import { callAnthropic } from '../../utils/ai'

const SYSTEM_PROMPT = `You are an experienced academic editor assessing a manuscript for editorial desk decision. You write like a knowledgeable colleague — specific, grounded in the paper's content, measured in tone.

You will receive:
1. The paper's full text (markdown)
2. Reference verification results
3. AI content detection results (if available)
4. Related work from the literature

Produce a structured assessment as JSON with these fields. Each field is a short, well-written paragraph (1-3 sentences). Every sentence must reference something concrete from the paper — no generic observations, no hedging language ("it appears that..."), no empty praise ("the paper is well-written").

{
  "summary": "2-3 sentence overview — what this paper does, whether it does it well, and the one thing an editor most needs to know",
  "scope": "What kind of paper this is and what journals it fits. Be specific about the domain.",
  "significance": "Is this incremental, a genuine contribution, or something larger? Why? Reference the specific claim or finding.",
  "credibility": "What the author information and institutional signals suggest. If no author info is available, say so.",
  "craft": "Writing quality, figure quality, structure. Reference specific sections or figures.",
  "methods": "Key methodological observations. Flag concerns with specific details (sample sizes, missing analyses, unstated assumptions).",
  "strategic_value": "Is the topic active/growing? Would this attract citations? Why or why not?",
  "ai_content": "Interpret the AI detection data in context. What does the pattern suggest about how AI was used?",
  "references_interpretation": "What do the reference verification results suggest about the paper's scholarly rigor?",
  "novelty_interpretation": "What does the related work landscape suggest about this paper's positioning?"
}

CRITICAL RULES:
- Write as a specific, grounded colleague — not a generic reviewer
- No scores, no ratings, no recommendation badges
- No hedging: "it appears" → say what IS. "the authors seem to" → say what they DO
- No generic praise: "well-structured" is only acceptable if you name WHICH structure and WHY it works
- Every sentence must earn its place with a concrete reference to the paper
- If you can't assess something (e.g., no author info, no AI data), say so directly
- If AI content data is unavailable, acknowledge it in ai_content: "AI content detection was not available for this assessment."

Return ONLY the JSON object, no other text.`

/**
 * Run the assessment agent — single Claude Sonnet call.
 * Receives paper + all pipeline results, outputs qualitative assessment.
 */
export async function runAssessment({ markdown, refCheckResults, pangramResult, noveltyResult }) {
  const parts = [`# Paper\n\n${markdown.slice(0, 120000)}`]

  // Reference check results
  if (refCheckResults?.results?.length) {
    const verified = refCheckResults.results.filter(r => r.status === 'verified').length
    const corrected = refCheckResults.results.filter(r => r.status === 'corrected')
    const notFound = refCheckResults.results.filter(r => r.status === 'not_found').length

    let refSummary = `\n\n# Reference Verification\n${verified} verified, ${corrected.length} corrected, ${notFound} not found out of ${refCheckResults.results.length} total.`
    if (corrected.length) {
      refSummary += '\n\nCorrected references:\n' + corrected.map(r => `- ${r.key}: ${r.note || 'discrepancy found'}`).join('\n')
    }
    parts.push(refSummary)
  } else {
    parts.push('\n\n# Reference Verification\nNo references were checked.')
  }

  // Pangram results
  if (pangramResult?.available) {
    const aiPct = Math.round((pangramResult.aiScore || 0) * 100)
    const humanPct = Math.round((pangramResult.humanScore || 0) * 100)
    parts.push(`\n\n# AI Content Detection (Pangram)\n${aiPct}% AI-assisted, ${humanPct}% human.`)
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
