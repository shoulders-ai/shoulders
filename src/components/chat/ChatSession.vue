<template>
  <div class="flex flex-col h-full">
    <!-- Messages area -->
    <div ref="messagesRef" class="flex-1 overflow-y-auto pt-4 pb-8 flex flex-col" @scroll="onScroll">

      <!-- Empty state: suggestion chips -->
      <div v-if="messages.length === 0" class="flex-1">
        <div class="max-w-[80ch] mx-auto w-full px-3" style="padding-top: max(3rem, 40vh);">
          <button
            v-for="chip in suggestionChips"
            :key="chip.text"
            class="chip-row"
            @click="setSuggestion(chip.text)">
            <span class="gutter">›</span>
            <span>{{ chip.text }}</span>
          </button>
        </div>
      </div>

      <!-- Messages -->
      <div class="max-w-[80ch] mx-auto px-3 w-full" v-if="messages.length > 0">
        <div v-for="(msg, idx) in messages" :key="msg.id"
          class="group"
          :class="idx > 0 && messages[idx - 1].role !== msg.role ? 'mt-4' : 'mt-2'"
          :style="idx === 0 ? 'margin-top: 0' : ''">
          <ChatMessage
            :message="msg"
            :prevRole="idx > 0 ? messages[idx - 1].role : null"
            :sessionId="session.id"
            :isLastAssistant="msg.id === lastAssistantId"
            @proposal-select="onProposalSelect"
          />
        </div>
      </div>

      <!-- Error display -->
      <div v-if="chatError" class="max-w-[80ch] mx-auto px-3 mt-3">
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

    <!-- Input — constrained to match message column width -->
    <div class="max-w-[80ch] mx-auto w-full">
      <ChatInput
        ref="chatInputRef"
        :isStreaming="isStreaming"
        :modelId="session.modelId"
        :sessionId="session.id"
        :estimatedTokens="estimatedTokens"
        :contextWindow="getContextWindow(session.modelId, workspace)"
        @send="onSend"
        @abort="onAbort"
        @update-model="onUpdateModel"
      />
    </div>
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

const workspace   = useWorkspaceStore()
const editorStore = useEditorStore()
const chatStore   = useChatStore()

// ─── Chat instance reactive state ─────────────────────────────────

const chat = computed(() => chatStore.getChatInstance(props.session.id))

const messages = computed(() => {
  if (chat.value) {
    return chat.value.state.messagesRef.value.filter(m => !m._isToolResult)
  }
  return (props.session.messages || []).filter(m => !m._isToolResult)
})

const lastAssistantId = computed(() => {
  for (let i = messages.value.length - 1; i >= 0; i--) {
    if (messages.value[i].role === 'assistant') return messages.value[i].id
  }
  return null
})

const isStreaming = computed(() => {
  if (chat.value) {
    const status = chat.value.state.statusRef.value
    return status === 'submitted' || status === 'streaming'
  }
  return props.session.status === 'streaming'
})

const estimatedTokens = computed(() => {
  const msgs = chat.value ? chat.value.state.messagesRef.value : (props.session.messages || [])
  if (msgs.length === 0) return null
  return props.session._lastInputTokens ?? 0
})

// ─── Error display ────────────────────────────────────────────────

const dismissedError = ref(false)

const chatError = computed(() => {
  if (!chat.value || dismissedError.value) return null
  const status = chat.value.state.statusRef.value
  const error  = chat.value.state.errorRef.value
  if (status === 'error' && error) {
    const msg = error.message || String(error)
    return renderMarkdown(formatChatApiError(msg))
  }
  return null
})

watch(() => chat.value?.state.statusRef.value, (status) => {
  if (status !== 'error') dismissedError.value = false
})

function dismissError() {
  dismissedError.value = true
}

// ─── Suggestion chips (context-aware via last document tab) ───────

// Track the last non-chat tab so chips remain relevant when a chat tab is active
const lastDocumentTab = ref(null)

watch(() => editorStore.activeTab, (tab) => {
  if (tab && !tab.startsWith('chat:')) {
    lastDocumentTab.value = tab
  }
}, { immediate: true })

const suggestionChips = computed(() => {
  const file = lastDocumentTab.value
  const chips = []

  if (file) {
    if (isMarkdown(file) || file.endsWith('.docx') || file.endsWith('.tex')) {
      chips.push({ text: 'Proofread this document' })
      chips.push({ text: 'Emulate a critical peer reviewer' })
      chips.push({ text: 'Summarise the key arguments' })
    } else if (file.startsWith('ref:')) {
      chips.push({ text: 'Summarise the main points' })
      chips.push({ text: 'Find related papers' })
    } else if (file.endsWith('.py') || file.endsWith('.r') || file.endsWith('.R') || file.endsWith('.ipynb')) {
      chips.push({ text: 'Explain this code' })
      chips.push({ text: 'Help me debug this' })
    }
  }

  chips.push({ text: 'Help me think about...' })
  return chips
})

function setSuggestion(text) {
  window.dispatchEvent(new CustomEvent('chat-set-input', { detail: { message: text } }))
}

// ─── Scroll management ────────────────────────────────────────────

const messagesRef    = ref(null)
const bottomAnchor   = ref(null)
const chatInputRef   = ref(null)
const showScrollButton = ref(false)
const isAutoScrolling  = ref(true)

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
  isAutoScrolling.value  = atBottom
}

function scrollToBottom() {
  nextTick(() => {
    bottomAnchor.value?.scrollIntoView({ behavior: 'smooth' })
    showScrollButton.value = false
    isAutoScrolling.value  = true
  })
}

watch(messages, () => {
  if (isAutoScrolling.value) {
    nextTick(() => {
      bottomAnchor.value?.scrollIntoView({ behavior: 'auto' })
    })
  }
}, { deep: true })

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

<style scoped>
.chip-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  font-size: 13px;
  color: var(--fg-secondary);
  padding: 4px 0;
  transition: color 75ms;
}
.chip-row:hover {
  color: var(--fg-primary);
}
.gutter {
  width: 12px;
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1;
  color: transparent;
  transition: color 75ms;
  user-select: none;
}
.chip-row:hover .gutter {
  color: var(--fg-muted);
}
</style>
