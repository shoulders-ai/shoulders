import { callGemini } from '../../utils/ai'

const OPENALEX_BASE = 'https://api.openalex.org'

const QUERY_PROMPT = `You are an academic search strategist. Given a paper's title and abstract (or first few paragraphs), generate 3-5 search queries to find closely related prior work.

Each query should target a different angle:
1. The core research question or methodology
2. The specific domain/application area
3. Key terms that would appear in competing/overlapping work

Return a JSON array of query strings. Each query should be 3-8 words, specific enough to find closely related papers (not just papers in the same field).

Return ONLY the JSON array, no other text.`

async function fetchOpenAlex(query) {
  const config = useRuntimeConfig()
  const filter = `title_and_abstract.search:${encodeURIComponent(query.slice(0, 200))}`
  let url = `${OPENALEX_BASE}/works?filter=${filter}&per_page=5&sort=relevance_score:desc`
  if (config.openalexApiKey) url += `&api_key=${config.openalexApiKey}`

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Shoulders/1.0 (mailto:service@shoulde.rs)' },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map(r => ({
      title: r.display_name || '',
      year: r.publication_year || null,
      authors: (r.authorships || []).slice(0, 3).map(a => a.author?.display_name).filter(Boolean).join(', '),
      journal: r.primary_location?.source?.display_name || '',
      doi: r.doi?.replace(/^https?:\/\/doi\.org\//i, '') || '',
      citedByCount: r.cited_by_count || 0,
      openalexId: r.id || '',
    }))
  } catch {
    return []
  }
}

/**
 * Find related work via Gemini-generated queries + OpenAlex search.
 * Returns { relatedPapers: [...], queries: [...], usage }
 */
export async function findRelatedWork(markdown) {
  // Extract title + first ~3000 chars for query generation
  const snippet = markdown.slice(0, 4000)

  const { text, usage } = await callGemini({
    model: 'gemini-2.5-flash-lite',
    system: QUERY_PROMPT,
    messages: [{ role: 'user', content: `Generate search queries for this paper:\n\n${snippet}` }],
    maxTokens: 1000,
  })

  let queries = []
  try {
    const cleaned = text.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim()
    queries = JSON.parse(cleaned)
    if (!Array.isArray(queries)) queries = []
  } catch {
    console.error('[noveltyCheck] Failed to parse queries:', text.slice(0, 200))
    return { relatedPapers: [], queries: [], usage }
  }

  // Search OpenAlex with all queries in parallel
  const allResults = await Promise.all(queries.map(q => fetchOpenAlex(q)))
  const flat = allResults.flat()

  // Deduplicate by DOI or title
  const seen = new Set()
  const deduplicated = []
  for (const paper of flat) {
    const key = paper.doi || paper.title.toLowerCase().slice(0, 80)
    if (seen.has(key)) continue
    seen.add(key)
    deduplicated.push(paper)
  }

  // Sort by citation count descending, take top 10
  deduplicated.sort((a, b) => b.citedByCount - a.citedByCount)
  const relatedPapers = deduplicated.slice(0, 10)

  return { relatedPapers, queries, usage }
}
