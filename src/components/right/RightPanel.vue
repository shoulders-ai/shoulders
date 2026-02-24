<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Main tab bar (Chat / Terminals / Tasks / Backlinks) -->
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

      <!-- Terminals panel (always mounted, hidden via v-show to preserve processes) -->
      <div v-show="mainTab === 'terminal'" class="absolute inset-0 flex flex-col">
        <!-- Terminal sub-tabs -->
        <div class="flex items-center h-7 shrink-0 border-b" style="border-color: var(--border);">
          <div ref="termTabsContainer" class="flex-1 flex items-center h-full overflow-x-auto scrollbar-hidden relative">
            <div
              v-for="(term, idx) in terminals"
              :key="term.id"
              :ref="el => termTabEls[idx] = el"
              class="flex items-center h-full px-2 text-[11px] cursor-pointer shrink-0 group"
              :style="{
                background: activeTerminal === idx ? 'var(--bg-primary)' : 'transparent',
                color: activeTerminal === idx ? 'var(--fg-primary)' : 'var(--fg-muted)',
                minWidth: '48px',
                opacity: termDragIdx === idx ? 0.3 : 1,
                transition: 'opacity 0.15s',
              }"
              @mousedown="onTermMouseDown(idx, $event)"
              @mouseenter="onTermMouseEnter(idx)"
              @click="onTermClick(idx)"
              @dblclick="startRenameTerminal(idx)"
            >
              <template v-if="termRenamingIdx === idx">
                <input
                  ref="termRenameInputRef"
                  v-model="termRenameText"
                  class="bg-transparent border-none outline-none text-[11px] w-20"
                  :style="{ color: 'var(--fg-primary)' }"
                  autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                  @keydown.enter="finishTermRename"
                  @keydown.escape="cancelTermRename"
                  @blur="finishTermRename"
                  @click.stop
                />
              </template>
              <template v-else>
                <span class="flex-1 truncate">{{ term.label }}</span>
              </template>
              <button
                v-if="terminals.length > 1 && termRenamingIdx !== idx"
                class="ml-auto pl-1.5 w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 shrink-0"
                style="color: var(--fg-muted);"
                @click.stop="closeTerminal(idx)"
              >
                <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M2 2l6 6M8 2l-6 6"/>
                </svg>
              </button>
            </div>

            <!-- Drop indicator line -->
            <div v-if="termDropIndicatorLeft !== null" class="tab-drop-indicator" :style="{ left: termDropIndicatorLeft + 'px' }"></div>
          </div>
          <button
            class="w-7 h-7 flex items-center justify-center shrink-0 hover:bg-[var(--bg-hover)]"
            style="color: var(--fg-muted);"
            @click="addTerminal"
            title="New terminal"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 3v10M3 8h10"/>
            </svg>
          </button>
        </div>

        <!-- Ghost tab for terminal drag -->
        <Teleport to="body">
          <div v-if="termGhostVisible" class="tab-ghost" :style="{ left: termGhostX + 'px', top: termGhostY + 'px' }">
            {{ termGhostLabel }}
          </div>
        </Teleport>

        <!-- Active terminal -->
        <div class="flex-1 overflow-hidden">
          <Terminal
            v-for="(term, idx) in terminals"
            :key="term.id"
            :ref="el => { if (el) terminalRefs[idx] = el }"
            v-show="activeTerminal === idx"
            :termId="term.id"
            :spawnCmd="term.spawnCmd || null"
            :spawnArgs="term.spawnArgs || []"
            :language="term.language || null"
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
import { ref, reactive, nextTick, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from '../../stores/tasks'
import { useLinksStore } from '../../stores/links'
import { useEditorStore } from '../../stores/editor'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspace'
import { getLanguageConfig } from '../../services/codeRunner'
import { invoke } from '@tauri-apps/api/core'
import Terminal from './Terminal.vue'
import TaskThreads from './TaskThreads.vue'
import Backlinks from './Backlinks.vue'
import ChatSession from './ChatSession.vue'

const tasksStore = useTasksStore()
const linksStore = useLinksStore()
const editorStore = useEditorStore()
const chatStore = useChatStore()
const workspace = useWorkspaceStore()

const backlinkCount = computed(() => {
  const active = editorStore.activeTab
  if (!active) return 0
  return linksStore.backlinksForFile(active).length
})
const mainTabs = computed(() => {
  const tabs = ['chat', 'tasks', 'terminal']
  if (backlinkCount.value > 0) tabs.push('backlinks')
  return tabs
})
const mainTab = ref('chat')
const terminalRefs = reactive({})
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

// ====== Terminal state ======
let termNextId = 1
const terminals = reactive([
  { id: termNextId++, label: 'Terminal 1' },
])
const activeTerminal = ref(0)

// Terminal rename
const termRenamingIdx = ref(-1)
const termRenameText = ref('')
const termRenameInputRef = ref(null)

// Terminal drag
const termDragIdx = ref(-1)
const termDragOverIdx = ref(-1)
const termTabsContainer = ref(null)
const termTabEls = reactive({})
const termDropIndicatorLeft = ref(null)
const termGhostVisible = ref(false)
const termGhostX = ref(0)
const termGhostY = ref(0)
const termGhostLabel = ref('')

function addTerminal() {
  const num = termNextId++
  terminals.push({ id: num, label: `Terminal ${num}` })
  activeTerminal.value = terminals.length - 1
}

function closeTerminal(idx) {
  terminals.splice(idx, 1)
  if (activeTerminal.value >= terminals.length) {
    activeTerminal.value = terminals.length - 1
  }
}

function startRenameTerminal(idx) {
  termRenamingIdx.value = idx
  termRenameText.value = terminals[idx].label
  nextTick(() => {
    const el = termRenameInputRef.value
    const input = Array.isArray(el) ? el[0] : el
    if (input) { input.focus(); input.select() }
  })
}
function finishTermRename() {
  if (termRenamingIdx.value >= 0 && termRenameText.value.trim()) {
    terminals[termRenamingIdx.value].label = termRenameText.value.trim()
  }
  termRenamingIdx.value = -1
}
function cancelTermRename() { termRenamingIdx.value = -1 }

// Terminal mouse drag
let termMouseDownStart = null
let termIsDragging = false

function onTermMouseDown(idx, e) {
  if (termRenamingIdx.value === idx) return
  termMouseDownStart = { idx, x: e.clientX, y: e.clientY }
  termIsDragging = false

  function onMouseMove(ev) {
    if (!termMouseDownStart) return
    const dx = Math.abs(ev.clientX - termMouseDownStart.x)
    if (dx > 5 && !termIsDragging) {
      termIsDragging = true
      termDragIdx.value = termMouseDownStart.idx
      termGhostLabel.value = terminals[termMouseDownStart.idx].label
      termGhostVisible.value = true
      document.body.classList.add('tab-dragging')
    }
    if (termIsDragging) {
      termGhostX.value = ev.clientX
      termGhostY.value = ev.clientY
      updateTermDropIndicator(ev.clientX)
    }
  }
  function onMouseUp() {
    if (termIsDragging && termDragIdx.value !== -1 && termDragOverIdx.value !== -1 && termDragIdx.value !== termDragOverIdx.value) {
      const fromIdx = termDragIdx.value
      const toIdx = termDragOverIdx.value
      const [moved] = terminals.splice(fromIdx, 1)
      terminals.splice(toIdx, 0, moved)
      const tmpRef = terminalRefs[fromIdx]
      terminalRefs[fromIdx] = terminalRefs[toIdx]
      terminalRefs[toIdx] = tmpRef
      if (activeTerminal.value === fromIdx) activeTerminal.value = toIdx
      else if (fromIdx < activeTerminal.value && toIdx >= activeTerminal.value) activeTerminal.value--
      else if (fromIdx > activeTerminal.value && toIdx <= activeTerminal.value) activeTerminal.value++
    }
    termDragIdx.value = -1
    termDragOverIdx.value = -1
    termDropIndicatorLeft.value = null
    termGhostVisible.value = false
    termMouseDownStart = null
    termIsDragging = false
    document.body.classList.remove('tab-dragging')
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
function onTermMouseEnter(idx) {
  if (termIsDragging && termDragIdx.value !== -1 && termDragIdx.value !== idx) termDragOverIdx.value = idx
}
function updateTermDropIndicator(mouseX) {
  if (!termTabsContainer.value) return
  const containerRect = termTabsContainer.value.getBoundingClientRect()
  let bestIdx = -1, bestDist = Infinity
  for (let i = 0; i <= terminals.length; i++) {
    let edgeX
    if (i === 0) { const el = termTabEls[0]; if (!el) continue; edgeX = el.getBoundingClientRect().left }
    else { const el = termTabEls[i - 1]; if (!el) continue; edgeX = el.getBoundingClientRect().right }
    const dist = Math.abs(mouseX - edgeX)
    if (dist < bestDist) { bestDist = dist; bestIdx = i }
  }
  if (bestIdx !== -1 && bestIdx !== termDragIdx.value && bestIdx !== termDragIdx.value + 1) {
    let edgeX
    if (bestIdx === 0) edgeX = termTabEls[0]?.getBoundingClientRect().left || 0
    else edgeX = termTabEls[bestIdx - 1]?.getBoundingClientRect().right || 0
    termDropIndicatorLeft.value = edgeX - containerRect.left - 1
    termDragOverIdx.value = bestIdx > termDragIdx.value ? bestIdx - 1 : bestIdx
  } else {
    termDropIndicatorLeft.value = null
    termDragOverIdx.value = -1
  }
}
function onTermClick(idx) { if (!termIsDragging) activeTerminal.value = idx }

// ====== Language terminal support ======

function findLanguageTerminal(language) {
  return terminals.findIndex(t => t.language === language)
}

function addLanguageTerminal(language) {
  const config = getLanguageConfig(language)
  if (!config) return -1

  // Check if one already exists
  const existing = findLanguageTerminal(language)
  if (existing !== -1) return existing

  const num = termNextId++
  terminals.push({
    id: num,
    label: config.label,
    language,
    spawnCmd: config.cmd,
    spawnArgs: config.args,
  })
  const idx = terminals.length - 1
  activeTerminal.value = idx
  return idx
}

function onCreateLanguageTerminal(e) {
  const { language } = e.detail || {}
  if (!language) return
  const idx = addLanguageTerminal(language)
  if (idx !== -1) {
    mainTab.value = 'terminal'
    activeTerminal.value = idx
    workspace.rightSidebarOpen = true
  }
}

function onFocusLanguageTerminal(e) {
  const { language } = e.detail || {}
  if (!language) return
  const idx = findLanguageTerminal(language)
  if (idx !== -1) {
    mainTab.value = 'terminal'
    activeTerminal.value = idx
    workspace.rightSidebarOpen = true
    nextTick(() => {
      const term = terminalRefs[idx]
      if (term) { term.refitTerminal(); term.focus() }
    })
  }
}

// Build a single-line source/exec command for multi-line code via temp file.
// Avoids PTY readline garbling when pasting multiple lines into R/Python/Julia.
const LANG_EXT = { r: '.R', python: '.py', julia: '.jl' }
async function buildReplCommand(code, language) {
  const needsTempFile = code.includes('\n')
  if (!needsTempFile) return code + '\n'

  const ext = LANG_EXT[language] || '.txt'
  const tmp = `/tmp/.shoulders-run-${Date.now()}${ext}`
  await invoke('write_file', { path: tmp, content: code })

  switch (language) {
    case 'r':       return `source("${tmp}", echo = TRUE)\n`
    case 'python':  return `exec(open("${tmp}").read())\n`
    case 'julia':   return `include("${tmp}")\n`
    default:        return code + '\n'
  }
}

async function sendCodeToTerminal(idx, code, language) {
  const term = terminalRefs[idx]
  if (!term) return
  const cmd = await buildReplCommand(code, language)
  await new Promise(r => setTimeout(r, 8))
  term.writeToPty(cmd)
}

function onSendToRepl(e) {
  const { code, language } = e.detail || {}
  if (!code || !language) return

  // Find or create the language terminal
  let idx = findLanguageTerminal(language)
  if (idx === -1) {
    idx = addLanguageTerminal(language)
    if (idx === -1) return
    // Give the terminal time to spawn before writing
    mainTab.value = 'terminal'
    activeTerminal.value = idx
    workspace.rightSidebarOpen = true
    setTimeout(() => sendCodeToTerminal(idx, code, language), 500)
    return
  }

  mainTab.value = 'terminal'
  activeTerminal.value = idx
  workspace.rightSidebarOpen = true
  nextTick(() => sendCodeToTerminal(idx, code, language))
}

onMounted(() => {
  window.addEventListener('create-language-terminal', onCreateLanguageTerminal)
  window.addEventListener('focus-language-terminal', onFocusLanguageTerminal)
  window.addEventListener('send-to-repl', onSendToRepl)
})

onUnmounted(() => {
  window.removeEventListener('create-language-terminal', onCreateLanguageTerminal)
  window.removeEventListener('focus-language-terminal', onFocusLanguageTerminal)
  window.removeEventListener('send-to-repl', onSendToRepl)
})

// ====== Chat state ======

function addChat() {
  chatStore.archiveAndNewChat()
}

// Refit terminal when switching back to terminals tab
watch(mainTab, (tab) => {
  if (tab === 'terminal') {
    nextTick(() => {
      const term = terminalRefs[activeTerminal.value]
      if (term) term.refitTerminal()
    })
  }
})

// Fall back to chat if current tab disappears (e.g. backlinks hidden)
watch(mainTabs, (tabs) => {
  if (!tabs.includes(mainTab.value)) {
    mainTab.value = 'chat'
  }
})

defineExpose({
  focusTerminal() {
    mainTab.value = 'terminal'
    nextTick(() => {
      const term = terminalRefs[activeTerminal.value]
      if (term) { term.refitTerminal(); term.focus() }
    })
  },
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
