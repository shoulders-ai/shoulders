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
      </div>
      <!-- Context cards: file refs + selection (below bubble, right-aligned) -->
      <div v-if="hasContext" class="chat-context-cards">
        <!-- File refs -->
        <button v-for="ref in (message.fileRefs || [])" :key="ref.path"
          class="chat-context-chip" @click="openFile(ref.path)" :title="ref.path">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z"/>
            <path d="M9 1v4h4"/>
          </svg>
          {{ ref.path.split('/').pop() }}
        </button>
        <!-- Selection context -->
        <button v-if="message.context && message.context.text"
          class="chat-context-chip" @click="openFile(message.context.file)"
          :title="'Selection from ' + (message.context.file || '').split('/').pop()">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 3l-4 5 4 5M10 3l4 5-4 5"/>
          </svg>
          {{ truncateContext(message.context.text) }}
        </button>
      </div>
    </div>

    <!-- Assistant message: document-style -->
    <div v-else class="chat-msg-assistant" :class="{ 'chat-msg-error': message.status === 'error' }">
      <!-- Thinking: collapsed by default, animated dots during streaming -->
      <div v-if="message.thinking" class="mb-2">
        <button
          class="ui-text-sm cursor-pointer bg-transparent border-none flex items-center gap-1"
          style="color: var(--fg-muted);"
          @click="showThinking = !showThinking">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
            :style="{ transform: showThinking ? 'rotate(90deg)' : '', transition: 'transform 0.15s' }">
            <path d="M2 1l4 3-4 3z"/>
          </svg>
          <span v-if="isThinkingActive">
            Thinking<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
          </span>
          <span v-else>Thought process</span>
        </button>
        <div v-if="showThinking" class="mt-1 pl-2 ui-text-sm chat-md chat-thinking-content"
          style="color: var(--fg-muted); border-left: 2px solid var(--border); padding-left: 8px;"
          v-html="renderedThinking"></div>
      </div>

      <!-- Content -->
      <div class="chat-md ui-text-lg" v-html="renderedContent"></div>

      <!-- Streaming dots (only while waiting for first content token, hidden when tools visible) -->
      <span v-if="message.status === 'streaming' && !message.content && !hasToolCalls" class="chat-streaming-dots">
        <span></span><span></span><span></span>
      </span>

      <!-- Copy button (top-right, group-hover) -->
      <button
        v-if="message.content"
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

      <!-- Tool calls -->
      <div v-if="message.toolCalls && message.toolCalls.length > 0" class="mt-1">
        <template v-for="tc in message.toolCalls" :key="tc.id">
          <!-- Proposal card (special rendering) -->
          <ProposalCard
            v-if="tc.name === 'create_proposal' && getProposalData(tc.output)"
            :prompt="getProposalData(tc.output).prompt"
            :options="getProposalData(tc.output).options"
            @select="(title) => $emit('proposal-select', title)"
          />
          <!-- Standard tool call: compact one-liner -->
          <ToolCallLine v-else :tc="tc" />
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import ProposalCard from './ProposalCard.vue'
import ToolCallLine from './ToolCallLine.vue'
import { renderMarkdown } from '../../utils/chatMarkdown'
import { useEditorStore } from '../../stores/editor'

const editorStore = useEditorStore()

const props = defineProps({
  message: { type: Object, required: true },
  prevRole: { type: String, default: null },
})

defineEmits(['proposal-select'])

const showThinking = ref(false)
const copied = ref(false)
const userExpanded = ref(false)

const renderedContent = computed(() => renderMarkdown(props.message.content))
const renderedThinking = computed(() => renderMarkdown(props.message.thinking || ''))

// Consider a user message "long" if raw text has >5 newlines or >300 chars
const isLongUserMessage = computed(() => {
  if (props.message.role !== 'user') return false
  const text = props.message.content || ''
  return text.split('\n').length > 5 || text.length > 300
})

const hasContext = computed(() => {
  const refs = props.message.fileRefs
  const ctx = props.message.context
  return (refs && refs.length > 0) || (ctx && ctx.text)
})

const hasToolCalls = computed(() => {
  const tcs = props.message.toolCalls
  return tcs && tcs.length > 0
})

const isThinkingActive = computed(() =>
  props.message.status === 'streaming' && props.message.thinking && !props.message.content && !hasToolCalls.value
)

function openFile(path) {
  if (path) editorStore.openFile(path)
}

function truncateContext(text) {
  if (!text) return ''
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > 40 ? oneLine.slice(0, 40) + '...' : oneLine
}

function getProposalData(output) {
  if (!output) return null
  try {
    const data = typeof output === 'string' ? JSON.parse(output) : output
    if (data?._type === 'proposal' && data.options) return data
  } catch (e) {}
  return null
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function copyContent() {
  navigator.clipboard.writeText(props.message.content || '')
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
.chat-msg-copy {
  position: absolute;
  top: 4px;
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
