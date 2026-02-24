import { EditorView, Decoration, ViewPlugin, WidgetType, keymap } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
import { RangeSetBuilder, StateField, Prec } from '@codemirror/state'
import { invoke } from '@tauri-apps/api/core'

// Module-level cache: absolute path → data URL (persists for editor session)
const imageCache = new Map()

function getMimeType(path) {
  const ext = path.split('.').pop()?.toLowerCase()
  const map = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp',
                bmp: 'image/bmp', ico: 'image/x-icon', tiff: 'image/tiff' }
  return map[ext] || 'image/png'
}

function isRemoteUrl(src) {
  return /^https?:\/\//i.test(src)
}

function resolveImagePath(src, filePath) {
  if (isRemoteUrl(src)) return src
  if (src.startsWith('/')) return src
  // Resolve relative to the directory containing the markdown file
  const dir = filePath.substring(0, filePath.lastIndexOf('/'))
  return `${dir}/${src}`
}

/**
 * Check if a position is inside a fenced code block.
 */
function isInFencedCode(state, pos) {
  let inCode = false
  syntaxTree(state).iterate({
    from: pos,
    to: pos,
    enter(node) {
      const name = node.type.name
      if (name === 'FencedCode' || name === 'CodeBlock') {
        inCode = true
        return false
      }
    },
  })
  return inCode
}

/**
 * Parse a markdown table into structured data.
 * @param {string} text - Raw markdown table text
 * @returns {{ headers: string[], alignments: string[], rows: string[][] } | null}
 */
function parseMarkdownTable(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return null

  const splitRow = (line) => {
    let trimmed = line.trim()
    if (trimmed.startsWith('|')) trimmed = trimmed.slice(1)
    if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1)
    const cells = []
    let current = ''
    for (let i = 0; i < trimmed.length; i++) {
      if (trimmed[i] === '\\' && i + 1 < trimmed.length && trimmed[i + 1] === '|') {
        current += '|'
        i++
      } else if (trimmed[i] === '|') {
        cells.push(current.trim())
        current = ''
      } else {
        current += trimmed[i]
      }
    }
    cells.push(current.trim())
    return cells
  }

  const headerCells = splitRow(lines[0])
  const delimCells = splitRow(lines[1])

  // Validate delimiter row (must contain only dashes, colons, spaces)
  const isDelimiter = delimCells.every(c => /^:?-+:?$/.test(c.trim()))
  if (!isDelimiter) return null

  const alignments = delimCells.map(cell => {
    const d = cell.trim()
    const left = d.startsWith(':')
    const right = d.endsWith(':')
    if (left && right) return 'center'
    if (right) return 'right'
    return 'left'
  })

  const rows = []
  for (let i = 2; i < lines.length; i++) {
    rows.push(splitRow(lines[i]))
  }

  return { headers: headerCells, alignments, rows }
}

/**
 * Horizontal rule widget — replaces `---`/`***`/`___` with a styled <hr>.
 */
class HrWidget extends WidgetType {
  toDOM() {
    const el = document.createElement('hr')
    el.className = 'cm-lp-hr'
    return el
  }

  eq() { return true }
  ignoreEvent() { return false }
}

/**
 * Table widget — replaces raw markdown table with a rendered HTML table.
 */
class TableWidget extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }

  eq(other) { return this.text === other.text }
  ignoreEvent() { return false }

  toDOM() {
    const parsed = parseMarkdownTable(this.text)
    if (!parsed) {
      const pre = document.createElement('pre')
      pre.textContent = this.text
      pre.className = 'cm-lp-table-fallback'
      return pre
    }

    const table = document.createElement('table')
    table.className = 'cm-lp-table'

    const thead = document.createElement('thead')
    const headerRow = document.createElement('tr')
    parsed.headers.forEach((cell, i) => {
      const th = document.createElement('th')
      th.textContent = cell
      const align = parsed.alignments[i] || 'left'
      if (align !== 'left') th.style.textAlign = align
      headerRow.appendChild(th)
    })
    thead.appendChild(headerRow)
    table.appendChild(thead)

    if (parsed.rows.length > 0) {
      const tbody = document.createElement('tbody')
      parsed.rows.forEach(row => {
        const tr = document.createElement('tr')
        for (let i = 0; i < parsed.headers.length; i++) {
          const td = document.createElement('td')
          td.textContent = row[i] || ''
          const align = parsed.alignments[i] || 'left'
          if (align !== 'left') td.style.textAlign = align
          tr.appendChild(td)
        }
        tbody.appendChild(tr)
      })
      table.appendChild(tbody)
    }

    const wrapper = document.createElement('div')
    wrapper.className = 'cm-lp-table-wrap'
    wrapper.appendChild(table)
    return wrapper
  }
}

/**
 * Image widget — replaces `![alt](src)` with a rendered <img>.
 * Loads local images async via Rust (base64), caches the result.
 * Remote URLs are used directly.
 */
class ImageWidget extends WidgetType {
  constructor(src, absPath) {
    super()
    this.src = src
    this.absPath = absPath
  }

  eq(other) { return this.absPath === other.absPath }
  ignoreEvent() { return false }

  toDOM() {
    const wrapper = document.createElement('div')
    wrapper.className = 'cm-lp-image-wrap'

    const img = document.createElement('img')

    if (isRemoteUrl(this.absPath)) {
      img.src = this.absPath
      wrapper.appendChild(img)
    } else if (imageCache.has(this.absPath)) {
      img.src = imageCache.get(this.absPath)
      wrapper.appendChild(img)
    } else {
      const placeholder = document.createElement('span')
      placeholder.className = 'cm-lp-image-placeholder'
      placeholder.textContent = 'Loading image…'
      wrapper.appendChild(placeholder)

      const absPath = this.absPath
      invoke('read_file_base64', { path: absPath })
        .then(b64 => {
          const dataUrl = `data:${getMimeType(absPath)};base64,${b64}`
          imageCache.set(absPath, dataUrl)
          img.src = dataUrl
          wrapper.appendChild(img)
          placeholder.remove()
        })
        .catch(() => {
          placeholder.textContent = 'Image not found'
        })
    }

    return wrapper
  }
}

/**
 * Build decorations for live preview (semi-WYSIWYG).
 * Hides markdown syntax when cursor is NOT on the same line.
 */
function buildDecorations(view, isEnabled, getFilePath) {
  if (!isEnabled()) return Decoration.none

  const builder = new RangeSetBuilder()
  const { state } = view
  const cursorLine = state.doc.lineAt(state.selection.main.head).number

  // Additional cursor lines from all selection ranges
  const cursorLines = new Set()
  for (const range of state.selection.ranges) {
    const headLine = state.doc.lineAt(range.head).number
    const anchorLine = state.doc.lineAt(range.anchor).number
    for (let l = Math.min(headLine, anchorLine); l <= Math.max(headLine, anchorLine); l++) {
      cursorLines.add(l)
    }
  }

  const { from: vpFrom, to: vpTo } = view.viewport
  const start = Math.max(0, vpFrom - 500)
  const end = Math.min(state.doc.length, vpTo + 500)

  const decos = []

  syntaxTree(state).iterate({
    from: start,
    to: end,
    enter(node) {
      const name = node.type.name
      const nFrom = node.from
      const nTo = node.to

      // Skip anything inside fenced code
      if (name === 'FencedCode' || name === 'CodeBlock') return false

      const nodeLine = state.doc.lineAt(nFrom).number
      const onCursorLine = cursorLines.has(nodeLine)

      // Bold: StrongEmphasis — hide EmphasisMark children (**), apply bold to content
      if (name === 'StrongEmphasis' && !onCursorLine) {
        // Find the EmphasisMark children (** at start and end)
        let marks = []
        let contentFrom = nFrom
        let contentTo = nTo
        const parent = node
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.from < nFrom || child.to > nTo) return
            if (child.type.name === 'EmphasisMark') {
              marks.push({ from: child.from, to: child.to })
            }
          },
        })
        if (marks.length >= 2) {
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[0].from, marks[0].to))
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[marks.length - 1].from, marks[marks.length - 1].to))
          decos.push(Decoration.mark({ class: 'cm-lp-bold' }).range(marks[0].to, marks[marks.length - 1].from))
        }
        return false
      }

      // Italic: Emphasis (but not StrongEmphasis) — hide EmphasisMark, apply italic
      if (name === 'Emphasis' && !onCursorLine) {
        // Check we're not inside StrongEmphasis (already handled)
        let marks = []
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.from < nFrom || child.to > nTo) return
            if (child.type.name === 'EmphasisMark') {
              marks.push({ from: child.from, to: child.to })
            }
          },
        })
        if (marks.length >= 2) {
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[0].from, marks[0].to))
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[marks.length - 1].from, marks[marks.length - 1].to))
          decos.push(Decoration.mark({ class: 'cm-lp-italic' }).range(marks[0].to, marks[marks.length - 1].from))
        }
        return false
      }

      // Strikethrough: hide ~~, apply line-through
      if (name === 'Strikethrough' && !onCursorLine) {
        let marks = []
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.from < nFrom || child.to > nTo) return
            if (child.type.name === 'StrikethroughMark') {
              marks.push({ from: child.from, to: child.to })
            }
          },
        })
        if (marks.length >= 2) {
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[0].from, marks[0].to))
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[marks.length - 1].from, marks[marks.length - 1].to))
          decos.push(Decoration.mark({ class: 'cm-lp-strike' }).range(marks[0].to, marks[marks.length - 1].from))
        }
        return false
      }

      // Inline code: hide backticks
      if (name === 'InlineCode' && !onCursorLine) {
        let marks = []
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.from < nFrom || child.to > nTo) return
            if (child.type.name === 'CodeMark') {
              marks.push({ from: child.from, to: child.to })
            }
          },
        })
        if (marks.length >= 2) {
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[0].from, marks[0].to))
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(marks[marks.length - 1].from, marks[marks.length - 1].to))
        }
        return false
      }

      // Links: [text](url) — hide ](url) part, keep [text] visible
      if (name === 'Link' && !onCursorLine) {
        // Find URL and LinkMark nodes
        let linkMarks = []
        let url = null
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.from < nFrom || child.to > nTo) return
            if (child.type.name === 'LinkMark') {
              linkMarks.push({ from: child.from, to: child.to })
            }
            if (child.type.name === 'URL') {
              url = { from: child.from, to: child.to }
            }
          },
        })
        // Hide opening [ and the ](url) part
        // linkMarks: [0]=[, [1]=], [2]=(, [3]=)
        if (linkMarks.length >= 1) {
          // Hide the first [ bracket
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(linkMarks[0].from, linkMarks[0].to))
        }
        if (linkMarks.length >= 2) {
          // Hide from ] to closing ) — this includes ](url)
          decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(linkMarks[1].from, nTo))
        }
        // Style the visible text as a link
        if (linkMarks.length >= 2) {
          decos.push(Decoration.mark({ class: 'cm-lp-link' }).range(linkMarks[0].to, linkMarks[1].from))
        }
        return false
      }

      // Images: ![alt](src) — replace with rendered <img>
      if (name === 'Image' && !onCursorLine) {
        let imgUrl = null
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.from < nFrom || child.to > nTo) return
            if (child.type.name === 'URL') {
              imgUrl = state.sliceDoc(child.from, child.to)
            }
          },
        })
        if (imgUrl && getFilePath) {
          const absPath = resolveImagePath(imgUrl, getFilePath())
          decos.push(Decoration.replace({ widget: new ImageWidget(imgUrl, absPath) }).range(nFrom, nTo))
        }
        return false
      }

      // Headings: dim/shrink the # marks
      if (name.startsWith('ATXHeading') && !onCursorLine) {
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.type.name === 'HeaderMark') {
              decos.push(Decoration.mark({ class: 'cm-lp-heading-mark' }).range(child.from, child.to))
            }
          },
        })
      }

      // Blockquote: hide > mark, add left border via line decoration
      if (name === 'Blockquote' && !onCursorLine) {
        syntaxTree(state).iterate({
          from: nFrom,
          to: nTo,
          enter(child) {
            if (child.type.name === 'QuoteMark') {
              // Hide the > character and trailing space
              const hideEnd = Math.min(child.to + 1, nTo) // +1 for space after >
              decos.push(Decoration.mark({ class: 'cm-lp-hidden' }).range(child.from, hideEnd))
            }
          },
        })
        // Add left-border line decoration for each line in the blockquote
        const startLine = state.doc.lineAt(nFrom).number
        const endLine = state.doc.lineAt(Math.min(nTo, state.doc.length)).number
        for (let l = startLine; l <= endLine; l++) {
          const lineStart = state.doc.line(l).from
          decos.push(Decoration.line({ class: 'cm-lp-blockquote-line' }).range(lineStart))
        }
      }

      // Horizontal rule: replace with styled hr widget
      if (name === 'HorizontalRule' && !onCursorLine) {
        decos.push(Decoration.replace({ widget: new HrWidget() }).range(nFrom, nTo))
        return false
      }

      // Table: skip children — handled by separate StateField (block decorations
      // cannot come from ViewPlugins)
      if (name === 'Table') return false
    },
  })

  // Sort decorations by position (required by RangeSet)
  decos.sort((a, b) => a.from - b.from || a.startSide - b.startSide)

  for (const d of decos) {
    builder.add(d.from, d.to, d.value)
  }

  return builder.finish()
}

/**
 * Create the live preview extension.
 * @param {Function} isEnabled - () => boolean
 * @param {Function} [getFilePath] - () => string (current file path, for resolving relative image paths)
 * @returns {Extension[]}
 */
export function livePreviewExtension(isEnabled, getFilePath) {
  const plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildDecorations(view, isEnabled, getFilePath)
      }

      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          // Recalculate when enabled state might have changed
          update.startState.facet(EditorView.darkTheme) !== update.state.facet(EditorView.darkTheme)
        ) {
          this.decorations = buildDecorations(update.view, isEnabled, getFilePath)
        }
      }
    },
    { decorations: (v) => v.decorations }
  )

  const theme = EditorView.baseTheme({
    '.cm-lp-hidden': {
      fontSize: '0',
      overflow: 'hidden',
      display: 'inline',
      width: '0',
      verticalAlign: 'baseline',
    },
    '.cm-lp-bold': {
      fontWeight: 'bold',
    },
    '.cm-lp-italic': {
      fontStyle: 'italic',
    },
    '.cm-lp-strike': {
      textDecoration: 'line-through',
    },
    '.cm-lp-link': {
      color: 'var(--accent)',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
    },
    '.cm-lp-heading-mark': {
      opacity: '0.25',
      fontSize: '0.7em',
    },
    '.cm-lp-blockquote-line': {
      borderLeft: '3px solid var(--accent)',
      paddingLeft: '8px',
      opacity: '0.9',
    },
    '.cm-lp-hr': {
      border: 'none',
      borderTop: '1px solid var(--border)',
      margin: '8px 0',
      display: 'block',
    },
    '.cm-lp-table-wrap': {
      margin: '4px 0',
      overflowX: 'auto',
      display: 'block',
    },
    '.cm-lp-table': {
      borderCollapse: 'collapse',
      width: '100%',
      fontSize: 'var(--editor-font-size)',
      fontFamily: 'var(--font-mono)',
      color: 'var(--fg-primary)',
    },
    '.cm-lp-table th': {
      fontWeight: '600',
      backgroundColor: 'var(--bg-secondary)',
      borderBottom: '2px solid var(--border)',
      padding: '6px 12px',
      textAlign: 'left',
      color: 'var(--fg-primary)',
    },
    '.cm-lp-table td': {
      padding: '4px 12px',
      borderBottom: '1px solid var(--border)',
      color: 'var(--fg-secondary)',
    },
    '.cm-lp-table tbody tr:hover': {
      backgroundColor: 'var(--bg-hover)',
    },
    '.cm-lp-image-wrap': {
      display: 'block',
      margin: '4px 0',
      lineHeight: '0',
    },
    '.cm-lp-image-wrap img': {
      maxWidth: '100%',
      maxHeight: '400px',
      borderRadius: '4px',
      display: 'block',
    },
    '.cm-lp-image-placeholder': {
      display: 'block',
      padding: '12px',
      color: 'var(--fg-muted)',
      fontSize: 'var(--editor-font-size)',
      fontFamily: 'var(--font-mono)',
      lineHeight: '1.4',
    },
  })

  // Table decorations use a StateField because block/cross-line replace
  // decorations are not allowed from ViewPlugins.
  const tableField = StateField.define({
    create(state) {
      return buildTableDecorations(state, isEnabled)
    },
    update(value, tr) {
      if (tr.docChanged || tr.selection) {
        return buildTableDecorations(tr.state, isEnabled)
      }
      return value
    },
    provide: f => EditorView.decorations.from(f),
  })

  // Arrow keys skip over replace-decoration widgets. This keymap intercepts
  // ArrowDown/ArrowUp when adjacent to a widget-rendered table and moves the
  // cursor into it so the user can edit via keyboard, not just clicks.
  const tableNav = Prec.high(keymap.of([
    { key: 'ArrowDown', run: view => navigateIntoTable(view, 'down', isEnabled) },
    { key: 'ArrowUp', run: view => navigateIntoTable(view, 'up', isEnabled) },
  ]))

  return [plugin, tableField, tableNav, theme]
}

/**
 * Build block-level table decorations (separate from inline decorations).
 */
function buildTableDecorations(state, isEnabled) {
  if (!isEnabled()) return Decoration.none

  const cursorLines = new Set()
  for (const range of state.selection.ranges) {
    const headLine = state.doc.lineAt(range.head).number
    const anchorLine = state.doc.lineAt(range.anchor).number
    for (let l = Math.min(headLine, anchorLine); l <= Math.max(headLine, anchorLine); l++) {
      cursorLines.add(l)
    }
  }

  const decos = []

  syntaxTree(state).iterate({
    enter(node) {
      const name = node.type.name
      if (name === 'FencedCode' || name === 'CodeBlock') return false

      if (name === 'Table') {
        const fromLine = state.doc.lineAt(node.from)
        const toLine = state.doc.lineAt(node.to > node.from ? node.to - 1 : node.to)
        let cursorInTable = false
        for (let l = fromLine.number; l <= toLine.number; l++) {
          if (cursorLines.has(l)) { cursorInTable = true; break }
        }
        if (!cursorInTable) {
          const text = state.sliceDoc(node.from, node.to)
          decos.push(
            Decoration.replace({ widget: new TableWidget(text), block: true })
              .range(fromLine.from, toLine.to)
          )
        }
        return false
      }
    },
  })

  decos.sort((a, b) => a.from - b.from || a.startSide - b.startSide)

  const builder = new RangeSetBuilder()
  for (const d of decos) {
    builder.add(d.from, d.to, d.value)
  }
  return builder.finish()
}

/**
 * Arrow key handler: enter a widget-rendered table instead of skipping it.
 * Returns false (pass-through) when cursor is already inside a table or
 * when there's no adjacent table in the given direction.
 */
function navigateIntoTable(view, direction, isEnabled) {
  if (!isEnabled()) return false

  const { state } = view
  const pos = state.selection.main.head

  // If cursor is already inside a Table node, let default behavior handle it
  let insideTable = false
  syntaxTree(state).iterate({
    from: pos, to: pos,
    enter(node) {
      if (node.type.name === 'Table') { insideTable = true; return false }
    },
  })
  if (insideTable) return false

  const line = state.doc.lineAt(pos)

  if (direction === 'down') {
    const nextPos = line.to + 1
    if (nextPos >= state.doc.length) return false

    let tableFrom = null
    syntaxTree(state).iterate({
      from: nextPos, to: nextPos,
      enter(node) {
        if (node.type.name === 'Table') { tableFrom = node.from; return false }
      },
    })
    if (tableFrom !== null) {
      view.dispatch({ selection: { anchor: tableFrom } })
      return true
    }
  } else {
    if (line.from === 0) return false
    const prevPos = line.from - 1

    let tableTo = null
    syntaxTree(state).iterate({
      from: prevPos, to: prevPos,
      enter(node) {
        if (node.type.name === 'Table') { tableTo = node.to; return false }
      },
    })
    if (tableTo !== null) {
      const toLine = state.doc.lineAt(tableTo > 0 ? tableTo - 1 : tableTo)
      view.dispatch({ selection: { anchor: toLine.to } })
      return true
    }
  }

  return false
}
