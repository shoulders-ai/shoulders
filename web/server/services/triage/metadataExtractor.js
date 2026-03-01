import { callGemini } from '../../utils/ai'

const SYSTEM_PROMPT = `You are a metadata extraction tool. Given the beginning of an academic paper (converted from PDF/DOCX to markdown), extract structured metadata.

Return a JSON object with this exact structure:

{
  "title": "Full paper title exactly as it appears",
  "authors": [
    { "name": "First Last", "affiliation": "University/Institution if stated" }
  ],
  "abstract": "Full abstract text if present",
  "sections": ["Introduction", "Methods", "Results", ...],
  "appendix": true/false
}

Rules:
- title: Extract the actual title, not a description. If not clearly identifiable, use null.
- authors: Extract all authors with affiliations if listed. If affiliations are numbered/footnoted, match them. If none found, return empty array.
- abstract: The full abstract text. If labeled "Abstract" or "Summary", include the content. If none found, use null.
- sections: Main section headings only (not subsections). Extract from markdown headers or bold/caps section labels.
- appendix: true if any appendix/supplementary section exists.

Return ONLY the JSON object, no other text.`

/**
 * Extract title, authors, abstract, and sections from paper markdown.
 * Uses Gemini Flash Lite — cheap and fast (~2-3 seconds, ~$0.001).
 */
export async function extractMetadata(markdown) {
  // First ~5000 chars should contain title, authors, abstract
  const snippet = markdown.slice(0, 5000)

  const { text, usage } = await callGemini({
    model: 'gemini-2.5-flash-lite',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Extract metadata from this paper:\n\n${snippet}` }],
    maxTokens: 2000,
  })

  let metadata = null
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    metadata = JSON.parse(cleaned)
  } catch {
    console.error('[metadataExtractor] Failed to parse response:', text.slice(0, 300))
    metadata = { title: null, authors: [], abstract: null, sections: [], appendix: false }
  }

  return { metadata, usage }
}
