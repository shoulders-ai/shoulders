import { eq } from 'drizzle-orm'
import { writeFile, mkdir } from 'fs/promises'
import { join, extname } from 'path'
import { useDb } from '../../db/index.js'
import { triages } from '../../db/schema.js'
import { convertDocx } from '../../utils/docx'
import { convertPdf } from '../../utils/pdfOcr'
import { calculateCostCents } from '../../utils/pricing'
import { extractReferences } from './referenceExtractor'
import { checkReferences } from './referenceChecker'
import { detectAiContent } from './pangramDetection'
import { findRelatedWork } from './noveltyCheck'
import { extractMetadata } from './metadataExtractor'
import { lookupAuthors } from './authorLookup'
import { runAssessment } from './assessmentAgent'

function updateTriage(id, data) {
  const db = useDb()
  if (data.techNotes && typeof data.techNotes === 'object') {
    data.techNotes = JSON.stringify(data.techNotes)
  }
  if (data.stepDetails && typeof data.stepDetails === 'object') {
    data.stepDetails = JSON.stringify(data.stepDetails)
  }
  db.update(triages).set(data).where(eq(triages.id, id)).run()
}

function addCost(totalCostCents, usage, model) {
  return totalCostCents + calculateCostCents(usage.input, usage.output, model, {
    cacheRead: usage.cacheRead || 0,
    cacheCreation: usage.cacheCreation || 0,
  })
}

export async function runTriagePipeline(id, buffer, filename, { journalScope, customInstructions } = {}) {
  const techNotes = { stages: {} }
  const totalUsage = { input: 0, output: 0 }
  let totalCostCents = 0

  // Step details accumulate for progressive UI
  const stepDetails = {}

  try {
    // ─── Save original file to disk ───
    const config = useRuntimeConfig()
    const dataDir = config.dataDir || '.data'
    const triageFilesDir = join(dataDir, 'triage-files')
    await mkdir(triageFilesDir, { recursive: true })
    const ext = extname(filename).toLowerCase() || '.pdf'
    const filePath = join(triageFilesDir, `${id}${ext}`)
    await writeFile(filePath, buffer)
    updateTriage(id, { filePath })
    console.log(`[Triage ${id}] Saved file: ${filePath}`)

    // ─── Step 0: Extract ───
    console.log(`[Triage ${id}] Step 0: Extract`)
    updateTriage(id, { currentStep: 'extracting', stepDetails })

    const isPdf = filename.toLowerCase().endsWith('.pdf')
    const extraction = isPdf
      ? await convertPdf(buffer)
      : await convertDocx(buffer)
    const { markdown } = extraction

    // Track OCR cost
    if (extraction.ocrUsage?.total_tokens) {
      const ocrTokens = extraction.ocrUsage.total_tokens
      totalUsage.input += ocrTokens
      totalCostCents += calculateCostCents(ocrTokens, 0, 'glm-ocr')
      techNotes.stages.ocr = { tokens: ocrTokens }
    }

    // Compute stats
    const wordCount = markdown.split(/\s+/).filter(Boolean).length
    const pageEstimate = isPdf ? Math.ceil(wordCount / 350) : null
    const tableCount = (markdown.match(/(?:^|\n)\|.+\|.+\|/g) || []).length > 0
      ? new Set(markdown.split('\n').reduce((acc, line, i, lines) => {
          if (/^\|.+\|/.test(line) && (i === 0 || !/^\|.+\|/.test(lines[i - 1]))) acc.push(i)
          return acc
        }, [])).size
      : 0
    const figureCount = new Set(
      (markdown.match(/\b(?:Figure|Fig\.?)\s*(\d+)/gi) || []).map(m => m.match(/\d+/)?.[0])
    ).size
    stepDetails.extracted = { wordCount, pageEstimate, chars: markdown.length, tableCount, figureCount }
    console.log(`[Triage ${id}] Extracted: ${wordCount} words, ~${pageEstimate || '?'} pages`)

    updateTriage(id, { markdown, stepDetails })

    // ─── Step 0a: Extract metadata (title, authors, abstract) ───
    console.log(`[Triage ${id}] Step 0a: Extract metadata`)
    let metadataResult = { title: null, authors: [], abstract: null, sections: [], appendix: false }
    try {
      const { metadata, usage: metaUsage } = await extractMetadata(markdown)
      metadataResult = metadata
      if (metaUsage) {
        totalUsage.input += metaUsage.input; totalUsage.output += metaUsage.output
        totalCostCents += calculateCostCents(metaUsage.input, metaUsage.output, 'gemini-2.5-flash-lite')
      }
      stepDetails.metadata = { title: !!metadata.title, authors: metadata.authors?.length || 0 }
      console.log(`[Triage ${id}] Metadata: "${metadata.title?.slice(0, 60) || '?'}", ${metadata.authors?.length || 0} authors`)
    } catch (e) {
      console.error(`[Triage ${id}] Metadata extraction failed:`, e.message)
      techNotes.stages.metadataError = e.message
    }
    updateTriage(id, { metadataJson: JSON.stringify(metadataResult), stepDetails })

    // ─── Step 0b: Extract structured references ───
    console.log(`[Triage ${id}] Step 0b: Extract references`)
    const { references, usage: refExtractUsage } = await extractReferences(markdown)
    if (refExtractUsage) {
      totalUsage.input += refExtractUsage.input; totalUsage.output += refExtractUsage.output
      totalCostCents += calculateCostCents(refExtractUsage.input, refExtractUsage.output, 'gemini-2.5-flash-lite')
    }

    stepDetails.referencesExtracted = { count: references.length }
    console.log(`[Triage ${id}] Extracted ${references.length} references`)
    updateTriage(id, { referencesJson: JSON.stringify(references), stepDetails })

    // ─── Step 1: Parallel checks (refs, pangram, novelty, author lookup) ───
    console.log(`[Triage ${id}] Step 1: Parallel checks`)
    updateTriage(id, { currentStep: 'checking', stepDetails })

    const [refCheckResult, pangramResult, noveltyResult, authorProfiles] = await Promise.all([
      checkReferences(references).catch(e => {
        console.error(`[Triage ${id}] Reference check failed:`, e.message)
        techNotes.stages.refCheckError = e.message
        return { results: [], summary: 'Reference check failed.', usage: { input: 0, output: 0 } }
      }),
      detectAiContent(markdown).catch(e => {
        console.error(`[Triage ${id}] Pangram failed:`, e.message)
        return { available: false, error: e.message }
      }),
      findRelatedWork(markdown).catch(e => {
        console.error(`[Triage ${id}] Novelty check failed:`, e.message)
        return { relatedPapers: [], queries: [], usage: { input: 0, output: 0 } }
      }),
      lookupAuthors(metadataResult.authors || []).catch(e => {
        console.error(`[Triage ${id}] Author lookup failed:`, e.message)
        return []
      }),
    ])

    // Track costs
    if (refCheckResult.usage) {
      totalUsage.input += refCheckResult.usage.input; totalUsage.output += refCheckResult.usage.output
      totalCostCents = addCost(totalCostCents, refCheckResult.usage, 'claude-sonnet-4-6')
    }
    if (noveltyResult.usage) {
      totalUsage.input += noveltyResult.usage.input; totalUsage.output += noveltyResult.usage.output
      totalCostCents += calculateCostCents(noveltyResult.usage.input, noveltyResult.usage.output, 'gemini-2.5-flash-lite')
    }

    // Build step details for progressive UI
    const verified = refCheckResult.results.filter(r => r.status === 'verified').length
    const errors = refCheckResult.results.filter(r => r.status === 'error').length
    const unverified = refCheckResult.results.filter(r => r.status === 'unverified').length
    stepDetails.referencesChecked = { verified, errors, unverified, total: refCheckResult.results.length }
    stepDetails.pangram = pangramResult.available
      ? { aiScore: pangramResult.aiScore, humanScore: pangramResult.humanScore }
      : { available: false }
    stepDetails.novelty = { paperCount: noveltyResult.relatedPapers.length }
    stepDetails.authorProfiles = { found: authorProfiles.filter(a => a.status === 'found').length, total: authorProfiles.length }

    console.log(`[Triage ${id}] Refs: ${verified} verified, ${errors} errors, ${unverified} unverified`)
    console.log(`[Triage ${id}] Pangram: ${pangramResult.available ? `${Math.round((pangramResult.aiScore || 0) * 100)}% AI` : 'unavailable'}`)
    console.log(`[Triage ${id}] Novelty: ${noveltyResult.relatedPapers.length} related papers`)
    console.log(`[Triage ${id}] Authors: ${authorProfiles.filter(a => a.status === 'found').length}/${authorProfiles.length} found`)

    updateTriage(id, {
      refCheckJson: JSON.stringify(refCheckResult),
      pangramJson: JSON.stringify(pangramResult),
      noveltyJson: JSON.stringify(noveltyResult),
      authorsJson: JSON.stringify(authorProfiles),
      stepDetails,
    })

    // ─── Step 2: Assessment ───
    console.log(`[Triage ${id}] Step 2: Assessment`)
    updateTriage(id, { currentStep: 'assessing', stepDetails })

    const { assessment, usage: assessmentUsage } = await runAssessment({
      markdown,
      refCheckResults: refCheckResult,
      pangramResult,
      noveltyResult,
      journalScope,
      customInstructions,
    })

    if (assessmentUsage) {
      totalUsage.input += assessmentUsage.input; totalUsage.output += assessmentUsage.output
      totalCostCents = addCost(totalCostCents, assessmentUsage, 'claude-sonnet-4-6')
    }

    techNotes.stages.assessment = { fields: Object.keys(assessment) }

    // ─── Complete ───
    updateTriage(id, {
      status: 'complete',
      currentStep: 'complete',
      assessmentJson: JSON.stringify(assessment),
      stepDetails,
      techNotes,
      costCents: totalCostCents,
      inputTokens: totalUsage.input,
      outputTokens: totalUsage.output,
      completedAt: new Date().toISOString(),
    })

    console.log(`[Triage ${id}] Complete. Cost=${totalCostCents}c, tokens=${totalUsage.input}in/${totalUsage.output}out`)
    return { success: true }

  } catch (e) {
    console.error(`[Triage ${id}] Pipeline error:`, e)
    techNotes.stages.fatal = e.message
    try {
      updateTriage(id, {
        status: 'failed',
        currentStep: 'failed',
        techNotes,
        stepDetails,
        costCents: totalCostCents,
        inputTokens: totalUsage.input,
        outputTokens: totalUsage.output,
      })
    } catch {}
    return { success: false, reason: e.message }
  }
}
