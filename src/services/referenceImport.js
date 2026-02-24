import { lookupByDoi, searchByMetadata } from './crossref'
import { parseBibtex } from '../utils/bibtexParser'
import { parseRis } from '../utils/risParser'
import { extractFromPdf } from '../utils/pdfMetadata'
import { aiParseReferences, aiExtractPdfMetadata } from './refAi'
import { invoke } from '@tauri-apps/api/core'

/**
 * Import references from text input.
 * Auto-detects: DOI, BibTeX, RIS, CSL-JSON, batch DOI, or falls back to AI extraction.
 *
 * @returns {{ results: Array<{csl, status, confidence}>, errors: string[] }}
 */
export async function importFromText(text, workspace) {
  const trimmed = text.trim()
  if (!trimmed) return { results: [], errors: ['Empty input'] }

  // Detect: DOI (single)
  if (/^(https?:\/\/doi\.org\/)?10\.\d{4,}/i.test(trimmed) && !trimmed.includes('\n')) {
    return await importSingleDoi(trimmed)
  }

  // Detect: BibTeX
  if (/^@\w+\{/m.test(trimmed)) {
    return importBibtex(trimmed)
  }

  // Detect: RIS format (starts with TY tag)
  if (/^TY\s{2}-/m.test(trimmed)) {
    return importRis(trimmed)
  }

  // Detect: CSL-JSON (array or object with "type" and "title")
  if (trimmed.startsWith('[') || (trimmed.startsWith('{') && trimmed.includes('"type"'))) {
    try {
      const cslResult = importCslJson(trimmed)
      if (cslResult.results.length > 0) return cslResult
    } catch (e) { /* not valid JSON, continue */ }
  }

  // Detect: Multiple DOIs (one per line)
  const lines = trimmed.split('\n').map(l => l.trim()).filter(Boolean)
  const doiLines = lines.filter(l => /^(https?:\/\/doi\.org\/)?10\.\d{4,}/i.test(l))
  if (doiLines.length > 1 && doiLines.length === lines.length) {
    return await importBatchDois(doiLines)
  }

  // Try CrossRef search directly with raw text as title
  try {
    const crossrefMatch = await searchByMetadata(trimmed, '', null)
    if (crossrefMatch && crossrefMatch.score >= 0.6) {
      crossrefMatch.csl._needsReview = false
      crossrefMatch.csl._matchMethod = 'crossref-title-match'
      return {
        results: [{ csl: crossrefMatch.csl, status: 'matched', confidence: 'matched' }],
        errors: [],
      }
    }
  } catch (e) {
    // CrossRef search failed, continue to AI
  }

  // Fallback: AI extraction (multi-provider)
  return await importViaAi(trimmed, workspace)
}

/**
 * Import from a single DOI string.
 */
async function importSingleDoi(doi) {
  try {
    const csl = await lookupByDoi(doi)
    if (csl) {
      csl._needsReview = false
      csl._matchMethod = 'doi'
      return {
        results: [{ csl, status: 'verified', confidence: 'verified' }],
        errors: [],
      }
    }
    return {
      results: [],
      errors: [`DOI not found: ${doi}`],
    }
  } catch (e) {
    return { results: [], errors: [e.message] }
  }
}

/**
 * Import from BibTeX text.
 */
function importBibtex(text) {
  const parsed = parseBibtex(text)
  const results = parsed.map(csl => ({
    csl: { ...csl, _needsReview: false, _matchMethod: 'bibtex' },
    status: 'matched',
    confidence: 'matched',
  }))

  return {
    results,
    errors: results.length === 0 ? ['No valid BibTeX entries found'] : [],
  }
}

/**
 * Import from RIS text.
 */
function importRis(text) {
  const parsed = parseRis(text)
  const results = parsed.map(csl => ({
    csl: { ...csl, _needsReview: false, _matchMethod: 'ris' },
    status: 'matched',
    confidence: 'matched',
  }))

  return {
    results,
    errors: results.length === 0 ? ['No valid RIS entries found'] : [],
  }
}

/**
 * Import from CSL-JSON text.
 */
function importCslJson(text) {
  let data = JSON.parse(text)
  if (!Array.isArray(data)) data = [data]

  const results = data
    .filter(item => item.title)
    .map(item => ({
      csl: { ...item, _needsReview: false, _matchMethod: 'csl-json' },
      status: 'matched',
      confidence: 'matched',
    }))

  return {
    results,
    errors: results.length === 0 ? ['No valid CSL-JSON entries found'] : [],
  }
}

/**
 * Import batch DOIs.
 */
async function importBatchDois(dois) {
  const results = []
  const errors = []

  for (const doi of dois) {
    try {
      const csl = await lookupByDoi(doi)
      if (csl) {
        csl._needsReview = false
        csl._matchMethod = 'doi'
        results.push({ csl, status: 'verified', confidence: 'verified' })
      } else {
        errors.push(`DOI not found: ${doi}`)
      }
    } catch (e) {
      errors.push(`Failed: ${doi} - ${e.message}`)
    }
  }

  return { results, errors }
}

/**
 * Import via AI extraction (multi-provider).
 * Parses text with AI, then enriches each result via CrossRef.
 */
async function importViaAi(text, workspace) {
  // Try AI parsing (supports multiple refs)
  const parsed = await aiParseReferences(text, workspace)

  if (!parsed || parsed.length === 0) {
    return { results: [], errors: ['Could not extract references from text'] }
  }

  const results = []
  const errors = []

  for (const item of parsed) {
    const csl = aiResultToCsl(item)

    // Try DOI enrichment
    if (csl.DOI) {
      try {
        const verified = await lookupByDoi(csl.DOI)
        if (verified) {
          verified._needsReview = false
          verified._matchMethod = 'doi'
          results.push({ csl: verified, status: 'verified', confidence: 'verified' })
          continue
        }
      } catch (e) { /* continue */ }
    }

    // Try title search
    if (csl.title) {
      try {
        const firstAuthor = csl.author?.[0]?.family || ''
        const year = csl.issued?.['date-parts']?.[0]?.[0]
        const match = await searchByMetadata(csl.title, firstAuthor, year)
        if (match) {
          match.csl._needsReview = false
          match.csl._matchMethod = 'crossref-title-match'
          results.push({ csl: match.csl, status: 'matched', confidence: 'matched' })
          continue
        }
      } catch (e) { /* continue */ }
    }

    // Unverified AI extraction
    csl._needsReview = true
    csl._matchMethod = 'ai-unverified'
    results.push({ csl, status: 'unverified', confidence: 'unverified' })
  }

  return { results, errors }
}

/**
 * Convert AI extraction result to CSL-JSON.
 */
function aiResultToCsl(result) {
  const csl = {
    type: result.type || 'article-journal',
    title: result.title || '',
  }

  if (result.authors?.length > 0) {
    csl.author = result.authors.map(a =>
      typeof a === 'string'
        ? { family: a.split(' ').pop(), given: a.split(' ').slice(0, -1).join(' ') }
        : { family: a.family || '', given: a.given || '' }
    )
  } else if (result.author) {
    csl.author = Array.isArray(result.author)
      ? result.author.map(a =>
        typeof a === 'string'
          ? { family: a.split(' ').pop(), given: a.split(' ').slice(0, -1).join(' ') }
          : a
      )
      : []
  }

  if (result.year) {
    csl.issued = { 'date-parts': [[parseInt(result.year, 10)]] }
  }

  if (result.journal) csl['container-title'] = result.journal
  if (result.volume) csl.volume = result.volume
  if (result.issue) csl.issue = result.issue
  if (result.pages) csl.page = result.pages
  if (result.doi) csl.DOI = result.doi
  if (result.url) csl.URL = result.url
  if (result.abstract) csl.abstract = result.abstract
  if (result.publisher) csl.publisher = result.publisher

  return csl
}

/**
 * Import from a PDF file.
 *
 * @returns {{ csl, confidence, key } | null}
 */
export async function importFromPdf(filePath, workspace, referencesStore) {
  try {
    // Extract text + metadata from PDF
    const { text, firstText, metadata } = await extractFromPdf(filePath)

    let csl = null
    let confidence = 'unverified'

    // Tier 1: DOI from metadata -> CrossRef lookup
    if (metadata.doi) {
      const verified = await lookupByDoi(metadata.doi)
      if (verified) {
        csl = verified
        csl._needsReview = false
        csl._matchMethod = 'doi'
        confidence = 'verified'
      }
    }

    // Tier 2: AI extraction + verification (multi-provider)
    if (!csl) {
      const aiResult = await aiExtractPdfMetadata(firstText, workspace)
      if (aiResult) {
        csl = aiResultToCsl(aiResult)

        // Try DOI from AI
        if (csl.DOI) {
          const verified = await lookupByDoi(csl.DOI)
          if (verified) {
            csl = verified
            csl._needsReview = false
            csl._matchMethod = 'doi'
            confidence = 'verified'
          }
        }

        // Try title search
        if (confidence === 'unverified' && csl.title) {
          const firstAuthor = csl.author?.[0]?.family || ''
          const year = csl.issued?.['date-parts']?.[0]?.[0]
          const match = await searchByMetadata(csl.title, firstAuthor, year)
          if (match) {
            csl = match.csl
            csl._needsReview = false
            csl._matchMethod = 'crossref-title-match'
            confidence = 'matched'
          }
        }
      }
    }

    // Fallback: minimal metadata from PDF info
    if (!csl) {
      csl = {
        type: 'article',
        title: metadata.title || filePath.split('/').pop().replace('.pdf', ''),
        _needsReview: true,
        _matchMethod: 'pdf-metadata-only',
      }
      if (metadata.author) {
        csl.author = [{ family: metadata.author }]
      }
      confidence = 'unverified'
    }

    if (confidence === 'unverified') {
      csl._needsReview = true
    }

    // Generate key + add to library
    csl._addedAt = new Date().toISOString()
    const { key } = referencesStore.addReference(csl)

    // Store PDF + extract text
    await referencesStore.storePdf(key, filePath)

    // Store full text for search
    const projectDir = workspace.projectDir
    if (projectDir && text) {
      try {
        await invoke('write_file', {
          path: `${projectDir}/references/fulltext/${key}.txt`,
          content: text,
        })
        referencesStore.updateReference(key, { _textFile: `${key}.txt` })
      } catch (e) {
        // Non-fatal
      }
    }

    return { csl: referencesStore.getByKey(key), confidence, key }
  } catch (e) {
    console.error('PDF import failed:', e)
    return null
  }
}
