<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Main tab bar (Outline / Tasks / Terminals / Backlinks) -->
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
      <!-- Outline panel -->
      <div v-show="mainTab === 'outline'" class="absolute inset-0 overflow-auto">
        <OutlinePanel :collapsed="false" :overrideActiveFile="documentTab" />
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
        <TaskThreads ref="taskThreadsRef" :documentTab="documentTab" />
      </div>

      <!-- Backlinks panel -->
      <div v-show="mainTab === 'backlinks'" class="absolute inset-0 overflow-auto">
        <Backlinks :overrideActiveFile="documentTab" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, nextTick, computed, watch, onMounted, onUnmounted } from 'vue'
import { useTasksStore } from '../../stores/tasks'
import { useLinksStore } from '../../stores/links'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { getLanguageConfig } from '../../services/codeRunner'
import { invoke } from '@tauri-apps/api/core'
import Terminal from './Terminal.vue'
import TaskThreads from './TaskThreads.vue'
import Backlinks from './Backlinks.vue'
import OutlinePanel from '../sidebar/OutlinePanel.vue'

const tasksStore = useTasksStore()
const linksStore = useLinksStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()

// Track the last focused document tab (non-chat) for document-scoped content
const lastDocumentTab = ref(null)

const documentTab = computed(() => {
  const active = editorStore.activeTab
  if (active && !active.startsWith('chat:')) return active
  // When a chat tab is focused, keep showing the last document's context
  return lastDocumentTab.value
})

// Update lastDocumentTab whenever a non-chat tab is focused
// flush:'post' prevents mid-patch state mutations that can cause Vue __vnode errors
watch(() => editorStore.activeTab, (tab) => {
  if (tab && !tab.startsWith('chat:')) {
    lastDocumentTab.value = tab
  }
}, { flush: 'post' })

const backlinkCount = computed(() => {
  const active = documentTab.value
  if (!active) return 0
  return linksStore.backlinksForFile(active).length
})
const mainTabs = computed(() => {
  const tabs = ['outline', 'tasks', 'terminal']
  if (backlinkCount.value > 0) tabs.push('backlinks')
  return tabs
})
const mainTab = ref(localStorage.getItem('rightPanelTab') || 'outline')
const terminalRefs = reactive({})
const taskThreadsRef = ref(null)

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

// Persist active tab + refit terminal when switching back to terminals tab
watch(mainTab, (tab) => {
  localStorage.setItem('rightPanelTab', tab)
  if (tab === 'terminal') {
    nextTick(() => {
      const term = terminalRefs[activeTerminal.value]
      if (term) term.refitTerminal()
    })
  }
})

// Fall back to outline if current tab disappears (e.g. backlinks hidden)
watch(mainTabs, (tabs) => {
  if (!tabs.includes(mainTab.value)) {
    mainTab.value = 'outline'
  }
}, { flush: 'post' })

defineExpose({
  focusTerminal() {
    mainTab.value = 'terminal'
    nextTick(() => {
      const term = terminalRefs[activeTerminal.value]
      if (term) { term.refitTerminal(); term.focus() }
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
