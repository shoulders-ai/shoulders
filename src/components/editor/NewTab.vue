<template>
  <div class="flex flex-col h-full" style="background: var(--bg-primary);">
    <!-- Close pane button (non-root panes only) -->
    <div v-if="paneId !== 'pane-root'" class="flex items-center justify-end h-7 shrink-0 border-b px-1" style="border-color: var(--border);">
      <button
        class="p-1 rounded hover:opacity-80 cursor-pointer"
        style="color: var(--fg-muted);"
        title="Close pane"
        @click="editorStore.collapsePane(paneId)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>
    <!-- Scrollable content area -->
    <div class="flex-1 overflow-auto min-h-0" :class="{ 'overflow-hidden': view === 'home' }">

      <!-- ═══ HOME VIEW ═══ -->
      <div v-if="view === 'home'" class="newtab-center">
        <div class="newtab-col">
          <!-- Wordmark -->
          <div class="newtab-brand">Shoulders</div>
          <div class="newtab-rule"></div>

          <!-- File creation links -->
          <div class="newtab-create-row">
            <button
              v-for="ft in fileTypes"
              :key="ft.ext"
              class="newtab-create-link"
              @click="createNewFile(ft.ext, ft.label)"
            >{{ ft.label }}</button>
          </div>

          <!-- Recent files -->
          <div v-if="recentFiles.length > 0" class="newtab-section">
            <button class="newtab-section-header" @click="view = 'files'">
              <span>Recent files</span>
              <span class="newtab-arrow">&rarr;</span>
            </button>
            <button
              v-for="entry in recentFiles.slice(0, 3)"
              :key="entry.path"
              class="newtab-item"
              @click="openFile(entry.path)"
            >
              <span class="truncate">{{ fileName(entry.path) }}</span>
              <span class="newtab-time">{{ relativeTime(entry.openedAt) }}</span>
            </button>
          </div>

          <!-- Recent chats -->
          <div v-if="recentChats.length > 0" class="newtab-section">
            <button class="newtab-section-header" @click="goToChats">
              <span>Recent chats</span>
              <span class="newtab-arrow">&rarr;</span>
            </button>
            <button
              v-for="sess in recentChats.slice(0, 3)"
              :key="sess.id"
              class="newtab-item"
              @click="openChat(sess.id)"
            >
              <span class="truncate">{{ sess.label }}</span>
              <span class="newtab-time">{{ relativeTime(sess.updatedAt) }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ═══ FILES VIEW ═══ -->
      <div v-else-if="view === 'files'" class="newtab-list-view">
        <div class="newtab-list-header">
          <button class="newtab-back" @click="view = 'home'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="newtab-list-title">Recent files</div>
        </div>
        <div v-if="allRecentFiles.length === 0" class="newtab-empty">No recent files</div>
        <button
          v-for="entry in allRecentFiles"
          :key="entry.path"
          class="newtab-item"
          @click="openFile(entry.path)"
        >
          <span class="truncate">{{ fileName(entry.path) }}</span>
          <span class="newtab-time">{{ relativeTime(entry.openedAt) }}</span>
        </button>
      </div>

      <!-- ═══ CHATS VIEW ═══ -->
      <div v-else-if="view === 'chats'" class="newtab-list-view">
        <div class="newtab-list-header">
          <button class="newtab-back" @click="view = 'home'">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <div class="newtab-list-title">Chat history</div>
        </div>
        <div v-if="allChats.length === 0" class="newtab-empty">No past chats</div>
        <button
          v-for="sess in allChats"
          :key="sess.id"
          class="newtab-item"
          @click="openChat(sess.id)"
        >
          <span class="truncate">{{ sess.label }}</span>
          <span class="newtab-time">{{ relativeTime(sess.updatedAt) }}</span>
        </button>
      </div>
    </div>

    <!-- ═══ CHAT INPUT (always visible) ═══ -->
    <div class="newtab-chat-area">
      <div class="newtab-chat-inner">
        <div class="newtab-chat-box" :class="{ 'newtab-chat-focused': chatFocused }">
          <input
            ref="chatInputRef"
            v-model="chatInput"
            class="newtab-chat-input"
            placeholder="Ask anything..."
            autocomplete="off"
            autocorrect="off"
            @keydown="onChatKeydown"
            @focus="chatFocused = true"
            @blur="chatFocused = false"
          />
          <button
            class="newtab-chat-send"
            :class="{ 'newtab-chat-send-active': chatInput.trim() }"
            @click="sendChat"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2.5 2.5l11 5.5-11 5.5V9.5L9 8l-6.5-1.5z"/>
            </svg>
          </button>
        </div>
        <!-- Model picker -->
        <div class="newtab-chat-footer">
          <button
            ref="modelBtnRef"
            class="newtab-model-btn"
            @click.stop="showModelPicker = !showModelPicker"
          >
            {{ selectedModelName }}
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><path d="M1 3l4 4 4-4z"/></svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Model dropdown (teleported to escape overflow) -->
    <Teleport to="body">
      <template v-if="showModelPicker">
        <div class="fixed inset-0 z-[90]" @click="showModelPicker = false"></div>
        <div
          class="fixed z-[100] rounded border min-w-[160px] py-1"
          :style="modelDropdownPos"
          style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.3);"
        >
          <template v-if="availableModels.length > 0">
            <div v-for="m in availableModels" :key="m.id"
              class="px-3 py-1.5 text-[13px] cursor-pointer flex items-center"
              style="color: var(--fg-secondary);"
              @mouseenter="$event.currentTarget.style.background = 'var(--bg-hover)'"
              @mouseleave="$event.currentTarget.style.background = 'transparent'"
              @click="selectModel(m)"
            >
              <span v-if="m.id === selectedModelId" class="mr-1.5" style="color: var(--accent);">&#x2713;</span>
              <span v-else style="width: 16px; display: inline-block;"></span>
              {{ m.name }}
            </div>
          </template>
          <div v-else class="px-3 py-2 text-[11px]" style="color: var(--fg-muted);">
            No models available. Add API keys in Settings.
          </div>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useChatStore } from '../../stores/chat'
import { useWorkspaceStore } from '../../stores/workspace'

const props = defineProps({
  paneId: { type: String, required: true },
})

const editorStore = useEditorStore()
const filesStore = useFilesStore()
const chatStore = useChatStore()
const workspace = useWorkspaceStore()

// ─── Internal state ────────────────────────────────────────────────
const view = ref('home') // 'home' | 'files' | 'chats'
const chatInput = ref('')
const chatInputRef = ref(null)
const chatFocused = ref(false)
const showModelPicker = ref(false)
const modelBtnRef = ref(null)
const selectedModelId = ref(null)

// ─── File creation types ───────────────────────────────────────────
const fileTypes = [
  { ext: '.md', label: 'Markdown' },
  { ext: '.tex', label: 'LaTeX' },
  { ext: '.docx', label: 'Word Document' },
  { ext: '.ipynb', label: 'Notebook' },
  { ext: '.py', label: 'Code' },
]

// ─── Computed data ─────────────────────────────────────────────────
const recentFiles = computed(() => editorStore.recentFilesForEmptyState)

const allRecentFiles = computed(() => {
  const flatPaths = new Set(filesStore.flatFiles.map(f => f.path))
  return editorStore.recentFiles.filter(entry => flatPaths.has(entry.path))
})

const recentChats = computed(() => chatStore.allSessionsMeta)

const allChats = computed(() =>
  [...chatStore.allSessionsMeta].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
)

// ─── Model picker ──────────────────────────────────────────────────
const availableModels = computed(() => {
  const config = workspace.modelsConfig
  if (!config?.models) return []
  return config.models.filter(m => {
    const providerConfig = config.providers?.[m.provider]
    const keyEnv = providerConfig?.apiKeyEnv
    const key = keyEnv ? workspace.apiKeys?.[keyEnv] : null
    const hasDirectKey = key && !key.includes('your-')
    const hasProxyAccess = !!workspace.shouldersAuth?.token
    return hasDirectKey || hasProxyAccess
  })
})

const selectedModelName = computed(() => {
  const config = workspace.modelsConfig
  if (!config?.models) return 'Sonnet'
  const id = selectedModelId.value || workspace.selectedModelId || config.models.find(m => m.default)?.id || 'sonnet'
  const model = config.models.find(m => m.id === id)
  return model?.name || 'Sonnet'
})

const modelDropdownPos = computed(() => {
  const el = modelBtnRef.value
  if (!el) return {}
  const rect = el.getBoundingClientRect()
  return {
    bottom: (window.innerHeight - rect.top + 4) + 'px',
    left: rect.left + 'px',
  }
})

// ─── Actions ───────────────────────────────────────────────────────

function fileName(path) {
  return path.split('/').pop() || path
}

function relativeTime(ts) {
  if (!ts) return ''
  const val = typeof ts === 'number' ? ts : new Date(ts).getTime()
  const diff = Date.now() - val
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

function openFile(path) {
  editorStore.setActivePane(props.paneId)
  editorStore.openFile(path)
}

function openChat(sessionId) {
  editorStore.setActivePane(props.paneId)
  chatStore.reopenSession(sessionId, { skipArchive: true })
  nextTick(() => {
    editorStore.openChat({ sessionId, paneId: props.paneId })
  })
}

function goToChats() {
  chatStore.loadAllSessionsMeta()
  view.value = 'chats'
}

function selectModel(m) {
  selectedModelId.value = m.id
  workspace.setSelectedModelId(m.id)
  showModelPicker.value = false
}

function onChatKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendChat()
  }
}

async function sendChat() {
  const text = chatInput.value.trim()
  if (!text) return

  editorStore.setActivePane(props.paneId)

  const modelId = selectedModelId.value || workspace.selectedModelId
  const sessionId = chatStore.createSession()

  if (modelId) {
    const session = chatStore.sessions.find(s => s.id === sessionId)
    if (session) session.modelId = modelId
  }

  chatInput.value = ''
  editorStore.openChat({ sessionId, paneId: props.paneId })

  await nextTick()
  chatStore.sendMessage(sessionId, { text })
}

async function createNewFile(ext, label) {
  if (!workspace.path) return

  const baseName = 'untitled'
  let name = `${baseName}${ext}`
  let counter = 2

  // Find a unique name
  while (true) {
    const fullPath = `${workspace.path}/${name}`
    try {
      const exists = await invoke('path_exists', { path: fullPath })
      if (!exists) break
    } catch {
      break
    }
    name = `${baseName}-${counter}${ext}`
    counter++
  }

  const created = await filesStore.createFile(workspace.path, name)
  if (created) {
    editorStore.setActivePane(props.paneId)
    editorStore.openFile(created)
  }
}

// ─── Lifecycle ─────────────────────────────────────────────────────
onMounted(() => {
  chatStore.loadAllSessionsMeta()
})
</script>

<style scoped>
/* ── Center layout (Home) ── */
.newtab-center {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  user-select: none;
  -webkit-user-select: none;
}

.newtab-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 320px;
}

/* ── Wordmark ── */
.newtab-brand {
  font-family: 'Lora', ui-serif, Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: 2.25rem;
  color: var(--fg-primary);
  opacity: 0.25;
  letter-spacing: -0.02em;
}

.newtab-rule {
  width: 32px;
  height: 1px;
  background: var(--fg-muted);
  opacity: 0.2;
  margin: 16px 0 24px;
}

/* ── File creation row ── */
.newtab-create-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 4px 12px;
  margin-bottom: 24px;
  width: 100%;
}

.newtab-create-link {
  border: none;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  transition: color 0.15s;
}

.newtab-create-link:hover {
  color: var(--accent);
}

/* ── Section headers ── */
.newtab-section {
  width: 100%;
  margin-top: 4px;
}

.newtab-section + .newtab-section {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

.newtab-section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 4px 10px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--fg-muted);
  opacity: 0.8;
  border-radius: 4px;
  transition: color 0.15s, opacity 0.15s;
}

.newtab-section-header:hover {
  opacity: 1;
  color: var(--fg-secondary);
}

.newtab-arrow {
  font-size: 11px;
  transition: transform 0.15s;
}

.newtab-section-header:hover .newtab-arrow {
  transform: translateX(2px);
}

/* ── List items (files / chats) ── */
.newtab-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--fg-secondary);
  font-size: 13px;
  line-height: 1.5;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
  gap: 12px;
}

.newtab-item:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.newtab-time {
  font-size: 11px;
  color: var(--fg-muted);
  flex-shrink: 0;
  white-space: nowrap;
}

/* ── List views (files / chats drill-in) ── */
.newtab-list-view {
  max-width: 480px;
  margin: 0 auto;
  padding: 36px 24px 20px;
  user-select: none;
  -webkit-user-select: none;
}

.newtab-list-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 0 4px;
}

.newtab-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  transition: color 0.15s, background 0.15s;
  flex-shrink: 0;
}

.newtab-back:hover {
  color: var(--fg-secondary);
  background: var(--bg-hover);
}

.newtab-list-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-secondary);
  letter-spacing: -0.01em;
}

.newtab-empty {
  padding: 20px 10px;
  text-align: center;
  font-size: 13px;
  color: var(--fg-muted);
}

/* ── Chat input area ── */
.newtab-chat-area {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 0 24px 20px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}

.newtab-chat-inner {
  width: 100%;
  max-width: 560px;
}

.newtab-chat-box {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--bg-secondary);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.newtab-chat-focused {
  border-color: var(--accent);
  box-shadow: 0 0 0 1px var(--accent);
}

.newtab-chat-input {
  flex: 1;
  border: none;
  background: transparent;
  color: var(--fg-primary);
  font-size: 13.5px;
  line-height: 1.5;
  padding: 10px 14px;
  outline: none;
  font-family: inherit;
}

.newtab-chat-input::placeholder {
  color: var(--fg-muted);
}

.newtab-chat-send {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  margin-right: 6px;
  border: none;
  border-radius: 6px;
  background: var(--bg-tertiary);
  color: var(--fg-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;
}

.newtab-chat-send-active {
  background: var(--accent);
  color: var(--bg-primary);
}

.newtab-chat-footer {
  display: flex;
  align-items: center;
  padding: 4px 2px 0;
}

.newtab-model-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s;
}

.newtab-model-btn:hover {
  color: var(--fg-secondary);
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
