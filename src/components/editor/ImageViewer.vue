<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-1 border-b" style="background: var(--bg-secondary); border-color: var(--border); color: var(--fg-secondary);">
      <button class="img-btn" @click="zoomOut" title="Zoom out">−</button>
      <span class="text-xs tabular-nums" style="min-width: 3em; text-align: center;">{{ Math.round(zoom * 100) }}%</span>
      <button class="img-btn" @click="zoomIn" title="Zoom in">+</button>
      <button class="img-btn text-xs" @click="resetView" title="Reset to actual size">Fit</button>
      <span class="mx-2 text-xs" style="color: var(--fg-muted);">|</span>
      <span v-if="naturalSize" class="text-xs" style="color: var(--fg-muted);">{{ naturalSize }}</span>
      <span v-if="error" class="text-xs ml-auto" style="color: var(--error);">{{ error }}</span>
    </div>

    <!-- Image viewport -->
    <div
      ref="viewport"
      class="flex-1 overflow-hidden relative"
      style="cursor: grab;"
      @mousedown="startPan"
      @wheel="handleWheel"
      @dblclick="resetView"
    >
      <img
        v-if="dataUrl"
        ref="imgEl"
        :src="dataUrl"
        class="absolute select-none"
        style="transform-origin: 0 0; image-rendering: auto;"
        :style="{ transform: `translate(${panX}px, ${panY}px) scale(${zoom})` }"
        draggable="false"
        @load="onImgLoad"
      />
      <div v-else-if="loading" class="flex items-center justify-center h-full text-sm" style="color: var(--fg-muted);">Loading image...</div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getMimeType } from '../../utils/fileTypes'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const viewport = ref(null)
const imgEl = ref(null)
const dataUrl = ref(null)
const zoom = ref(1)
const panX = ref(0)
const panY = ref(0)
const naturalSize = ref('')
const loading = ref(true)
const error = ref(null)

let isPanning = false
let panStartX = 0
let panStartY = 0
let startPanX = 0
let startPanY = 0

onMounted(async () => {
  try {
    const base64 = await invoke('read_file_base64', { path: props.filePath })
    const mime = getMimeType(props.filePath)
    dataUrl.value = `data:${mime};base64,${base64}`
    loading.value = false
  } catch (e) {
    error.value = e.toString()
    loading.value = false
  }
})

async function onImgLoad() {
  if (!imgEl.value || !viewport.value) return
  const w = imgEl.value.naturalWidth
  const h = imgEl.value.naturalHeight
  naturalSize.value = `${w} × ${h}`
  await nextTick()
  // Default to 1:1 (top-left corner visible)
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function resetView() {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}

function zoomIn() {
  zoomBy(1.25)
}

function zoomOut() {
  zoomBy(0.8)
}

function zoomBy(factor) {
  if (!viewport.value) return
  const vw = viewport.value.clientWidth
  const vh = viewport.value.clientHeight
  // Zoom towards center
  const cx = vw / 2
  const cy = vh / 2
  const newZoom = Math.max(0.01, Math.min(zoom.value * factor, 20))
  panX.value = cx - (cx - panX.value) * (newZoom / zoom.value)
  panY.value = cy - (cy - panY.value) * (newZoom / zoom.value)
  zoom.value = newZoom
}

function handleWheel(e) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  const rect = viewport.value.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top
  const newZoom = Math.max(0.01, Math.min(zoom.value * factor, 20))
  panX.value = cx - (cx - panX.value) * (newZoom / zoom.value)
  panY.value = cy - (cy - panY.value) * (newZoom / zoom.value)
  zoom.value = newZoom
}

function startPan(e) {
  if (e.button !== 0) return
  isPanning = true
  panStartX = e.clientX
  panStartY = e.clientY
  startPanX = panX.value
  startPanY = panY.value
  viewport.value.style.cursor = 'grabbing'
  document.addEventListener('mousemove', onPanMove)
  document.addEventListener('mouseup', stopPan)
}

function onPanMove(e) {
  if (!isPanning) return
  panX.value = startPanX + (e.clientX - panStartX)
  panY.value = startPanY + (e.clientY - panStartY)
}

function stopPan() {
  isPanning = false
  if (viewport.value) viewport.value.style.cursor = 'grab'
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', stopPan)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onPanMove)
  document.removeEventListener('mouseup', stopPan)
})
</script>

<style scoped>
.img-btn {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  border: 1px solid var(--border);
  transition: background 0.15s;
}
.img-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}
</style>
