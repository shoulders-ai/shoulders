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

    // Fallback: whitespace-normalized matching
    if (idx === -1) {
      const normalizedText = text.replace(/\s+/g, ' ')
      const normalizedSnippet = snippet.replace(/\s+/g, ' ')
      idx = normalizedText.indexOf(normalizedSnippet)
      if (idx === -1) continue
    }

    const end = idx + snippet.length
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
        starts.push(i)
        ends.push(semi + 1)
        text += decoded
        i = semi + 1
        continue
      }
    }

    starts.push(i)
    ends.push(i + 1)
    text += html[i]
    i++
  }

  return { text, starts, ends }
}

function decodeEntity(entity) {
  const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&nbsp;': ' ' }
  return map[entity] || entity
}
