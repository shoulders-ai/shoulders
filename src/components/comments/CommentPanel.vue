<template>
  <!-- Create mode -->
  <div v-if="mode === 'create'" class="comment-panel" :style="panelPosition" ref="panelRef">
    <CommentInput
      ref="createInputRef"
      placeholder="Type your comment..."
      :autofocus="true"
      :show-submit="true"
      @save="handleCreate"
      @save-and-submit="handleCreateAndSubmit"
      @cancel="$emit('close')"
    />
  </div>

  <!-- View mode (existing comment) -->
  <div v-else-if="comment" class="comment-panel" :style="panelPosition" ref="panelRef">
    <!-- Header -->
    <div class="comment-panel-header">
      <span class="truncate flex-1 mr-2" style="min-width: 0;">Comment on "{{ truncate(comment.anchorText, 40) }}"</span>
      <div class="flex items-center gap-0.5 shrink-0">
        <!-- More menu (contains delete) -->
        <div class="relative" ref="moreMenuRef">
          <button
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] bg-transparent border-none cursor-pointer"
            style="color: var(--fg-muted);"
            title="More actions"
            @click.stop="showMoreMenu = !showMoreMenu"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="4" cy="8" r="1.3"/>
              <circle cx="8" cy="8" r="1.3"/>
              <circle cx="12" cy="8" r="1.3"/>
            </svg>
          </button>
          <div
            v-if="showMoreMenu"
            class="absolute right-0 top-full mt-1 z-10 rounded border py-1"
            style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.2); min-width: 140px;"
          >
            <button
              class="w-full px-3 py-1.5 flex items-center gap-2 bg-transparent border-none cursor-pointer text-left hover:bg-[rgba(247,118,142,0.1)]"
              :style="{ color: 'var(--error)', fontSize: 'calc(var(--ui-font-size, 13px) - 1px)' }"
              @click="handleDelete"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 4.5h10M6 4.5V3a1 1 0 011-1h2a1 1 0 011 1v1.5M5 4.5v8a1 1 0 001 1h4a1 1 0 001-1v-8"/>
              </svg>
              Delete comment
            </button>
          </div>
        </div>
        <!-- Close -->
        <button
          class="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] bg-transparent border-none cursor-pointer"
          style="color: var(--fg-muted);"
          @click="$emit('close')"
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 2l6 6M8 2l-6 6"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Thread -->
    <div class="comment-panel-thread">
      <!-- Original comment -->
      <div class="comment-panel-reply">
        <div class="comment-panel-reply-author">
          {{ comment.author === 'ai' ? 'AI' : 'You' }}
        </div>
        <div class="comment-panel-reply-text">{{ comment.text }}</div>
        <div class="comment-panel-reply-time">{{ formatTime(comment.createdAt) }}</div>

        <!-- Proposed edit on root comment -->
        <div v-if="comment.proposedEdit" class="comment-diff-card">
          <div class="comment-diff-old">{{ comment.proposedEdit.oldText }}</div>
          <div class="comment-diff-new">{{ comment.proposedEdit.newText }}</div>
          <div class="comment-diff-actions">
            <template v-if="!rootEditStatus">
              <button class="comment-btn-primary" @click="applyEdit(comment.id)">Apply</button>
              <button class="comment-btn-secondary" @click="dismissEdit(comment.id)">Dismiss</button>
            </template>
            <span v-else-if="rootEditStatus.status === 'applied'" style="color: var(--success);">Applied</span>
            <span v-else-if="rootEditStatus.status === 'error'" style="color: var(--error);">{{ rootEditStatus.error }}</span>
          </div>
        </div>
      </div>

      <!-- Replies -->
      <div v-for="reply in comment.replies" :key="reply.id" class="comment-panel-reply">
        <div class="comment-panel-reply-author">
          {{ reply.author === 'ai' ? 'AI' : 'You' }}
        </div>
        <div class="comment-panel-reply-text">{{ reply.text }}</div>
        <div class="comment-panel-reply-time">{{ formatTime(reply.timestamp) }}</div>

        <!-- Proposed edit in reply -->
        <div v-if="reply.proposedEdit" class="comment-diff-card">
          <div class="comment-diff-old">{{ reply.proposedEdit.oldText }}</div>
          <div class="comment-diff-new">{{ reply.proposedEdit.newText }}</div>
          <div class="comment-diff-actions">
            <template v-if="!getReplyEditStatus(reply.id)">
              <button class="comment-btn-primary" @click="applyEdit(comment.id, reply.id)">Apply</button>
              <button class="comment-btn-secondary" @click="dismissEdit(comment.id, reply.id)">Dismiss</button>
            </template>
            <span v-else-if="getReplyEditStatus(reply.id)?.status === 'applied'" style="color: var(--success);">Applied</span>
            <span v-else-if="getReplyEditStatus(reply.id)?.status === 'error'" style="color: var(--error);">{{ getReplyEditStatus(reply.id).error }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Resolve action -->
    <div class="comment-panel-resolve" style="padding: 4px 12px; border-top: 1px solid var(--border);">
      <button
        class="comment-resolve-btn"
        :class="{ 'comment-resolve-btn-resolved': comment.status === 'resolved' }"
        @click="handleResolve"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M3 8.5l3.5 3.5 6.5-7"/>
        </svg>
        {{ comment.status === 'resolved' ? 'Reopen' : 'Resolve' }}
      </button>
    </div>

    <!-- Reply input -->
    <div style="padding: 8px 12px; border-top: 1px solid var(--border);">
      <CommentInput
        ref="replyInputRef"
        placeholder="Reply..."
        @save="handleReply"
        @cancel="$emit('close')"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useCommentsStore } from '../../stores/comments'
import CommentInput from './CommentInput.vue'

const props = defineProps({
  comment: { type: Object, default: null },
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
  editorView: { type: Object, default: null },
  containerRect: { type: Object, default: null },
  mode: { type: String, default: 'view' },
  selectionRange: { type: Object, default: null },
  selectionText: { type: String, default: '' },
})

const emit = defineEmits(['close', 'comment-created'])

const commentsStore = useCommentsStore()

const panelRef = ref(null)
const createInputRef = ref(null)
const replyInputRef = ref(null)
const moreMenuRef = ref(null)
const showMoreMenu = ref(false)

// ─── Positioning ──────────────────────────────────────────────────

const panelPosition = computed(() => {
  if (!props.editorView || !props.containerRect) return { display: 'none' }

  let anchorPos
  if (props.mode === 'create' && props.selectionRange) {
    anchorPos = props.selectionRange.to
  } else if (props.comment) {
    anchorPos = props.comment.range.to
  } else {
    return { display: 'none' }
  }

  const coords = props.editorView.coordsAtPos(anchorPos)
  if (!coords) return { display: 'none' }

  const containerHeight = props.containerRect.height
  const containerWidth = props.containerRect.width
  const maxH = Math.max(200, containerHeight * 0.5)

  // Editor area width (excluding 200px margin if visible)
  const marginW = commentsStore.isMarginVisible(props.filePath) ? 200 : 0
  const editorW = containerWidth - marginW

  // Center panel horizontally within the editor area
  const panelW = Math.min(Math.max(280, editorW * 0.85), 640)
  const centeredLeft = Math.max(8, (editorW - panelW) / 2)

  const base = {
    left: centeredLeft + 'px',
    width: panelW + 'px',
    maxHeight: maxH + 'px',
  }

  // Position below the anchor text, relative to the container
  const anchorRelativeTop = coords.bottom - props.containerRect.top
  if (anchorRelativeTop > containerHeight * 0.6) {
    // Anchor is in bottom portion — position panel above
    return {
      ...base,
      bottom: (containerHeight - (coords.top - props.containerRect.top) + 4) + 'px',
    }
  }

  return {
    ...base,
    top: (anchorRelativeTop + 4) + 'px',
  }
})

// ─── Edit status helpers ──────────────────────────────────────────

const rootEditStatus = computed(() => {
  if (!props.comment) return null
  return commentsStore.getEditStatus(props.comment.id)
})

function getReplyEditStatus(replyId) {
  if (!props.comment) return null
  return commentsStore.getEditStatus(props.comment.id, replyId)
}

// ─── Actions ──────────────────────────────────────────────────────

function handleCreate({ text, fileRefs }) {
  if (!props.selectionRange) return
  const comment = commentsStore.createComment(
    props.filePath,
    props.selectionRange,
    props.selectionText,
    text,
    'user',
    fileRefs.length > 0 ? fileRefs : null,
  )
  emit('comment-created', comment)
  emit('close')
}

function handleCreateAndSubmit({ text, fileRefs }) {
  if (!props.selectionRange) return
  const comment = commentsStore.createComment(
    props.filePath,
    props.selectionRange,
    props.selectionText,
    text,
    'user',
    fileRefs.length > 0 ? fileRefs : null,
  )
  emit('comment-created', comment)
  commentsStore.submitToChat(props.filePath)
  emit('close')
}

function handleReply({ text, fileRefs }) {
  if (!props.comment) return
  commentsStore.addReply(props.comment.id, {
    author: 'user',
    text,
    fileRefs: fileRefs.length > 0 ? fileRefs : null,
  })
}

function handleResolve() {
  if (!props.comment) return
  if (props.comment.status === 'resolved') {
    commentsStore.unresolveComment(props.comment.id)
  } else {
    commentsStore.resolveComment(props.comment.id)
  }
  emit('close')
}

function handleDelete() {
  if (!props.comment) return
  showMoreMenu.value = false
  commentsStore.deleteComment(props.comment.id)
  emit('close')
}

function applyEdit(commentId, replyId) {
  commentsStore.applyProposedEdit(commentId, replyId)
  emit('close')
}

function dismissEdit(commentId, replyId) {
  const comment = commentsStore.comments.find(c => c.id === commentId)
  if (!comment) return

  if (replyId) {
    const reply = comment.replies.find(r => r.id === replyId)
    if (reply) reply.proposedEdit = null
  } else {
    comment.proposedEdit = null
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

function truncate(text, maxLen) {
  if (!text) return ''
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text
}

function formatTime(isoString) {
  if (!isoString) return ''
  const diff = Date.now() - new Date(isoString).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

// ─── Click outside to close ───────────────────────────────────────

function onDocumentMousedown(event) {
  if (event.target.closest('.comment-panel, .comment-margin, .comment-card, .comment-input-wrapper, .comment-file-chip, .comment-file-popover')) {
    return
  }
  // Close the more-menu if clicking outside it
  if (showMoreMenu.value && !event.target.closest('.comment-panel')) {
    showMoreMenu.value = false
  }
  emit('close')
}

// ─── Escape to close (works regardless of focus) ──────────────────

function onDocumentKeydown(event) {
  if (event.key === 'Escape') {
    // Don't double-handle if CommentInput already handles it
    if (event.target.tagName === 'TEXTAREA' && event.target.closest('.comment-input-wrapper')) {
      return
    }
    event.preventDefault()
    if (showMoreMenu.value) {
      showMoreMenu.value = false
      return
    }
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('mousedown', onDocumentMousedown, true)
  document.addEventListener('keydown', onDocumentKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onDocumentMousedown, true)
  document.removeEventListener('keydown', onDocumentKeydown, true)
})

// ─── Public API ───────────────────────────────────────────────────

function focusReply() {
  nextTick(() => replyInputRef.value?.focus())
}

defineExpose({ focusReply })
</script>
