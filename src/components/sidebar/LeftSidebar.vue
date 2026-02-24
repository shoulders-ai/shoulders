<template>
  <div ref="containerEl" class="flex flex-col h-full overflow-hidden">
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
      class="h-[3px] shrink-0 cursor-row-resize hover:bg-[var(--accent)]"
      :style="{ background: 'var(--border)' }"
      @mousedown="startResizeRefs"
    ></div>

    <!-- References section -->
    <div
      class="overflow-hidden relative"
      :style="refsStyle"
    >
      <ReferenceList
        :collapsed="refsCollapsed"
        @toggle-collapse="toggleRefs"
      />
    </div>

    <!-- Resize handle: refs ↔ outline (when both expanded) -->
    <div
      v-if="showHandleRefsOutline"
      class="h-[3px] shrink-0 cursor-row-resize hover:bg-[var(--accent)]"
      :style="{ background: 'var(--border)' }"
      @mousedown="startResizeOutline"
    ></div>

    <!-- Resize handle: explorer ↔ outline (when refs collapsed, both others expanded) -->
    <div
      v-if="showHandleExplorerOutline"
      class="h-[3px] shrink-0 cursor-row-resize hover:bg-[var(--accent)]"
      :style="{ background: 'var(--border)' }"
      @mousedown="startResizeOutline"
    ></div>

    <!-- Outline section -->
    <div
      class="overflow-hidden"
      :style="outlineStyle"
    >
      <OutlinePanel
        :collapsed="outlineCollapsed"
        @toggle-collapse="toggleOutline"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import FileTree from './FileTree.vue'
import OutlinePanel from './OutlinePanel.vue'
import ReferenceList from './ReferenceList.vue'

const emit = defineEmits(['version-history'])

const workspace = useWorkspaceStore()
const containerEl = ref(null)
const fileTreeRef = ref(null)

// Collapse states
const explorerCollapsed = ref(false)
const outlineCollapsed = ref(true) // collapsed by default
const refsCollapsed = ref(false)

// Panel heights when expanded (resizable)
const outlineHeight = ref(180)
const refHeight = ref(250)

onMounted(() => {
  try {
    const rh = localStorage.getItem('referencesPanelHeight')
    if (rh) refHeight.value = parseInt(rh, 10) || 250
    const oh = localStorage.getItem('outlinePanelHeight')
    if (oh) outlineHeight.value = parseInt(oh, 10) || 180
    explorerCollapsed.value = localStorage.getItem('explorerCollapsed') === 'true'
    outlineCollapsed.value = localStorage.getItem('outlineCollapsed') !== 'false' // default true
    refsCollapsed.value = localStorage.getItem('refsCollapsed') === 'true'
  } catch { /* ignore */ }
})

function toggleExplorer() {
  explorerCollapsed.value = !explorerCollapsed.value
  try { localStorage.setItem('explorerCollapsed', String(explorerCollapsed.value)) } catch {}
}

function toggleOutline() {
  outlineCollapsed.value = !outlineCollapsed.value
  try { localStorage.setItem('outlineCollapsed', String(outlineCollapsed.value)) } catch {}
}

function toggleRefs() {
  refsCollapsed.value = !refsCollapsed.value
  try { localStorage.setItem('refsCollapsed', String(refsCollapsed.value)) } catch {}
}

// Count expanded panels (excluding explorer which is always flex-1)
const expandedCount = computed(() => {
  let n = 0
  if (!explorerCollapsed.value) n++
  if (!outlineCollapsed.value) n++
  if (!refsCollapsed.value) n++
  return n
})

// --- Layout styles ---

const explorerStyle = computed(() => {
  if (explorerCollapsed.value) return { flex: '0 0 auto' }
  // Explorer always gets flex-1 (fills remaining space)
  return { flex: '1 1 0', minHeight: expandedCount.value > 1 ? '60px' : '28px' }
})

const outlineStyle = computed(() => {
  if (outlineCollapsed.value) return { flex: '0 0 auto' }
  // If outline is the only expanded panel, it fills the space
  if (expandedCount.value === 1) return { flex: '1 1 0', minHeight: '28px' }
  return { flex: `0 0 ${outlineHeight.value}px` }
})

const refsStyle = computed(() => {
  if (refsCollapsed.value) return { flex: '0 0 auto' }
  // If refs is the only expanded panel, it fills the space
  if (expandedCount.value === 1) return { flex: '1 1 0', minHeight: '28px' }
  return { flex: `0 0 ${refHeight.value}px` }
})

// --- Resize handle visibility ---
// Only one handle between any two adjacent expanded panels

const showHandleExplorerRefs = computed(() =>
  !explorerCollapsed.value && !refsCollapsed.value
)

const showHandleRefsOutline = computed(() =>
  !refsCollapsed.value && !outlineCollapsed.value
)

// When refs is collapsed but explorer and outline are both expanded
const showHandleExplorerOutline = computed(() =>
  !explorerCollapsed.value && refsCollapsed.value && !outlineCollapsed.value
)

// --- Resize logic ---

function startResizeOutline(event) {
  const startY = event.clientY
  const startHeight = outlineHeight.value
  const container = containerEl.value

  const onMouseMove = (ev) => {
    const delta = ev.clientY - startY
    const containerHeight = container?.getBoundingClientRect().height || 600
    // Leave room for explorer (60px min), refs, handles, and collapsed headers
    const maxHeight = containerHeight - 60 - 3 - (refsCollapsed.value ? 40 : Math.max(60, refHeight.value) + 3)
    const newHeight = Math.max(60, Math.min(maxHeight, startHeight - delta))
    outlineHeight.value = newHeight
  }

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    try { localStorage.setItem('outlinePanelHeight', String(outlineHeight.value)) } catch {}
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
    // Leave room for explorer (60px min), outline, handles, and collapsed headers
    const outlineSpace = outlineCollapsed.value ? 28 : Math.max(60, outlineHeight.value) + 3
    const maxHeight = containerHeight - 60 - 3 - outlineSpace
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
  createNewMarkdown() {
    fileTreeRef.value?.createNewMarkdown()
  },
  activateFilter() {
    fileTreeRef.value?.activateFilter()
  },
})
</script>
