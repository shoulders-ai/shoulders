<template>
  <div class="h-full flex flex-col overflow-hidden docx-editor" ref="rootEl">
    <!-- Custom toolbar — wait for activeEditor (editorReady) so commands work -->
    <DocxToolbar
      v-if="editorReady"
      :superdoc="superdocRef"
      :documentMode="documentMode"
      @mode-change="setDocumentMode"
    />

    <!-- SuperDoc document + loading overlay wrapper -->
    <div class="flex-1 overflow-auto" :style="{ position: 'relative', zoom: workspace.docxZoomPercent / 100 }" ref="wrapperEl" @contextmenu="onContextMenu">
      <div :id="editorId" ref="editorEl" class="absolute inset-0"></div>
      <!-- Loading dots overlay — only visible during API call. -->
      <!-- Suggestion text is rendered INLINE by SuperDoc (gray textStyle mark). -->
      <div v-if="ghostState?.type === 'loading'" class="docx-ghost-overlay" :style="ghostOverlayPos">
        <span class="ghost-loading-inline">
          <span v-for="i in 3" :key="i" class="ghost-dot" :style="{ animationDelay: (i - 1) * 160 + 'ms' }"></span>
        </span>
      </div>
      <!-- AI task thread indicators (dots in the margin) -->
      <DocxTaskIndicators
        v-if="editorReady"
        :filePath="filePath"
        :wrapperEl="wrapperEl"
        :superdoc="superdocRef"
      />
      <!-- Citations use the native link mark — no overlays needed -->
    </div>

    <!-- Custom context menu -->
    <DocxContextMenu
      v-if="ctxMenu.show"
      :x="ctxMenu.x"
      :y="ctxMenu.y"
      :superdoc="superdocRef"
      :filePath="filePath"
      :savedSelection="ctxMenu.savedSelection"
      @close="ctxMenu.show = false"
      @add-comment="onAddComment"
    />

    <!-- Native comment input dialog (uses SuperDoc's public addComment API) -->
    <Teleport to="body">
      <div v-if="commentInput.show" class="fixed inset-0 z-[9998]" @click="cancelComment" @contextmenu.prevent="cancelComment">
        <div
          class="docx-comment-input"
          :style="commentInputStyle"
          @click.stop
        >
          <textarea
            ref="commentTextarea"
            class="docx-comment-textarea"
            placeholder="Add a comment..."
            v-model="commentInput.text"
            @keydown.enter.meta="submitComment"
            @keydown.escape="cancelComment"
          ></textarea>
          <div class="docx-comment-footer">
            <button class="docx-comment-btn" @click="cancelComment">Cancel</button>
            <button class="docx-comment-btn docx-comment-btn-primary" @click="submitComment" :disabled="!commentInput.text.trim()">Comment</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Citation palette (inserts & edits — Teleported internally) -->
    <CitationPalette
      v-if="citPalette.show"
      :mode="citPalette.mode"
      :pos-x="citPalette.x"
      :pos-y="citPalette.y"
      :query="citPalette.query"
      :cites="citPalette.cites"
      @insert="onCitInsert"
      @update="onCitUpdate"
      @close="onCitClose"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, reactive, computed, watch, onMounted, onUnmounted, nextTick, markRaw } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useTasksStore } from '../../stores/tasks'
import { useReferencesStore } from '../../stores/references'
import { base64ToFile, blobToBase64, base64ToUint8Array } from '../../utils/docxBridge'
import { createDocxAIProvider } from '../../services/docxProvider'
import { createDocxGhostExtension, ghostPluginKey } from '../../editor/docxGhost'
import { createDocxTaskPositionsExtension } from '../../editor/docxTaskPositions'
import { prescanDocxForZotero, postProcessCitationsOrdered, getCitationMeta, setCitationMeta, loadCitationMeta, persistCitationMeta, isCitationHref, citationIdFromHref, reformatAllCitations, removeCitationLink, insertNewCitation, getAllCitedKeys, hasBibliography, insertBibliography, refreshBibliography, createCitationMarkGuardExtension } from '../../services/docxCitationImporter'
import { DocxTaskBridge } from '../../editor/docxTasks'
import DocxToolbar from './DocxToolbar.vue'
import DocxContextMenu from './DocxContextMenu.vue'
import DocxTaskIndicators from './DocxTaskIndicators.vue'
import CitationPalette from './CitationPalette.vue'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const emit = defineEmits(['cursor-change', 'editor-stats'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const filesStore = useFilesStore()
const tasksStore = useTasksStore()
const referencesStore = useReferencesStore()

const rootEl = ref(null)
const editorEl = ref(null)
const wrapperEl = ref(null)
const documentMode = ref('editing')
const superdocRef = shallowRef(null)
const editorReady = ref(false)

// Context menu state (savedSelection captured in capture-phase mousedown, before SuperDoc collapses it)
const ctxMenu = reactive({ show: false, x: 0, y: 0, savedSelection: null })

// Native comment input dialog state
const commentInput = reactive({ show: false, x: 0, y: 0, text: '', savedSelection: null })
const commentTextarea = ref(null)

// Ghost overlay state
const ghostState = ref(null)
const ghostOverlayPos = ref({})

// Citation state
const zoteroCitations = ref(null) // pre-scanned Zotero data (set before SuperDoc init)
const citPalette = reactive({
  show: false,
  mode: 'insert',
  x: 0,
  y: 0,
  query: '',
  cites: [],
  citationId: null,
  replaceFrom: 0,
  replaceTo: 0,
})

// SuperDoc needs CSS selector strings, not DOM elements
const uid = Math.random().toString(36).slice(2, 8)
const editorId = `sd-editor-${uid}`

let superdoc = null
let aiActions = null
let taskBridge = null
let saveTimeout = null
let lastSaveTime = 0
let isSaving = false // Guards against recursive save loops during strip/restore

/**
 * Handle citation link clicks.
 * SuperDoc dispatches 'superdoc-link-click' CustomEvent when a link is clicked.
 * We intercept cite: links and open our popover instead of the default link editor.
 */
function handleCiteLinkClick(e) {
  const href = e.detail?.href
  if (!isCitationHref(href)) return // let normal links through

  e.stopPropagation() // prevent SuperDoc's link popover
  e.preventDefault?.()

  const citationId = citationIdFromHref(href)
  const meta = getCitationMeta(citationId)
  if (!meta) {
    console.warn('[DocxEditor] No metadata for citation:', citationId)
    return
  }

  citPalette.citationId = citationId
  citPalette.x = e.detail?.clientX ?? 0
  citPalette.y = (e.detail?.clientY ?? 0) + 4
  citPalette.mode = 'edit'
  citPalette.cites = (meta.cites || []).map(c => ({
    key: c.key,
    locator: c.locator || '',
    prefix: c.prefix || '',
  }))
  citPalette.query = ''
  citPalette.show = true
}

/** Prevent browser navigation for citation links */
function handleCiteLinkNav(e) {
  const link = e.target?.closest?.('a.superdoc-link')
  if (link && isCitationHref(link.getAttribute('href'))) {
    e.preventDefault()
  }
}

/**
 * Citation palette handlers — unified for insert & edit modes.
 */
function onCitInsert({ keys }) {
  const editor = superdoc?.activeEditor
  if (!editor || !keys.length) return

  const key = keys[0]
  insertNewCitation(editor, key, citPalette.replaceFrom, citPalette.replaceTo, referencesStore)
  persistCitationMeta(props.filePath)
  citPalette.show = false
  editor.view?.focus()
}

function onCitUpdate({ cites }) {
  const editor = superdoc?.activeEditor
  if (!editor || !citPalette.citationId) return

  if (cites.length === 0) {
    removeCitationLink(editor, citPalette.citationId)
    persistCitationMeta(props.filePath)
    citPalette.show = false
    return
  }

  const meta = getCitationMeta(citPalette.citationId)
  setCitationMeta(citPalette.citationId, { ...meta, cites })
  const style = referencesStore.citationStyle || 'apa'
  reformatAllCitations(editor, style, referencesStore)
  persistCitationMeta(props.filePath)
}

function onCitClose() {
  citPalette.show = false
  superdoc?.activeEditor?.view?.focus()
}

/** Open citation palette in insert mode at the caret position */
function openInsertCiteAtCaret(query = '') {
  const container = wrapperEl.value
  if (!container) return
  const editor = superdoc?.activeEditor
  if (!editor) return

  const caret = container.querySelector('.presentation-editor__selection-caret')
  if (!caret) return

  const rect = caret.getBoundingClientRect()
  const { from } = editor.view.state.selection

  citPalette.x = rect.left
  citPalette.y = rect.bottom
  citPalette.query = query
  citPalette.replaceFrom = from - query.length - 1 // -1 for the @ character
  citPalette.replaceTo = from
  citPalette.mode = 'insert'
  citPalette.cites = []
  citPalette.citationId = null
  citPalette.show = true
}

/** Expose for context menu — inserts at current cursor with no @ replacement */
function openInsertCiteAtPos(x, y) {
  const editor = superdoc?.activeEditor
  if (!editor) return
  const { from } = editor.view.state.selection
  citPalette.x = x
  citPalette.y = y
  citPalette.query = ''
  citPalette.replaceFrom = from
  citPalette.replaceTo = from
  citPalette.mode = 'insert'
  citPalette.cites = []
  citPalette.citationId = null
  citPalette.show = true
}

/**
 * Check for @ trigger in editor text.
 * Called on each editor update — looks for @query pattern before cursor.
 */
function checkAtTrigger() {
  const editor = superdoc?.activeEditor
  if (!editor) return

  // Don't trigger while in edit mode
  if (citPalette.show && citPalette.mode === 'edit') return

  const { from } = editor.view.state.selection
  const $pos = editor.view.state.doc.resolve(from)
  const textBefore = $pos.parent.textBetween(
    Math.max(0, $pos.parentOffset - 30),
    $pos.parentOffset
  )
  const atMatch = textBefore.match(/@(\w*)$/)
  if (atMatch && referencesStore.library.length > 0) {
    if (citPalette.show && citPalette.mode === 'insert') {
      // Update query while user types
      citPalette.query = atMatch[1]
      citPalette.replaceTo = from
    } else {
      openInsertCiteAtCaret(atMatch[1])
    }
  } else if (citPalette.show && citPalette.mode === 'insert') {
    citPalette.show = false
  }
}

// Expose openInsertCiteAtPos for context menu
defineExpose({ openInsertCiteAtPos })

function onGhostStateChange(state) {
  ghostState.value = state
  // Cancel any pending save when ghost becomes active — prevents saving
  // ghost text to disk (the debouncedSave from typing ++ might still be pending)
  if (state?.type && saveTimeout) {
    clearTimeout(saveTimeout)
    saveTimeout = null
  }
  if (state?.type === 'loading') {
    nextTick(() => positionGhostOverlay())
  }
}

function positionGhostOverlay() {
  const container = wrapperEl.value
  if (!container) return

  const caret = container.querySelector('.presentation-editor__selection-caret')
  if (!caret) return

  const caretRect = caret.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  ghostOverlayPos.value = {
    position: 'absolute',
    left: (caretRect.left - containerRect.left + caretRect.width) + 'px',
    top: (caretRect.top - containerRect.top + container.scrollTop) + 'px',
    zIndex: 1000,
    pointerEvents: 'none',
  }
}

// Capture-phase mousedown: save selection BEFORE SuperDoc processes the right-click
// (SuperDoc's mousedown handler on child elements collapses the selection to a cursor)
function handleRightMouseDown(e) {
  if (e.button !== 2) return  // only right-click
  const ed = superdoc?.activeEditor
  if (!ed) return
  const { from, to, empty } = ed.state.selection
  ctxMenu.savedSelection = !empty ? { from, to } : null
}

onMounted(async () => {
  // Attach keydown handler for Cmd+S
  rootEl.value?.addEventListener('keydown', handleKeydown, true)
  // Capture-phase: fires before SuperDoc's handlers on child elements
  wrapperEl.value?.addEventListener('mousedown', handleRightMouseDown, true)

  try {
    // Load binary file
    const base64 = await invoke('read_file_base64', { path: props.filePath })
    const filename = props.filePath.split('/').pop()
    const file = base64ToFile(base64, filename)

    // Phase 1: Pre-scan DOCX for Zotero citations (before SuperDoc loads)
    try {
      const bytes = base64ToUint8Array(base64)
      zoteroCitations.value = await prescanDocxForZotero(bytes)
      // Zotero citations found — will convert after SuperDoc loads
    } catch (e) {
      console.warn('[DocxEditor] Zotero pre-scan failed:', e)
      zoteroCitations.value = { citations: [], bibliography: null, prefs: null }
    }

    // Lazy import SuperDoc
    const { SuperDoc } = await import('superdoc')
    await import('superdoc/style.css')

    // Ghost suggestion extension
    const ghostExt = createDocxGhostExtension({
      getWorkspace: () => workspace,
      getSystemPrompt: () => workspace.systemPrompt,
      getInstructions: () => workspace.instructions,
      onGhostStateChange,
      isEnabled: () => workspace.ghostEnabled,
    })

    // Citation mark bleed guard (strips link marks from text typed after citations)
    const citationGuardExt = createCitationMarkGuardExtension()

    // Comment positions extension (maps thread ranges through edits)
    const commentPosExt = createDocxTaskPositionsExtension({
      getThreads: () => tasksStore.threadsForFile(props.filePath),
      onPositionsUpdated: () => {
        // Update store ranges + signal indicator recalc
        const threads = tasksStore.threadsForFile(props.filePath)
        for (const t of threads) {
          tasksStore.updateRange(t.id, t.range.from, t.range.to)
        }
        wrapperEl.value?.dispatchEvent(new CustomEvent('docx-content-changed'))
      },
    })

    superdoc = new SuperDoc({
      selector: `#${editorId}`,
      document: file,
      documentMode: 'editing',
      user: { name: 'User', email: 'user@local' },
      editorExtensions: [ghostExt, commentPosExt, citationGuardExt],
    })
    // markRaw prevents Vue from deep-proxying the SuperDoc instance.
    // SuperDoc uses #private class fields which break through Proxy wrappers.
    superdocRef.value = markRaw(superdoc)

    // Register early so getAnySuperdoc works before 'ready'
    editorStore.registerSuperdoc(props.paneId, props.filePath, superdoc, null, null)

    // activeEditor is set asynchronously — wait for 'ready' event
    superdoc.on('ready', async () => {
      editorReady.value = true
      wireEditorEvents()
      updateTextCache()
      updateEditorStats()

      // Phase 2: Post-process Zotero citations (replace field codes → link-marked text)
      // Load any previously saved citation metadata
      loadCitationMeta(props.filePath)

      if (zoteroCitations.value?.citations?.length && superdoc.activeEditor) {
        try {
          const count = postProcessCitationsOrdered(
            superdoc.activeEditor,
            zoteroCitations.value.citations,
            referencesStore
          )
          if (count) {
            updateTextCache()
            persistCitationMeta(props.filePath)
          }
        } catch (e) {
          console.warn('[DocxEditor] Citation post-processing failed:', e)
        }
      }

      // Listen for citation link clicks (capture phase — fires before SuperDoc's handler)
      wrapperEl.value?.addEventListener('superdoc-link-click', handleCiteLinkClick, true)
      wrapperEl.value?.addEventListener('click', handleCiteLinkNav, true)

      // Create comment bridge (maps our AI threads ↔ SuperDoc comment highlights)
      taskBridge = new DocxTaskBridge(superdoc, props.filePath)

      // Initialize AIActions for literalReplace (documented API for find-and-replace)
      try {
        const { AIActions } = await import('@superdoc-dev/ai')
        aiActions = new AIActions(superdoc, {
          user: { displayName: 'Shoulders AI', userId: 'shoulders-ai', email: 'ai@shoulders.app' },
          provider: createDocxAIProvider(workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'),
        })
        await aiActions.waitUntilReady()
        // Restore user identity — AIActions constructor overwrites editor.options.user
        // which causes native comments to be attributed to "Shoulders AI"
        const ed = superdoc.activeEditor
        if (ed) {
          ed.setOptions({ user: { name: 'User', email: 'user@local' } })
        }
      } catch (e) {
        console.warn('AIActions initialization failed:', e)
      }

      // Register with bridge + AIActions
      editorStore.registerSuperdoc(props.paneId, props.filePath, superdoc, taskBridge, aiActions)
    })

    // Also check if activeEditor is already set (small docs may init synchronously)
    if (superdoc.activeEditor) {
      editorReady.value = true
      wireEditorEvents()
      updateTextCache()
    }

    // Listen for force-save events and insert citation requests
    window.addEventListener('docx-save-now', handleForceSave)
    window.addEventListener('docx-insert-citation', handleInsertCitationEvent)
    window.addEventListener('docx-insert-bibliography', handleInsertBibliographyEvent)
  } catch (e) {
    console.error('Failed to load DOCX:', e)
    const { useToastStore } = await import('../../stores/toast')
    const { formatFileError } = await import('../../utils/errorMessages')
    useToastStore().show(formatFileError('load', props.filePath, e), { type: 'error', duration: 5000 })
  }
})

onUnmounted(() => {
  if (saveTimeout) clearTimeout(saveTimeout)
  rootEl.value?.removeEventListener('keydown', handleKeydown, true)
  wrapperEl.value?.removeEventListener('mousedown', handleRightMouseDown, true)
  wrapperEl.value?.removeEventListener('superdoc-link-click', handleCiteLinkClick, true)
  wrapperEl.value?.removeEventListener('click', handleCiteLinkNav, true)
  window.removeEventListener('docx-save-now', handleForceSave)
  window.removeEventListener('docx-insert-citation', handleInsertCitationEvent)
  window.removeEventListener('docx-insert-bibliography', handleInsertBibliographyEvent)
  editorStore.unregisterSuperdoc(props.paneId, props.filePath)
  if (taskBridge) {
    taskBridge.destroy()
    taskBridge = null
  }
  if (superdoc) {
    superdoc.destroy()
    superdoc = null
    superdocRef.value = null
  }
})

let eventsWired = false
function wireEditorEvents() {
  if (eventsWired || !superdoc?.activeEditor) return
  eventsWired = true
  const editor = superdoc.activeEditor
  editor.on('update', () => {
    // Suppress ALL side effects during save cycle (strip/restore dispatches transactions
    // which trigger this handler — without this guard, saves loop infinitely)
    if (isSaving) return

    // Suppress cache/stats/save while ghost text is in the document.
    const pmGhost = ghostPluginKey.getState?.(editor.view?.state)
    if (!pmGhost?.type) {
      updateTextCache()
      updateEditorStats()
      debouncedSave()
      checkAtTrigger()
    }
    // Bump reactive counter so OutlinePanel re-evaluates (style changes don't alter textContent)
    editorStore.bumpDocxUpdate()
    // Signal comment indicators to recalculate
    wrapperEl.value?.dispatchEvent(new CustomEvent('docx-content-changed'))
  })
  editor.on('selectionUpdate', () => {
    if (isSaving) return
    updateCursorPos()

    // Auto-scroll: keep visible caret in viewport
    requestAnimationFrame(() => {
      const container = wrapperEl.value
      if (!container) return
      const caret = container.querySelector('.presentation-editor__selection-caret')
      if (!caret) return
      const caretRect = caret.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      if (caretRect.top < containerRect.top + 20 || caretRect.bottom > containerRect.bottom - 20) {
        caret.scrollIntoView({ behavior: 'auto', block: 'nearest' })
      }
    })

    const pmGhost = ghostPluginKey.getState?.(editor.view?.state)
    if (!pmGhost?.type) {
      updateEditorStats()
    }
    // Close palette if cursor moved away from @ region (insert mode only)
    if (citPalette.show && citPalette.mode === 'insert') {
      const { from } = editor.view.state.selection
      if (from < citPalette.replaceFrom || from > citPalette.replaceTo + 30) {
        citPalette.show = false
      }
    }
  })
}

function updateTextCache() {
  if (!superdoc?.activeEditor) return
  try {
    const text = superdoc.activeEditor.state.doc.textContent
    filesStore.fileContents[props.filePath] = text
  } catch (e) {
    // Editor may not be fully initialized yet
  }
}

function updateCursorPos() {
  if (!superdoc?.activeEditor) return
  try {
    const { from } = superdoc.activeEditor.state.selection
    const resolved = superdoc.activeEditor.state.doc.resolve(from)
    emit('cursor-change', {
      line: resolved.depth > 0 ? resolved.index(0) + 1 : 1,
      col: resolved.parentOffset + 1,
    })
  } catch (e) {
    // Ignore position errors during init
  }
}

function updateEditorStats() {
  if (!superdoc?.activeEditor) return
  try {
    const doc = superdoc.activeEditor.state.doc
    const text = doc.textContent
    const words = text.trim() ? text.trim().split(/\s+/).length : 0
    const chars = text.replace(/\s/g, '').length

    const { from, to, empty } = superdoc.activeEditor.state.selection
    let selWords = 0, selChars = 0
    if (!empty) {
      const selText = doc.textBetween(from, to, '\n', ' ')
      selWords = selText.trim() ? selText.trim().split(/\s+/).length : 0
      selChars = selText.replace(/\s/g, '').length
    }

    emit('editor-stats', { words, chars, selWords, selChars })
  } catch (e) {
    // Ignore stats errors during init
  }
}

function debouncedSave() {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => saveNow(), 1500)
}

async function saveNow() {
  if (!superdoc || isSaving) return
  isSaving = true
  if (saveTimeout) { clearTimeout(saveTimeout); saveTimeout = null }

  try {
    // Citations are link marks — SuperDoc exports them as DOCX hyperlinks natively.
    // No strip/restore cycle needed.
    const blob = await superdoc.export({ exportType: 'docx', triggerDownload: false })
    if (!blob) return
    const base64 = await blobToBase64(blob)
    lastSaveTime = Date.now()
    await invoke('write_file_base64', { path: props.filePath, data: base64 })

    // Persist citation metadata
    persistCitationMeta(props.filePath)
  } catch (e) {
    console.error('DOCX save error:', e)
    const { useToastStore } = await import('../../stores/toast')
    const { formatFileError } = await import('../../utils/errorMessages')
    useToastStore().showOnce(`save:${props.filePath}`, formatFileError('save', props.filePath, e), { type: 'error', duration: 5000 })
  } finally {
    isSaving = false
    updateTextCache()
  }
}

function handleForceSave(event) {
  if (event.detail?.path === props.filePath) {
    saveNow()
  }
}

function setDocumentMode(mode) {
  if (!superdoc) return
  documentMode.value = mode
  superdoc.setDocumentMode(mode)
}

function onContextMenu(e) {
  // Let SuperDoc handle context menu inside tables (built-in table editing menu)
  const ed = superdoc?.activeEditor
  if (ed?.isActive('table')) return // don't prevent default — SuperDoc shows its table menu

  e.preventDefault()
  ctxMenu.x = e.clientX
  ctxMenu.y = e.clientY
  ctxMenu.show = true
}

function handleInsertCitationEvent(e) {
  openInsertCiteAtPos(e.detail?.x ?? 200, e.detail?.y ?? 200)
}

function handleInsertBibliographyEvent() {
  const editor = superdoc?.activeEditor
  if (!editor) return

  const style = referencesStore.citationStyle || 'apa'
  if (hasBibliography(editor.view.state.doc)) {
    refreshBibliography(editor, style, referencesStore)
  } else {
    insertBibliography(editor, style, referencesStore)
  }
  editor.view?.focus()
}

/**
 * Comment input: triggered by context menu "Comment" item.
 * Uses SuperDoc's public addComment API (documented, no sidebar needed).
 */
function onAddComment({ savedSelection, x, y }) {
  commentInput.savedSelection = savedSelection
  commentInput.text = ''
  // Position near the click, clamped to viewport
  const menuW = 300, menuH = 160
  commentInput.x = Math.min(x, window.innerWidth - menuW - 16)
  commentInput.y = Math.min(y, window.innerHeight - menuH - 16)
  commentInput.show = true
  nextTick(() => {
    commentTextarea.value?.focus()
  })
}

const commentInputStyle = computed(() => ({
  left: commentInput.x + 'px',
  top: commentInput.y + 'px',
}))

function submitComment() {
  const text = commentInput.text.trim()
  if (!text) return

  const ed = superdoc?.activeEditor
  if (!ed) {
    console.warn('[DocxEditor] submitComment: no activeEditor')
    commentInput.show = false
    return
  }

  // Restore the PM selection that was saved before right-click
  const sel = commentInput.savedSelection
  if (sel) {
    try {
      const state = ed.view.state
      const TextSel = state.selection.constructor
      ed.view.dispatch(state.tr.setSelection(TextSel.create(state.doc, sel.from, sel.to)))
    } catch (e) {
      console.warn('[DocxEditor] Failed to restore selection:', e.message)
      commentInput.show = false
      return
    }
  } else {
    console.warn('[DocxEditor] submitComment: no savedSelection')
    commentInput.show = false
    return
  }

  // Call SuperDoc's public addComment API (documented at docs.superdoc.dev/extensions/comments)
  // This adds the PM mark + emits commentsUpdate → store's addComment handles the rest
  ed.commands.addComment({
    content: text,
    author: 'User',
    authorEmail: 'user@local',
    isInternal: false,
  })

  commentInput.show = false
  commentInput.text = ''
  commentInput.savedSelection = null
  ed.view?.focus()
}

function cancelComment() {
  commentInput.show = false
  commentInput.text = ''
  commentInput.savedSelection = null
}

function handleKeydown(e) {
  const mod = e.metaKey || e.ctrlKey
  if (mod && e.key === 's') {
    e.stopPropagation()
    e.preventDefault()
    saveNow()
  }
}

// Reformat all citations and refresh bibliography when citation style changes
watch(() => referencesStore.citationStyle, (style) => {
  const editor = superdoc?.activeEditor
  if (!editor) return
  const count = reformatAllCitations(editor, style, referencesStore)
  if (count) {
    persistCitationMeta(props.filePath)
  }
  // Auto-refresh bibliography if one exists
  if (hasBibliography(editor.view.state.doc)) {
    refreshBibliography(editor, style, referencesStore)
  }
})
</script>

<style scoped>
.ghost-loading-inline {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: 4px;
}
</style>

<style>
/* Comment input dialog — Teleported to body, needs unscoped styles */
.docx-comment-input {
  position: fixed;
  z-index: 9999;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  padding: 10px;
  width: 280px;
  font-family: var(--ui-font, 'Inter', sans-serif);
}
.docx-comment-textarea {
  width: 100%;
  height: 72px;
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 12px;
  color: var(--fg-primary);
  resize: none;
  outline: none;
  font-family: inherit;
}
.docx-comment-textarea:focus {
  border-color: var(--accent);
}
.docx-comment-textarea::placeholder {
  color: var(--fg-muted);
  opacity: 0.6;
}
.docx-comment-footer {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  margin-top: 8px;
}
.docx-comment-btn {
  font-size: 11px;
  padding: 4px 12px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  color: var(--fg-muted);
  background: transparent;
}
.docx-comment-btn:hover {
  background: var(--bg-hover);
}
.docx-comment-btn-primary {
  background: var(--accent);
  color: white;
}
.docx-comment-btn-primary:hover {
  opacity: 0.85;
}
.docx-comment-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>

<!-- Citation link styling + SuperDoc overrides — must be unscoped to reach SuperDoc's painted DOM -->
<style>
/* Hide SuperDoc's native floating tools panel (comment/AI button on selection) — we use our own context menu */
.superdoc__tools { display: none !important; }

a.superdoc-link[href^="https://cite.local/"],
span[data-link-rid][href^="https://cite.local/"] {
  text-decoration: none !important;
  color: var(--accent-color, #89b4fa) !important;
  cursor: pointer !important;
  border-bottom: 1px dotted var(--accent-color, #89b4fa);
  transition: opacity 0.15s;
}
a.superdoc-link[href^="https://cite.local/"]:hover,
span[data-link-rid][href^="https://cite.local/"]:hover {
  opacity: 0.8;
}

/* Fix citation cursor bleed: text typed after a citation inherits the run's
   hyperlink styling (blue + underline). The appendTransaction splits the run,
   but this CSS is the immediate visual fix — targets any <span> painted right
   after a citation <a> that still carries the inherited inline styles. */
a.superdoc-link[href^="https://cite.local/"] + span {
  color: inherit !important;
  text-decoration: none !important;
  border-bottom: none !important;
}
</style>
