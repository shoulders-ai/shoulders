<template>
  <div class="h-full flex flex-col overflow-hidden">
    <div v-if="loading" class="flex items-center justify-center h-full text-sm"
         style="color: var(--fg-muted);">
      Loading PDF...
    </div>
    <div v-else-if="error" class="flex items-center justify-center h-full text-sm"
         style="color: var(--fg-muted);">
      Could not load PDF
    </div>
    <iframe
      v-else-if="viewerSrc"
      ref="iframeRef"
      :src="viewerSrc"
      class="w-full flex-1 border-0"
      style="display: block;"
      @load="onIframeLoad"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../../stores/workspace'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId:   { type: String, required: true },
})

const workspace  = useWorkspaceStore()
const iframeRef  = ref(null)
const viewerSrc  = ref(null)
const loading    = ref(true)
const error      = ref(null)

let currentBlobUrl = null

// Light themes in the app — everything else is dark
const LIGHT_THEMES = new Set(['light', 'one-light','humane','solarized'])
const isDark = computed(() => !LIGHT_THEMES.has(workspace.theme))

function applyTheme() {
  const doc = iframeRef.value?.contentDocument
  if (!doc?.documentElement) return
  doc.documentElement.style.setProperty('color-scheme', isDark.value ? 'dark' : 'light')
}

function onIframeLoad() {
  const win = iframeRef.value?.contentWindow
  if (!win) return
  // Apply theme immediately — pdf.js is fully initialized by @load time.
  // (Can't rely on 'webviewerloaded': it fires to parent.document before @load.)
  applyTheme()

  // Forward clicks from the iframe so EditorPane's @mousedown handler fires
  // (sets the active pane). Without this, clicking the PDF doesn't focus the pane.
  // Also forward Cmd+W so the app closes the tab instead of the whole window.
  try {
    win.document.addEventListener('mousedown', () => {
      iframeRef.value?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    win.document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'w') {
        e.preventDefault()
        document.dispatchEvent(new KeyboardEvent('keydown', {
          key: e.key, code: e.code,
          metaKey: e.metaKey, ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey, altKey: e.altKey,
          bubbles: true, cancelable: true,
        }))
      }
    })
  } catch (_) { /* cross-origin iframe — blob URLs should be same-origin */ }
}

// Re-apply when the user switches app theme while the viewer is open
watch(isDark, applyTheme)

async function loadPdf() {
  loading.value = true
  error.value   = null

  if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null }

  try {
    const base64   = await invoke('read_file_base64', { path: props.filePath })
    const bytes    = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
    currentBlobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    viewerSrc.value = `/pdfjs-viewer/web/viewer.html?file=${encodeURIComponent(currentBlobUrl)}`
  } catch (e) {
    error.value = e.toString()
  } finally {
    loading.value = false
  }
}

function handlePdfUpdated(e) {
  if (e.detail?.path === props.filePath) loadPdf()
}

onMounted(() => {
  window.addEventListener('pdf-updated', handlePdfUpdated)
  loadPdf()
})

onUnmounted(() => {
  window.removeEventListener('pdf-updated', handlePdfUpdated)
  if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl)
})

watch(() => props.filePath, loadPdf)
</script>
