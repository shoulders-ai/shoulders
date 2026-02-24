/**
 * RIS format parser — converts .ris text to CSL-JSON array.
 *
 * RIS is a tag-value format used by PubMed, Scopus, Web of Science, etc.
 * Each record starts with TY and ends with ER.
 * Tags: 2-4 uppercase chars + "  - " + value
 */

const TYPE_MAP = {
  JOUR: 'article-journal',
  BOOK: 'book',
  CHAP: 'chapter',
  CONF: 'paper-conference',
  RPRT: 'report',
  THES: 'thesis',
  ELEC: 'webpage',
  GEN: 'article',
  MGZN: 'article-magazine',
  NEWS: 'article-newspaper',
  UNPB: 'manuscript',
  ABST: 'article',
  ADVS: 'article',
  BILL: 'legislation',
  CASE: 'legal_case',
  DATA: 'dataset',
  ICOMM: 'personal_communication',
  INPR: 'article',
  MAP: 'map',
  MPCT: 'motion_picture',
  PAT: 'patent',
  PCOMM: 'personal_communication',
  SOUND: 'song',
  STAT: 'legislation',
  VIDEO: 'motion_picture',
}

export function parseRis(text) {
  const records = []
  // Split on ER tag (end of record)
  const blocks = text.split(/^ER\s{2}-.*$/m)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed || !/^TY\s{2}-/m.test(trimmed)) continue

    try {
      const record = parseRisRecord(trimmed)
      if (record && record.title) records.push(record)
    } catch (e) {
      console.warn('[risParser] Failed to parse record:', e)
    }
  }

  return records
}

function parseRisRecord(text) {
  const lines = text.split('\n')
  const fields = {}
  let lastTag = null

  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9]{1,3})\s{2}-\s?(.*)$/)
    if (match) {
      const [, tag, value] = match
      lastTag = tag
      if (!fields[tag]) fields[tag] = []
      fields[tag].push(value.trim())
    } else if (lastTag && line.trim()) {
      // Continuation line
      const arr = fields[lastTag]
      arr[arr.length - 1] += ' ' + line.trim()
    }
  }

  const csl = {
    type: TYPE_MAP[fields.TY?.[0]] || 'article',
  }

  // Title
  csl.title = fields.TI?.[0] || fields.T1?.[0] || ''

  // Authors (AU and A1 tags, each line = one author)
  const authorTags = [...(fields.AU || []), ...(fields.A1 || [])]
  if (authorTags.length > 0) {
    csl.author = authorTags.map(parseRisName)
  }

  // Editors
  const editorTags = [...(fields.ED || []), ...(fields.A2 || [])]
  if (editorTags.length > 0) {
    csl.editor = editorTags.map(parseRisName)
  }

  // Date / Year
  const dateStr = fields.DA?.[0] || fields.Y1?.[0]
  const yearStr = fields.PY?.[0]
  if (dateStr) {
    const parts = parseDateParts(dateStr)
    if (parts) csl.issued = { 'date-parts': [parts] }
  } else if (yearStr) {
    const yr = parseInt(yearStr, 10)
    if (!isNaN(yr)) csl.issued = { 'date-parts': [[yr]] }
  }

  // Journal / container
  const container = fields.JO?.[0] || fields.JF?.[0] || fields.T2?.[0]
  if (container) csl['container-title'] = container

  // Volume, Issue
  if (fields.VL?.[0]) csl.volume = fields.VL[0]
  if (fields.IS?.[0]) csl.issue = fields.IS[0]

  // Pages (SP = start, EP = end)
  const sp = fields.SP?.[0]
  const ep = fields.EP?.[0]
  if (sp && ep) csl.page = `${sp}-${ep}`
  else if (sp) csl.page = sp

  // DOI
  if (fields.DO?.[0]) {
    csl.DOI = fields.DO[0].replace(/^https?:\/\/doi\.org\//i, '')
  }

  // URL
  if (fields.UR?.[0]) csl.URL = fields.UR[0]

  // Abstract
  const ab = fields.AB?.[0] || fields.N2?.[0]
  if (ab) csl.abstract = ab

  // Publisher
  if (fields.PB?.[0]) csl.publisher = fields.PB[0]

  // ISBN / ISSN (SN tag — heuristic: short with dashes = ISSN)
  if (fields.SN?.[0]) {
    const sn = fields.SN[0]
    if (sn.replace(/-/g, '').length <= 9) {
      csl.ISSN = sn
    } else {
      csl.ISBN = sn
    }
  }

  // Keywords
  const kw = fields.KW || []
  if (kw.length > 0) {
    csl._tags = kw.flatMap(k => k.split(/[;,]/).map(s => s.trim()).filter(Boolean))
  }

  // Language
  if (fields.LA?.[0]) csl.language = fields.LA[0]

  // Notes
  if (fields.N1?.[0]) csl.note = fields.N1[0]

  // Collection / series title
  if (fields.T3?.[0]) csl['collection-title'] = fields.T3[0]

  return csl
}

function parseRisName(str) {
  str = str.trim()
  if (!str) return { family: 'Unknown' }

  if (str.includes(',')) {
    const [family, ...rest] = str.split(',')
    return { family: family.trim(), given: rest.join(',').trim() }
  }

  const words = str.split(/\s+/)
  if (words.length === 1) return { family: words[0] }
  return { family: words[words.length - 1], given: words.slice(0, -1).join(' ') }
}

function parseDateParts(str) {
  // Handles: YYYY/MM/DD, YYYY/MM, YYYY, YYYY-MM-DD
  const cleaned = str.replace(/-/g, '/')
  const parts = cleaned.split('/').map(s => parseInt(s, 10)).filter(n => !isNaN(n))
  return parts.length > 0 ? parts : null
}
