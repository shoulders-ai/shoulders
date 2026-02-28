import { eq } from 'drizzle-orm'
import { useDb } from '../../db/index.js'
import { triages } from '../../db/schema.js'
import { convertDocx } from '../../utils/docx'
import { convertPdf } from '../../utils/pdfOcr'
import { calculateCostCents } from '../../utils/pricing'
import { extractReferences } from './referenceExtractor'
import { checkReferences } from './referenceChecker'
import { detectAiContent } from './pangramDetection'
import { findRelatedWork } from './noveltyCheck'
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

export async function runTriagePipeline(id, buffer, filename) {
  const techNotes = { stages: {} }
  const totalUsage = { input: 0, output: 0 }
  let totalCostCents = 0

  // Step details accumulate for progressive UI
  const stepDetails = {}

  try {
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
    stepDetails.extracted = { wordCount, pageEstimate, chars: markdown.length }
    console.log(`[Triage ${id}] Extracted: ${wordCount} words, ~${pageEstimate || '?'} pages`)

    updateTriage(id, { markdown, stepDetails })

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

    // ─── Step 1: Parallel checks ───
    console.log(`[Triage ${id}] Step 1: Parallel checks`)
    updateTriage(id, { currentStep: 'checking', stepDetails })

    const [refCheckResult, pangramResult, noveltyResult] = await Promise.all([
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
    const corrected = refCheckResult.results.filter(r => r.status === 'corrected').length
    const notFound = refCheckResult.results.filter(r => r.status === 'not_found').length
    stepDetails.referencesChecked = { verified, corrected, notFound, total: refCheckResult.results.length }
    stepDetails.pangram = pangramResult.available
      ? { aiScore: pangramResult.aiScore, humanScore: pangramResult.humanScore }
      : { available: false }
    stepDetails.novelty = { paperCount: noveltyResult.relatedPapers.length }

    console.log(`[Triage ${id}] Refs: ${verified} verified, ${corrected} corrected, ${notFound} not found`)
    console.log(`[Triage ${id}] Pangram: ${pangramResult.available ? `${Math.round((pangramResult.aiScore || 0) * 100)}% AI` : 'unavailable'}`)
    console.log(`[Triage ${id}] Novelty: ${noveltyResult.relatedPapers.length} related papers`)

    updateTriage(id, {
      refCheckJson: JSON.stringify(refCheckResult),
      pangramJson: JSON.stringify(pangramResult),
      noveltyJson: JSON.stringify(noveltyResult),
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
