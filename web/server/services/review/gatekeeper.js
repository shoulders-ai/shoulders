import { callGemini } from '../../utils/ai'

const SYSTEM_PROMPT = `You are a gatekeeper for an academic peer review service. Your job is to determine whether a submitted document is a research paper, academic report, or similar scholarly work that can meaningfully be peer-reviewed.

Respond with a JSON object:
{
  "eligible": true/false,
  "domain_hint": "e.g. health economics, computer science, psychology" (or null),
  "reason": "brief explanation"
}

ELIGIBLE: Research papers, systematic reviews, meta-analyses, case studies, technical reports, thesis chapters, grant proposals, pre-prints.

NOT ELIGIBLE: CVs/resumes, cover letters, personal essays, fiction, recipes, random text, blank documents, spreadsheet data, presentations, letters, forms.

If the document is health economics, health technology assessment, or health research, note this in the domain_hint.`

export async function runGatekeeper(plainText) {
  const excerpt = plainText.slice(0, 8000)

  const { text, usage } = await callGemini({
    model: 'gemini-2.5-flash-lite',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Evaluate this document:\n\n${excerpt}` }],
    maxTokens: 200,
  })

  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleaned)
    return { ...result, usage }
  } catch {
    return { eligible: true, domain_hint: null, reason: 'Could not parse gatekeeper response', usage }
  }
}
