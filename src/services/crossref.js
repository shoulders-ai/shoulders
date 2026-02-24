import { invoke } from '@tauri-apps/api/core'

const CROSSREF_API = 'https://api.crossref.org/works'
const DOI_ORG = 'https://doi.org'

function normalizeDoi(doi) {
  return doi
    .replace(/^https?:\/\/doi\.org\//i, '')
    .replace(/^doi:\s*/i, '')
    .trim()
}

async function fetchJson(url, headers = {}) {
  try {
    const result = await invoke('proxy_api_call', {
      request: {
        url,
        method: 'GET',
        headers: { 'User-Agent': 'Shoulders/1.0 (mailto:user@example.com)', ...headers },
        body: '',
      },
    })
    return JSON.parse(result)
  } catch (e) {
    console.warn('CrossRef fetch failed:', url, e)
    return null
  }
}

/**
 * Look up a DOI via CrossRef API.
 * Returns CSL-JSON or null.
 */
export async function lookupByDoi(doi) {
  const normalized = normalizeDoi(doi)
  if (!normalized) return null

  // Try CrossRef works endpoint
  const data = await fetchJson(`${CROSSREF_API}/${encodeURIComponent(normalized)}`)
  if (data?.status === 'ok' && data.message) {
    return crossrefToCsl(data.message)
  }

  // Fallback: DOI content negotiation
  try {
    const result = await invoke('proxy_api_call', {
      request: {
        url: `${DOI_ORG}/${encodeURIComponent(normalized)}`,
        method: 'GET',
        headers: { Accept: 'application/vnd.citationstyles.csl+json' },
        body: '',
      },
    })
    const csl = JSON.parse(result)
    if (csl && csl.type) return csl
  } catch (e) {
    // Content negotiation failed
  }

  return null
}

/**
 * Search CrossRef by metadata (title, author, year).
 * Returns best match above threshold, or null.
 */
export async function searchByMetadata(title, author, year) {
  if (!title) return null

  const params = new URLSearchParams()
  params.set('query.bibliographic', title)
  if (author) params.set('query.author', author)
  params.set('rows', '5')

  const data = await fetchJson(`${CROSSREF_API}?${params}`)
  if (!data?.message?.items?.length) return null

  let bestMatch = null
  let bestScore = 0

  for (const item of data.message.items) {
    let score = 0

    // Title similarity (0.5 weight)
    if (item.title?.[0]) {
      score += titleSimilarity(title, item.title[0]) * 0.5
    }

    // Author match (0.25 weight)
    if (item.author?.length && author) {
      const authorLower = author.toLowerCase()
      const hasMatch = item.author.some(a =>
        (a.family || '').toLowerCase().includes(authorLower) ||
        authorLower.includes((a.family || '').toLowerCase())
      )
      if (hasMatch) score += 0.25
    }

    // Year match (0.25 weight)
    if (year && item.issued?.['date-parts']?.[0]?.[0]) {
      if (String(item.issued['date-parts'][0][0]) === String(year)) {
        score += 0.25
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = item
    }
  }

  if (bestScore >= 0.6 && bestMatch) {
    return { csl: crossrefToCsl(bestMatch), score: bestScore }
  }

  return null
}

/**
 * Convert CrossRef work item to CSL-JSON.
 */
export function crossrefToCsl(work) {
  const typeMap = {
    'journal-article': 'article-journal',
    'proceedings-article': 'paper-conference',
    'book-chapter': 'chapter',
    'posted-content': 'article',
    'monograph': 'book',
    'edited-book': 'book',
    'reference-book': 'book',
    'dissertation': 'thesis',
    'report': 'report',
    'peer-review': 'article-journal',
    'book': 'book',
  }

  const csl = {
    type: typeMap[work.type] || 'article',
    title: work.title?.[0] || '',
    DOI: work.DOI || '',
  }

  // Authors
  if (work.author?.length) {
    csl.author = work.author.map(a => ({
      family: a.family || '',
      given: a.given || '',
    }))
  }

  // Date
  if (work.issued?.['date-parts']?.[0]) {
    csl.issued = { 'date-parts': [work.issued['date-parts'][0]] }
  } else if (work.published?.['date-parts']?.[0]) {
    csl.issued = { 'date-parts': [work.published['date-parts'][0]] }
  }

  // Container (journal/conference)
  if (work['container-title']?.[0]) {
    csl['container-title'] = work['container-title'][0]
  }

  // Volume, issue, page
  if (work.volume) csl.volume = work.volume
  if (work.issue) csl.issue = work.issue
  if (work.page) csl.page = work.page

  // Publisher
  if (work.publisher) csl.publisher = work.publisher

  // Abstract
  if (work.abstract) {
    csl.abstract = work.abstract.replace(/<[^>]+>/g, '') // strip HTML
  }

  // URL
  if (work.URL) csl.URL = work.URL

  return csl
}

/**
 * Title similarity using Jaccard index on word tokens.
 */
function titleSimilarity(a, b) {
  const tokensA = new Set(a.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1

  const intersection = new Set([...tokensA].filter(t => tokensB.has(t)))
  const union = new Set([...tokensA, ...tokensB])
  return union.size > 0 ? intersection.size / union.size : 0
}
