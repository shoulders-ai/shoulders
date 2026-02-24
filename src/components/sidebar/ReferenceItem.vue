<template>
  <div
    class="py-1.5 px-2 cursor-pointer ref-item group select-none"
    :class="{
      'bg-[var(--bg-hover)]': isActive || isSelected,
    }"
    @click="handleClick"
    @contextmenu.prevent="$emit('context-menu', { event: $event, ref: reference })"
    @mousedown="handleMouseDown"
  >
    <!-- Line 1: Title + indicators -->
    <div class="flex items-center gap-1">
      <div class="flex-1 min-w-0 ui-text-base truncate" :style="{ color: 'var(--fg-secondary)' }">
        {{ reference.title || 'Untitled' }}
      </div>
      <!-- Copy citation button (hover) -->
      <button
        class="shrink-0 w-4 h-4 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity"
        :style="{ color: copied ? 'var(--success)' : 'var(--fg-muted)' }"
        title="Copy citation"
        @click.stop="copyCitation"
      >
        <svg v-if="!copied" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3a1 1 0 011-1h8"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 8l3 3 7-7"/>
        </svg>
      </button>
      <span v-if="isCited" class="shrink-0 inline-block w-[5px] h-[5px] rounded-full" :style="{ background: 'var(--success)' }" title="Cited in document"></span>
      <svg v-if="reference._pdfFile" class="shrink-0" width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" :style="{ color: 'var(--fg-muted)' }">
        <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"/>
        <path d="M9 1v4h4"/>
      </svg>
      <span v-if="reference._needsReview" class="ref-needs-review shrink-0"></span>
    </div>
    <!-- Line 2: Author (year) -->
    <div class="ui-text-sm mt-0.5 truncate" :style="{ color: 'var(--fg-muted)' }">
      {{ authorLine }}{{ yearStr ? ` (${yearStr})` : '' }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useReferencesStore } from '../../stores/references'

const props = defineProps({
  reference: { type: Object, required: true },
  isSelected: { type: Boolean, default: false },
  isCited: { type: Boolean, default: false },
})

const copied = ref(false)
let copiedTimer = null

function copyCitation() {
  navigator.clipboard.writeText(`[@${props.reference._key}]`)
  copied.value = true
  clearTimeout(copiedTimer)
  copiedTimer = setTimeout(() => { copied.value = false }, 1200)
}

const emit = defineEmits(['click', 'context-menu', 'drag-start'])

const referencesStore = useReferencesStore()

const isActive = computed(() => referencesStore.activeKey === props.reference._key)

const authorLine = computed(() => {
  const authors = props.reference.author || []
  if (authors.length === 0) return 'Unknown'
  const first = authors[0].family || authors[0].given || ''
  if (authors.length === 1) return first
  if (authors.length === 2) return `${first} & ${authors[1].family || ''}`
  return `${first} et al.`
})

const yearStr = computed(() => {
  return props.reference.issued?.['date-parts']?.[0]?.[0] || ''
})

function handleClick(event) {
  emit('click', { key: props.reference._key, event })
}

let mouseDownInfo = null

function handleMouseDown(event) {
  if (event.button !== 0) return
  mouseDownInfo = { x: event.clientX, y: event.clientY, key: props.reference._key }

  const onMouseMove = (ev) => {
    if (!mouseDownInfo) return
    const dx = Math.abs(ev.clientX - mouseDownInfo.x)
    const dy = Math.abs(ev.clientY - mouseDownInfo.y)
    if (dx > 3 || dy > 3) {
      emit('drag-start', { key: mouseDownInfo.key, event: ev })
      mouseDownInfo = null
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }
  const onMouseUp = () => {
    mouseDownInfo = null
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>
