<template>
  <div
    v-if="fileEdits.length > 0"
    class="flex items-center justify-between px-2 shrink-0"
    style="background: rgba(224, 175, 104, 0.08); border-bottom: 1px solid var(--border); height: 28px;"
  >
    <span class="text-xs" style="color: var(--warning);">
      {{ fileEdits.length }} cell change{{ fileEdits.length !== 1 ? 's' : '' }}
    </span>
    <div class="flex items-center gap-1.5">
      <button
        class="review-bar-btn review-bar-accept"
        @click="reviews.acceptAllForFile(filePath)"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,8 7,12 13,4"/></svg>
        Accept All
      </button>
      <button
        class="review-bar-btn review-bar-reject"
        @click="reviews.rejectAllForFile(filePath)"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
        Reject All
      </button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useReviewsStore } from '../../stores/reviews'

const props = defineProps({
  filePath: { type: String, default: null },
})

const reviews = useReviewsStore()

const fileEdits = computed(() => {
  if (!props.filePath) return []
  return reviews.notebookEditsForFile(props.filePath)
})
</script>
