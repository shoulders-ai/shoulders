<template>
  <div ref="containerEl" class="flex flex-col h-full overflow-hidden bg-surface-secondary">
    <!-- Panel area: explorer + private + refs fill remaining space -->
    <div class="flex-1 flex flex-col min-h-0 overflow-hidden">
      <!-- Explorer section -->
      <div
        class="overflow-hidden"
        :style="explorerStyle"
      >
        <FileTree
          ref="fileTreeRef"
          :collapsed="explorerCollapsed"
          @toggle-collapse="toggleExplorer"
          @open-search="openSearch"
          @version-history="$emit('version-history', $event)"
        />
      </div>

      <!-- Resize handle: explorer <-> private (when both expanded) -->
      <div
        v-if="showHandleExplorerPrivate"
        class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
        @mousedown="startResizePrivate"
      >
        <div class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"></div>
      </div>

      <!-- Private section -->
      <div
        class="overflow-hidden relative border-t border-line"
        :style="privateStyle"
      >
        <PrivateTree
          :collapsed="privateCollapsed"
          @toggle-collapse="togglePrivate"
        />
      </div>

      <!-- Resize handle: above refs (when refs + at least one panel above is expanded) -->
      <div
        v-if="showHandleAboveRefs"
        class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
        @mousedown="startResizeRefs"
      >
        <div class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"></div>
      </div>

      <!-- References section -->
      <div
        class="overflow-hidden relative border-t border-line"
        :style="refsStyle"
      >
        <ReferenceList
          :collapsed="refsCollapsed"
          @toggle-collapse="toggleRefs"
        />
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import FileTree from './FileTree.vue'
import PrivateTree from './PrivateTree.vue'
import ReferenceList from './ReferenceList.vue'

const emit = defineEmits(['version-history'])

const workspace = useWorkspaceStore()
const containerEl = ref(null)
const fileTreeRef = ref(null)

// --- Collapse states ---
const explorerCollapsed = ref(false)
const privateCollapsed = ref(false)
const refsCollapsed = ref(false)

// Panel heights when expanded (resizable)
const privateHeight = ref(180)
const refHeight = ref(250)

onMounted(() => {
  try {
    const rh = localStorage.getItem('referencesPanelHeight')
    if (rh) refHeight.value = parseInt(rh, 10) || 250
    const ph = localStorage.getItem('privatePanelHeight')
    if (ph) privateHeight.value = parseInt(ph, 10) || 180
    explorerCollapsed.value = localStorage.getItem('explorerCollapsed') === 'true'
    privateCollapsed.value = localStorage.getItem('privateCollapsed') === 'true'
    refsCollapsed.value = localStorage.getItem('refsCollapsed') === 'true'
  } catch { /* ignore */ }
})

function toggleExplorer() {
  explorerCollapsed.value = !explorerCollapsed.value
  try { localStorage.setItem('explorerCollapsed', String(explorerCollapsed.value)) } catch {}
}

function togglePrivate() {
  privateCollapsed.value = !privateCollapsed.value
  try { localStorage.setItem('privateCollapsed', String(privateCollapsed.value)) } catch {}
}

function toggleRefs() {
  refsCollapsed.value = !refsCollapsed.value
  try { localStorage.setItem('refsCollapsed', String(refsCollapsed.value)) } catch {}
}

// Count expanded panels
const expandedCount = computed(() => {
  let n = 0
  if (!explorerCollapsed.value) n++
  if (!privateCollapsed.value) n++
  if (!refsCollapsed.value) n++
  return n
})

// --- Layout styles ---
const explorerStyle = computed(() => {
  if (explorerCollapsed.value) return { flex: '0 0 auto' }
  return { flex: '1 1 0', minHeight: expandedCount.value > 1 ? '60px' : '28px' }
})

const privateStyle = computed(() => {
  if (privateCollapsed.value) return { flex: '0 0 auto' }
  if (expandedCount.value === 1) return { flex: '1 1 0', minHeight: '28px' }
  return { flex: `0 0 ${privateHeight.value}px` }
})

const refsStyle = computed(() => {
  if (refsCollapsed.value) return { flex: '0 0 auto' }
  if (expandedCount.value === 1) return { flex: '1 1 0', minHeight: '28px' }
  return { flex: `0 0 ${refHeight.value}px` }
})

// --- Resize handle visibility ---
const showHandleExplorerPrivate = computed(() =>
  !explorerCollapsed.value && !privateCollapsed.value
)

const showHandleAboveRefs = computed(() =>
  !refsCollapsed.value && (!explorerCollapsed.value || !privateCollapsed.value)
)

// --- Resize logic ---
function startResizePrivate(event) {
  const startY = event.clientY
  const startHeight = privateHeight.value
  const container = containerEl.value

  const onMouseMove = (ev) => {
    const delta = startY - ev.clientY
    const containerHeight = container?.getBoundingClientRect().height || 600
    const maxHeight = containerHeight - 120
    const newHeight = Math.max(60, Math.min(maxHeight, startHeight + delta))
    privateHeight.value = newHeight
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    try { localStorage.setItem('privatePanelHeight', String(privateHeight.value)) } catch {}
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startResizeRefs(event) {
  const startY = event.clientY
  const startHeight = refHeight.value
  const container = containerEl.value

  const onMouseMove = (ev) => {
    const delta = startY - ev.clientY
    const containerHeight = container?.getBoundingClientRect().height || 600
    const maxHeight = containerHeight - 120
    const newHeight = Math.max(60, Math.min(maxHeight, startHeight + delta))
    refHeight.value = newHeight
    workspace.referencesPanelHeight = newHeight
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    try { localStorage.setItem('referencesPanelHeight', String(refHeight.value)) } catch {}
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// --- Search ---
function openSearch() {
  window.dispatchEvent(new CustomEvent('app:focus-search'))
}

// Expose FileTree methods for App.vue
defineExpose({
  createNewFile(ext = '.md') {
    fileTreeRef.value?.createNewFile(ext)
  },
  activateFilter() {
    fileTreeRef.value?.activateFilter()
  },
})
</script>
