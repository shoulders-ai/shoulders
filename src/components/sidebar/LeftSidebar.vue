<template>
  <div ref="containerEl" class="flex flex-col h-full overflow-hidden bg-[var(--bg-secondary)]">
    <!-- Explorer section -->
    <div
      class="overflow-hidden"
      :style="explorerStyle"
    >
      <FileTree
        ref="fileTreeRef"
        :collapsed="explorerCollapsed"
        @toggle-collapse="toggleExplorer"
        @version-history="$emit('version-history', $event)"
      />
    </div>

    <!-- Resize handle: explorer ↔ refs (when both expanded) -->
    <div
      v-if="showHandleExplorerRefs"
      class="relative h-0.5 shrink-0 cursor-row-resize bg-transparent"
      @mousedown="startResizeRefs"
    >
      <!-- Visual handle, stays at 1px -->
      <div
        class="absolute left-0 right-0 top-0.5 -translate-y-1/2 h-4 w-full z-10"
        
      ></div>
      <!-- Hover indicator remains at 1px high for visual, but you can increase its opacity or style on hover if needed -->
    </div>

    <!-- References section -->
    <div
      class="overflow-hidden relative border-b border-t border-[var(--border)]"
      :style="refsStyle"
    >
      <ReferenceList
        :collapsed="refsCollapsed"
        @toggle-collapse="toggleRefs"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import FileTree from './FileTree.vue'
import ReferenceList from './ReferenceList.vue'

const emit = defineEmits(['version-history'])

const workspace = useWorkspaceStore()
const containerEl = ref(null)
const fileTreeRef = ref(null)

// Collapse states
const explorerCollapsed = ref(false)
const refsCollapsed = ref(false)

// Panel heights when expanded (resizable)
const refHeight = ref(250)

onMounted(() => {
  try {
    const rh = localStorage.getItem('referencesPanelHeight')
    if (rh) refHeight.value = parseInt(rh, 10) || 250
    explorerCollapsed.value = localStorage.getItem('explorerCollapsed') === 'true'
    refsCollapsed.value = localStorage.getItem('refsCollapsed') === 'true'
  } catch { /* ignore */ }
})

function toggleExplorer() {
  explorerCollapsed.value = !explorerCollapsed.value
  try { localStorage.setItem('explorerCollapsed', String(explorerCollapsed.value)) } catch {}
}

function toggleRefs() {
  refsCollapsed.value = !refsCollapsed.value
  try { localStorage.setItem('refsCollapsed', String(refsCollapsed.value)) } catch {}
}

// Count expanded panels
const expandedCount = computed(() => {
  let n = 0
  if (!explorerCollapsed.value) n++
  if (!refsCollapsed.value) n++
  return n
})

// --- Layout styles ---

const explorerStyle = computed(() => {
  if (explorerCollapsed.value) return { flex: '0 0 auto' }
  // Explorer always gets flex-1 (fills remaining space)
  return { flex: '1 1 0', minHeight: expandedCount.value > 1 ? '60px' : '28px' }
})

const refsStyle = computed(() => {
  if (refsCollapsed.value) return { flex: '0 0 auto' }
  // If refs is the only expanded panel, it fills the space
  if (expandedCount.value === 1) return { flex: '1 1 0', minHeight: '28px' }
  return { flex: `0 0 ${refHeight.value}px` }
})

// --- Resize handle visibility ---

const showHandleExplorerRefs = computed(() =>
  !explorerCollapsed.value && !refsCollapsed.value
)

// --- Resize logic ---

function startResizeRefs(event) {
  const startY = event.clientY
  const startHeight = refHeight.value
  const container = containerEl.value

  const onMouseMove = (ev) => {
    const delta = startY - ev.clientY
    const containerHeight = container?.getBoundingClientRect().height || 600
    // Leave room for explorer (60px min) and handle (3px)
    const maxHeight = containerHeight - 60 - 3
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
