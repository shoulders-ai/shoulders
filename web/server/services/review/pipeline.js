import { eq } from 'drizzle-orm'
import { useDb } from '../../db/index.js'
import { reviews } from '../../db/schema.js'
import { convertDocx } from '../../utils/docx'
import { convertPdf } from '../../utils/pdfOcr'
import { anchorCommentsInHtml } from '../../utils/anchorComments'
import { calculateCostCents } from '../../utils/pricing'
import { sendReviewEmail } from '../../utils/reviewEmail'
import { runGatekeeper } from './gatekeeper'
import { runTechnicalReview } from './agents/technicalReviewer'
import { runEditorialReview } from './agents/editorialReviewer'
import { runReferenceCheck } from './agents/referenceChecker'
import { writeReport } from './agents/reportWriter'

const AGENT_TIMEOUT = 600_000
const MAX_PAPER_CHARS = 150_000

function deduplicateComments(comments) {
  const seen = new Set()
  return comments.filter(c => {
    const key = c.text_snippet?.trim()?.replace(/\s+/g, ' ')
    if (!key) return true
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function updateReview(id, data) {
  const db = useDb()
  if (data.techNotes && typeof data.techNotes === 'object') {
    data.techNotes = JSON.stringify(data.techNotes)
  }
  db.update(reviews).set(data).where(eq(reviews.id, id)).run()
}

function addCacheAwareCost(totalCostCents, usage, model) {
  return totalCostCents + calculateCostCents(usage.input, usage.output, model, {
    cacheRead: usage.cacheRead || 0,
    cacheCreation: usage.cacheCreation || 0,
  })
}

export async function runReviewPipeline(id, buffer, filename, email) {
  const techNotes = { stages: {} }
  const totalUsage = { input: 0, output: 0 }
  let totalCostCents = 0

  try {
    // Stage 1: Extract
    console.log(`[Review ${id}] Stage 1: Extract`)
    const isPdf = filename.toLowerCase().endsWith('.pdf')
    const extraction = isPdf
      ? await convertPdf(buffer)
      : await convertDocx(buffer)
    const { html, markdown, images } = extraction
    console.log(`[Review ${id}] Extracted (${isPdf ? 'pdf' : 'docx'}): html=${html.length} chars, md=${markdown.length} chars, images=${images.length}`)

    // Track OCR cost for PDF extraction
    if (extraction.ocrUsage?.total_tokens) {
      const ocrTokens = extraction.ocrUsage.total_tokens
      totalUsage.input += ocrTokens
      totalCostCents += calculateCostCents(ocrTokens, 0, 'glm-ocr')
      techNotes.stages.ocr = { tokens: ocrTokens }
    }

    updateReview(id, { html, markdown, status: 'processing' })

    // Stage 2: Gatekeeper
    console.log(`[Review ${id}] Stage 2: Gatekeeper`)
    const gateResult = await runGatekeeper(markdown)
    console.log(`[Review ${id}] Gatekeeper:`, JSON.stringify({ eligible: gateResult.eligible, domain_hint: gateResult.domain_hint }))
    techNotes.stages.gatekeeper = gateResult
    if (gateResult.usage) {
      totalUsage.input += gateResult.usage.input
      totalUsage.output += gateResult.usage.output
      totalCostCents += calculateCostCents(gateResult.usage.input, gateResult.usage.output, 'gemini-2.5-flash-lite')
    }

    if (!gateResult.eligible) {
      updateReview(id, { status: 'failed', techNotes: { ...techNotes, rejectionReason: gateResult.reason } })
      await sendReviewEmail(email, getSlug(id), 'failed')
      return { success: false, reason: gateResult.reason }
    }

    updateReview(id, { domainHint: gateResult.domain_hint })

    // Truncate paper for review agents if too long
    let reviewMarkdown = markdown
    if (markdown.length > MAX_PAPER_CHARS) {
      reviewMarkdown = markdown.slice(0, MAX_PAPER_CHARS) +
        `\n\n---\n\nNote: This paper was truncated for review (original: ${markdown.length} characters, limit: ${MAX_PAPER_CHARS}). The review covers only the content above. Please mention in your comments that later sections were not reviewed.`
      console.log(`[Review ${id}] Paper truncated: ${markdown.length} → ${MAX_PAPER_CHARS} chars`)
      techNotes.stages.paperTruncated = { original: markdown.length, limit: MAX_PAPER_CHARS }
    }

    // Stage 3: Review agents (parallel) — images sent directly to Sonnet
    console.log(`[Review ${id}] Stage 3: Review agents (parallel)`)

    const techShared = { allValid: [], techNotes: [] }
    const editShared = { allValid: [], techNotes: [] }
    const refShared = { allValid: [], techNotes: [] }

    const runAgent = async (fn, md, imgs, shared, label) => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          return await Promise.race([
            fn(md, imgs, shared),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Agent timeout')), AGENT_TIMEOUT)),
          ])
        } catch (e) {
          const cause = e.cause ? ` (cause: ${e.cause.message || e.cause.code || e.cause})` : ''
          console.error(`[Review ${id}] ${label} FAILED (attempt ${attempt}/2): ${e.message}${cause}`)
          if (attempt === 2) return null
          await new Promise(r => setTimeout(r, 5_000))
          console.log(`[Review ${id}] ${label} retrying...`)
        }
      }
      return null
    }

    const [technicalResult, editorialResult, referenceResult] = await Promise.all([
      runAgent(runTechnicalReview, reviewMarkdown, images, techShared, 'Technical reviewer'),
      runAgent(runEditorialReview, reviewMarkdown, images, editShared, 'Editorial reviewer'),
      runAgent(runReferenceCheck, reviewMarkdown, images, refShared, 'Reference checker'),
    ])

    const technicalComments = (technicalResult?.comments || techShared.allValid.map(c => ({ ...c, reviewer: 'Technical Reviewer' })))
    const editorialComments = (editorialResult?.comments || editShared.allValid.map(c => ({ ...c, reviewer: 'Editorial Reviewer' })))
    const referenceComments = (referenceResult?.comments || refShared.allValid.map(c => ({ ...c, reviewer: 'Reference Checker' })))
    const citationSummary = referenceResult?.summary || null

    if (technicalResult?.usage) {
      totalUsage.input += technicalResult.usage.input; totalUsage.output += technicalResult.usage.output
      totalCostCents = addCacheAwareCost(totalCostCents, technicalResult.usage, 'claude-sonnet-4-6')
    }
    if (editorialResult?.usage) {
      totalUsage.input += editorialResult.usage.input; totalUsage.output += editorialResult.usage.output
      totalCostCents = addCacheAwareCost(totalCostCents, editorialResult.usage, 'claude-sonnet-4-6')
    }
    if (referenceResult?.usage) {
      totalUsage.input += referenceResult.usage.input; totalUsage.output += referenceResult.usage.output
      totalCostCents = addCacheAwareCost(totalCostCents, referenceResult.usage, 'claude-sonnet-4-6')
    }

    console.log(`[Review ${id}] Technical: ${technicalComments.length} comments${!technicalResult ? ' (partial)' : ''}`)
    console.log(`[Review ${id}] Editorial: ${editorialComments.length} comments${!editorialResult ? ' (partial)' : ''}`)
    console.log(`[Review ${id}] Reference: ${referenceComments.length} comments, summary: ${citationSummary ? 'yes' : 'no'}`)

    const allComments = deduplicateComments([...technicalComments, ...editorialComments, ...referenceComments])
    techNotes.stages.technicalReviewer = { commentCount: technicalComments.length, timedOut: !technicalResult }
    techNotes.stages.editorialReviewer = { commentCount: editorialComments.length, timedOut: !editorialResult }
    techNotes.stages.referenceChecker = { commentCount: referenceComments.length, summary: !!citationSummary, timedOut: !referenceResult }

    if (allComments.length === 0) {
      updateReview(id, { status: 'failed', techNotes })
      await sendReviewEmail(email, getSlug(id), 'failed')
      return { success: false, reason: 'Review agents failed to produce comments' }
    }

    // Stage 4: Report
    console.log(`[Review ${id}] Stage 4: Report (${allComments.length} comments)`)
    let report = null
    try {
      const reportResult = await writeReport(markdown, allComments, { citationSummary })
      report = reportResult.text
      if (reportResult.usage) {
        totalUsage.input += reportResult.usage.input; totalUsage.output += reportResult.usage.output
        totalCostCents = addCacheAwareCost(totalCostCents, reportResult.usage, 'claude-sonnet-4-6')
      }
      techNotes.stages.report = { length: report?.length }
    } catch (e) {
      console.error(`[Review ${id}] Report failed:`, e.message)
      techNotes.stages.report = { error: e.message }
    }

    // Stage 5: Anchor comments in HTML
    console.log(`[Review ${id}] Stage 5: Anchor comments`)
    const commentsForAnchoring = allComments.map((c, i) => ({
      id: `comment-${i + 1}`,
      text_snippet: c.text_snippet,
      severity: c.severity,
    }))
    const anchoredHtml = anchorCommentsInHtml(html, commentsForAnchoring)

    // Number comments and build final JSON
    const numberedComments = allComments.map((c, i) => ({
      id: `comment-${i + 1}`,
      number: i + 1,
      reviewer: c.reviewer,
      severity: c.severity,
      text_snippet: c.text_snippet,
      content: c.content,
    }))

    // Cost already accumulated per-model above
    const costCents = totalCostCents

    // Mark complete
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

    updateReview(id, {
      status: 'complete',
      report,
      commentsJson: JSON.stringify(numberedComments),
      anchoredHtml,
      techNotes,
      costCents,
      inputTokens: totalUsage.input,
      outputTokens: totalUsage.output,
      completedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })

    console.log(`[Review ${id}] Complete. ${numberedComments.length} comments, cost=${costCents}c`)
    await sendReviewEmail(email, getSlug(id), 'complete')
    return { success: true }

  } catch (e) {
    console.error(`[Review ${id}] Pipeline error:`, e)
    techNotes.stages.fatal = e.message
    try { updateReview(id, { status: 'failed', techNotes }) } catch {}
    await sendReviewEmail(email, getSlug(id), 'failed').catch(() => {})
    return { success: false, reason: e.message }
  }
}

function getSlug(id) {
  const db = useDb()
  const row = db.select({ slug: reviews.slug }).from(reviews).where(eq(reviews.id, id)).get()
  return row?.slug
}
