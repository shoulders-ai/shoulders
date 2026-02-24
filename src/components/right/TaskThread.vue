<template>
  <div class="flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2 shrink-0 border-b" style="border-color: var(--border);">
      <button
        class="bg-transparent border-none cursor-pointer p-0.5 rounded hover:bg-[var(--bg-hover)]"
        style="color: var(--fg-muted);"
        @click="tasksStore.setActiveThread(null)"
        title="Back to list"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M10 3L5 8l5 5"/>
        </svg>
      </button>

      <div class="flex-1 min-w-0">
        <div class="ui-text-lg truncate" style="color: var(--fg-primary);">
          <template v-if="thread.cellId">
            Cell {{ thread.cellIndex != null ? thread.cellIndex : '?' }}
            <span class="ui-text-md" style="color: var(--fg-muted);">[{{ thread.cellType || 'code' }}]</span>
          </template>
          <template v-else>
            {{ selectionPreview }}
          </template>
        </div>
        <div class="ui-text-md" style="color: var(--fg-muted);">
          {{ thread.fileId.split('/').pop() }}
        </div>
      </div>

      <button
        class="ui-text-base px-1.5 py-0.5 rounded bg-transparent border-none cursor-pointer"
        style="color: var(--fg-muted);"
        @click="navigateToSelection"
        title="Jump to selection in editor"
      >
        Jump to
      </button>

      <button
        v-if="hasAppliedEdits"
        class="ui-text-base px-1.5 py-0.5 rounded bg-transparent border-none cursor-pointer"
        style="color: var(--success);"
        @click="tasksStore.resolveThread(thread.id)"
        title="Resolve thread"
      >
        Resolve
      </button>
      <button
        class="ui-text-base px-1.5 py-0.5 rounded bg-transparent border-none cursor-pointer"
        style="color: var(--error);"
        @click="tasksStore.removeThread(thread.id)"
        title="Delete thread"
      >
        Delete
      </button>
    </div>

    <!-- Messages area -->
    <div ref="messagesRef" class="flex-1 overflow-y-auto px-3 pt-4 pb-8" @scroll="onScroll">
      <div class="max-w-[100ch] mx-auto" v-if="visibleMessages.length > 0">
      <div v-for="(msg, idx) in visibleMessages" :key="msg.id"
        class="group"
        :class="idx > 0 && visibleMessages[idx - 1].role !== msg.role ? 'mt-4' : 'mt-2'"
        :style="idx === 0 ? 'margin-top: 0' : ''">

        <!-- Hover timestamp -->
        <div class="chat-timestamp ui-text-sm" style="color: var(--fg-muted);">
          {{ formatTime(msg.createdAt) }}
        </div>

        <!-- User message: right-aligned bubble -->
        <div v-if="msg.role === 'user'" class="flex flex-col items-end">
          <div class="chat-msg-user">
            <!-- File refs -->
            <div v-if="msg.fileRefs && msg.fileRefs.length > 0"
              class="flex flex-wrap gap-1 mb-1.5">
              <span v-for="ref in msg.fileRefs" :key="ref.path"
                class="ui-text-sm px-1.5 py-0.5 rounded"
                style="background: rgba(255,255,255,0.06); color: var(--fg-secondary);">
                {{ ref.path.split('/').pop() }}
              </span>
            </div>
            <div class="chat-md ui-text-lg" :class="{ 'chat-user-clamped': !userExpanded[msg.id] }" v-html="renderMarkdown(msg.content)"></div>
            <button v-if="isLongMessage(msg) && !userExpanded[msg.id]"
              class="chat-show-more ui-text-sm"
              @click="userExpanded[msg.id] = true">
              show more
            </button>
            <button v-if="userExpanded[msg.id]"
              class="chat-show-more ui-text-sm"
              @click="userExpanded[msg.id] = false">
              show less
            </button>
          </div>
        </div>

        <!-- Assistant message: document-style -->
        <div v-else class="chat-msg-assistant relative" :class="{ 'chat-msg-error': msg.status === 'error' }">
          <!-- Thinking -->
          <div v-if="msg.thinking" class="mb-2">
            <button
              class="ui-text-sm cursor-pointer bg-transparent border-none flex items-center gap-1"
              style="color: var(--fg-muted);"
              @click="expandedThinking[msg.id] = !expandedThinking[msg.id]">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"
                :style="{ transform: expandedThinking[msg.id] ? 'rotate(90deg)' : '', transition: 'transform 0.15s' }">
                <path d="M2 1l4 3-4 3z"/>
              </svg>
              <span v-if="isThinkingActiveForMsg(msg)">
                Thinking<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
              </span>
              <span v-else>Thought process</span>
            </button>
            <div v-if="expandedThinking[msg.id]" class="mt-1 pl-2 ui-text-sm chat-md chat-thinking-content"
              style="color: var(--fg-muted); border-left: 2px solid var(--border); padding-left: 8px;"
              v-html="renderMarkdown(msg.thinking || '')"></div>
          </div>

          <!-- Content -->
          <div class="chat-md ui-text-lg" v-html="renderMarkdown(msg.content)"></div>

          <!-- Streaming dots -->
          <span v-if="msg.status === 'streaming' && !msg.content && !hasToolCalls(msg)" class="chat-streaming-dots">
            <span></span><span></span><span></span>
          </span>

          <!-- Copy button -->
          <button
            v-if="msg.content"
            class="chat-msg-copy opacity-0 group-hover:opacity-100 transition-opacity"
            @click="copyMsg(msg)"
            :title="copiedId === msg.id ? 'Copied!' : 'Copy message'">
            <svg v-if="copiedId !== msg.id" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="5" y="5" width="8" height="8" rx="1"/>
              <path d="M3 11V3a1 1 0 011-1h8"/>
            </svg>
            <svg v-else width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--success)" stroke-width="1.5">
              <path d="M4 8l3 3 5-5"/>
            </svg>
          </button>

          <!-- Tool calls -->
          <div v-if="msg.toolCalls && msg.toolCalls.length > 0" class="mt-1">
            <template v-for="tc in msg.toolCalls" :key="tc.id">
              <!-- propose_edit: special diff card -->
              <div v-if="tc.name === 'propose_edit'"
                class="rounded border ui-text-lg"
                style="border-color: var(--border); background: var(--bg-primary);">
                <div class="px-2.5 py-2">
                  <div class="ui-text-sm uppercase tracking-wider mb-1.5" style="color: var(--fg-muted);">
                    Proposed Edit
                  </div>
                  <!-- Old text (strikethrough) -->
                  <div class="rounded px-2 py-1 mb-1" style="background: rgba(247, 118, 142, 0.08);">
                    <div class="line-through ui-text-lg" style="color: var(--error);">{{ tc.input?.old_string }}</div>
                  </div>
                  <!-- New text -->
                  <div class="rounded px-2 py-1 mb-2" style="background: rgba(158, 206, 106, 0.08);">
                    <div class="ui-text-lg" style="color: var(--success);">{{ tc.input?.new_string }}</div>
                  </div>
                  <!-- Action buttons -->
                  <div class="flex items-center gap-2">
                    <button
                      v-if="tc.status !== 'applied'"
                      class="review-bar-btn review-bar-accept ui-text-base"
                      @click="tasksStore.applyProposedEdit(thread.id, tc.id)"
                    >
                      Apply
                    </button>
                    <span v-if="tc.status === 'applied'"
                      class="ui-text-base font-medium" style="color: var(--success);">
                      Applied
                    </span>
                    <span v-if="tc.status === 'error'"
                      class="ui-text-base" style="color: var(--error);">
                      {{ tc.output }}
                    </span>
                  </div>
                </div>
              </div>
              <!-- Standard tool call: compact one-liner -->
              <ToolCallLine v-else :tc="tc" />
            </template>
          </div>
        </div>
      </div>
    </div>

      <!-- Bottom anchor -->
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
    <TaskInput
      ref="taskInputRef"
      :isStreaming="thread.status === 'streaming'"
      :modelId="thread.modelId"
      @send="onSend"
      @abort="onAbort"
      @update-model="onUpdateModel"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useTasksStore } from '../../stores/tasks'
import { useEditorStore } from '../../stores/editor'
import { renderMarkdown } from '../../utils/chatMarkdown'
import TaskInput from './TaskInput.vue'
import ToolCallLine from './ToolCallLine.vue'

const props = defineProps({
  thread: { type: Object, required: true },
})

const tasksStore = useTasksStore()
const editorStore = useEditorStore()

const messagesRef = ref(null)
const bottomAnchor = ref(null)
const taskInputRef = ref(null)
const showScrollButton = ref(false)
const isAutoScrolling = ref(true)
const expandedThinking = ref({})
const userExpanded = ref({})
const copiedId = ref(null)

function isThinkingActiveForMsg(msg) {
  return msg.status === 'streaming' && msg.thinking && !msg.content
    && !(msg.toolCalls?.length > 0)
}

function hasToolCalls(msg) {
  return msg.toolCalls && msg.toolCalls.length > 0
}

function isLongMessage(msg) {
  if (msg.role !== 'user') return false
  const text = msg.content || ''
  return text.split('\n').length > 5 || text.length > 300
}

function copyMsg(msg) {
  navigator.clipboard.writeText(msg.content || '')
  copiedId.value = msg.id
  setTimeout(() => { if (copiedId.value === msg.id) copiedId.value = null }, 2000)
}

const hasAppliedEdits = computed(() => {
  return props.thread.messages.some(m =>
    m.toolCalls?.some(tc => tc.status === 'applied')
  )
})

const selectionPreview = computed(() => {
  const text = props.thread.selectedText || ''
  return text.length > 80 ? text.slice(0, 80) + '...' : text
})

const visibleMessages = computed(() => {
  return props.thread.messages.filter(m => !m._isToolResult && !m._synthetic)
})

function onSend(payload) {
  tasksStore.sendMessage(props.thread.id, payload)
  nextTick(() => scrollToBottom())
}

function onAbort() {
  tasksStore.abortThread(props.thread.id)
}

function onUpdateModel(modelId) {
  const thread = tasksStore.threads.find(t => t.id === props.thread.id)
  if (thread) thread.modelId = modelId
}

/** Single DOCX "Jump to" attempt: set PM selection + scroll visible line. */
function navigateDocx(thread) {
  const sd = editorStore.getAnySuperdoc(thread.fileId)
  const ed = sd?.activeEditor

  if (ed && thread.range) {
    try {
      const { from, to } = thread.range
      const maxPos = ed.state.doc.content.size
      const tr = ed.state.tr.setSelection(
        ed.state.selection.constructor.create(ed.state.doc, Math.min(from, maxPos), Math.min(to, maxPos))
      )
      tr.scrollIntoView()
      ed.view.dispatch(tr)
      ed.view.focus()
    } catch (_) {}
  }

  const wrapper = document.querySelector('.docx-editor .overflow-auto')
  if (!wrapper) return

  const needle = (thread.selectedText || '').slice(0, 60).replace(/\s+/g, ' ').trim().toLowerCase()
  if (needle) {
    const lines = wrapper.querySelectorAll('.superdoc-line')
    for (const line of lines) {
      const lineText = (line.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (lineText.includes(needle)) {
        line.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }
  }

  const caret = wrapper.querySelector('.presentation-editor__selection-caret')
  if (caret) caret.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function navigateToSelection() {
  editorStore.openFile(props.thread.fileId)

  // Notebook threads: dispatch scroll-to-cell event
  if (props.thread.cellId) {
    nextTick(() => {
      window.dispatchEvent(new CustomEvent('notebook-scroll-to-cell', {
        detail: {
          path: props.thread.fileId,
          cellId: props.thread.cellId,
        },
      }))
    })
    return
  }

  // DOCX path: brute-force 3x with 500ms gaps (file open + painter lag)
  if (props.thread.fileId.endsWith('.docx')) {
    nextTick(() => navigateDocx(props.thread))
    setTimeout(() => navigateDocx(props.thread), 500)
    setTimeout(() => navigateDocx(props.thread), 1000)
    setTimeout(() => navigateDocx(props.thread), 1500)
    return
  }

  // CodeMirror path: retry with increasing delays — editor view may not be mounted yet
  const tryScroll = (attempts = 0) => {
    const pane = editorStore.activePane
    if (!pane) return
    const view = editorStore.getEditorView(pane.id, props.thread.fileId)
    if (view) {
      const from = Math.min(props.thread.range.from, view.state.doc.length)
      const to = Math.min(props.thread.range.to, view.state.doc.length)
      view.dispatch({
        selection: { anchor: from, head: to },
        scrollIntoView: true,
      })
      view.focus()
    } else if (attempts < 5) {
      setTimeout(() => tryScroll(attempts + 1), 50 * (attempts + 1))
    }
  }
  nextTick(() => tryScroll())
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

// Auto-scroll on new content
watch(
  () => {
    const last = props.thread.messages[props.thread.messages.length - 1]
    return last?.content?.length || 0
  },
  () => {
    if (isAutoScrolling.value) {
      nextTick(() => {
        bottomAnchor.value?.scrollIntoView({ behavior: 'auto' })
      })
    }
  },
)

watch(
  () => props.thread.messages.length,
  () => {
    if (isAutoScrolling.value) {
      nextTick(() => scrollToBottom())
    }
  },
)

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function focusInput() {
  taskInputRef.value?.focus()
}

defineExpose({ focusInput })
</script>

<style scoped>
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
