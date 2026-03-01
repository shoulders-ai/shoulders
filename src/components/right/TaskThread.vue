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
          <ChatMessage
            :message="msg"
            :prevRole="idx > 0 ? visibleMessages[idx - 1].role : null"
            :threadId="thread.id"
          />
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
      :isStreaming="isStreaming"
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
import ChatMessage from './ChatMessage.vue'
import TaskInput from './TaskInput.vue'

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

// ─── Chat instance and messages ─────────────────────────────────

const chat = computed(() => tasksStore.getTaskChatInstance(props.thread.id))

const visibleMessages = computed(() => {
  if (chat.value) return chat.value.state.messagesRef.value
  return []
})

const isStreaming = computed(() => {
  if (!chat.value) return false
  const status = chat.value.state.statusRef.value
  return status === 'submitted' || status === 'streaming'
})

const hasAppliedEdits = computed(() => {
  // Check editStatuses for any applied edits in this thread's messages
  for (const msg of visibleMessages.value) {
    if (msg.role !== 'assistant' || !msg.parts) continue
    for (const part of msg.parts) {
      if (part.toolCallId && tasksStore.getEditStatus(part.toolCallId)?.status === 'applied') {
        return true
      }
    }
  }
  return false
})

const selectionPreview = computed(() => {
  const text = props.thread.selectedText || ''
  return text.length > 80 ? text.slice(0, 80) + '...' : text
})

// ─── Message handling ───────────────────────────────────────────

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

// ─── Navigation ─────────────────────────────────────────────────

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

  if (props.thread.fileId.endsWith('.docx')) {
    nextTick(() => navigateDocx(props.thread))
    setTimeout(() => navigateDocx(props.thread), 500)
    setTimeout(() => navigateDocx(props.thread), 1000)
    setTimeout(() => navigateDocx(props.thread), 1500)
    return
  }

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

// ─── Scrolling ──────────────────────────────────────────────────

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
    const msgs = visibleMessages.value
    if (msgs.length === 0) return 0
    const last = msgs[msgs.length - 1]
    const textParts = last.parts?.filter(p => p.type === 'text') || []
    return textParts.reduce((len, p) => len + (p.text?.length || 0), 0)
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
  () => visibleMessages.value.length,
  () => {
    if (isAutoScrolling.value) {
      nextTick(() => scrollToBottom())
    }
  },
)

function focusInput() {
  taskInputRef.value?.focus()
}

defineExpose({ focusInput })
</script>
