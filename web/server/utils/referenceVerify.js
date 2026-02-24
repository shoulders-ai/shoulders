const MAX_CONCURRENT = 5
const REF_CAP = 30
const CROSSREF_BASE = 'https://api.crossref.org'
const OPENALEX_BASE = 'https://api.openalex.org'

async function fetchJson(url, headers = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'Shoulders/1.0 (mailto:service@shoulde.rs)', ...headers } })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
  finally { clearTimeout(timeout) }
}

function parseCrossrefItem(m) {
  return {
    source: 'crossref',
    title: m.title?.[0] || '',
    year: m.published?.['date-parts']?.[0]?.[0] || m['published-print']?.['date-parts']?.[0]?.[0] || null,
    authors: (m.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ')).join(', '),
    journal: m['container-title']?.[0] || '',
    doi: m.DOI || '',
  }
}

function parseOpenAlexItem(r) {
  return {
    source: 'openalex',
    title: r.display_name || '',
    year: r.publication_year || null,
    authors: (r.authorships || []).map(a => a.author?.display_name).filter(Boolean).join(', '),
    journal: r.primary_location?.source?.display_name || '',
    doi: r.doi?.replace(/^https?:\/\/doi\.org\//i, '') || '',
  }
}

async function crossrefLookupDoi(doi) {
  const cleaned = doi.replace(/^https?:\/\/doi\.org\//i, '')
  const data = await fetchJson(`${CROSSREF_BASE}/works/${encodeURIComponent(cleaned)}`)
  if (!data?.message) return []
  return [parseCrossrefItem(data.message)]
}

async function crossrefSearch(query, author) {
  const q = encodeURIComponent(query.slice(0, 250))
  const url = author
    ? `${CROSSREF_BASE}/works?query.bibliographic=${q}&query.author=${encodeURIComponent(author.split(/[,&]/)[0].trim())}&rows=3`
    : `${CROSSREF_BASE}/works?query.bibliographic=${q}&rows=3`
  const data = await fetchJson(url)
  return (data?.message?.items || []).map(parseCrossrefItem)
}

async function openalexSearch(title) {
  const config = useRuntimeConfig()
  const filter = `title.search:${encodeURIComponent(title.slice(0, 200))}`
  let url = `${OPENALEX_BASE}/works?filter=${filter}&per_page=3`
  if (config.openalexApiKey) url += `&api_key=${config.openalexApiKey}`
  const data = await fetchJson(url, config.openalexApiKey ? {} : { 'User-Agent': 'Shoulders/1.0 (mailto:service@shoulde.rs)' })
  return (data?.results || []).map(parseOpenAlexItem)
}

async function searchSingleRef(ref) {
  try {
    const results = []

    // 1. DOI lookup
    if (ref.doi) {
      const doiResults = await crossrefLookupDoi(ref.doi)
      results.push(...doiResults)
    }

    // 2. Title search (Crossref + OpenAlex) — skip if DOI already found something
    if (ref.title && results.length === 0) {
      const crResults = await crossrefSearch(ref.title, ref.authors)
      results.push(...crResults)
      if (results.length === 0) {
        const oaResults = await openalexSearch(ref.title)
        results.push(...oaResults)
      }
    }

    // 3. Raw text fallback — skip if already found something
    if (ref.raw && results.length === 0) {
      const rawResults = await crossrefSearch(ref.raw)
      results.push(...rawResults)
    }

    return { key: ref.key, results: results.slice(0, 3) }
  } catch (e) {
    return { key: ref.key, results: [], error: e.message }
  }
}

export async function searchReferences(refs) {
  const capped = refs.slice(0, REF_CAP)
  const results = []

  for (let i = 0; i < capped.length; i += MAX_CONCURRENT) {
    const batch = capped.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.all(batch.map(searchSingleRef))
    results.push(...batchResults)
  }

  if (refs.length > REF_CAP) {
    results.push({ key: '_skipped', results: [], note: `${refs.length - REF_CAP} references skipped (cap: ${REF_CAP})` })
  }

  return results
}
