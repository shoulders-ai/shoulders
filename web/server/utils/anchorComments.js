export function anchorCommentsInHtml(html, comments) {
  if (!html || !comments?.length) return html

  const withSnippets = comments
    .filter(c => c.id && c.text_snippet?.trim())
    .sort((a, b) => b.text_snippet.length - a.text_snippet.length)

  if (!withSnippets.length) return html

  const { text, starts, ends } = mapTextPositions(html)

  const anchors = []
  const used = new Set()

  for (const c of withSnippets) {
    const snippet = c.text_snippet.trim()
    let idx = text.indexOf(snippet)
    let matchLen = snippet.length

    // Fallback: whitespace-normalized matching
    if (idx === -1) {
      const normalizedText = text.replace(/\s+/g, ' ')
      const normalizedSnippet = snippet.replace(/\s+/g, ' ')
      const nIdx = normalizedText.indexOf(normalizedSnippet)
      if (nIdx === -1) continue
      // Map normalized positions back to original text positions
      idx = normToOrigIndex(text, nIdx)
      const origEnd = normToOrigIndex(text, nIdx + normalizedSnippet.length)
      matchLen = origEnd - idx
    }

    const end = idx + matchLen

    let overlaps = false
    for (let i = idx; i < end; i++) {
      if (used.has(i)) { overlaps = true; break }
    }
    if (overlaps) continue

    for (let i = idx; i < end; i++) used.add(i)
    anchors.push({ commentId: c.id, severity: c.severity || 'suggestion', textStart: idx, textEnd: end })
  }

  if (!anchors.length) return html

  // Insert from end to preserve positions
  anchors.sort((a, b) => b.textStart - a.textStart)

  let result = html
  for (const { commentId, severity, textStart, textEnd } of anchors) {
    const htmlStart = starts[textStart]
    const htmlEnd = ends[textEnd - 1]
    result = result.slice(0, htmlStart) +
      `<mark data-comment-id="${commentId}" data-severity="${severity}">` +
      result.slice(htmlStart, htmlEnd) +
      `</mark>` +
      result.slice(htmlEnd)
  }

  return result
}

function mapTextPositions(html) {
  let text = ''
  const starts = []
  const ends = []
  let inTag = false
  let i = 0

  while (i < html.length) {
    if (html[i] === '<') { inTag = true; i++; continue }
    if (html[i] === '>') { inTag = false; i++; continue }
    if (inTag) { i++; continue }

    if (html[i] === '&') {
      const semi = html.indexOf(';', i)
      if (semi !== -1 && semi - i < 10) {
        const entity = html.slice(i, semi + 1)
        const decoded = decodeEntity(entity)
        if (decoded.length === 1) {
          // Successfully decoded to single char — one position entry
          starts.push(i)
          ends.push(semi + 1)
          text += decoded
          i = semi + 1
          continue
        }
        // Unknown entity: fall through — treat '&' as a literal character
        // so each char gets its own position entry (preserves text↔position alignment)
      }
    }

    starts.push(i)
    ends.push(i + 1)
    text += html[i]
    i++
  }

  return { text, starts, ends }
}

/**
 * Map a position in whitespace-normalized text back to the original text.
 * Each whitespace run in the original counts as 1 char in normalized text.
 */
function normToOrigIndex(text, normIdx) {
  let ni = 0
  let oi = 0
  while (ni < normIdx && oi < text.length) {
    if (/\s/.test(text[oi])) {
      while (oi < text.length && /\s/.test(text[oi])) oi++
      ni++
    } else {
      oi++
      ni++
    }
  }
  return oi
}

function decodeEntity(entity) {
  const map = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ',
    '&mdash;': '\u2014', '&ndash;': '\u2013',
    '&lsquo;': '\u2018', '&rsquo;': '\u2019', '&ldquo;': '\u201C', '&rdquo;': '\u201D',
    '&hellip;': '\u2026', '&bull;': '\u2022',
    '&copy;': '\u00A9', '&reg;': '\u00AE', '&trade;': '\u2122',
    '&deg;': '\u00B0', '&plusmn;': '\u00B1', '&times;': '\u00D7', '&divide;': '\u00F7',
    '&frac12;': '\u00BD', '&frac14;': '\u00BC', '&frac34;': '\u00BE',
    '&pound;': '\u00A3', '&euro;': '\u20AC', '&yen;': '\u00A5', '&cent;': '\u00A2',
    '&sect;': '\u00A7', '&para;': '\u00B6', '&micro;': '\u00B5',
    '&laquo;': '\u00AB', '&raquo;': '\u00BB',
  }
  if (map[entity]) return map[entity]

  // Handle numeric character references: &#NNN; and &#xHHH;
  if (entity.startsWith('&#')) {
    const code = entity[2] === 'x' || entity[2] === 'X'
      ? parseInt(entity.slice(3, -1), 16)
      : parseInt(entity.slice(2, -1), 10)
    if (!isNaN(code)) return String.fromCodePoint(code)
  }

  return entity // unknown — caller handles multi-char case
}
