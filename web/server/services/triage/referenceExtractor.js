import { callGemini } from '../../utils/ai'

const SYSTEM_PROMPT = `You are a bibliography parser. Extract structured reference data from the bibliography/references section of an academic paper.

Return a JSON array of objects with these fields:
- key: the reference identifier as it appears in the paper (e.g. "[1]", "[Smith2020]", "1.")
- title: the paper/book title
- authors: author names as they appear
- year: publication year (string)
- doi: DOI if present (string, without URL prefix)
- journal: journal or venue name if present
- raw: the full verbatim text of the bibliography entry

Only extract entries from the bibliography/references section. If no bibliography section exists, return an empty array.

Return ONLY the JSON array, no other text.`

/**
 * Extract structured references from paper markdown using Gemini Flash Lite.
 * Returns { references: [...], usage }
 */
export async function extractReferences(markdown) {
  // Find the bibliography section
  const bibMatch = markdown.match(/\n#{1,3}\s*(references|bibliography|works cited|literature cited)\b/i)
  if (!bibMatch) {
    return { references: [], usage: { input: 0, output: 0 } }
  }

  // Send the last portion of the paper (bibliography is at the end)
  const bibStart = bibMatch.index
  const bibSection = markdown.slice(Math.max(0, bibStart - 500), bibStart + 50000)

  const { text, usage } = await callGemini({
    model: 'gemini-2.5-flash-lite',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Extract references from this bibliography section:\n\n${bibSection}` }],
    maxTokens: 8000,
  })

  let references = []
  try {
    // Strip markdown code fences if present
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    references = JSON.parse(cleaned)
    if (!Array.isArray(references)) references = []
  } catch {
    console.error('[referenceExtractor] Failed to parse Gemini response:', text.slice(0, 200))
  }

  return { references, usage }
}
