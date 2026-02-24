<template>
  <div class="docx-task-gutter" v-if="indicators.length">
    <div
      v-for="ind in indicators"
      :key="ind.threadId"
      class="docx-task-dot"
      :class="[dotClass(ind), { 'docx-task-active': ind.threadId === tasksStore.activeThreadId }]"
      :style="{ top: ind.top + 'px', left: ind.left + 'px' }"
      :title="ind.preview"
      @click.stop="openThread(ind.threadId)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useTasksStore } from '../../stores/tasks'

const props = defineProps({
  filePath: { type: String, required: true },
  wrapperEl: { type: Object, default: null },
  superdoc: { type: Object, default: null },
})

const tasksStore = useTasksStore()
const indicators = ref([])

let rafId = null
let resizeObserver = null
let recalcTimeout = null

const threads = computed(() => {
  return tasksStore.threadsForFile(props.filePath)
})

function dotClass(ind) {
  if (ind.approximate) return 'docx-task-approximate'
  if (ind.status === 'streaming') return 'docx-task-streaming'
  if (ind.status === 'error') return 'docx-task-error'
  return 'docx-task-idle'
}

function openThread(threadId) {
  tasksStore.setActiveThread(threadId)
  window.dispatchEvent(new CustomEvent('open-tasks'))
}

/**
 * Find the gutter left position by reading the first .superdoc-fragment element's
 * left offset. This accounts for DOCX document margins.
 */
function getGutterLeft(container) {
  const fragment = container.querySelector('.superdoc-fragment')
  if (!fragment) return 8
  const fragRect = fragment.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  // Place dot 20px left of the fragment edge (in the margin area)
  return Math.max(4, fragRect.left - containerRect.left - 20)
}

/**
 * Search visible .superdoc-line elements for text matching the thread's selectedText.
 * Returns the bounding rect of the matching line relative to the wrapper container.
 */
function findLineForText(container, searchText) {
  if (!searchText) return null

  const lines = container.querySelectorAll('.superdoc-line')
  if (!lines.length) return null

  // Normalize and truncate search text for matching
  const needle = searchText.slice(0, 60).replace(/\s+/g, ' ').trim().toLowerCase()
  if (!needle) return null

  for (const line of lines) {
    const lineText = (line.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
    if (lineText.includes(needle)) {
      return line.getBoundingClientRect()
    }
  }

  return null
}

/**
 * Estimate position from ProseMirror range as a fraction of total content height.
 * Used as fallback when text search doesn't find a match.
 */
function estimatePosition(container, range, docSize) {
  if (!range || !docSize) return null

  const scrollHeight = container.scrollHeight
  const ratio = range.from / docSize
  return container.scrollTop + ratio * scrollHeight
}

function recalcIndicators() {
  const container = props.wrapperEl
  if (!container) {
    indicators.value = []
    return
  }

  const activeThreads = threads.value.filter(t => t.status !== 'resolved')
  if (!activeThreads.length) {
    indicators.value = []
    return
  }

  const containerRect = container.getBoundingClientRect()
  const gutterLeft = getGutterLeft(container)
  const docSize = props.superdoc?.activeEditor?.state?.doc?.content?.size || 1

  const result = []
  const usedTops = new Set()

  for (const thread of activeThreads) {
    let top = null
    let approximate = false

    // Try text search first
    const lineRect = findLineForText(container, thread.selectedText)
    if (lineRect) {
      top = lineRect.top - containerRect.top + container.scrollTop + (lineRect.height / 2) - 4

      // Check for duplicate position (different threads on same line)
      const roundedTop = Math.round(top / 10) * 10
      if (usedTops.has(roundedTop)) {
        // Offset slightly to avoid overlap
        top += 12
      }
      usedTops.add(roundedTop)
    } else {
      // Fallback: estimate from PM position
      const est = estimatePosition(container, thread.range, docSize)
      if (est !== null) {
        top = est
        approximate = true
      }
    }

    if (top !== null) {
      const preview = thread.selectedText
        ? (thread.selectedText.length > 60 ? thread.selectedText.slice(0, 60) + '...' : thread.selectedText)
        : ''

      result.push({
        threadId: thread.id,
        top,
        left: gutterLeft,
        status: thread.status,
        approximate,
        preview,
      })
    }
  }

  indicators.value = result
}

function scheduleRecalc(delay = 50) {
  if (recalcTimeout) clearTimeout(recalcTimeout)
  recalcTimeout = setTimeout(recalcIndicators, delay)
}

function onScroll() {
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(recalcIndicators)
}

function onContentChanged() {
  scheduleRecalc(300)
}

onMounted(() => {
  const container = props.wrapperEl
  if (container) {
    container.addEventListener('scroll', onScroll, { passive: true })
    container.addEventListener('docx-content-changed', onContentChanged)

    resizeObserver = new ResizeObserver(() => scheduleRecalc(150))
    resizeObserver.observe(container)
  }

  // Initial calculation after a short delay for SuperDoc to paint
  scheduleRecalc(200)
})

onUnmounted(() => {
  const container = props.wrapperEl
  if (container) {
    container.removeEventListener('scroll', onScroll)
    container.removeEventListener('docx-content-changed', onContentChanged)
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
  if (rafId) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  if (recalcTimeout) {
    clearTimeout(recalcTimeout)
    recalcTimeout = null
  }
})

// Recalc when threads change
watch(threads, () => scheduleRecalc(50), { deep: true })

// Recalc when active thread changes (for highlight)
watch(() => tasksStore.activeThreadId, () => {
  // No need to recalculate positions, just re-render (reactive via template)
})

// Recalc when superdoc editor becomes ready
watch(() => props.superdoc?.activeEditor, () => {
  scheduleRecalc(300)
})
</script>
