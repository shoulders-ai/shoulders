<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-1 border-b" style="background: var(--bg-secondary); border-color: var(--border); color: var(--fg-secondary);">
      <button class="pdf-btn" @click="zoomOut" title="Zoom out">&minus;</button>
      <span class="text-xs tabular-nums" style="min-width: 3em; text-align: center;">{{ Math.round(zoom * 100) }}%</span>
      <button class="pdf-btn" @click="zoomIn" title="Zoom in">+</button>
      <button class="pdf-btn text-xs" @click="fitWidth" title="Fit width">Fit</button>
      <span class="mx-2 text-xs" style="color: var(--fg-muted);">|</span>
      <span class="text-xs" style="color: var(--fg-muted);">
        Page
        <input
          v-model.number="pageInput"
          class="w-8 text-center text-xs border-b bg-transparent outline-none tabular-nums"
          :style="{ borderColor: 'var(--border)', color: 'var(--fg-primary)' }"
          type="number" :min="1" :max="pageCount"
          @keydown.enter="goToPage"
          @blur="goToPage"
        />
        / {{ pageCount }}
      </span>
      <button class="pdf-btn" @click="toggleSearch" title="Find (Cmd+F)">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.35-4.35" />
        </svg>
      </button>
      <span v-if="error" class="text-xs ml-auto" style="color: var(--error);">{{ error }}</span>
    </div>

    <!-- Search bar -->
    <div v-if="searchOpen" class="flex items-center gap-2 px-3 py-1 border-b"
         style="background: var(--bg-secondary); border-color: var(--border);">
      <input
        ref="searchInput"
        v-model="searchQuery"
        class="flex-1 px-2 py-0.5 text-xs rounded border outline-none"
        :style="{ background: 'var(--bg-tertiary)', color: 'var(--fg-primary)', borderColor: 'var(--border)' }"
        placeholder="Find in PDF..."
        autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        @input="onSearchInput"
        @keydown.enter.exact="nextMatch"
        @keydown.enter.shift="prevMatch"
        @keydown.escape="closeSearch"
      />
      <span class="text-[11px] tabular-nums" style="color: var(--fg-muted); min-width: 4em;">
        {{ matches.length > 0 ? `${currentMatchIdx + 1}/${matches.length}` : searchQuery ? 'No matches' : '' }}
      </span>
      <button class="pdf-btn" @click="prevMatch" title="Previous (Shift+Enter)">&uarr;</button>
      <button class="pdf-btn" @click="nextMatch" title="Next (Enter)">&darr;</button>
      <button class="pdf-btn" @click="closeSearch" title="Close (Esc)">&#x2715;</button>
    </div>

    <!-- Pages -->
    <div ref="container" class="flex-1 overflow-auto p-4 flex flex-col items-center gap-4" @wheel="handleWheel" @scroll="updateCurrentPage" @dblclick="handleDblClick">
      <div
        v-for="(_, i) in pageCount"
        :key="i"
        class="page-container"
      >
        <canvas
          :ref="el => { if (el) canvasRefs[i] = el }"
          class="shadow-lg"
        />
        <div class="textLayer" :ref="el => { if (el) textLayerRefs[i] = el }"></div>
      </div>
      <div v-if="loading" class="text-sm" style="color: var(--fg-muted);">Loading PDF...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editor'
import * as pdfjsLib from 'pdfjs-dist'
import { TextLayer } from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href

const STANDARD_FONT_DATA_URL = '/pdfjs/standard_fonts/'
const CMAP_URL = '/pdfjs/cmaps/'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const emit = defineEmits(['dblclick-page'])
const editorStore = useEditorStore()

const container = ref(null)
const canvasRefs = ref({})
const textLayerRefs = ref({})
const zoom = ref(1)
const pageCount = ref(0)
const loading = ref(true)
const error = ref(null)

// Page navigation
const currentPage = ref(1)
const pageInput = ref(1)

// Search
const searchOpen = ref(false)
const searchQuery = ref('')
const searchInput = ref(null)
const matches = ref([])
const currentMatchIdx = ref(0)

let pdfDoc = null
const textLayers = {}
const pageTextContent = {}
const renderTasks = {}  // Track in-flight page.render() tasks
let renderRaf = null

// Module-level cache: keeps parsed pdfDoc alive across remounts (split/unsplit pane)
const pdfDocCache = new Map()

async function loadPdf() {
  // Save current state before reloading (for recompile / pdf-updated case)
  if (pdfDoc) {
    editorStore.setPdfViewerState(props.filePath, {
      zoom: zoom.value,
      currentPage: currentPage.value,
    })
  }

  loading.value = true
  error.value = null

  try {
    // Clean up render tasks and text layers from previous render
    if (pdfDoc) {
      for (const key of Object.keys(renderTasks)) {
        try { renderTasks[key]?.cancel() } catch {}
        delete renderTasks[key]
      }
      for (const key of Object.keys(textLayers)) {
        try { textLayers[key]?.cancel() } catch {}
        delete textLayers[key]
      }
      for (const key of Object.keys(pageTextContent)) {
        delete pageTextContent[key]
      }
      pdfDoc = null
    }

    // Use cached pdfDoc if available (survives remount on split/unsplit)
    const cached = pdfDocCache.get(props.filePath)
    if (cached) {
      pdfDocCache.delete(props.filePath)
      pdfDoc = cached
    } else {
      const base64 = await invoke('read_file_base64', { path: props.filePath })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      pdfDoc = await pdfjsLib.getDocument({
        data: bytes,
        standardFontDataUrl: STANDARD_FONT_DATA_URL,
        cMapUrl: CMAP_URL,
        cMapPacked: true,
      }).promise
    }

    pageCount.value = pdfDoc.numPages
    loading.value = false

    // Restore saved zoom before rendering (affects render scale — no double render)
    const saved = editorStore.getPdfViewerState(props.filePath)
    if (saved?.zoom) {
      zoom.value = saved.zoom
    }

    // Hide container while rendering + restoring scroll to avoid visible jump
    const needsScrollRestore = saved?.currentPage && saved.currentPage > 1 && saved.currentPage <= pageCount.value
    if (needsScrollRestore && container.value) {
      container.value.style.visibility = 'hidden'
    }

    await nextTick()
    await renderAllPages()

    // Restore scroll position after pages are rendered
    if (needsScrollRestore) {
      await nextTick()
      const targetCanvas = canvasRefs.value[saved.currentPage - 1]
      if (targetCanvas) {
        targetCanvas.scrollIntoView({ block: 'start' })
        currentPage.value = saved.currentPage
        pageInput.value = saved.currentPage
      }
    }

    // Reveal
    if (container.value) {
      container.value.style.visibility = ''
    }
  } catch (e) {
    error.value = e.toString()
    loading.value = false
  }
}

function handlePdfUpdated(e) {
  const { path } = e.detail || {}
  if (path === props.filePath) {
    pdfDocCache.delete(props.filePath) // file changed on disk, invalidate cache
    loadPdf()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onGlobalKeydown)
  window.addEventListener('pdf-updated', handlePdfUpdated)
  loadPdf()
})

async function renderAllPages() {
  if (!pdfDoc) return
  for (let i = 0; i < pdfDoc.numPages; i++) {
    await renderPage(i)
  }
}

async function renderPage(index) {
  const page = await pdfDoc.getPage(index + 1)
  const scale = zoom.value * 1.5
  const viewport = page.getViewport({ scale })
  const canvas = canvasRefs.value[index]
  if (!canvas) return

  // Cancel any in-flight render on this canvas
  if (renderTasks[index]) {
    renderTasks[index].cancel()
    delete renderTasks[index]
  }

  const ctx = canvas.getContext('2d')
  canvas.width = viewport.width
  canvas.height = viewport.height

  const task = page.render({ canvasContext: ctx, viewport })
  renderTasks[index] = task
  try {
    await task.promise
  } catch (e) {
    if (e?.name === 'RenderingCancelledException') return
    throw e
  } finally {
    if (renderTasks[index] === task) delete renderTasks[index]
  }

  // Text layer
  const textContent = await page.getTextContent()
  const textDiv = textLayerRefs.value[index]
  if (!textDiv) return

  textDiv.innerHTML = ''
  textDiv.style.width = viewport.width + 'px'
  textDiv.style.height = viewport.height + 'px'

  // Cancel previous text layer if re-rendering
  if (textLayers[index]) {
    textLayers[index].cancel()
  }

  const tl = new TextLayer({
    textContentSource: textContent,
    container: textDiv,
    viewport,
  })
  await tl.render()
  textLayers[index] = tl

  // Store text content for search — read from rendered DOM spans
  // to guarantee 1:1 correspondence between textDivs and strings
  const spans = Array.from(textDiv.querySelectorAll('span'))
  pageTextContent[index] = {
    textDivs: spans,
    strings: spans.map(s => s.textContent),
  }
}

function zoomIn() {
  zoom.value = Math.min(zoom.value + 0.25, 4)
}

function zoomOut() {
  zoom.value = Math.max(zoom.value - 0.25, 0.25)
}

function fitWidth() {
  if (!container.value || !pdfDoc) return
  pdfDoc.getPage(1).then(page => {
    const viewport = page.getViewport({ scale: 1 })
    const containerWidth = container.value.clientWidth - 32 // padding
    zoom.value = Math.round((containerWidth / viewport.width / 1.5) * 100) / 100
  })
}

function handleWheel(e) {
  if (e.metaKey || e.ctrlKey) {
    e.preventDefault()
    // Proportional zoom: clamp deltaY so trackpad pinch is smooth
    // and mouse wheel doesn't overshoot
    const clampedDelta = Math.max(-10, Math.min(10, e.deltaY))
    const factor = Math.pow(1.01, -clampedDelta)
    zoom.value = Math.round(Math.max(0.25, Math.min(4, zoom.value * factor)) * 100) / 100
  }
}

// Page navigation
function updateCurrentPage() {
  if (!container.value) return
  const containerRect = container.value.getBoundingClientRect()
  const midY = containerRect.top + containerRect.height / 2

  for (let i = 0; i < pageCount.value; i++) {
    const canvas = canvasRefs.value[i]
    if (!canvas) continue
    const rect = canvas.getBoundingClientRect()
    if (rect.top <= midY && rect.bottom >= midY) {
      currentPage.value = i + 1
      pageInput.value = i + 1
      return
    }
  }
}

function goToPage() {
  const p = Math.max(1, Math.min(pageInput.value || 1, pageCount.value))
  pageInput.value = p
  const canvas = canvasRefs.value[p - 1]
  if (canvas) canvas.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

// Search
function toggleSearch() {
  searchOpen.value = !searchOpen.value
  if (searchOpen.value) {
    nextTick(() => searchInput.value?.focus())
  } else {
    closeSearch()
  }
}

function closeSearch() {
  searchOpen.value = false
  searchQuery.value = ''
  clearHighlights()
  matches.value = []
  currentMatchIdx.value = 0
}

function clearHighlights() {
  for (const p of Object.keys(pageTextContent)) {
    const divs = pageTextContent[p]?.textDivs
    if (!divs) continue
    for (const div of divs) {
      div.classList.remove('highlight', 'selected')
    }
  }
}

function onSearchInput() {
  clearHighlights()
  if (!searchQuery.value.trim()) {
    matches.value = []
    currentMatchIdx.value = 0
    return
  }

  const query = searchQuery.value.toLowerCase()
  const found = []

  for (let p = 0; p < pageCount.value; p++) {
    const page = pageTextContent[p]
    if (!page) continue
    for (let d = 0; d < page.strings.length; d++) {
      const text = page.strings[d].toLowerCase()
      let idx = text.indexOf(query)
      while (idx !== -1) {
        found.push({ pageIdx: p, divIdx: d })
        page.textDivs[d]?.classList.add('highlight')
        idx = text.indexOf(query, idx + 1)
      }
    }
  }

  matches.value = found
  currentMatchIdx.value = 0
  if (found.length > 0) scrollToMatch(0)
}

function clearSelectedHighlight() {
  for (const p of Object.keys(pageTextContent)) {
    const divs = pageTextContent[p]?.textDivs
    if (!divs) continue
    for (const div of divs) {
      div.classList.remove('selected')
    }
  }
}

function scrollToMatch(idx) {
  clearSelectedHighlight()
  const match = matches.value[idx]
  if (!match) return
  currentMatchIdx.value = idx

  const div = pageTextContent[match.pageIdx]?.textDivs[match.divIdx]
  if (div) {
    div.classList.add('selected')
    div.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

function nextMatch() {
  if (matches.value.length === 0) return
  scrollToMatch((currentMatchIdx.value + 1) % matches.value.length)
}

function prevMatch() {
  if (matches.value.length === 0) return
  scrollToMatch((currentMatchIdx.value - 1 + matches.value.length) % matches.value.length)
}

// Double-click: emit page + position for SyncTeX backward sync
function handleDblClick(e) {
  for (let i = 0; i < pageCount.value; i++) {
    const canvas = canvasRefs.value[i]
    if (!canvas) continue
    const rect = canvas.getBoundingClientRect()
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      emit('dblclick-page', {
        page: i + 1,
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      })
      return
    }
  }
}

// Expose scrollToPage for forward sync
defineExpose({
  scrollToPage(page) {
    const canvas = canvasRefs.value[page - 1]
    if (canvas) {
      canvas.scrollIntoView({ behavior: 'smooth', block: 'center' })
      currentPage.value = page
      pageInput.value = page
    }
  },
})

// Document-level Cmd+F listener (div @keydown won't fire without focus)
function onGlobalKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    // Only handle if this PDF viewer is visible (container is in DOM and has dimensions)
    if (!container.value || container.value.offsetParent === null) return
    e.preventDefault()
    e.stopPropagation()
    searchOpen.value = true
    nextTick(() => {
      searchInput.value?.focus()
      searchInput.value?.select()
    })
  }
}

// RAF-coalesced re-render on zoom change (smooth trackpad, ~16ms)
watch(zoom, () => {
  cancelAnimationFrame(renderRaf)
  renderRaf = requestAnimationFrame(async () => {
    await nextTick()
    await renderAllPages()
    if (searchQuery.value.trim()) {
      onSearchInput()
    }
  })
})

onUnmounted(() => {
  editorStore.setPdfViewerState(props.filePath, {
    zoom: zoom.value,
    currentPage: currentPage.value,
  })
  document.removeEventListener('keydown', onGlobalKeydown)
  window.removeEventListener('pdf-updated', handlePdfUpdated)
  cancelAnimationFrame(renderRaf)
  // Cancel all in-flight renders
  for (const key of Object.keys(renderTasks)) {
    try { renderTasks[key]?.cancel() } catch {}
    delete renderTasks[key]
  }
  // Cancel all text layers
  for (const key of Object.keys(textLayers)) {
    try { textLayers[key]?.cancel() } catch {}
  }
  // Cache pdfDoc for fast remount (split/unsplit) instead of destroying
  if (pdfDoc) {
    pdfDocCache.set(props.filePath, pdfDoc)
    pdfDoc = null
  }
})
</script>

<style scoped>
.pdf-btn {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  border: 1px solid var(--border);
  transition: background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pdf-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.page-container {
  position: relative;
  display: inline-block;
}

.page-container canvas {
  display: block;
}

/* pdfjs v5 TextLayer CSS — based on official styles */
.textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: clip;
  opacity: 1;
  line-height: 1;
  text-size-adjust: none;
  forced-color-adjust: none;
  transform-origin: 0 0;
  caret-color: CanvasText;
  z-index: 2;
}

.textLayer :deep(span),
.textLayer :deep(br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  pointer-events: all;
  transform-origin: 0% 0%;
}

/* endOfContent div enables reliable click-drag selection across spans */
.textLayer :deep(.endOfContent) {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: -1;
  cursor: default;
  user-select: none;
}

.textLayer :deep(.endOfContent.active) {
  top: 0;
}

.textLayer :deep(::selection) {
  background: rgba(0, 100, 200, 0.3);
}

.textLayer :deep(.highlight) {
  background-color: rgba(255, 230, 0, 0.35);
  border-radius: 2px;
}

.textLayer :deep(.highlight.selected) {
  background-color: rgba(255, 150, 0, 0.5);
}

/* Hide number input spinners */
input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
</style>
