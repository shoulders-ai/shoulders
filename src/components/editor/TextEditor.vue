<template>
  <div ref="editorContainer" class="h-full w-full overflow-hidden" :data-editor-filepath="props.filePath" @contextmenu.prevent="onContextMenu"></div>
  <EditorContextMenu
    :visible="ctxMenu.show"
    :x="ctxMenu.x"
    :y="ctxMenu.y"
    :has-selection="ctxMenu.hasSelection"
    :file-path="props.filePath"
    :view="view"
    :spellcheck-enabled="isMd && workspace.spellcheck"
    @close="ctxMenu.show = false"
  />
  <CitationPalette
    v-if="citPalette.show"
    :mode="citPalette.mode"
    :pos-x="citPalette.x"
    :pos-y="citPalette.y"
    :query="citPalette.query"
    :cites="citPalette.cites"
    :latex-command="citPalette.latexCommand"
    @insert="onCitInsert"
    @update="onCitUpdate"
    @close="onCitClose"
  />
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { Prec } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { languages } from '@codemirror/language-data'
import { createEditorExtensions, createEditorState, wrapCompartment, spellCheckCompartment, columnWidthCompartment, columnWidthExtension } from '../../editor/setup'
import { ghostSuggestionExtension } from '../../editor/ghostSuggestion'
import { mergeViewExtension, reconfigureMergeView, computeOriginalContent } from '../../editor/diffOverlay'
import { tasksExtension, addTask, removeTask, updateTask, taskField } from '../../editor/tasks'
import { wikiLinksExtension } from '../../editor/wikiLinks'
import { livePreviewExtension } from '../../editor/livePreview'
import { citationsExtension, CITATION_GROUP_RE, CITE_KEY_RE } from '../../editor/citations'
import CitationPalette from './CitationPalette.vue'
import { autocompletion } from '@codemirror/autocomplete'
import { useFilesStore } from '../../stores/files'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { useReviewsStore } from '../../stores/reviews'
import { useTasksStore } from '../../stores/tasks'
import { useLinksStore } from '../../stores/links'
import { useReferencesStore } from '../../stores/references'
import { isMarkdown, isLatex, isImage, isRunnable, getLanguage, isRmdOrQmd, relativePath } from '../../utils/fileTypes'
import { useLatexStore } from '../../stores/latex'
import { latexCitationsExtension, LATEX_CITE_RE } from '../../editor/latexCitations'
import { latexCommandCompletionSource } from '../../editor/latexAutocomplete'
import EditorContextMenu from './EditorContextMenu.vue'
import { computeMinimalChange } from '../../utils/textDiff'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const emit = defineEmits(['cursor-change', 'editor-stats'])

const editorContainer = ref(null)
const files = useFilesStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()
const reviews = useReviewsStore()
const tasksStore = useTasksStore()
const linksStore = useLinksStore()
const referencesStore = useReferencesStore()
const latexStore = useLatexStore()

const ctxMenu = reactive({ show: false, x: 0, y: 0, hasSelection: false })

function onContextMenu(e) {
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.hasSelection = view ? view.state.selection.main.from !== view.state.selection.main.to : false
  ctxMenu.show = true
}

// ── Citation Palette state ──────────────────────────────────
const citPalette = reactive({
  show: false,
  mode: 'insert',
  x: 0,
  y: 0,
  query: '',
  cites: [],
  latexCommand: null,
  triggerFrom: 0,
  triggerTo: 0,
  insideBrackets: false,
  // For edit mode: group boundaries
  groupFrom: 0,
  groupTo: 0,
})

function onCitInsert({ keys, stayOpen, latexCommand }) {
  if (!view || !keys.length) return
  const key = keys[0]

  if (isTex && latexCommand) {
    // LaTeX: \citep{key} or add key to existing \citep{existing, key}
    const text = citPalette.insideBrackets
      ? key
      : `\\${latexCommand}{${key}}`
    view.dispatch({
      changes: { from: citPalette.triggerFrom, to: citPalette.triggerTo, insert: text },
    })
  } else {
    // Markdown: [@key] or just @key inside existing brackets
    const text = citPalette.insideBrackets
      ? `@${key}`
      : `[@${key}]`
    view.dispatch({
      changes: { from: citPalette.triggerFrom, to: citPalette.triggerTo, insert: text },
    })
  }

  if (stayOpen) {
    // Transition to edit mode: find the just-inserted citation group
    const cursor = view.state.selection.main.head
    const line = view.state.doc.lineAt(cursor)
    CITATION_GROUP_RE.lastIndex = 0
    let match
    while ((match = CITATION_GROUP_RE.exec(line.text)) !== null) {
      const gFrom = line.from + match.index
      const gTo = gFrom + match[0].length
      if (cursor >= gFrom && cursor <= gTo) {
        citPalette.mode = 'edit'
        citPalette.groupFrom = gFrom
        citPalette.groupTo = gTo
        citPalette.cites = parseCitationGroup(match[0])
        citPalette.query = ''
        return
      }
    }
  }

  citPalette.show = false
  view.focus()
}

function onCitUpdate({ cites }) {
  if (!view) return

  if (isTex) {
    // LaTeX: reconstruct \command{key1, key2}
    const keys = cites.map(c => c.key)
    const cmd = citPalette.latexCommand || 'cite'
    const text = `\\${cmd}{${keys.join(', ')}}`
    view.dispatch({
      changes: { from: citPalette.groupFrom, to: citPalette.groupTo, insert: text },
    })
    citPalette.groupTo = citPalette.groupFrom + text.length
  } else {
    // Markdown: reconstruct [prefix @key1, locator1; prefix @key2, locator2]
    if (cites.length === 0) {
      // Remove entire citation group
      view.dispatch({
        changes: { from: citPalette.groupFrom, to: citPalette.groupTo, insert: '' },
      })
      return
    }
    const parts = cites.map(c => {
      let part = ''
      if (c.prefix) part += c.prefix + ' '
      part += '@' + c.key
      if (c.locator) part += ', ' + c.locator
      return part
    })
    const text = '[' + parts.join('; ') + ']'
    view.dispatch({
      changes: { from: citPalette.groupFrom, to: citPalette.groupTo, insert: text },
    })
    citPalette.groupTo = citPalette.groupFrom + text.length
  }
}

function onCitClose() {
  citPalette.show = false
  view?.focus()
}

function parseCitationGroup(text) {
  const inner = text.slice(1, -1) // strip [ ]
  // Split on ; or , when followed by @ (lookahead keeps the @)
  // This handles both standard Pandoc (;) and common comma-separated citations
  const parts = inner.split(/\s*;\s*|\s*,\s*(?=@)/).map(s => s.trim()).filter(Boolean)
  const cites = []
  for (const part of parts) {
    const keyMatch = part.match(/@([a-zA-Z][\w]*)/)
    if (!keyMatch) continue
    const key = keyMatch[1]
    const afterKey = part.substring(part.indexOf(keyMatch[0]) + keyMatch[0].length).replace(/^[\s,]+/, '')
    const prefix = part.substring(0, part.indexOf(keyMatch[0])).trim()
    cites.push({ key, locator: afterKey, prefix })
  }
  return cites
}

let view = null
let rmdKernelBridge = null
let chunkExecuteHandler = null
let chunkExecuteAllHandler = null
const isMd = isMarkdown(props.filePath)
const isTex = isLatex(props.filePath)
const fileIsRunnable = isRunnable(props.filePath)
const fileLanguage = getLanguage(props.filePath)
const fileIsRmdOrQmd = isRmdOrQmd(props.filePath)

async function loadLanguageExtension() {
  if (isMd) {
    const { markdown, markdownLanguage } = await import('@codemirror/lang-markdown')
    return markdown({ base: markdownLanguage, codeLanguages: languages })
  }
  // Try to match by filename from the language-data registry
  const matched = languages.filter((lang) => {
    // LanguageDescription has filename patterns and extensions
    const name = props.filePath.split('/').pop() || ''
    if (lang.filename && lang.filename.test(name)) return true
    if (lang.extensions) {
      const dot = name.lastIndexOf('.')
      if (dot > 0) {
        const ext = name.substring(dot + 1)
        return lang.extensions.includes(ext)
      }
    }
    return false
  })
  if (matched.length > 0) {
    const loaded = await matched[0].load()
    return loaded
  }
  return null
}

onMounted(async () => {
  if (!editorContainer.value) return

  // Load file content
  let content = files.fileContents[props.filePath]
  if (content === undefined) {
    content = await files.readFile(props.filePath)
  }
  if (content === null) content = ''

  // Load language
  const langExt = await loadLanguageExtension()

  // Build extra extensions
  const extraExtensions = [
    // Ghost suggestions (all file types)
    ghostSuggestionExtension(
      () => workspace,
      () => workspace.systemPrompt,
      { isEnabled: () => workspace.ghostEnabled, getInstructions: () => workspace.instructions },
    ),
    // Merge view for inline diffs (always available)
    mergeViewExtension(),
    // Tasks (always available)
    ...tasksExtension(),
    // Track doc changes for task position mapping
    EditorView.updateListener.of((update) => {
      if (update.docChanged) handleDocChanged()
    }),
  ]

  // Code runner keybindings for runnable files
  if (fileIsRunnable) {
    const { sendCode, runFile } = await import('../../services/codeRunner')

    if (fileIsRmdOrQmd) {
      // .Rmd/.qmd: chunk-aware execution with inline outputs
      const { chunkField: cf, chunkAtPosition, extractAllChunkCode } = await import('../../editor/codeChunks')
      const { chunkOutputsExtension, setChunkOutput, clearChunkOutput, chunkKey: getChunkKey } = await import('../../editor/chunkOutputs')
      const { ChunkKernelBridge } = await import('../../services/chunkKernelBridge')

      // Load inline output widgets
      extraExtensions.push(...chunkOutputsExtension())

      // Jupyter kernel bridge — no subprocess fallback
      const kernelBridge = new ChunkKernelBridge(workspace.path)
      rmdKernelBridge = kernelBridge

      /**
       * Execute a chunk inline via Jupyter kernel.
       * Shows setup error if no kernel is available.
       */
      async function executeChunk(editorView, chunk) {
        const code = editorView.state.sliceDoc(chunk.contentFrom, chunk.contentTo).trim()
        if (!code) return

        const key = getChunkKey(chunk, editorView.state.doc)

        editorView.dispatch({
          effects: setChunkOutput.of({ chunkKey: key, outputs: [], status: 'running' }),
        })

        const result = await kernelBridge.execute(code, chunk.language)
        editorView.dispatch({
          effects: setChunkOutput.of({
            chunkKey: key,
            outputs: result.outputs,
            status: result.success ? 'done' : 'error',
          }),
        })
      }

      extraExtensions.push(Prec.highest(keymap.of([
        {
          key: 'Mod-Enter',
          run: (editorView) => {
            const state = editorView.state
            const sel = state.selection.main
            const chunks = state.field(cf)
            const chunk = chunkAtPosition(chunks, state.doc, sel.head)
            if (!chunk) return true // In prose/YAML → do nothing

            if (sel.from !== sel.to) {
              // Selection → run only selected text, show output under this chunk
              const selCode = state.sliceDoc(sel.from, sel.to).trim()
              if (selCode) {
                const key = getChunkKey(chunk, state.doc)
                editorView.dispatch({
                  effects: setChunkOutput.of({ chunkKey: key, outputs: [], status: 'running' }),
                })
                kernelBridge.execute(selCode, chunk.language).then(result => {
                  editorView.dispatch({
                    effects: setChunkOutput.of({
                      chunkKey: key,
                      outputs: result.outputs,
                      status: result.success ? 'done' : 'error',
                    }),
                  })
                })
              }
              return true
            }

            executeChunk(editorView, chunk)

            // Advance cursor to next chunk header
            const idx = chunks.indexOf(chunk)
            if (idx >= 0 && idx + 1 < chunks.length) {
              const nextChunk = chunks[idx + 1]
              const nextLine = state.doc.line(nextChunk.headerLine)
              editorView.dispatch({
                selection: { anchor: nextLine.from },
                scrollIntoView: true,
              })
            }
            return true
          },
        },
        {
          key: 'Shift-Mod-Enter',
          run: (editorView) => {
            const totalChunks = editorView.state.field(cf).length

            // Run all chunks sequentially, re-reading live state each iteration
            ;(async () => {
              for (let i = 0; i < totalChunks; i++) {
                const chunks = editorView.state.field(cf)
                const chunk = chunks[i]
                if (!chunk || !chunk.endLine) continue
                const code = editorView.state.sliceDoc(chunk.contentFrom, chunk.contentTo).trim()
                if (!code) continue
                await executeChunk(editorView, chunk)
              }
            })()
            return true
          },
        },
      ])))

      // Listen for chunk-execute events from gutter play buttons
      chunkExecuteHandler = (event) => {
        if (!view) return
        const { chunkIdx } = event.detail || {}
        const chunks = view.state.field(cf)
        if (chunkIdx >= 0 && chunkIdx < chunks.length) {
          executeChunk(view, chunks[chunkIdx])
        }
      }

      // Listen for chunk-execute-all (Run All button) — sequential execution
      // Re-reads chunks on each iteration so offsets stay fresh after output widgets shift lines
      chunkExecuteAllHandler = async (event) => {
        if (!view) return
        const totalChunks = view.state.field(cf).length
        for (let i = 0; i < totalChunks; i++) {
          const chunks = view.state.field(cf)
          const chunk = chunks[i]
          if (!chunk || !chunk.endLine) continue
          const code = view.state.sliceDoc(chunk.contentFrom, chunk.contentTo).trim()
          if (!code) continue
          await executeChunk(view, chunk)
        }
      }
    } else {
      // Plain .r/.py/.jl: line-by-line execution
      extraExtensions.push(Prec.highest(keymap.of([
        {
          key: 'Mod-Enter',
          run: (editorView) => {
            const state = editorView.state
            const sel = state.selection.main
            let code
            if (sel.from !== sel.to) {
              code = state.sliceDoc(sel.from, sel.to)
            } else {
              const line = state.doc.lineAt(sel.head)
              code = line.text
              if (line.number < state.doc.lines) {
                const nextLine = state.doc.line(line.number + 1)
                editorView.dispatch({
                  selection: { anchor: nextLine.from },
                  scrollIntoView: true,
                })
              }
            }
            if (code) sendCode(code, fileLanguage)
            return true
          },
        },
        {
          key: 'Shift-Mod-Enter',
          run: () => {
            runFile(props.filePath, fileLanguage)
            return true
          },
        },
      ])))
    }
  }

  // Code chunk gutter play buttons for .Rmd/.qmd files
  if (fileIsRmdOrQmd) {
    const { codeChunksExtension } = await import('../../editor/codeChunks')
    extraExtensions.push(...codeChunksExtension())
  }

  // Markdown-only extensions
  if (isMd) {
    const completionSources = []

    const wikiLinks = wikiLinksExtension({
      resolveLink: (target, fromPath) => linksStore.resolveLink(target, fromPath),
      getFiles: () => linksStore.allFileNames,
      getHeadings: (target) => {
        const resolved = linksStore.resolveLink(target, props.filePath)
        if (!resolved) return null
        return linksStore.headingsForFile(resolved.path)
      },
      currentFilePath: () => props.filePath,
    })
    extraExtensions.push(...wikiLinks.extensions)
    completionSources.push(wikiLinks.completionSource)

    const citations = citationsExtension(referencesStore, {
      isOpen: () => citPalette.show,
      onOpen: ({ x, y, query, triggerFrom, triggerTo, insideBrackets }) => {
        citPalette.show = true
        citPalette.mode = 'insert'
        citPalette.x = x
        citPalette.y = y
        citPalette.query = query
        citPalette.triggerFrom = triggerFrom
        citPalette.triggerTo = triggerTo
        citPalette.insideBrackets = insideBrackets
        citPalette.latexCommand = null
        citPalette.cites = []
      },
      onQueryChange: (query, cursorPos) => {
        citPalette.query = query
        citPalette.triggerTo = cursorPos
      },
      onDismiss: () => {
        if (citPalette.show && citPalette.mode === 'insert') {
          citPalette.show = false
        }
      },
    })
    extraExtensions.push(...citations.extensions)

    // Single autocompletion instance with wiki links only (citations use palette now)
    extraExtensions.push(autocompletion({
      override: completionSources,
      activateOnTyping: true,
      activateOnTypingDelay: 0,
      defaultKeymap: true,
    }))

    // Formatting shortcuts (Cmd+B, Cmd+I, etc.)
    const { markdownShortcuts } = await import('../../editor/markdownShortcuts')
    extraExtensions.push(markdownShortcuts())

    // Live preview (hide markdown syntax when cursor is elsewhere)
    extraExtensions.push(...livePreviewExtension(() => workspace.livePreviewEnabled, () => props.filePath))
  }

  // LaTeX-only extensions
  if (isTex) {
    const completionSources = []

    const latexCitations = latexCitationsExtension(referencesStore, {
      isOpen: () => citPalette.show,
      onOpen: ({ x, y, query, triggerFrom, triggerTo, insideBrackets, latexCommand }) => {
        citPalette.show = true
        citPalette.mode = 'insert'
        citPalette.x = x
        citPalette.y = y
        citPalette.query = query
        citPalette.triggerFrom = triggerFrom
        citPalette.triggerTo = triggerTo
        citPalette.insideBrackets = insideBrackets
        citPalette.latexCommand = latexCommand
        citPalette.cites = []
      },
      onQueryChange: (query, cursorPos, newTriggerFrom) => {
        citPalette.query = query
        citPalette.triggerTo = cursorPos
        if (newTriggerFrom !== undefined) citPalette.triggerFrom = newTriggerFrom
      },
      onDismiss: () => {
        if (citPalette.show && citPalette.mode === 'insert') {
          citPalette.show = false
        }
      },
    })
    extraExtensions.push(...latexCitations.extensions)

    // LaTeX command autocomplete (citations now use palette)
    completionSources.push(latexCommandCompletionSource)

    extraExtensions.push(autocompletion({
      override: completionSources,
      activateOnTyping: true,
      activateOnTypingDelay: 0,
      defaultKeymap: true,
    }))
  }

  const extensions = createEditorExtensions({
    softWrap: workspace.softWrap,
    wrapColumn: workspace.wrapColumn,
    spellcheck: isMd && workspace.spellcheck,
    languageExtension: langExt,
    onSave: (content) => {
      files.saveFile(props.filePath, content)
      if (isTex) latexStore.scheduleAutoCompile(props.filePath)
    },
    onCursorChange: (pos) => {
      emit('cursor-change', pos)
    },
    onStats: (stats) => {
      emit('editor-stats', stats)
    },
    extraExtensions,
  })

  const state = createEditorState(content, extensions)

  view = new EditorView({
    state,
    parent: editorContainer.value,
  })

  // Register view
  editorStore.registerEditorView(props.paneId, props.filePath, view)

  // Set initial merge view if there are pending edits
  showMergeViewIfNeeded()

  // LaTeX: trigger initial compile on open
  if (isTex) {
    latexStore.scheduleAutoCompile(props.filePath)
  }

  // Native click handler for wiki link + citation navigation (markdown only)
  if (isMd) {
    editorContainer.value.addEventListener('click', handleWikiLinkClick)
    editorContainer.value.addEventListener('click', handleCitationClick)
  }

  // LaTeX citation click → edit mode
  if (isTex) {
    editorContainer.value.addEventListener('click', handleLatexCitationClick)
  }

  // Task-click handler (gutter dot clicks)
  editorContainer.value.addEventListener('task-click', handleTaskClick)

  // Chunk execute handlers for .Rmd/.qmd
  if (chunkExecuteHandler) {
    editorContainer.value.addEventListener('chunk-execute', chunkExecuteHandler)
    editorContainer.value.addEventListener('chunk-execute-all', chunkExecuteAllHandler)
  }

  // Initial task sync
  syncTasksToEditor(tasksStore.threadsForFile(props.filePath))
})

// LaTeX: backward sync listener (PDF → editor line jump)
let backwardSyncHandler = null
if (isTex) {
  backwardSyncHandler = (e) => {
    if (!view) return
    const { file, line } = e.detail || {}
    // Only respond if this is our file
    if (file && !props.filePath.endsWith(file.split('/').pop())) return
    if (line && line > 0) {
      const docLine = view.state.doc.line(Math.min(line, view.state.doc.lines))
      view.dispatch({
        selection: { anchor: docLine.from },
        scrollIntoView: true,
        effects: EditorView.scrollIntoView(docLine.from, { y: 'center' }),
      })
      // Brief highlight
      view.dispatch({
        effects: EditorView.scrollIntoView(docLine.from, { y: 'center' }),
      })
    }
  }
  window.addEventListener('latex-backward-sync', backwardSyncHandler)

  // Respond to forward-sync requests from PDF viewer
  window.addEventListener('latex-request-cursor', (e) => {
    if (!view) return
    if (e.detail?.texPath !== props.filePath) return
    const pos = view.state.selection.main.head
    const line = view.state.doc.lineAt(pos).number
    window.dispatchEvent(new CustomEvent('latex-cursor-response', {
      detail: { texPath: props.filePath, line },
    }))
  })

}

// Wiki link click navigation (plain click navigates, like Obsidian)
function handleWikiLinkClick(event) {
  if (!view) return

  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return

  const line = view.state.doc.lineAt(pos)
  const lineText = line.text

  const re = /\[\[([^\]]+)\]\]/g
  let match
  while ((match = re.exec(lineText)) !== null) {
    const mFrom = line.from + match.index
    const mTo = mFrom + match[0].length
    if (pos >= mFrom && pos < mTo) {
      let target = match[1]
      let heading = null

      const pipeIdx = target.indexOf('|')
      if (pipeIdx !== -1) target = target.substring(0, pipeIdx)

      const hashIdx = target.indexOf('#')
      if (hashIdx !== -1) {
        heading = target.substring(hashIdx + 1)
        target = target.substring(0, hashIdx)
      }
      target = target.trim()
      if (!target) return

      const resolved = linksStore.resolveLink(target, props.filePath)
      if (resolved) {
        editorStore.openFile(resolved.path)
      } else {
        // Create new file in same directory
        const dir = props.filePath.split('/').slice(0, -1).join('/')
        const newName = target.endsWith('.md') ? target : target + '.md'
        files.createFile(dir, newName).then(newPath => {
          if (newPath) editorStore.openFile(newPath)
        })
      }
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }
}

// Citation click: opens CitationPalette in edit mode
function handleCitationClick(event) {
  if (!view) return
  if (event.metaKey || event.ctrlKey) return

  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return

  const line = view.state.doc.lineAt(pos)

  CITATION_GROUP_RE.lastIndex = 0
  let match
  while ((match = CITATION_GROUP_RE.exec(line.text)) !== null) {
    const mFrom = line.from + match.index
    const mTo = mFrom + match[0].length
    if (pos >= mFrom && pos < mTo) {
      const cites = parseCitationGroup(match[0])
      const coords = view.coordsAtPos(mFrom)
      citPalette.show = true
      citPalette.mode = 'edit'
      citPalette.x = event.clientX
      citPalette.y = (coords?.bottom ?? event.clientY) + 2
      citPalette.groupFrom = mFrom
      citPalette.groupTo = mTo
      citPalette.cites = cites
      citPalette.query = ''
      citPalette.latexCommand = null
      citPalette.insideBrackets = true
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }
}

// LaTeX citation click: opens CitationPalette in edit mode
function handleLatexCitationClick(event) {
  if (!view) return
  if (event.metaKey || event.ctrlKey) return

  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
  if (pos === null) return

  const line = view.state.doc.lineAt(pos)

  LATEX_CITE_RE.lastIndex = 0
  let match
  while ((match = LATEX_CITE_RE.exec(line.text)) !== null) {
    const mFrom = line.from + match.index
    const mTo = mFrom + match[0].length
    if (pos >= mFrom && pos < mTo) {
      const cmdName = match[1]
      const keysStr = match[2]
      const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean)
      const cites = keys.map(key => ({ key, locator: '', prefix: '' }))
      const coords = view.coordsAtPos(mFrom)
      citPalette.show = true
      citPalette.mode = 'edit'
      citPalette.x = event.clientX
      citPalette.y = (coords?.bottom ?? event.clientY) + 2
      citPalette.groupFrom = mFrom
      citPalette.groupTo = mTo
      citPalette.cites = cites
      citPalette.query = ''
      citPalette.latexCommand = cmdName
      citPalette.insideBrackets = true
      event.preventDefault()
      event.stopPropagation()
      return
    }
  }
}

// Watch task threads → sync to CodeMirror
watch(
  () => tasksStore.threadsForFile(props.filePath),
  (storeThreads) => { if (view) syncTasksToEditor(storeThreads) },
  { deep: true }
)

function syncTasksToEditor(storeThreads) {
  if (!view) return
  const cmTasks = view.state.field(taskField)
  const storeIds = new Set(storeThreads.map(t => t.id))
  const cmIds = new Set(cmTasks.map(c => c.id))
  const effects = []

  // Add new threads
  for (const t of storeThreads) {
    if (!cmIds.has(t.id)) {
      effects.push(addTask.of({
        id: t.id,
        range: { from: t.range.from, to: t.range.to },
        status: t.status,
        messages: t.messages,
      }))
    }
  }

  // Remove deleted threads
  for (const c of cmTasks) {
    if (!storeIds.has(c.id)) {
      effects.push(removeTask.of(c.id))
    }
  }

  // Update changed threads (status)
  for (const t of storeThreads) {
    const existing = cmTasks.find(c => c.id === t.id)
    if (existing && existing.status !== t.status) {
      effects.push(updateTask.of({ id: t.id, status: t.status }))
    }
  }

  if (effects.length > 0) {
    view.dispatch({ effects })
  }
}

// Position mapping: on doc changes, update store with new ranges
function handleDocChanged() {
  if (!view) return
  const cmTasks = view.state.field(taskField)
  for (const c of cmTasks) {
    tasksStore.updateRange(c.id, c.range.from, c.range.to)
  }
}

function handleTaskClick(event) {
  const taskId = event.detail?.taskId
  if (taskId) {
    tasksStore.setActiveThread(taskId)
    // Dispatch a custom event that App.vue can listen to for opening the right panel
    window.dispatchEvent(new CustomEvent('open-tasks', { detail: { threadId: taskId } }))
  }
}

// Watch for pending edits changes → toggle merge view
// Uses nextTick to ensure the fileContents watcher (which updates the editor
// content) has run first — otherwise computeOriginalContent sees stale content
// and computes original === current, skipping the merge view on the first edit.
watch(
  () => reviews.editsForFile(props.filePath),
  async () => {
    await nextTick()
    showMergeViewIfNeeded()
  },
  { deep: true }
)

let mergeViewActive = false

function showMergeViewIfNeeded() {
  if (!view) return
  const edits = reviews.editsForFile(props.filePath)

  if (edits.length > 0) {
    const currentContent = view.state.doc.toString()
    const original = computeOriginalContent(currentContent, edits)

    if (original !== currentContent) {
      mergeViewActive = true
      reconfigureMergeView(view, original, () => {
        mergeViewActive = false
        reconfigureMergeView(view, null)
        // Sync editor content to disk (handles rejected chunks where disk still has new text)
        const finalContent = view.state.doc.toString()
        files.saveFile(props.filePath, finalContent)
        for (const edit of reviews.editsForFile(props.filePath)) {
          reviews.acceptEdit(edit.id)
        }
      })
    } else if (mergeViewActive) {
      mergeViewActive = false
      reconfigureMergeView(view, null)
    }
  } else if (mergeViewActive) {
    mergeViewActive = false
    reconfigureMergeView(view, null)
  }
}

// Watch for external file changes
watch(
  () => files.fileContents[props.filePath],
  (newContent) => {
    if (!view || newContent === undefined) return
    const currentContent = view.state.doc.toString()
    const change = computeMinimalChange(currentContent, newContent)
    if (change) {
      // Tear down merge view before replacing document to avoid
      // stale mark decorations (RangeError: Mark decorations may not be empty)
      if (mergeViewActive) {
        mergeViewActive = false
        reconfigureMergeView(view, null)
      }
      view.dispatch({ changes: change })
    }
    // Always check merge view — even when content didn't change in the editor,
    // pending edits may have been added in the same reactive flush
    showMergeViewIfNeeded()
  }
)

// Watch for soft wrap toggle
watch(
  () => workspace.softWrap,
  (wrap) => {
    if (!view) return
    view.dispatch({
      effects: wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : []),
    })
  }
)

// Watch for wrap column change
watch(
  () => workspace.wrapColumn,
  (col) => {
    if (!view) return
    view.dispatch({
      effects: columnWidthCompartment.reconfigure(columnWidthExtension(col)),
    })
  }
)

// Watch for spellcheck toggle (markdown files only)
if (isMd) {
  watch(
    () => workspace.spellcheck,
    (enabled) => {
      if (!view) return
      view.dispatch({
        effects: spellCheckCompartment.reconfigure(enabled ? EditorView.contentAttributes.of({ spellcheck: 'true' }) : []),
      })
    }
  )
}

// Watch for live preview toggle — nudge CM to rebuild decorations
if (isMd) {
  watch(
    () => workspace.livePreviewEnabled,
    () => {
      if (!view) return
      // Move selection to same position to trigger selectionSet → decoration rebuild
      const pos = view.state.selection.main.head
      view.dispatch({ selection: { anchor: pos } })
    }
  )
}

// File tree drag → editor drop (overlay blocks CM6 mouse events during drag)
let dropOverlay = null
let dropCursor = null
let draggedFilePaths = []

function buildInsertText(paths) {
  const lines = paths.map(p => {
    const relPath = relativePath(props.filePath, p)
    const fileName = p.split('/').pop()
    const nameNoExt = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName
    if (isMd) return isImage(p) ? `![${nameNoExt}](${relPath})` : `[${fileName}](${relPath})`
    if (isTex) return isImage(p) ? `\\includegraphics{${relPath}}` : `\\input{${relPath}}`
    return relPath
  })
  return lines.join('\n')
}

function onFileTreeDragStart(ev) {
  draggedFilePaths = ev.detail?.paths || []
  if (!draggedFilePaths.length || !editorContainer.value) return
  // Create transparent overlay to block CM6 mouse events
  dropOverlay = document.createElement('div')
  dropOverlay.style.cssText = 'position:absolute;inset:0;z-index:50;cursor:copy;'
  editorContainer.value.style.position = 'relative'
  editorContainer.value.appendChild(dropOverlay)
  // Drop cursor line
  dropCursor = document.createElement('div')
  dropCursor.style.cssText = 'position:absolute;width:2px;pointer-events:none;background:var(--accent);z-index:51;opacity:0.8;display:none;'
  editorContainer.value.appendChild(dropCursor)
  dropOverlay.addEventListener('mousemove', onOverlayMouseMove)
  dropOverlay.addEventListener('mouseup', onOverlayMouseUp)
}

function onOverlayMouseMove(ev) {
  if (!view || !dropCursor) return
  const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY })
  if (pos === null) { dropCursor.style.display = 'none'; return }
  const coords = view.coordsAtPos(pos)
  if (!coords) { dropCursor.style.display = 'none'; return }
  const rect = editorContainer.value.getBoundingClientRect()
  dropCursor.style.display = ''
  dropCursor.style.left = (coords.left - rect.left) + 'px'
  dropCursor.style.top = (coords.top - rect.top) + 'px'
  dropCursor.style.height = (coords.bottom - coords.top) + 'px'
}

function onOverlayMouseUp(ev) {
  if (view && draggedFilePaths.length) {
    const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY })
    if (pos !== null) {
      const text = buildInsertText(draggedFilePaths)
      if (text) {
        view.dispatch({
          changes: { from: pos, to: pos, insert: text },
          selection: { anchor: pos + text.length },
        })
        view.focus()
      }
    }
  }
}

function onFileTreeDragEnd() {
  draggedFilePaths = []
  if (dropOverlay) { dropOverlay.remove(); dropOverlay = null }
  if (dropCursor) { dropCursor.remove(); dropCursor = null }
}

window.addEventListener('filetree-drag-start', onFileTreeDragStart)
window.addEventListener('filetree-drag-end', onFileTreeDragEnd)

onUnmounted(() => {
  window.removeEventListener('filetree-drag-start', onFileTreeDragStart)
  window.removeEventListener('filetree-drag-end', onFileTreeDragEnd)
  onFileTreeDragEnd()
  if (isMd) {
    editorContainer.value?.removeEventListener('click', handleWikiLinkClick)
    editorContainer.value?.removeEventListener('click', handleCitationClick)
  }
  if (isTex && backwardSyncHandler) {
    window.removeEventListener('latex-backward-sync', backwardSyncHandler)
  }
  if (chunkExecuteHandler) {
    editorContainer.value?.removeEventListener('chunk-execute', chunkExecuteHandler)
    editorContainer.value?.removeEventListener('chunk-execute-all', chunkExecuteAllHandler)
  }
  editorContainer.value?.removeEventListener('task-click', handleTaskClick)
  if (rmdKernelBridge) {
    rmdKernelBridge.shutdown()
    rmdKernelBridge = null
  }
  if (view) {
    editorStore.unregisterEditorView(props.paneId, props.filePath)
    view.destroy()
    view = null
  }
})
</script>
