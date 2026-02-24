/**
 * Resilient BibTeX parser → CSL-JSON array.
 * Each entry is parsed independently — one bad entry doesn't kill the batch.
 */

const TYPE_MAP = {
  article: 'article-journal',
  inproceedings: 'paper-conference',
  conference: 'paper-conference',
  book: 'book',
  incollection: 'chapter',
  inbook: 'chapter',
  phdthesis: 'thesis',
  mastersthesis: 'thesis',
  techreport: 'report',
  misc: 'article',
  unpublished: 'manuscript',
  proceedings: 'book',
  manual: 'book',
  booklet: 'book',
}

/**
 * Parse a BibTeX string into an array of CSL-JSON objects.
 */
export function parseBibtex(text) {
  const entries = splitEntries(text)
  const results = []

  for (const entry of entries) {
    try {
      const csl = parseEntry(entry)
      if (csl) results.push(csl)
    } catch (e) {
      console.warn('Failed to parse BibTeX entry:', e.message)
    }
  }

  return results
}

/**
 * Split BibTeX text into individual entry strings.
 */
function splitEntries(text) {
  const entries = []
  const re = /@(\w+)\s*\{/g
  let match

  while ((match = re.exec(text)) !== null) {
    const start = match.index
    let depth = 0
    let end = start

    for (let i = match.index + match[0].length - 1; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) {
          end = i + 1
          break
        }
      }
    }

    if (end > start) {
      entries.push(text.substring(start, end))
    }
  }

  return entries
}

/**
 * Parse a single BibTeX entry string into CSL-JSON.
 */
function parseEntry(entry) {
  // Extract type and key
  const headerMatch = entry.match(/@(\w+)\s*\{\s*([^,\s]*)\s*,/)
  if (!headerMatch) return null

  const type = headerMatch[1].toLowerCase()
  const key = headerMatch[2].trim()

  // Skip non-entry types
  if (type === 'string' || type === 'preamble' || type === 'comment') return null

  // Extract fields
  const body = entry.substring(headerMatch[0].length, entry.length - 1)
  const fields = parseFields(body)

  // Build CSL-JSON
  const csl = {
    id: key,
    _key: key,
    type: TYPE_MAP[type] || 'article',
  }

  if (fields.title) csl.title = cleanValue(fields.title)
  if (fields.author) csl.author = parseAuthors(fields.author)
  if (fields.editor) csl.editor = parseAuthors(fields.editor)

  // Year / date
  if (fields.year) {
    const year = parseInt(cleanValue(fields.year), 10)
    if (!isNaN(year)) {
      csl.issued = { 'date-parts': [[year]] }
      if (fields.month) {
        const month = parseMonth(cleanValue(fields.month))
        if (month) csl.issued['date-parts'][0].push(month)
      }
    }
  }

  if (fields.journal || fields.journaltitle) {
    csl['container-title'] = cleanValue(fields.journal || fields.journaltitle)
  }
  if (fields.booktitle) csl['container-title'] = cleanValue(fields.booktitle)
  if (fields.volume) csl.volume = cleanValue(fields.volume)
  if (fields.number || fields.issue) csl.issue = cleanValue(fields.number || fields.issue)
  if (fields.pages) csl.page = cleanValue(fields.pages).replace('--', '-')
  if (fields.doi) csl.DOI = cleanValue(fields.doi)
  if (fields.url) csl.URL = cleanValue(fields.url)
  if (fields.publisher) csl.publisher = cleanValue(fields.publisher)
  if (fields.abstract) csl.abstract = cleanValue(fields.abstract)
  if (fields.isbn) csl.ISBN = cleanValue(fields.isbn)
  if (fields.issn) csl.ISSN = cleanValue(fields.issn)
  if (fields.keywords) {
    csl._tags = cleanValue(fields.keywords).split(/[,;]/).map(s => s.trim()).filter(Boolean)
  }

  return csl
}

/**
 * Parse the field body of a BibTeX entry into a key-value map.
 */
function parseFields(body) {
  const fields = {}
  let pos = 0

  while (pos < body.length) {
    // Skip whitespace and commas
    while (pos < body.length && /[\s,]/.test(body[pos])) pos++
    if (pos >= body.length) break

    // Extract field name
    const nameMatch = body.substring(pos).match(/^([a-zA-Z_][\w-]*)\s*=\s*/)
    if (!nameMatch) {
      pos++
      continue
    }

    const fieldName = nameMatch[1].toLowerCase()
    pos += nameMatch[0].length

    // Extract value
    const { value, endPos } = extractValue(body, pos)
    fields[fieldName] = value
    pos = endPos
  }

  return fields
}

/**
 * Extract a BibTeX field value starting at pos.
 * Handles: {braced}, "quoted", bare numbers, and concatenation with #.
 */
function extractValue(text, pos) {
  let value = ''

  while (pos < text.length) {
    // Skip whitespace
    while (pos < text.length && text[pos] === ' ') pos++

    if (text[pos] === '{') {
      // Braced value
      const { content, end } = extractBraced(text, pos)
      value += content
      pos = end
    } else if (text[pos] === '"') {
      // Quoted value
      pos++
      let depth = 0
      let start = pos
      while (pos < text.length) {
        if (text[pos] === '{') depth++
        else if (text[pos] === '}') depth--
        else if (text[pos] === '"' && depth === 0) break
        pos++
      }
      value += text.substring(start, pos)
      if (pos < text.length) pos++ // skip closing "
    } else if (/\d/.test(text[pos])) {
      // Bare number
      const numMatch = text.substring(pos).match(/^\d+/)
      if (numMatch) {
        value += numMatch[0]
        pos += numMatch[0].length
      }
    } else {
      // Unknown / end of value
      break
    }

    // Check for # concatenation
    while (pos < text.length && text[pos] === ' ') pos++
    if (text[pos] === '#') {
      pos++
      continue
    }
    break
  }

  return { value, endPos: pos }
}

/**
 * Extract content inside matched braces { ... }.
 */
function extractBraced(text, pos) {
  let depth = 0
  let start = pos + 1

  for (let i = pos; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}') {
      depth--
      if (depth === 0) {
        return { content: text.substring(start, i), end: i + 1 }
      }
    }
  }

  // Unbalanced — return what we can
  return { content: text.substring(start), end: text.length }
}

/**
 * Parse BibTeX author string into CSL author array.
 * Handles: "Last, First and Last, First" and "First Last and First Last"
 */
function parseAuthors(authorStr) {
  const cleaned = cleanValue(authorStr)
  const parts = cleaned.split(/\s+and\s+/i)

  return parts.map(part => {
    part = part.trim()
    if (!part) return null

    if (part.includes(',')) {
      // "Last, First" format
      const [family, ...rest] = part.split(',')
      return {
        family: family.trim(),
        given: rest.join(',').trim(),
      }
    }

    // "First Last" format
    const words = part.split(/\s+/)
    if (words.length === 1) {
      return { family: words[0] }
    }

    return {
      family: words[words.length - 1],
      given: words.slice(0, -1).join(' '),
    }
  }).filter(Boolean)
}

/**
 * Clean a BibTeX field value: strip outer braces, handle LaTeX accents.
 */
function cleanValue(value) {
  if (!value) return ''

  // Strip outer braces
  let v = value.replace(/^\{|\}$/g, '')

  // Handle common LaTeX accents
  v = v.replace(/\\["'`^~=.uvHtcdb]\{(\w)\}/g, '$1')
  v = v.replace(/\{\\["'`^~=.uvHtcdb]\s*(\w)\}/g, '$1')
  v = v.replace(/\\["'`^~=.uvHtcdb](\w)/g, '$1')

  // Remove remaining braces
  v = v.replace(/[{}]/g, '')

  // Normalize whitespace
  v = v.replace(/\s+/g, ' ').trim()

  return v
}

/**
 * Parse month string or number.
 */
function parseMonth(month) {
  const months = {
    jan: 1, january: 1,
    feb: 2, february: 2,
    mar: 3, march: 3,
    apr: 4, april: 4,
    may: 5,
    jun: 6, june: 6,
    jul: 7, july: 7,
    aug: 8, august: 8,
    sep: 9, september: 9,
    oct: 10, october: 10,
    nov: 11, november: 11,
    dec: 12, december: 12,
  }
  const num = parseInt(month, 10)
  if (!isNaN(num) && num >= 1 && num <= 12) return num
  return months[month.toLowerCase()] || null
}
