import { callAnthropic } from '../../utils/ai'

const SYSTEM_PROMPT = `You are an experienced academic editor performing a structured desk triage. You produce concise, data-oriented assessments — not essays.

You will receive the paper's full text, reference verification results, AI content detection results, related work from the literature, and optionally a target journal scope and custom instructions.

Return a JSON object with this exact structure:

{
  "verdict": "2-3 sentences: the TL;DR of the entire ASSESSMENT (not paper summary). What would a senior colleague say after reviewing this? Be direct.",
  "scope_fit": {
    "headline": "Target journals or domain fit in ≤12 words",
    "detail": "2-3 sentences on fit with specifics"
  },
  "impact": {
    "headline": "Academic + practical impact summary in ≤12 words",
    "citation_forecast": {
      "point_estimate": 28,
      "range_low": 12,
      "range_high": 55,
      "horizon_months": 24,
      "reasoning": "1-2 sentences citing specific comparables from related work with their citation rates"
    }
  },
  "methodology": {
    "status": "clear",
    "headline": "Key methodological character in ≤12 words",
    "detail": "2-3 sentences: design, sample, limitations"
  },
  "writing": {
    "status": "clear",
    "headline": "Writing quality verdict in ≤12 words",
    "detail": "2-3 sentences citing specific sections/structures"
  },
  "contribution": {
    "headline": "What's genuinely new in ≤12 words",
    "detail": "2-3 sentences: novelty claim, how it compares to related work found, significance"
  },
  "references_summary": "Counts + key finding in 1 sentence (e.g. '39/45 verified, 1 error in ref 6 (missing authors), 5 unverified grey lit')",
  "novelty_summary": "Paper count + key finding in 1 sentence (e.g. '10 papers found. Closest: Franklin 2017 (24 cit). SWD-specific ethical argument is underexplored.')"
}

STATUS VALUES for methodology and writing:
- "clear" — no concerns (renders as ✓)
- "warning" — minor issues worth noting (renders as ⚠)
- "concern" — significant issues (renders as ✗)

CRITICAL RULES:
- verdict: This is the ASSESSMENT verdict, not a paper summary. Think: "What does a busy editor need to know in 10 seconds?" Be direct, no hedging.
- Headlines are STATUS REPORTS, not sentences. Max 12 words. No articles ("the", "a"), no hedging.
- Every claim must reference something concrete from the paper or the data provided.
- citation_forecast: Fermi estimate with concrete numbers. Use related work citation counts ÷ years to calibrate field velocity. A niche bioethics paper in a mid-tier journal: 5-20 in 24mo. A methods paper in a top journal: 50-200 in 24mo.
- contribution.detail MUST embed related work context — mention specific papers from the related work list and how this paper differs.
- If target journal is specified, assess scope_fit specifically against it.
- No scores, no ratings, no recommendation badges.
- No hedging: "it appears" → say what IS.
- Do NOT extract title/authors/abstract — that's handled separately.
- Do NOT produce author credibility assessment — that's handled by OpenAlex data.
- If AI content data is unavailable, omit ai_content references from the verdict.

Return ONLY the JSON object, no other text.`

/**
 * Run the assessment agent — single Claude Sonnet call.
 * Receives paper + all pipeline results, outputs structured assessment.
 */
export async function runAssessment({ markdown, refCheckResults, pangramResult, noveltyResult, journalScope, customInstructions }) {
  const parts = [`# Paper\n\n${markdown.slice(0, 120000)}`]

  // Reference check results
  if (refCheckResults?.results?.length) {
    const verified = refCheckResults.results.filter(r => r.status === 'verified').length
    const errors = refCheckResults.results.filter(r => r.status === 'error')
    const unverified = refCheckResults.results.filter(r => r.status === 'unverified')

    let refSummary = `\n\n# Reference Verification\n${verified} verified, ${errors.length} errors, ${unverified.length} unverified out of ${refCheckResults.results.length} total.`
    if (errors.length) {
      refSummary += '\n\nReferences with errors:\n' + errors.map(r => `- ${r.key}: ${r.note || 'metadata error found'}`).join('\n')
    }
    if (unverified.length) {
      refSummary += '\n\nUnverified references:\n' + unverified.map(r => `- ${r.key}: ${r.note || 'could not be verified'}`).join('\n')
    }
    parts.push(refSummary)
  } else {
    parts.push('\n\n# Reference Verification\nNo references were checked.')
  }

  // Pangram results
  if (pangramResult?.available) {
    const aiPct = Math.round((pangramResult.aiScore || 0) * 100)
    const humanPct = Math.round((pangramResult.humanScore || 0) * 100)
    const prediction = pangramResult.prediction ? ` Classification: ${pangramResult.prediction}.` : ''
    parts.push(`\n\n# AI Content Detection (Pangram)\n${aiPct}% AI, ${humanPct}% human.${prediction}`)
  } else {
    parts.push('\n\n# AI Content Detection\nNot available.')
  }

  // Novelty / related work
  if (noveltyResult?.relatedPapers?.length) {
    const papers = noveltyResult.relatedPapers.slice(0, 10).map(p =>
      `- "${p.title}" (${p.year || '?'}) — ${p.journal || 'unknown venue'}${p.citedByCount ? `, ${p.citedByCount} citations` : ''}`
    ).join('\n')
    parts.push(`\n\n# Related Work Found\n${papers}`)
  } else {
    parts.push('\n\n# Related Work\nNo closely related papers found.')
  }

  // Target journal
  if (journalScope) {
    parts.push(`\n\n# Target Journal\n${journalScope}`)
  }

  // Custom instructions
  if (customInstructions) {
    parts.push(`\n\n# Additional Instructions\n${customInstructions}`)
  }

  const { text, usage } = await callAnthropic({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: parts.join('') }],
    maxTokens: 4096,
    maxSteps: 1,
  })

  let assessment = null
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    assessment = JSON.parse(cleaned)
  } catch {
    console.error('[assessmentAgent] Failed to parse response:', text.slice(0, 300))
    throw new Error('Assessment agent returned invalid JSON')
  }

  return { assessment, usage }
}
