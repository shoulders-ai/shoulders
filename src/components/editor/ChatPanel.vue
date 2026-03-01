<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Chat header row -->
    <div class="flex items-center h-7 shrink-0 border-b" style="border-color: var(--border);">
      <div class="flex-1 min-w-0 px-2 ui-text-base truncate" style="color: var(--fg-muted);">
        {{ sessionLabel }}
      </div>
      <!-- History button -->
      <div class="relative shrink-0">
        <button
          class="h-7 px-2 flex items-center gap-1 shrink-0 cursor-pointer hover:opacity-80"
          style="color: var(--fg-muted);"
          @click.stop="toggleHistory"
          title="Chat history"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span class="ui-text-md">Past chats</span>
        </button>
        <!-- History dropdown -->
        <Teleport to="body">
          <template v-if="showHistory">
            <div class="fixed inset-0 z-[90]" @click="showHistory = false"></div>
            <div
              class="fixed z-[100] rounded-lg border overflow-hidden"
              :style="historyDropdownPos"
              style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 260px; max-height: 320px;"
              @click.stop
            >
              <div class="px-3 py-1.5 ui-text-md font-medium uppercase tracking-wider"
                style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
                Chat History
              </div>
              <div class="overflow-y-auto" style="max-height: 280px;">
                <div
                  v-for="sess in sortedSessions"
                  :key="sess.id"
                  class="px-3 py-2 cursor-pointer flex items-start gap-2"
                  :style="{ background: 'transparent' }"
                  @mouseenter="$event.currentTarget.style.background = 'var(--bg-hover)'"
                  @mouseleave="$event.currentTarget.style.background = 'transparent'"
                  @click="openHistorySession(sess.id)"
                >
                  <div class="flex-1 min-w-0">
                    <div class="ui-text-base truncate" style="color: var(--fg-secondary);">
                      {{ sess.label }}
                    </div>
                    <div class="ui-text-md mt-0.5" style="color: var(--fg-muted);">
                      {{ sess.messageCount }} message{{ sess.messageCount !== 1 ? 's' : '' }}
                    </div>
                  </div>
                  <span class="ui-text-md shrink-0 mt-0.5" style="color: var(--fg-muted);">
                    {{ relativeTime(sess.updatedAt) }}
                  </span>
                </div>
                <div v-if="sortedSessions.length === 0" class="px-3 py-4 text-center ui-text-base" style="color: var(--fg-muted);">
                  No past chats
                </div>
              </div>
            </div>
          </template>
        </Teleport>
      </div>
      <!-- New chat button -->
      <button
        class="h-7 px-2 flex items-center gap-1 shrink-0 cursor-pointer hover:opacity-80"
        style="color: var(--fg-muted);"
        @click="newChat"
        title="New chat"
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 3v10M3 8h10"/>
        </svg>
        <span class="ui-text-md">New chat</span>
      </button>
    </div>

    <!-- Chat session (messages + input) -->
    <div class="flex-1 overflow-hidden">
      <ChatSession
        v-if="session"
        ref="chatSessionRef"
        :key="sessionId"
        :session="session"
      />
      <div v-else class="flex items-center justify-center h-full ui-text-base" style="color: var(--fg-muted);">
        Loading chat session...
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useEditorStore } from '../../stores/editor'
import { getChatSessionId } from '../../utils/fileTypes'
import ChatSession from '../right/ChatSession.vue'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const chatStore = useChatStore()
const editorStore = useEditorStore()

const chatSessionRef = ref(null)
const showHistory = ref(false)
const historyBtnRef = ref(null)

// Extract session ID from the chat: path
const sessionId = computed(() => getChatSessionId(props.filePath))

// Get the session object (reactive)
const session = computed(() =>
  chatStore.sessions.find(s => s.id === sessionId.value) || null
)

const sessionLabel = computed(() =>
  session.value?.label || 'New Chat'
)

// History dropdown
const sortedSessions = computed(() => {
  const liveIds = new Set(chatStore.sessions.map(s => s.id))
  return chatStore.allSessionsMeta
    .filter(m => !liveIds.has(m.id))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
})

const historyDropdownPos = computed(() => {
  // Position near the top-right of this component
  const el = document.querySelector(`[data-chat-panel="${props.paneId}"]`)
  if (!el) return { top: '40px', right: '10px' }
  const rect = el.getBoundingClientRect()
  return {
    top: (rect.top + 35) + 'px',
    right: (window.innerWidth - rect.right + 10) + 'px',
  }
})

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

function toggleHistory() {
  showHistory.value = !showHistory.value
  if (showHistory.value) {
    chatStore.loadAllSessionsMeta()
  }
}

function openHistorySession(id) {
  showHistory.value = false
  // Open the selected session as a new chat tab in this pane
  editorStore.openChat({ sessionId: id, paneId: props.paneId })
}

function newChat() {
  // Create a new session and open it as a tab in this pane
  const sid = chatStore.createSession()
  editorStore.openChat({ sessionId: sid, paneId: props.paneId })
}

// On mount: ensure session is loaded, and set activeSessionId
onMounted(async () => {
  const sid = sessionId.value
  if (!sid) return

  // If session doesn't exist in chatStore.sessions, load it from disk
  // skipArchive: true — don't archive other sessions, tabs coexist
  const exists = chatStore.sessions.find(s => s.id === sid)
  if (!exists) {
    await chatStore.reopenSession(sid, { skipArchive: true })
  }

  // Update activeSessionId so "Ask AI" routing targets this session
  chatStore.activeSessionId = sid
})

// When this pane becomes active, update activeSessionId
watch(
  () => editorStore.activePaneId === props.paneId,
  (isActive) => {
    if (isActive && sessionId.value) {
      chatStore.activeSessionId = sessionId.value
    }
  },
)

function focus() {
  chatSessionRef.value?.focus()
}

defineExpose({ focus })
</script>
