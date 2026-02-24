import { invoke } from '@tauri-apps/api/core'

/**
 * Extract text from a PDF with spatial-aware layout reconstruction.
 * Handles two-column layouts, detects paragraphs and headings.
 */
export async function extractTextFromPdf(filePath) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href

  const base64 = await invoke('read_file_base64', { path: filePath })
  const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const pdf = await pdfjsLib.getDocument({ data }).promise

  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const viewport = page.getViewport({ scale: 1.0 })
    const pageText = _extractPageText(textContent.items, viewport.width, viewport.height)
    if (pageText.trim()) pages.push(pageText)
  }

  return pages.join('\n\n')
}

/** Extract structured text from a single page using spatial analysis. */
function _extractPageText(items, pageWidth, pageHeight) {
  const normalized = items
    .filter(item => item.str && item.str.trim().length > 0)
    .map(item => ({
      text: item.str,
      x: item.transform[4],
      y: pageHeight - item.transform[5], // flip Y to top-down
      fontSize: Math.abs(item.transform[0]) || Math.abs(item.transform[3]) || 12,
      width: item.width || 0,
    }))

  if (normalized.length === 0) return ''

  const columns = _detectColumns(normalized, pageWidth)
  return columns.map(col => _processColumn(col)).join('\n\n')
}

/** Detect whether items form single or two-column layout. */
function _detectColumns(items, pageWidth) {
  const midX = pageWidth / 2
  const gutter = pageWidth * 0.04
  const left = [], right = [], spanning = []

  for (const item of items) {
    const itemRight = item.x + item.width
    if (itemRight < midX - gutter) left.push(item)
    else if (item.x > midX + gutter) right.push(item)
    else spanning.push(item)
  }

  const total = items.length
  if (left.length > total * 0.2 && right.length > total * 0.2 && spanning.length < total * 0.35) {
    for (const item of spanning) {
      if (item.x + item.width / 2 < midX) left.push(item)
      else right.push(item)
    }
    return [left, right]
  }

  return [items]
}

/** Process a single column of items into formatted text. */
function _processColumn(items) {
  if (items.length === 0) return ''
  const lines = _groupIntoLines(items)
  if (lines.length === 0) return ''

  const { medianGap, bodyFontSize } = _computeStats(lines)
  return _buildParagraphs(lines, medianGap, bodyFontSize)
}

/** Group items into lines based on Y-proximity. */
function _groupIntoLines(items) {
  items.sort((a, b) => a.y - b.y || a.x - b.x)
  const lines = []
  let currentLine = [items[0]]

  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    const lineY = currentLine[0].y
    const threshold = (currentLine[0].fontSize || 12) * 0.6

    if (Math.abs(item.y - lineY) < threshold) {
      currentLine.push(item)
    } else {
      currentLine.sort((a, b) => a.x - b.x)
      lines.push(currentLine)
      currentLine = [item]
    }
  }
  currentLine.sort((a, b) => a.x - b.x)
  lines.push(currentLine)
  return lines
}

/** Join items within a line using gap-based spacing. */
function _joinLineItems(items) {
  if (items.length === 0) return ''
  let text = items[0].text
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]
    const curr = items[i]
    const expectedX = prev.x + prev.width
    const gap = curr.x - expectedX
    text += (gap > prev.fontSize * 0.2) ? ' ' + curr.text : curr.text
  }
  return text.trim()
}

/** Compute median line spacing and modal body font size. */
function _computeStats(lines) {
  const gaps = []
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i][0].y - lines[i - 1][0].y
    if (gap > 0 && gap < 80) gaps.push(gap)
  }
  gaps.sort((a, b) => a - b)
  const medianGap = gaps.length > 2 ? gaps[Math.floor(gaps.length / 2)] : 14

  const fontCounts = {}
  for (const line of lines) {
    for (const item of line) {
      const s = Math.round(item.fontSize * 2) / 2
      fontCounts[s] = (fontCounts[s] || 0) + 1
    }
  }
  const bodyFontSize = +(Object.entries(fontCounts).sort((a, b) => b[1] - a[1])[0]?.[0]) || 12

  return { medianGap, bodyFontSize }
}

/** Build paragraphs with heading detection and paragraph break detection. */
function _buildParagraphs(lines, medianGap, bodyFontSize) {
  const result = []
  let currentParagraph = ''

  for (let i = 0; i < lines.length; i++) {
    const lineText = _joinLineItems(lines[i])
    if (!lineText) continue

    const maxFontSize = Math.max(...lines[i].map(it => it.fontSize))
    const isHeading = maxFontSize > bodyFontSize * 1.2
    const gap = i > 0 ? lines[i][0].y - lines[i - 1][0].y : 0
    const isParagraphBreak = gap > medianGap * 1.4

    if (isHeading) {
      if (currentParagraph) {
        result.push(currentParagraph)
        currentParagraph = ''
      }
      const level = maxFontSize > bodyFontSize * 1.5 ? '##' : '###'
      result.push(`${level} ${lineText}`)
    } else if (isParagraphBreak) {
      if (currentParagraph) {
        result.push(currentParagraph)
      }
      currentParagraph = lineText
    } else {
      currentParagraph = currentParagraph ? currentParagraph + ' ' + lineText : lineText
    }
  }

  if (currentParagraph) result.push(currentParagraph)
  return result.join('\n\n')
}

/**
 * Extract metadata from a PDF file.
 * Returns { text, metadata } where metadata has title, authors, doi, etc.
 *
 * Tier 1: PDF document metadata (XMP/Info dict)
 * Tier 2: AI extraction from first ~3000 chars
 */
export async function extractFromPdf(filePath) {
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url
  ).href

  const base64 = await invoke('read_file_base64', { path: filePath })
  const data = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
  const pdf = await pdfjsLib.getDocument({ data }).promise

  // Extract first 3 pages of text
  const textPages = []
  const maxPages = Math.min(3, pdf.numPages)
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    textPages.push(textContent.items.map(item => item.str).join(' '))
  }
  const firstText = textPages.join('\n\n')

  // Also get full text for storage
  const allPages = [...textPages]
  for (let i = maxPages + 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    allPages.push(textContent.items.map(item => item.str).join(' '))
  }
  const fullText = allPages.join('\n\n')

  // Tier 1: PDF metadata
  const pdfMeta = await pdf.getMetadata().catch(() => null)
  const metadata = {
    title: null,
    author: null,
    doi: null,
    year: null,
  }

  if (pdfMeta?.info) {
    const info = pdfMeta.info
    if (info.Title && info.Title.length > 5) metadata.title = info.Title
    if (info.Author) metadata.author = info.Author
    if (info.Subject) {
      // DOI sometimes in Subject field
      const doiMatch = info.Subject.match(/10\.\d{4,}[^\s]+/)
      if (doiMatch) metadata.doi = doiMatch[0]
    }
  }

  // Check text for DOI patterns (first 2 pages)
  if (!metadata.doi) {
    const doiMatch = firstText.match(/(?:doi[:\s]*|https?:\/\/doi\.org\/)(10\.\d{4,}[^\s,;]+)/i)
    if (doiMatch) metadata.doi = doiMatch[1]
  }

  return { text: fullText, firstText, metadata }
}

// aiExtractMetadata has been moved to src/services/refAi.js (multi-provider support).
// The old Anthropic-only chat_stream approach is replaced by non-streaming proxy_api_call
// with automatic provider fallback: Gemini > Anthropic > OpenAI.
