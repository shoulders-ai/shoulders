<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Main tab bar (Chat / Tasks / Backlinks) -->
    <div class="flex items-center h-8 border-b shrink-0" style="border-color: var(--border);">
      <button
        v-for="tab in mainTabs"
        :key="tab"
        class="px-3 h-full ui-text-lg capitalize"
        :style="{
          color: mainTab === tab ? 'var(--fg-primary)' : 'var(--fg-muted)',
          borderBottom: mainTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
        }"
        @click="mainTab = tab"
      >
        {{ tab }}
        <span v-if="tab === 'chat' && chatStore.streamingCount > 0"
          class="ml-1 px-1 rounded ui-text-md"
          style="background: var(--accent); color: var(--bg-primary);">
          {{ chatStore.streamingCount }}
        </span>
        <span v-if="tab === 'tasks' && tasksStore.streamingCount > 0"
          class="ml-1 px-1 rounded ui-text-md"
          style="background: var(--accent); color: var(--bg-primary);">
          {{ tasksStore.streamingCount }}
        </span>
        <span v-if="tab === 'backlinks' && backlinkCount > 0"
          class="ml-1 px-1 rounded ui-text-md"
          style="background: var(--info); color: var(--bg-primary);">
          {{ backlinkCount }}
        </span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden relative">
      <!-- Chat panel -->
      <div v-show="mainTab === 'chat'" class="absolute inset-0 flex flex-col">
        <!-- Chat header row -->
        <div class="flex items-center h-7 shrink-0 border-b" style="border-color: var(--border);">
          <div class="flex-1 min-w-0 px-2 ui-text-base truncate" style="color: var(--fg-muted);">
            {{ chatStore.activeSession?.label || 'New Chat' }}
          </div>
          <!-- History button -->
          <div class="relative shrink-0">
            <button
              class="h-7 px-2 flex items-center gap-1 shrink-0 cursor-pointer hover:opacity-80"
              style="color: var(--fg-muted);"
              @click.stop="toggleChatHistory"
              title="Chat history"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
              </svg>
              <span class="ui-text-md">Past chats</span>
            </button>
            <!-- History dropdown -->
            <template v-if="showChatHistory">
              <div class="fixed inset-0 z-10" @click="showChatHistory = false"></div>
              <div
                class="absolute right-0 top-full rounded-lg border z-20 overflow-hidden"
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
                    @click="selectHistorySession(sess.id)"
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
          </div>
          <!-- New chat button -->
          <button
            class="h-7 px-2 flex items-center gap-1 shrink-0 cursor-pointer hover:opacity-80"
            style="color: var(--fg-muted);"
            @click="addChat"
            title="New chat"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 3v10M3 8h10"/>
            </svg>
            <span class="ui-text-md">New chat</span>
          </button>
        </div>

        <!-- Active chat session -->
        <div class="flex-1 overflow-hidden relative">
          <ChatSession
            v-if="chatStore.activeSession"
            :key="chatStore.activeSessionId"
            :ref="el => { if (el) chatSessionRefs[chatStore.activeSessionId] = el }"
            :session="chatStore.activeSession"
          />
        </div>
      </div>

      <!-- Tasks panel -->
      <div v-show="mainTab === 'tasks'" class="absolute inset-0 overflow-hidden">
        <TaskThreads ref="taskThreadsRef" />
      </div>

      <!-- Backlinks panel -->
      <div v-show="mainTab === 'backlinks'" class="absolute inset-0 overflow-auto">
        <Backlinks />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, computed, watch } from 'vue'
import { useTasksStore } from '../../stores/tasks'
import { useLinksStore } from '../../stores/links'
import { useEditorStore } from '../../stores/editor'
import { useChatStore } from '../../stores/chat'
import TaskThreads from './TaskThreads.vue'
import Backlinks from './Backlinks.vue'
import ChatSession from './ChatSession.vue'

const tasksStore = useTasksStore()
const linksStore = useLinksStore()
const editorStore = useEditorStore()
const chatStore = useChatStore()

const backlinkCount = computed(() => {
  const active = editorStore.activeTab
  if (!active) return 0
  return linksStore.backlinksForFile(active).length
})
const mainTabs = computed(() => {
  const tabs = ['chat', 'tasks']
  if (backlinkCount.value > 0) tabs.push('backlinks')
  return tabs
})
const mainTab = ref('chat')
const chatSessionRefs = reactive({})
const taskThreadsRef = ref(null)
const showChatHistory = ref(false)

const sortedSessions = computed(() => {
  const liveIds = new Set(chatStore.sessions.map(s => s.id))
  return chatStore.allSessionsMeta
    .filter(m => !liveIds.has(m.id))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
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

function toggleChatHistory() {
  showChatHistory.value = !showChatHistory.value
  if (showChatHistory.value) {
    chatStore.loadAllSessionsMeta()
  }
}

async function selectHistorySession(id) {
  await chatStore.reopenSession(id)
  showChatHistory.value = false
}

// ====== Chat state ======

function addChat() {
  chatStore.archiveAndNewChat()
}

// Fall back to chat if current tab disappears (e.g. backlinks hidden)
watch(mainTabs, (tabs) => {
  if (!tabs.includes(mainTab.value)) {
    mainTab.value = 'chat'
  }
})

defineExpose({
  focusChat() {
    mainTab.value = 'chat'
    nextTick(() => {
      const activeId = chatStore.activeSessionId
      if (activeId && chatSessionRefs[activeId]) {
        chatSessionRefs[activeId].focus()
      }
    })
  },
  focusTasks(threadId) {
    mainTab.value = 'tasks'
    if (threadId) tasksStore.setActiveThread(threadId)
    nextTick(() => {
      taskThreadsRef.value?.focusInput()
    })
  },
})
</script>
