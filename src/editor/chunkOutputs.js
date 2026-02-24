// CM6 extension for inline chunk outputs below code chunks in .Rmd/.qmd files.
// Shows rich outputs (plots, tables, errors) via CellOutput.vue rendered as block widgets.
// Block decorations MUST come from a StateField (not ViewPlugin) —
// CM6 throws "Block decorations may not be specified via plugins".

import { StateField, StateEffect } from '@codemirror/state'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'
import { createApp, h } from 'vue'
import CellOutput from '../components/editor/CellOutput.vue'
import { chunkField } from './codeChunks'

// ── State Effects ────────────────────────────────────────────

export const setChunkOutput = StateEffect.define()   // { chunkKey, outputs, status }
export const clearChunkOutput = StateEffect.define()  // chunkKey string
export const clearAllOutputs = StateEffect.define()   // no value

// ── Chunk Identity ───────────────────────────────────────────

export function chunkKey(chunk, doc) {
  const content = doc.sliceString(chunk.contentFrom, chunk.contentTo).trim()
  const fingerprint = content.substring(0, 80)
  return `${chunk.language}::${chunk.headerLine}::${fingerprint}`
}

// ── State Field (output data) ────────────────────────────────

export const chunkOutputField = StateField.define({
  create() {
    return new Map()
  },

  update(map, tr) {
    let changed = false
    let next = map

    for (const effect of tr.effects) {
      if (effect.is(setChunkOutput)) {
        if (!changed) { next = new Map(map); changed = true }
        next.set(effect.value.chunkKey, {
          outputs: effect.value.outputs,
          status: effect.value.status,
          timestamp: Date.now(),
        })
      } else if (effect.is(clearChunkOutput)) {
        if (map.has(effect.value)) {
          if (!changed) { next = new Map(map); changed = true }
          next.delete(effect.value)
        }
      } else if (effect.is(clearAllOutputs)) {
        if (map.size > 0) {
          next = new Map()
          changed = true
        }
      }
    }

    return next
  },
})

// ── Widget ───────────────────────────────────────────────────

class ChunkOutputWidget extends WidgetType {
  constructor(chunkKey, outputs, status) {
    super()
    this.chunkKey = chunkKey
    this.outputs = outputs
    this.status = status
    this._app = null
  }

  eq(other) {
    return this.chunkKey === other.chunkKey &&
      this.status === other.status &&
      this.outputs === other.outputs
  }

  toDOM(view) {
    const container = document.createElement('div')
    container.className = 'cm-chunk-output-widget'

    if (this.status === 'running') {
      const spinner = document.createElement('div')
      spinner.className = 'cm-chunk-output-spinner'
      spinner.innerHTML = '<div class="chunk-spinner-dot"></div><div class="chunk-spinner-dot"></div><div class="chunk-spinner-dot"></div>'
      container.appendChild(spinner)
      return container
    }

    if (!this.outputs || this.outputs.length === 0) {
      container.style.display = 'none'
      return container
    }

    // Close button
    const closeBtn = document.createElement('button')
    closeBtn.className = 'cm-chunk-output-close'
    closeBtn.title = 'Dismiss output'
    closeBtn.textContent = '\u00d7' // ×
    const key = this.chunkKey
    closeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      view.dispatch({ effects: clearChunkOutput.of(key) })
    })
    container.appendChild(closeBtn)

    // Mount CellOutput Vue component
    const mountPoint = document.createElement('div')
    container.appendChild(mountPoint)

    this._app = createApp({
      render: () => h(CellOutput, { outputs: this.outputs }),
    })
    this._app.mount(mountPoint)

    return container
  }

  destroy(dom) {
    if (this._app) {
      this._app.unmount()
      this._app = null
    }
  }
}

// ── Decoration StateField ────────────────────────────────────

function buildOutputDecorations(state) {
  const outputMap = state.field(chunkOutputField)
  if (outputMap.size === 0) return Decoration.none

  const chunks = state.field(chunkField)
  const decorations = []

  for (const chunk of chunks) {
    if (!chunk.endLine) continue
    const key = chunkKey(chunk, state.doc)
    const entry = outputMap.get(key)
    if (!entry) continue

    const endLine = state.doc.line(chunk.endLine)
    decorations.push(
      Decoration.widget({
        widget: new ChunkOutputWidget(key, entry.outputs, entry.status),
        block: true,
        side: 1,
      }).range(endLine.to)
    )
  }

  return Decoration.set(decorations, true)
}

const chunkOutputDecorations = StateField.define({
  create(state) {
    return Decoration.none
  },

  update(decos, tr) {
    if (tr.docChanged || tr.effects.some(e =>
      e.is(setChunkOutput) || e.is(clearChunkOutput) || e.is(clearAllOutputs)
    )) {
      return buildOutputDecorations(tr.state)
    }
    return decos
  },

  provide: f => EditorView.decorations.from(f),
})

// ── Extension ────────────────────────────────────────────────

export function chunkOutputsExtension() {
  return [
    chunkOutputField,
    chunkOutputDecorations,
  ]
}
