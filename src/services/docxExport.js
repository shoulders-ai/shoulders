/**
 * Markdown → DOCX export via `marked` lexer + `docx` npm package.
 *
 * Architecture note: PDF export lives in Rust (typst_export.rs) because Typst
 * is a Rust binary. DOCX export lives in JS because the `docx` npm package
 * (5.6k stars, v9.6+) vastly outmatches any Rust DOCX crate, and DOCX
 * generation is just ZIP-of-XML assembly — no external binary needed.
 */

import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  HeadingLevel, AlignmentType, BorderStyle, ShadingType, WidthType,
  Table, TableRow, TableCell, TableBorders,
  ExternalHyperlink, FootnoteReferenceRun,
  LevelFormat, UnderlineType, PageBreak,
  convertInchesToTwip,
} from 'docx'
import { Marked } from 'marked'
import { invoke } from '@tauri-apps/api/core'
import { formatInlineCitation, formatReferenceRich } from './citationFormatter'
import { resolveAbsPath } from '../utils/paths'

// ---------------------------------------------------------------------------
// Marked instance — minimal config, no HTML rendering extensions needed
// ---------------------------------------------------------------------------

const parser = new Marked()

// ---------------------------------------------------------------------------
// Settings mappings
// ---------------------------------------------------------------------------

const PAGE_SIZES = {
  'a4': { width: 11906, height: 16838 },
  'us-letter': { width: 12240, height: 15840 },
  'a5': { width: 8391, height: 11906 },
}

const MARGIN_MAP = {
  'narrow': convertInchesToTwip(0.5),
  'normal': convertInchesToTwip(1),
  'wide': convertInchesToTwip(1.5),
}

// ---------------------------------------------------------------------------
// Heading level map
// ---------------------------------------------------------------------------

const HEADING_MAP = {
  1: HeadingLevel.HEADING_1,
  2: HeadingLevel.HEADING_2,
  3: HeadingLevel.HEADING_3,
  4: HeadingLevel.HEADING_4,
  5: HeadingLevel.HEADING_5,
  6: HeadingLevel.HEADING_6,
}

// ---------------------------------------------------------------------------
// Pre-processing helpers
// ---------------------------------------------------------------------------

function stripFrontmatter(md) {
  if (!md.startsWith('---')) return md
  const end = md.indexOf('\n---', 3)
  if (end < 0) return md
  return md.substring(end + 4)
}

/** Extract [^label]: content definitions and remove them from the markdown. */
function extractFootnotes(md) {
  const defs = {}
  const cleaned = md.replace(
    /^\[\^([^\]]+)\]:\s*(.+(?:\n(?!\[\^|\n|\S).*)*)/gm,
    (_, label, content) => {
      defs[label] = content.trim()
      return ''
    },
  )
  return { cleaned, defs }
}

// ---------------------------------------------------------------------------
// Citation helpers
// ---------------------------------------------------------------------------

const CITATION_RE = /\[([^\[\]]*@[a-zA-Z][\w]*[^\[\]]*)\]/g
const KEY_RE = /@([a-zA-Z][\w]*)/g

function extractCitationKeys(inner) {
  const keys = []
  KEY_RE.lastIndex = 0
  let m
  while ((m = KEY_RE.exec(inner)) !== null) keys.push(m[1])
  return keys
}

function formatCitationRuns(inner, ctx, formatting) {
  const keys = extractCitationKeys(inner)
  if (!keys.length) return [new TextRun({ text: `[${inner}]`, ...formatting })]

  const refs = ctx.references
  const style = ctx.citationStyle
  const isNumbered = style === 'ieee' || style === 'vancouver'

  const parts = keys.map(key => {
    ctx.citedKeys.add(key)
    const ref = refs?.getByKey?.(key)
    if (!ref) return `@${key}`
    return formatInlineCitation(ref, style, ctx.citationNumberMap?.[key])
  })

  const display = isNumbered
    ? parts.join(', ')
    : `(${parts.map(p => p.replace(/^\(/, '').replace(/\)$/, '')).join('; ')})`

  return [new TextRun({ text: display, ...formatting })]
}

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

const MAX_IMAGE_WIDTH = 570 // pixels — fits within standard margins

function getImageDimensions(data) {
  // PNG: signature 0x89504E47, IHDR at offset 16
  if (data.length > 24 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    const w = (data[16] << 24) | (data[17] << 16) | (data[18] << 8) | data[19]
    const h = (data[20] << 24) | (data[21] << 16) | (data[22] << 8) | data[23]
    if (w > 0 && h > 0) return { width: w, height: h }
  }
  return { width: 600, height: 400 } // default
}

function scaleToFit(w, h) {
  if (w <= MAX_IMAGE_WIDTH) return { width: w, height: h }
  const ratio = MAX_IMAGE_WIDTH / w
  return { width: MAX_IMAGE_WIDTH, height: Math.round(h * ratio) }
}

/** Recursively find all image hrefs in a marked token tree. */
function collectImagePaths(tokens, paths = new Set()) {
  if (!tokens) return paths
  for (const t of tokens) {
    if (t.type === 'image') paths.add(t.href)
    if (t.tokens) collectImagePaths(t.tokens, paths)
    if (t.items) for (const item of t.items) collectImagePaths(item.tokens, paths)
  }
  return paths
}

async function preloadImages(tokens, workspacePath) {
  const paths = collectImagePaths(tokens)
  const cache = {}
  const loads = [...paths].map(async (src) => {
    try {
      const fullPath = resolveAbsPath(src, workspacePath)
      const b64 = await invoke('read_file_base64', { path: fullPath })
      const binary = atob(b64)
      const data = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) data[i] = binary.charCodeAt(i)
      const dims = getImageDimensions(data)
      const scaled = scaleToFit(dims.width, dims.height)
      cache[src] = { data, ...scaled }
    } catch {
      // Missing image — skip silently
    }
  })
  await Promise.all(loads)
  return cache
}

// ---------------------------------------------------------------------------
// Inline token walker
// ---------------------------------------------------------------------------

const FOOTNOTE_RE = /\[\^([^\]]+)\]/
const INLINE_SPLIT_RE = /(\[\^[^\]]+\]|\[[^\[\]]*@[a-zA-Z][\w]*[^\[\]]*\])/g

function processTextWithCitations(text, ctx, formatting) {
  if (!text) return []
  const runs = []
  const parts = text.split(INLINE_SPLIT_RE)

  for (const part of parts) {
    if (!part) continue

    // Footnote reference
    const fnMatch = part.match(FOOTNOTE_RE)
    if (fnMatch && part === fnMatch[0]) {
      const label = fnMatch[1]
      const fnId = ctx.footnoteIds[label]
      if (fnId !== undefined) {
        runs.push(new FootnoteReferenceRun(fnId))
        continue
      }
    }

    // Citation
    CITATION_RE.lastIndex = 0
    const citeMatch = CITATION_RE.exec(part)
    if (citeMatch && citeMatch[0] === part) {
      runs.push(...formatCitationRuns(citeMatch[1], ctx, formatting))
      continue
    }

    // Plain text
    if (part) runs.push(new TextRun({ text: part, ...formatting }))
  }

  return runs
}

function convertInlineTokens(tokens, ctx, formatting = {}) {
  if (!tokens) return []
  const runs = []

  for (const token of tokens) {
    switch (token.type) {
      case 'text':
        runs.push(...processTextWithCitations(token.text ?? token.raw, ctx, formatting))
        break
      case 'strong':
        runs.push(...convertInlineTokens(token.tokens, ctx, { ...formatting, bold: true }))
        break
      case 'em':
        runs.push(...convertInlineTokens(token.tokens, ctx, { ...formatting, italics: true }))
        break
      case 'codespan':
        runs.push(new TextRun({
          text: token.text,
          font: { name: 'Consolas' },
          size: 20, // 10pt
          shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
          ...formatting,
        }))
        break
      case 'link':
        runs.push(new ExternalHyperlink({
          link: token.href,
          children: convertInlineTokens(token.tokens, ctx, formatting),
        }))
        break
      case 'image': {
        const cached = ctx.imageCache[token.href]
        if (cached) {
          runs.push(new ImageRun({
            data: cached.data,
            transformation: { width: cached.width, height: cached.height },
          }))
        } else {
          // Missing image — show alt text
          runs.push(new TextRun({ text: `[${token.text || 'image'}]`, ...formatting, italics: true }))
        }
        break
      }
      case 'del':
        runs.push(...convertInlineTokens(token.tokens, ctx, { ...formatting, strike: true }))
        break
      case 'br':
        runs.push(new TextRun({ break: 1 }))
        break
      case 'escape':
        runs.push(new TextRun({ text: token.text, ...formatting }))
        break
      default:
        if (token.raw) runs.push(new TextRun({ text: token.raw, ...formatting }))
        break
    }
  }
  return runs
}

// ---------------------------------------------------------------------------
// Block token walkers
// ---------------------------------------------------------------------------

function convertCodeBlock(token) {
  const lines = token.text.split('\n')
  return lines.map((line, i) => new Paragraph({
    children: [new TextRun({
      text: line || '\u00A0', // non-breaking space for empty lines
      font: { name: 'Consolas' },
      size: 20,
    })],
    shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
    spacing: { before: i === 0 ? 120 : 0, after: i === lines.length - 1 ? 120 : 0 },
    indent: { left: convertInchesToTwip(0.25) },
  }))
}

function convertBlockquote(token, ctx) {
  const children = convertBlockTokens(token.tokens, ctx)
  // Apply blockquote styling to each paragraph
  return children.map(child => {
    if (child instanceof Paragraph) {
      return new Paragraph({
        ...child,
        indent: { left: convertInchesToTwip(0.5) },
        border: { left: { style: BorderStyle.SINGLE, size: 3, color: 'CCCCCC', space: 8 } },
      })
    }
    return child
  })
}

function convertList(token, ctx, level) {
  const children = []
  for (const item of token.items) {
    const inlineTokens = []
    const nested = []

    for (const t of item.tokens) {
      if (t.type === 'text' && t.tokens) {
        inlineTokens.push(...t.tokens)
      } else if (t.type === 'paragraph') {
        if (inlineTokens.length === 0) {
          inlineTokens.push(...(t.tokens || []))
        } else {
          nested.push(t)
        }
      } else if (t.type === 'list') {
        nested.push(t)
      } else if (t.type === 'space') {
        // skip
      } else {
        nested.push(t)
      }
    }

    // Main list item paragraph
    children.push(new Paragraph({
      children: convertInlineTokens(inlineTokens, ctx),
      ...(token.ordered
        ? { numbering: { reference: 'ordered-list', level } }
        : { bullet: { level } }),
    }))

    // Nested blocks
    for (const block of nested) {
      if (block.type === 'list') {
        children.push(...convertList(block, ctx, level + 1))
      } else if (block.type === 'paragraph') {
        children.push(new Paragraph({
          children: convertInlineTokens(block.tokens, ctx),
          indent: { left: convertInchesToTwip(0.25 * (level + 1)) },
        }))
      }
    }
  }
  return children
}

function convertTable(token, ctx) {
  const borderStyle = {
    style: BorderStyle.SINGLE,
    size: 1,
    color: 'CCCCCC',
  }
  const borders = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
    insideHorizontal: borderStyle,
    insideVertical: borderStyle,
  }

  const rows = []

  // Header row
  if (token.header?.length) {
    rows.push(new TableRow({
      tableHeader: true,
      children: token.header.map(cell => new TableCell({
        children: [new Paragraph({
          children: convertInlineTokens(cell.tokens, ctx, { bold: true }),
        })],
        shading: { type: ShadingType.CLEAR, fill: 'F5F5F5' },
      })),
    }))
  }

  // Data rows
  for (const row of (token.rows || [])) {
    rows.push(new TableRow({
      children: row.map(cell => new TableCell({
        children: [new Paragraph({
          children: convertInlineTokens(cell.tokens, ctx),
        })],
      })),
    }))
  }

  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders,
  })
}

function convertBlockTokens(tokens, ctx) {
  const children = []
  for (const token of tokens) {
    switch (token.type) {
      case 'heading':
        children.push(new Paragraph({
          heading: HEADING_MAP[token.depth] || HeadingLevel.HEADING_3,
          children: convertInlineTokens(token.tokens, ctx),
        }))
        break
      case 'paragraph':
        children.push(new Paragraph({
          children: convertInlineTokens(token.tokens, ctx),
          spacing: { after: 120 },
        }))
        break
      case 'list':
        children.push(...convertList(token, ctx, 0))
        break
      case 'table':
        children.push(convertTable(token, ctx))
        break
      case 'code':
        children.push(...convertCodeBlock(token))
        break
      case 'blockquote':
        children.push(...convertBlockquote(token, ctx))
        break
      case 'hr':
        children.push(new Paragraph({
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'AAAAAA' } },
          spacing: { before: 200, after: 200 },
        }))
        break
      case 'html':
        // Strip tags, keep text
        if (token.text) {
          const stripped = token.text.replace(/<[^>]+>/g, '').trim()
          if (stripped) {
            children.push(new Paragraph({
              children: [new TextRun(stripped)],
              spacing: { after: 120 },
            }))
          }
        }
        break
      case 'space':
        break // skip
    }
  }
  return children
}

// ---------------------------------------------------------------------------
// Bibliography
// ---------------------------------------------------------------------------

function buildBibliography(citedKeys, references, style) {
  const isNumbered = style === 'ieee' || style === 'vancouver'
  const refs = []
  let num = 1
  const numberMap = {}

  // Collect cited references in order
  for (const key of citedKeys) {
    const ref = references?.getByKey?.(key)
    if (ref) {
      numberMap[key] = num
      refs.push({ ref, num: num++ })
    }
  }

  if (!refs.length) return []

  // For author-date styles, sort alphabetically
  if (!isNumbered) {
    refs.sort((a, b) => {
      const aAuth = a.ref.author?.[0]?.family || ''
      const bAuth = b.ref.author?.[0]?.family || ''
      return aAuth.localeCompare(bAuth) || String(a.ref.issued?.['date-parts']?.[0]?.[0] || '').localeCompare(String(b.ref.issued?.['date-parts']?.[0]?.[0] || ''))
    })
  }

  const children = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun('References')],
      spacing: { before: 400 },
    }),
  ]

  for (const { ref, num } of refs) {
    const segments = formatReferenceRich(ref, style, isNumbered ? num : undefined)
    const runs = segments
      .filter(s => s.text)
      .map(s => new TextRun({
        text: s.text,
        italics: !!s.italic,
        size: 22,
      }))

    children.push(new Paragraph({
      children: runs,
      spacing: { after: 80 },
      indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.5) },
    }))
  }

  return { children, numberMap }
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Convert markdown content to a DOCX blob.
 *
 * @param {string} markdown — raw markdown (may include YAML frontmatter)
 * @param {object} options
 * @param {object} options.references — references store (needs .getByKey(key))
 * @param {string} options.citationStyle — 'apa', 'chicago', 'ieee', etc.
 * @param {string} options.workspacePath — workspace root for resolving images
 * @param {object} options.settings — { font, font_size, page_size, margins }
 * @param {string} options.title — document title metadata
 * @returns {Promise<Blob>}
 */
export async function exportMarkdownToDocx(markdown, options = {}) {
  const { references, citationStyle = 'apa', workspacePath, title, settings = {} } = options

  // Resolve settings with defaults
  const font = settings.font || 'Calibri'
  const fontSizeHp = (settings.font_size || 11) * 2 // half-points for OOXML
  const pageSize = PAGE_SIZES[settings.page_size] || PAGE_SIZES.a4
  const marginTwips = MARGIN_MAP[settings.margins] || MARGIN_MAP.normal

  // 1. Strip frontmatter
  const stripped = stripFrontmatter(markdown)

  // 2. Extract footnotes
  const { cleaned, defs: footnoteDefs } = extractFootnotes(stripped)

  // 3. Assign footnote IDs (docx uses positive integers, starting from 1)
  const footnoteIds = {}
  let fnCounter = 1
  for (const label of Object.keys(footnoteDefs)) {
    footnoteIds[label] = fnCounter++
  }

  // 4. Parse with marked
  const tokens = parser.lexer(cleaned)

  // 5. Pre-load images
  const imageCache = workspacePath ? await preloadImages(tokens, workspacePath) : {}

  // 6. Build context
  const ctx = {
    references,
    citationStyle,
    workspacePath,
    citedKeys: new Set(),
    citationNumberMap: null, // built after first pass for numbered styles
    footnoteIds,
    imageCache,
  }

  // 7. Convert block tokens
  const children = convertBlockTokens(tokens, ctx)

  // 8. Bibliography
  let footnotes = {}
  if (ctx.citedKeys.size > 0 && references) {
    const bib = buildBibliography(ctx.citedKeys, references, citationStyle)
    if (bib.numberMap) ctx.citationNumberMap = bib.numberMap
    children.push(...bib.children)
  }

  // 9. Build footnote definitions for docx
  for (const [label, content] of Object.entries(footnoteDefs)) {
    const id = footnoteIds[label]
    footnotes[id] = {
      children: [new Paragraph({ children: [new TextRun({ text: content, size: 20 })] })],
    }
  }

  // 10. Numbering config for ordered lists
  const numberingConfig = [{
    reference: 'ordered-list',
    levels: [
      { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: convertInchesToTwip(0.5), hanging: convertInchesToTwip(0.25) } } } },
      { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: convertInchesToTwip(1), hanging: convertInchesToTwip(0.25) } } } },
      { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', alignment: AlignmentType.START, style: { paragraph: { indent: { left: convertInchesToTwip(1.5), hanging: convertInchesToTwip(0.25) } } } },
    ],
  }]

  // 11. Assemble document — heading sizes scale with body font
  const h1Size = Math.round(fontSizeHp * 1.45)
  const h2Size = Math.round(fontSizeHp * 1.27)
  const h3Size = Math.round(fontSizeHp * 1.09)

  const doc = new Document({
    creator: 'Shoulders',
    title: title || 'Document',
    styles: {
      default: {
        document: {
          run: { font, size: fontSizeHp },
        },
        heading1: { run: { size: h1Size, bold: true, font }, paragraph: { spacing: { before: 240, after: 120 } } },
        heading2: { run: { size: h2Size, bold: true, font }, paragraph: { spacing: { before: 200, after: 100 } } },
        heading3: { run: { size: h3Size, bold: true, font }, paragraph: { spacing: { before: 160, after: 80 } } },
      },
    },
    numbering: { config: numberingConfig },
    footnotes,
    sections: [{
      properties: {
        page: {
          size: pageSize,
          margin: { top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips },
        },
      },
      children,
    }],
  })

  return Packer.toBlob(doc)
}
