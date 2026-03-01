<template>
  <div class="chat-message" :class="'chat-message-' + message.role">
    <!-- Timestamp (visible on hover) -->
    <div class="chat-timestamp ui-text-sm" style="color: var(--fg-muted);">
      {{ formatTime(message.createdAt) }}
    </div>

    <!-- User message: bubble (right-aligned) -->
    <div v-if="message.role === 'user'" class="flex flex-col items-end">
      <div class="chat-msg-user">
        <div class="chat-md ui-text-lg" :class="{ 'chat-user-clamped': !userExpanded }" v-html="renderedContent"></div>
        <button v-if="isLongUserMessage && !userExpanded"
          class="chat-show-more ui-text-sm"
          @click="userExpanded = true">
          show more
        </button>
        <button v-if="userExpanded"
          class="chat-show-more ui-text-sm"
          @click="userExpanded = false">
          show less
        </button>
        <button
          v-if="copyableText"
          class="chat-msg-copy opacity-0 group-hover:opacity-100 transition-opacity"
          @click="copyContent"
          :title="copied ? 'Copied!' : 'Copy message'">
          <svg v-if="!copied" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="5" width="8" height="8" rx="1"/>
            <path d="M3 11V3a1 1 0 011-1h8"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--success)" stroke-width="1.5">
            <path d="M4 8l3 3 5-5"/>
          </svg>
        </button>
      </div>
      <!-- Context cards: file refs + selection (below bubble, right-aligned) -->
      <div v-if="hasContext" class="chat-context-cards">
        <button v-for="ref in fileRefs" :key="ref.path"
          class="chat-context-chip" @click="openFile(ref.path)" :title="ref.path">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z"/>
            <path d="M9 1v4h4"/>
          </svg>
          {{ ref.path.split('/').pop() }}
        </button>
        <button v-if="contextData && contextData.text"
          class="chat-context-chip" @click="openFile(contextData.file)"
          :title="'Selection from ' + (contextData.file || '').split('/').pop()">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 3l-4 5 4 5M10 3l4 5-4 5"/>
          </svg>
          {{ truncateContext(contextData.text) }}
        </button>
      </div>
    </div>

    <!-- Assistant message: document-style with ordered parts -->
    <div v-else class="chat-msg-assistant" :class="{ 'chat-msg-error': hasError }">
      <!-- Render parts in order -->
      <template v-for="(part, idx) in displayParts" :key="idx">
        <!-- Reasoning -->
        <div v-if="part.type === 'reasoning'" class="my-2">
          <button
            class="ui-text-sm cursor-pointer bg-transparent border-none flex items-center gap-1"
            style="color: var(--fg-muted);"
            @click="expandedThinking[idx] = !expandedThinking[idx]">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
              :style="{ transform: expandedThinking[idx] ? 'rotate(90deg)' : '', transition: 'transform 0.15s' }">
              <path d="M2 1l4 3-4 3z"/>
            </svg>
            <span v-if="isReasoningActive(idx)">
              Thinking<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
            </span>
            <span v-else>Thought process</span>
          </button>
          <div v-if="expandedThinking[idx]" class="mt-1 pl-2 ui-text-sm chat-md chat-thinking-content"
            style="color: var(--fg-muted); border-left: 2px solid var(--border); padding-left: 8px;"
            v-html="renderMd(part.text)"></div>
        </div>

        <!-- Text -->
        <div v-else-if="part.type === 'text'" class="chat-md ui-text-lg" v-html="renderMd(part.text)"></div>

        <!-- Tool calls -->
        <template v-else-if="isToolPart(part)">
          <ProposalCard
            v-if="getToolName(part) === 'create_proposal' && getProposalData(part)"
            :prompt="getProposalData(part).prompt"
            :options="getProposalData(part).options"
            @select="(title) => $emit('proposal-select', title)"
          />
          <!-- propose_edit: diff card with apply button -->
          <div v-else-if="getToolName(part) === 'propose_edit' && part.input"
            class="rounded border ui-text-lg"
            style="border-color: var(--border); background: var(--bg-primary);">
            <div class="px-2.5 py-2">
              <div class="ui-text-sm uppercase tracking-wider mb-1.5" style="color: var(--fg-muted);">
                Proposed Edit
              </div>
              <div class="rounded px-2 py-1 mb-1" style="background: rgba(247, 118, 142, 0.08);">
                <div class="line-through ui-text-lg" style="color: var(--error);">{{ part.input.old_string }}</div>
              </div>
              <div class="rounded px-2 py-1 mb-2" style="background: rgba(158, 206, 106, 0.08);">
                <div class="ui-text-lg" style="color: var(--success);">{{ part.input.new_string }}</div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  v-if="proposeEditStatus(part.toolCallId) !== 'applied'"
                  class="review-bar-btn review-bar-accept ui-text-base"
                  @click="tasksStore.applyProposedEdit(props.threadId, part.toolCallId)"
                >
                  Apply
                </button>
                <span v-if="proposeEditStatus(part.toolCallId) === 'applied'"
                  class="ui-text-base font-medium" style="color: var(--success);">
                  Applied
                </span>
                <span v-if="proposeEditStatus(part.toolCallId) === 'error'"
                  class="ui-text-base" style="color: var(--error);">
                  {{ proposeEditError(part.toolCallId) }}
                </span>
              </div>
            </div>
          </div>
          <ToolCallLine v-else :part="part" :key="part.toolCallId + '-' + part.state" />
        </template>
      </template>

      <!-- Streaming dots (only while waiting for first content, no parts yet) -->
      <span v-if="isWaitingForContent" class="chat-streaming-dots">
        <span></span><span></span><span></span>
      </span>

      <!-- Copy button (bottom-right, group-hover) -->
      <button
        v-if="copyableText"
        class="chat-msg-copy opacity-0 group-hover:opacity-100 transition-opacity"
        @click="copyContent"
        :title="copied ? 'Copied!' : 'Copy message'">
        <svg v-if="!copied" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="5" y="5" width="8" height="8" rx="1"/>
          <path d="M3 11V3a1 1 0 011-1h8"/>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--success)" stroke-width="1.5">
          <path d="M4 8l3 3 5-5"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, reactive } from 'vue'
import ProposalCard from './ProposalCard.vue'
import ToolCallLine from './ToolCallLine.vue'
import { renderMarkdown } from '../../utils/chatMarkdown'
import { useEditorStore } from '../../stores/editor'
import { useChatStore } from '../../stores/chat'
import { useTasksStore } from '../../stores/tasks'

const editorStore = useEditorStore()
const chatStore = useChatStore()
const tasksStore = useTasksStore()

const props = defineProps({
  message: { type: Object, required: true },
  prevRole: { type: String, default: null },
  threadId: { type: String, default: null },
  sessionId: { type: String, default: null },
})

defineEmits(['proposal-select'])

const expandedThinking = reactive({})
const copied = ref(false)
const userExpanded = ref(false)

// ─── Parts-based rendering ──────────────────────────────────────

function renderMd(text) {
  return renderMarkdown(text || '')
}

function isToolPart(part) {
  return part.type?.startsWith('tool-') || part.type === 'dynamic-tool'
}

function getToolName(part) {
  return part.type === 'dynamic-tool' ? part.toolName : part.type?.replace('tool-', '')
}

/**
 * Get display parts from the message.
 * Supports both UIMessage parts[] format and legacy flat format.
 */
const displayParts = computed(() => {
  const msg = props.message

  // New UIMessage format: parts[]
  if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
    return msg.parts
  }

  // Legacy format: convert on the fly
  const parts = []

  if (msg.thinking || msg._thinkingBlocks?.length) {
    const thinkingText = msg._thinkingBlocks?.map(b => b.thinking).join('\n\n') || msg.thinking
    if (thinkingText) parts.push({ type: 'reasoning', text: thinkingText })
  }

  if (msg.content) {
    parts.push({ type: 'text', text: msg.content })
  }

  if (msg.toolCalls?.length) {
    for (const tc of msg.toolCalls) {
      parts.push({
        type: `tool-${tc.name}`,
        toolCallId: tc.id,
        toolName: tc.name,
        state: tc.status === 'done' ? 'output-available'
          : tc.status === 'error' ? 'output-error'
          : tc.status === 'running' ? 'input-available'
          : 'input-streaming',
        input: tc.input || {},
        output: tc.output,
        errorText: tc.status === 'error' ? tc.output : undefined,
        _expanded: tc._expanded,
      })
    }
  }

  return parts
})

// ─── Computed helpers ─────────────────────────────────────────────

const textContent = computed(() => {
  return displayParts.value
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('\n\n')
})

const copyableText = computed(() => {
  if (props.message.role === 'user') {
    const msg = props.message
    if (msg.parts && msg.parts.length > 0) {
      return msg.parts.filter(p => p.type === 'text').map(p => p.text).join('\n\n')
    }
    return msg.content || ''
  }
  return textContent.value
})

const renderedContent = computed(() => {
  // For user messages, use old-style content or text parts
  const msg = props.message
  if (msg.parts && msg.parts.length > 0) {
    const textParts = msg.parts.filter(p => p.type === 'text').map(p => p.text).join('\n\n')
    return renderMarkdown(textParts)
  }
  return renderMarkdown(msg.content || '')
})

const isLongUserMessage = computed(() => {
  if (props.message.role !== 'user') return false
  const msg = props.message
  const text = msg.parts
    ? msg.parts.filter(p => p.type === 'text').map(p => p.text).join('\n\n')
    : msg.content || ''
  return text.split('\n').length > 5 || text.length > 300
})

// Context: from metadata (new) or message fields (legacy)
const fileRefs = computed(() => {
  return props.message.metadata?.fileRefs || props.message.fileRefs || []
})

const contextData = computed(() => {
  return props.message.metadata?.context || props.message.context || null
})

const hasContext = computed(() => {
  return fileRefs.value.length > 0 || contextData.value?.text
})

const hasError = computed(() => {
  const msg = props.message
  // New format: check Chat error state
  // Legacy: check status field
  return msg.status === 'error'
})

function _getChatInstance() {
  return chatStore.getChatInstance(props.sessionId || props.message._sessionId)
    || (props.threadId ? tasksStore.getTaskChatInstance(props.threadId) : null)
}

const isWaitingForContent = computed(() => {
  const chat = _getChatInstance()
  if (!chat) {
    return props.message.status === 'streaming' && !textContent.value && !displayParts.value.some(p => isToolPart(p))
  }
  const status = chat.state.statusRef.value
  if (status !== 'submitted' && status !== 'streaming') return false
  if (textContent.value) return false
  // Hide dots when tool parts exist — they have their own pending indicator.
  // (part.state is mutated in place by AI SDK and isn't reactive, so we can't
  // reliably distinguish pending vs completed tools here.)
  return !displayParts.value.some(p => isToolPart(p))
})

function isReasoningActive(partIdx) {
  const parts = displayParts.value
  const partsAfter = parts.slice(partIdx + 1)
  if (partsAfter.length > 0) return false

  const chat = _getChatInstance()
  if (chat) {
    const status = chat.state.statusRef.value
    return status === 'submitted' || status === 'streaming'
  }
  return props.message.status === 'streaming'
}

function proposeEditStatus(toolCallId) {
  return tasksStore.getEditStatus(toolCallId)?.status || null
}

function proposeEditError(toolCallId) {
  return tasksStore.getEditStatus(toolCallId)?.error || ''
}

// ─── Helpers ──────────────────────────────────────────────────────

function openFile(path) {
  if (path) editorStore.openFile(path)
}

function truncateContext(text) {
  if (!text) return ''
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 40 ? oneLine.slice(0, 40) + '...' : oneLine
}

function getProposalData(part) {
  const output = part.output
  if (!output) return null
  try {
    const data = typeof output === 'string' ? JSON.parse(output) : output
    if (data?._type === 'proposal' && data.options) return data
  } catch {}
  return null
}

function formatTime(ts) {
  if (!ts) return ''
  const d = ts instanceof Date ? ts : new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function copyContent() {
  navigator.clipboard.writeText(copyableText.value)
  copied.value = true
  setTimeout(() => copied.value = false, 2000)
}
</script>

<style scoped>
.chat-message {
  position: relative;
}
.chat-message-user {
  padding: 2px 0;
}
.chat-message-assistant {
  position: relative;
  padding: 2px 0;
}
.chat-msg-user {
  position: relative;
}
.chat-msg-assistant {
  position: relative;
}
.chat-msg-copy {
  position: absolute;
  bottom: 4px;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--fg-muted);
  cursor: pointer;
}
.chat-msg-copy:hover { background: var(--bg-hover); color: var(--fg-primary); }
.thinking-dots span {
  animation: dot-fade 1.4s ease-in-out infinite;
  opacity: 0.2;
}
.thinking-dots span:nth-child(2) { animation-delay: 0.2s; }
.thinking-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes dot-fade {
  0%, 80%, 100% { opacity: 0.2; }
  40% { opacity: 1; }
}
</style>
