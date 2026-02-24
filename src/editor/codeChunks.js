// CodeMirror 6 extension for R Markdown / Quarto code chunks.
// Detects ```{r}, ```{python}, ```{julia} fenced blocks and adds:
// - Gutter play button per chunk
// - Background tint on chunk lines
import { GutterMarker, gutter } from '@codemirror/view'
import { StateField, RangeSet } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

const CHUNK_RE = /^```\{(r|python|julia)(?:[,\s].*?)?\}\s*$/i
const FENCE_END_RE = /^```\s*$/

/**
 * Find all code chunks in a document.
 * Returns [{ language, headerLine, contentFrom, contentTo, endLine }]
 */
export function findCodeChunks(doc) {
  const chunks = []
  let inChunk = false
  let current = null

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i)
    const text = line.text.trimEnd()

    if (!inChunk) {
      const match = CHUNK_RE.exec(text)
      if (match) {
        inChunk = true
        current = {
          language: match[1].toLowerCase(),
          headerLine: i,
          contentFrom: line.to + 1,
          contentTo: line.to + 1,
          endLine: null,
        }
      }
    } else {
      if (FENCE_END_RE.test(text)) {
        current.contentTo = line.from
        current.endLine = i
        chunks.push(current)
        inChunk = false
        current = null
      }
    }
  }

  return chunks
}

// Gutter marker: green play button
class ChunkPlayMarker extends GutterMarker {
  constructor(chunkIdx) {
    super()
    this.chunkIdx = chunkIdx
  }

  toDOM() {
    const btn = document.createElement('button')
    btn.className = 'chunk-run-btn'
    btn.title = 'Run chunk'
    btn.innerHTML = '<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2l10 6-10 6V2z"/></svg>'
    btn.dataset.chunkIdx = this.chunkIdx
    return btn
  }
}

// State field: tracks chunk ranges for decoration + gutter
const chunkField = StateField.define({
  create(state) {
    return findCodeChunks(state.doc)
  },
  update(chunks, tr) {
    if (tr.docChanged) {
      return findCodeChunks(tr.state.doc)
    }
    return chunks
  },
})

// Gutter that shows play buttons on chunk header lines
const chunkGutter = gutter({
  class: 'cm-chunk-gutter',
  markers(view) {
    const chunks = view.state.field(chunkField)
    const markers = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const line = view.state.doc.line(chunk.headerLine)
      markers.push(new ChunkPlayMarker(i).range(line.from))
    }
    return RangeSet.of(markers)
  },
  domEventHandlers: {
    mousedown(view, line, event) {
      const target = event.target.closest('.chunk-run-btn')
      if (!target) return false
      const idx = parseInt(target.dataset.chunkIdx, 10)
      const chunks = view.state.field(chunkField)
      if (idx >= 0 && idx < chunks.length) {
        const chunk = chunks[idx]
        const content = view.state.sliceDoc(chunk.contentFrom, chunk.contentTo).trim()
        if (content) {
          // Dispatch event for TextEditor.vue to route through kernel bridge or REPL
          view.dom.dispatchEvent(new CustomEvent('chunk-execute', {
            bubbles: true,
            detail: { chunkIdx: idx },
          }))
        }
      }
      return true
    },
  },
})

// Line decorations for chunk background highlighting
import { EditorView, Decoration } from '@codemirror/view'
import { ViewPlugin } from '@codemirror/view'

const chunkHighlighter = ViewPlugin.fromClass(class {
  constructor(view) {
    this.decorations = this.buildDecorations(view)
  }

  update(update) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view) {
    const chunks = view.state.field(chunkField)
    const decorations = []

    for (const chunk of chunks) {
      // Header line decoration
      const headerLine = view.state.doc.line(chunk.headerLine)
      decorations.push(
        Decoration.line({ class: 'cm-chunk-header' }).range(headerLine.from)
      )

      // Content lines decoration
      if (chunk.contentFrom < chunk.contentTo) {
        const startLine = view.state.doc.lineAt(chunk.contentFrom)
        const endLine = view.state.doc.lineAt(Math.max(chunk.contentFrom, chunk.contentTo - 1))
        for (let i = startLine.number; i <= endLine.number; i++) {
          const line = view.state.doc.line(i)
          decorations.push(
            Decoration.line({ class: 'cm-chunk-content' }).range(line.from)
          )
        }
      }

      // End fence decoration
      if (chunk.endLine) {
        const endL = view.state.doc.line(chunk.endLine)
        decorations.push(
          Decoration.line({ class: 'cm-chunk-header' }).range(endL.from)
        )
      }
    }

    return Decoration.set(decorations, true)
  }
}, {
  decorations: v => v.decorations,
})

export { chunkField }

/**
 * Returns the chunk (from findCodeChunks) that contains `pos`,
 * where "contains" means from the header line start through the end fence line end.
 * Returns null if pos is in prose/YAML.
 */
export function chunkAtPosition(chunks, doc, pos) {
  for (const chunk of chunks) {
    const headerFrom = doc.line(chunk.headerLine).from
    const endTo = chunk.endLine ? doc.line(chunk.endLine).to : chunk.contentTo
    if (pos >= headerFrom && pos <= endTo) return chunk
  }
  return null
}

/**
 * Extracts code + language for all complete, non-empty chunks.
 */
export function extractAllChunkCode(doc, chunks) {
  const result = []
  for (const chunk of chunks) {
    if (!chunk.endLine) continue
    const code = doc.sliceString(chunk.contentFrom, chunk.contentTo).trim()
    if (code) result.push({ code, language: chunk.language })
  }
  return result
}

/**
 * Returns the code chunks extension array.
 * Call this for .Rmd/.qmd files.
 */
export function codeChunksExtension() {
  return [
    chunkField,
    chunkGutter,
    chunkHighlighter,
  ]
}
