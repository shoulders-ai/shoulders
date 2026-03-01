<template>
  <div class="flex flex-col h-full">
    <!-- Messages area -->
     
    <div ref="messagesRef" class="flex-1 overflow-y-auto px-3 pt-4 pb-8" @scroll="onScroll">
      <!-- Empty state -->
      <div v-if="messages.length === 0"
        class="flex flex-col justify-center h-full px-4 pb-20 max-w-xl mx-auto"
        style="color: var(--fg-muted);">

        <!-- Prompt starters -->
        <div class="mb-6">
          <div class="ui-text-md uppercase tracking-wider mb-2" style="color: var(--fg-muted);">
            Start with
          </div>
          <div v-for="chip in suggestionChips" :key="chip.text"
            class="py-1 cursor-pointer ui-text-base hover:underline"
            style="color: var(--fg-secondary);"
            @click="setSuggestion(chip.text)">
            {{ chip.text }}
          </div>
        </div>

        <!-- Recent conversations -->
        <div v-if="recentSessions.length > 0"
          class="pt-6 border-t" style="border-color: color-mix(in srgb, var(--border) 50%, transparent);">
          <div class="ui-text-md uppercase tracking-wider mb-2" style="color: var(--fg-muted);">
            Recent
          </div>
          <div v-for="sess in recentSessions" :key="sess.id"
            class="py-1 cursor-pointer flex items-center gap-2 group"
            @click="reopenSession(sess.id)">
            <span class="ui-text-base truncate flex-1 group-hover:underline" style="color: var(--fg-secondary);">{{ sess.label }}</span>
            <span class="ui-text-md shrink-0" style="color: var(--fg-muted);">{{ relativeTime(sess.updatedAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Messages -->
       <div class="max-w-[100ch] mx-auto" v-if="messages.length > 0">
      <div v-for="(msg, idx) in messages" :key="msg.id"
        class="group"
        :class="idx > 0 && messages[idx - 1].role !== msg.role ? 'mt-4' : 'mt-2'"
        :style="idx === 0 ? 'margin-top: 0' : ''">
        <ChatMessage
          :message="msg"
          :prevRole="idx > 0 ? messages[idx - 1].role : null"
          :sessionId="session.id"
          @proposal-select="onProposalSelect"
        />
      </div>
    </div>

      <!-- Error display -->
      <div v-if="chatError" class="max-w-[100ch] mx-auto mt-3">
        <div class="rounded-lg border px-3 py-2.5"
          style="background: color-mix(in srgb, var(--error) 8%, var(--bg-primary));
                 border-color: color-mix(in srgb, var(--error) 30%, var(--border));">
          <div class="ui-text-lg chat-md" style="color: var(--fg-secondary);"
            v-html="chatError"></div>
          <button
            class="mt-2 px-2.5 py-1 rounded ui-text-base border-none cursor-pointer"
            style="background: var(--bg-tertiary); color: var(--fg-secondary);"
            @click="dismissError">
            Dismiss
          </button>
        </div>
      </div>

      <!-- Bottom anchor for auto-scroll -->
      <div ref="bottomAnchor"></div>
    </div>

    <!-- Scroll-to-bottom button -->
    <div v-if="showScrollButton" class="relative">
      <button
        class="absolute right-3 -top-8 w-6 h-6 rounded-full flex items-center justify-center border cursor-pointer z-10"
        style="background: var(--bg-tertiary); border-color: var(--border); color: var(--fg-muted);"
        @click="scrollToBottom">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 4l3 3 3-3"/>
        </svg>
      </button>
    </div>

    <!-- Input -->
    <ChatInput
      ref="chatInputRef"
      :isStreaming="isStreaming"
      :modelId="session.modelId"
      :estimatedTokens="estimatedTokens"
      :contextWindow="getContextWindow(session.modelId, workspace)"
      @send="onSend"
      @abort="onAbort"
      @update-model="onUpdateModel"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import ChatMessage from './ChatMessage.vue'
import ChatInput from './ChatInput.vue'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { getContextWindow } from '../../services/chatModels'
import { isMarkdown } from '../../utils/fileTypes'
import { formatChatApiError } from '../../utils/errorMessages'
import { renderMarkdown } from '../../utils/chatMarkdown'

const props = defineProps({
  session: { type: Object, required: true },
})

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const chatStore = useChatStore()

// ─── Chat instance reactive state ─────────────────────────────────

const chat = computed(() => chatStore.getChatInstance(props.session.id))

/**
 * Messages: prefer Chat instance messages (reactive), fall back to session.messages.
 * Filter out tool-result messages for display.
 */
const messages = computed(() => {
  if (chat.value) {
    return chat.value.state.messagesRef.value.filter(m => !m._isToolResult)
  }
  return (props.session.messages || []).filter(m => !m._isToolResult)
})

const isStreaming = computed(() => {
  if (chat.value) {
    const status = chat.value.state.statusRef.value
    return status === 'submitted' || status === 'streaming'
  }
  return props.session.status === 'streaming'
})

// Real token count from the provider's last response.
// null = no messages yet (hide donut). 0+ = show donut even if context barely used.
const estimatedTokens = computed(() => {
  const msgs = chat.value ? chat.value.state.messagesRef.value : (props.session.messages || [])
  if (msgs.length === 0) return null
  return props.session._lastInputTokens ?? 0
})

// Error display: purely UI-driven, never manipulates Chat internals.
// dismissedError hides the current error; it resets when the user sends again.
const dismissedError = ref(false)

const chatError = computed(() => {
  if (!chat.value || dismissedError.value) return null
  const status = chat.value.state.statusRef.value
  const error = chat.value.state.errorRef.value
  if (status === 'error' && error) {
    const msg = error.message || String(error)
    return renderMarkdown(formatChatApiError(msg))
  }
  return null
})

// Reset dismiss flag when status changes away from error (user sent a new message)
watch(() => chat.value?.state.statusRef.value, (status) => {
  if (status !== 'error') dismissedError.value = false
})

function dismissError() {
  dismissedError.value = true
}

// ─── Recent sessions ──────────────────────────────────────────────

const recentSessions = computed(() => {
  const liveIds = new Set(chatStore.sessions.map(s => s.id))
  return chatStore.allSessionsMeta
    .filter(m => !liveIds.has(m.id))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .slice(0, 5)
})

function reopenSession(id) {
  chatStore.reopenSession(id)
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

// ─── Suggestion chips ─────────────────────────────────────────────

const suggestionChips = computed(() => {
  const chips = []
  const activeFile = editorStore.activeTab
  if (activeFile) {
    chips.push({ text: 'What can you help with?' })
    if (isMarkdown(activeFile) || activeFile.endsWith('.docx') || activeFile.endsWith('.tex')) {
      chips.push({ text: 'Proofread this document' })
      chips.push({ text: 'Emulate a critical peer reviewer' })
    } else if(activeFile.startsWith('ref:')) {
      chips.push({ text: 'Summarise the main points' })
    } else {
      chips.push({ text: 'Explain this code' })
    }
  }
  chips.push({ text: 'Help me think about...' })
  return chips
})

function setSuggestion(text) {
  window.dispatchEvent(new CustomEvent('chat-set-input', { detail: { message: text } }))
}

// ─── Scroll management ───────────────────────────────────────────

const messagesRef = ref(null)
const bottomAnchor = ref(null)
const chatInputRef = ref(null)
const showScrollButton = ref(false)
const isAutoScrolling = ref(true)

function onSend(payload) {
  chatStore.sendMessage(props.session.id, payload)
  nextTick(() => scrollToBottom())
}

function onAbort() {
  chatStore.abortSession(props.session.id)
}

function onProposalSelect(title) {
  chatStore.sendMessage(props.session.id, { text: `Selected: ${title}` })
  nextTick(() => scrollToBottom())
}

function onUpdateModel(modelId) {
  const session = chatStore.sessions.find(s => s.id === props.session.id)
  if (session) session.modelId = modelId
  workspace.setSelectedModelId(modelId)
}

function onScroll() {
  const el = messagesRef.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  showScrollButton.value = !atBottom
  isAutoScrolling.value = atBottom
}

function scrollToBottom() {
  nextTick(() => {
    bottomAnchor.value?.scrollIntoView({ behavior: 'smooth' })
    showScrollButton.value = false
    isAutoScrolling.value = true
  })
}

// Auto-scroll on new content when user is at bottom
watch(messages, () => {
  if (isAutoScrolling.value) {
    nextTick(() => {
      bottomAnchor.value?.scrollIntoView({ behavior: 'auto' })
    })
  }
}, { deep: true })

// Auto-scroll to error when it appears
watch(chatError, (err) => {
  if (err) {
    nextTick(() => {
      bottomAnchor.value?.scrollIntoView({ behavior: 'smooth' })
    })
  }
})

function focus() {
  chatInputRef.value?.focus()
}

defineExpose({ focus })
</script>
