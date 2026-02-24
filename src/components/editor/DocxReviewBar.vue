<template>
  <div
    v-if="changeCount > 0"
    class="flex items-center justify-between px-2 shrink-0"
    style="background: rgba(224,175,104,0.08); border-bottom: 1px solid var(--border); height: 28px;"
  >
    <span class="text-xs" style="color: var(--warning);">
      {{ changeCount }} tracked change{{ changeCount !== 1 ? 's' : '' }}
    </span>
    <div class="flex gap-1.5">
      <button class="review-bar-btn review-bar-accept" @click="acceptAll">Accept All</button>
      <button class="review-bar-btn review-bar-reject" @click="rejectAll">Reject All</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { trackChangesHelpers } from 'superdoc'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const editorStore = useEditorStore()
const changeCount = ref(0)

let editorUnsubscribe = null

onMounted(() => {
  wireEditor()
})

onUnmounted(() => {
  unwireEditor()
})

watch(() => props.filePath, () => {
  unwireEditor()
  wireEditor()
})

function getSuperdoc() {
  return editorStore.getSuperdoc(props.paneId, props.filePath)
}

function wireEditor() {
  const sd = getSuperdoc()
  const ed = sd?.activeEditor
  if (!ed) {
    // Editor not ready yet — retry shortly
    const timer = setTimeout(() => wireEditor(), 500)
    editorUnsubscribe = () => clearTimeout(timer)
    return
  }
  const handler = () => updateChangeCount()
  ed.on('update', handler)
  editorUnsubscribe = () => ed.off('update', handler)
  updateChangeCount()
}

function unwireEditor() {
  editorUnsubscribe?.()
  editorUnsubscribe = null
}

function updateChangeCount() {
  const sd = getSuperdoc()
  const ed = sd?.activeEditor
  if (!ed) {
    changeCount.value = 0
    return
  }
  try {
    const changes = trackChangesHelpers.getTrackChanges(ed.state)
    changeCount.value = Array.isArray(changes) ? changes.length : 0
  } catch {
    changeCount.value = 0
  }
}

function acceptAll() {
  const sd = getSuperdoc()
  if (!sd?.activeEditor) return
  try {
    sd.activeEditor.commands?.acceptAllTrackedChanges?.()
    updateChangeCount()
  } catch (e) {
    console.warn('Accept all tracked changes failed:', e)
  }
}

function rejectAll() {
  const sd = getSuperdoc()
  if (!sd?.activeEditor) return
  try {
    sd.activeEditor.commands?.rejectAllTrackedChanges?.()
    updateChangeCount()
  } catch (e) {
    console.warn('Reject all tracked changes failed:', e)
  }
}
</script>
