<template>
  <div
    class="comment-card"
    :class="{
      'comment-card-active': active,
      'comment-card-resolved': comment.status === 'resolved',
    }"
    @click="$emit('click')"
  >
    <!-- Author -->
    <div class="comment-card-author flex items-center gap-1">
      <!-- AI icon (sparkle) -->
      <svg v-if="comment.author === 'ai'" width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink: 0;">
        <path d="M8 0l1.5 5.5L14 8l-4.5 2.5L8 16l-1.5-5.5L2 8l4.5-2.5z"/>
      </svg>
      <!-- User icon (person) -->
      <svg v-else width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="flex-shrink: 0;">
        <circle cx="8" cy="5" r="3"/>
        <path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/>
      </svg>
      {{ comment.author === 'ai' ? 'AI' : 'You' }}
    </div>

    <!-- Comment text (truncated via CSS) -->
    <div class="comment-card-text">{{ comment.text }}</div>

    <!-- Meta: reply count, proposed edit indicator -->
    <div v-if="replyCount || hasProposedEdit" class="comment-card-meta flex items-center gap-1.5">
      <span v-if="replyCount">{{ replyCount }} {{ replyCount === 1 ? 'reply' : 'replies' }}</span>
      <span v-if="hasProposedEdit" :style="{ color: 'var(--accent)' }">&#183; Edit suggested</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  comment: { type: Object, required: true },
  active: { type: Boolean, default: false },
})

defineEmits(['click'])

const replyCount = computed(() => props.comment.replies?.length || 0)

const hasProposedEdit = computed(() => {
  if (props.comment.proposedEdit) return true
  return (props.comment.replies || []).some(r => r.proposedEdit)
})
</script>
