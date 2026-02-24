<template>
  <div
    v-if="fileEdits.length > 0"
    class="flex items-center justify-between px-2 shrink-0"
    style="background: rgba(224, 175, 104, 0.08); border-bottom: 1px solid var(--border); height: 28px;"
  >
    <span class="text-xs" style="color: var(--warning);">
      {{ fileEdits.length }} change{{ fileEdits.length !== 1 ? 's' : '' }}
    </span>
    <div class="flex items-center gap-1.5">
      <button
        class="review-bar-btn review-bar-accept"
        @click="reviews.acceptAllForFile(filePath)"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 8.5l3.5 3.5 6.5-8"/></svg>
        Keep All
      </button>
      <button
        class="review-bar-btn review-bar-reject"
        @click="reviews.rejectAllForFile(filePath)"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 2l6 6M8 2l-6 6"/></svg>
        Revert All
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
  return reviews.editsForFile(props.filePath)
})
</script>
