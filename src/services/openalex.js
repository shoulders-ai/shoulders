import { invoke } from '@tauri-apps/api/core'

const OPENALEX_API = 'https://api.openalex.org'

// Fields to request via select param
const SELECT_FIELDS = [
  'doi', 'display_name', 'publication_year',
  'abstract_inverted_index', 'authorships', 'cited_by_count',
  'open_access', 'type', 'primary_location', 'biblio',
].join(',')

/**
 * Reconstruct plaintext abstract from OpenAlex inverted index.
 * Input: { "Despite": [0], "growing": [1], "interest": [2, 45], ... }
 * Output: "Despite growing interest ..."
 */
export function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return ''
  const words = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      words[pos] = word
    }
  }
  return words.filter(w => w !== undefined).join(' ')
}

/**
 * Extract only the fields useful for literature discovery from a raw OpenAlex work.
 * Drops institution hierarchies, ORCIDs, lineage arrays, internal IDs, etc.
 */
function slimWork(work) {
  const abstract = work.abstract || reconstructAbstract(work.abstract_inverted_index)

  const slim = {
    title: work.display_name || '',
    authors: (work.authorships || []).map(a => a.author?.display_name || '').filter(Boolean),
    year: work.publication_year || null,
    doi: work.doi ? work.doi.replace('https://doi.org/', '') : null,
    cited_by_count: work.cited_by_count ?? 0,
    type: work.type || null,
    journal: work.primary_location?.source?.display_name || null,
  }

  if (abstract) slim.abstract = abstract.slice(0, 300) + (abstract.length > 300 ? '...' : '')
  if (work.open_access?.is_oa) slim.is_oa = true
  if (work.open_access?.oa_url) slim.oa_url = work.open_access.oa_url
  if (work.biblio?.volume) slim.volume = work.biblio.volume
  if (work.biblio?.issue) slim.issue = work.biblio.issue
  if (work.biblio?.first_page) {
    slim.pages = work.biblio.last_page
      ? `${work.biblio.first_page}-${work.biblio.last_page}`
      : work.biblio.first_page
  }

  return slim
}

/**
 * Search OpenAlex works. Returns slim results optimized for AI consumption.
 * Throws on HTTP error (caller handles fallback).
 */
export async function searchWorks(query, { perPage = 5, apiKey = null } = {}) {
  const params = new URLSearchParams()
  params.set('search', query)
  params.set('per_page', String(Math.min(perPage, 25)))
  params.set('select', SELECT_FIELDS)
  if (apiKey) params.set('api_key', apiKey)

  const url = `${OPENALEX_API}/works?${params}`

  const response = await invoke('proxy_api_call', {
    request: {
      url,
      method: 'GET',
      headers: { 'User-Agent': 'Shoulders/1.0 (mailto:contact@shoulde.rs)' },
      body: '',
    },
  })

  const data = JSON.parse(response)
  return (data.results || []).map(slimWork)
}

/**
 * Slim results from raw OpenAlex JSON (used when results come via Shoulders proxy
 * which returns the raw API response).
 */
export function slimResults(rawResults) {
  return (rawResults || []).map(slimWork)
}

/**
 * Convert an OpenAlex work object to CSL-JSON.
 * Mirrors crossrefToCsl() output shape for compatibility with references store.
 * Accepts either raw or slim works (checks for both field shapes).
 */
export function openalexToCsl(work) {
  const typeMap = {
    'article': 'article-journal',
    'preprint': 'article',
    'book': 'book',
    'book-chapter': 'chapter',
    'dissertation': 'thesis',
    'dataset': 'dataset',
    'editorial': 'article-journal',
    'erratum': 'article-journal',
    'letter': 'article-journal',
    'review': 'review',
    'paratext': 'article',
  }

  const csl = {
    type: typeMap[work.type] || 'article',
    title: work.display_name || work.title || '',
    DOI: work.doi ? work.doi.replace('https://doi.org/', '') : '',
  }

  // Authors
  if (work.authorships?.length) {
    csl.author = work.authorships.map(a => {
      const name = a.author?.display_name || ''
      const parts = name.split(' ')
      return {
        family: parts.length > 1 ? parts.slice(-1)[0] : name,
        given: parts.length > 1 ? parts.slice(0, -1).join(' ') : '',
      }
    })
  }

  // Date
  if (work.publication_year) {
    csl.issued = { 'date-parts': [[work.publication_year]] }
  }

  // Journal / source
  const source = work.primary_location?.source
  if (source?.display_name) {
    csl['container-title'] = source.display_name
  }

  // Biblio: volume, issue, pages
  if (work.biblio) {
    if (work.biblio.volume) csl.volume = work.biblio.volume
    if (work.biblio.issue) csl.issue = work.biblio.issue
    if (work.biblio.first_page) {
      csl.page = work.biblio.last_page
        ? `${work.biblio.first_page}-${work.biblio.last_page}`
        : work.biblio.first_page
    }
  }

  // Abstract
  const abstract_ = work.abstract || reconstructAbstract(work.abstract_inverted_index)
  if (abstract_) csl.abstract = abstract_

  // URL (prefer OA URL, fall back to DOI)
  if (work.open_access?.oa_url) {
    csl.URL = work.open_access.oa_url
  } else if (work.doi) {
    csl.URL = work.doi
  }

  return csl
}
