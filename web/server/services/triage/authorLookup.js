const OPENALEX_BASE = 'https://api.openalex.org'

/**
 * Look up a single author on OpenAlex.
 * Tries name + affiliation filter first, falls back to name-only search.
 */
async function lookupAuthor({ name, affiliation }) {
  if (!name) return { name, status: 'not_found' }

  const headers = { 'User-Agent': 'Shoulders/1.0 (mailto:service@shoulde.rs)' }

  // Try with affiliation filter first (more precise)
  if (affiliation) {
    const filter = `display_name.search:${encodeURIComponent(name)},last_known_institutions.display_name.search:${encodeURIComponent(affiliation)}`
    const url = `${OPENALEX_BASE}/authors?filter=${filter}&per_page=1`
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers })
      if (res.ok) {
        const data = await res.json()
        const author = data.results?.[0]
        if (author) return formatAuthor(author, name)
      }
    } catch {}
  }

  // Fallback: name-only search
  const url = `${OPENALEX_BASE}/authors?search=${encodeURIComponent(name)}&per_page=3`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers })
    if (!res.ok) return { name, status: 'not_found' }
    const data = await res.json()

    if (!data.results?.length) return { name, status: 'not_found' }

    // If affiliation was provided, try to match
    if (affiliation) {
      const affiliationLower = affiliation.toLowerCase()
      const match = data.results.find(a => {
        const inst = a.last_known_institutions?.[0]?.display_name?.toLowerCase() || ''
        return inst.includes(affiliationLower) || affiliationLower.includes(inst)
      })
      if (match) return formatAuthor(match, name)
    }

    // Take first result
    return formatAuthor(data.results[0], name)
  } catch {
    return { name, status: 'not_found' }
  }
}

function formatAuthor(oaAuthor, originalName) {
  return {
    name: originalName,
    openalex_name: oaAuthor.display_name || originalName,
    institution: oaAuthor.last_known_institutions?.[0]?.display_name || null,
    works_count: oaAuthor.works_count || 0,
    cited_by_count: oaAuthor.cited_by_count || 0,
    orcid: oaAuthor.orcid?.replace('https://orcid.org/', '') || null,
    openalex_id: oaAuthor.id || null,
    status: 'found',
  }
}

/**
 * Look up author profiles on OpenAlex.
 * Takes up to 5 authors (first, second, last, corresponding).
 * No API key needed — OpenAlex is free, rate limit 10/sec.
 */
export async function lookupAuthors(authors) {
  if (!authors?.length) return []

  // Select up to 5: first two, last, and any others up to 5
  const selected = []
  if (authors.length <= 5) {
    selected.push(...authors)
  } else {
    selected.push(authors[0], authors[1])
    if (authors.length > 2) selected.push(authors[authors.length - 1])
    // Fill remaining slots from the middle
    for (let i = 2; i < authors.length - 1 && selected.length < 5; i++) {
      selected.push(authors[i])
    }
  }

  // Look up in parallel (respecting 10/sec rate limit — max 5 concurrent is fine)
  const profiles = await Promise.all(selected.map(a => lookupAuthor(a)))
  return profiles
}
