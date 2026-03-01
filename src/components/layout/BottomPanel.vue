<template>
  <div v-if="hasEverOpened" v-show="workspace.bottomPanelOpen"
    class="flex flex-col overflow-hidden shrink-0"
    :style="{ height: workspace.bottomPanelHeight + 'px' }">

    <!-- Terminal sub-tabs -->
    <div class="flex items-center h-7 shrink-0 border-b" style="border-color: var(--border); background: var(--bg-secondary);">
      <!-- Tab list + New Terminal button -->
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
            class="ml-auto pl-1.5 w-3.5 h-3.5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 shrink-0"
            style="color: var(--fg-muted);"
            @click.stop="closeTerminal(idx)"
          >
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 2l6 6M8 2l-6 6"/>
            </svg>
          </button>
        </div>

        <!-- New Terminal (after last tab) -->
        <button
          class="h-7 px-2 flex items-center gap-1 shrink-0 cursor-pointer hover:bg-[var(--bg-hover)]"
          style="color: var(--fg-muted);"
          @click="addTerminal"
          title="New terminal"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          <span class="text-[11px]">New Terminal</span>
        </button>

        <!-- Drop indicator line -->
        <div v-if="termDropIndicatorLeft !== null" class="tab-drop-indicator" :style="{ left: termDropIndicatorLeft + 'px' }"></div>
      </div>

      <!-- Close panel button -->
      <button
        class="w-7 h-7 flex items-center justify-center shrink-0 hover:bg-[var(--bg-hover)]"
        style="color: var(--fg-muted);"
        @click="workspace.toggleBottomPanel()"
        title="Close terminal panel"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 2l6 6M8 2l-6 6"/>
        </svg>
      </button>
    </div>

    <!-- Ghost tab for terminal drag -->
    <Teleport to="body">
      <div v-if="termGhostVisible" class="tab-ghost" :style="{ left: termGhostX + 'px', top: termGhostY + 'px' }">
        {{ termGhostLabel }}
      </div>
    </Teleport>

    <!-- Terminal instances -->
    <div class="flex-1 overflow-hidden" style="background: var(--bg-primary);">
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
</template>

<script setup>
import { ref, reactive, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { getLanguageConfig } from '../../services/codeRunner'
import { invoke } from '@tauri-apps/api/core'
import Terminal from '../right/Terminal.vue'

const workspace = useWorkspaceStore()

// Lazy init: don't mount terminals until first open
const hasEverOpened = ref(workspace.bottomPanelOpen)

// Terminal state
let termNextId = 1
const terminals = reactive([])
const activeTerminal = ref(0)
const terminalRefs = reactive({})

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

// Seed first terminal if panel was already open from a previous session
if (hasEverOpened.value && terminals.length === 0) {
  terminals.push({ id: termNextId++, label: 'Terminal 1' })
  activeTerminal.value = 0
}

// Watch for open + refit on visibility change
watch(() => workspace.bottomPanelOpen, (open) => {
  if (open) {
    if (!hasEverOpened.value) hasEverOpened.value = true
    if (terminals.length === 0) {
      terminals.push({ id: termNextId++, label: 'Terminal 1' })
      activeTerminal.value = 0
    }
  }
  if (open) {
    nextTick(() => {
      const term = terminalRefs[activeTerminal.value]
      if (term) term.refitTerminal()
    })
  }
})

function ensureInitialized() {
  if (!hasEverOpened.value) {
    hasEverOpened.value = true
  }
}

function addTerminal() {
  const num = termNextId++
  terminals.push({ id: num, label: `Terminal ${num}` })
  activeTerminal.value = terminals.length - 1
}

function closeTerminal(idx) {
  terminals.splice(idx, 1)
  if (terminals.length === 0) {
    // Last tab closed — hide the panel
    workspace.toggleBottomPanel()
    return
  }
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
  ensureInitialized()
  const idx = addLanguageTerminal(language)
  if (idx !== -1) {
    activeTerminal.value = idx
    workspace.openBottomPanel()
  }
}

function onFocusLanguageTerminal(e) {
  const { language } = e.detail || {}
  if (!language) return
  const idx = findLanguageTerminal(language)
  if (idx !== -1) {
    activeTerminal.value = idx
    workspace.openBottomPanel()
    nextTick(() => {
      const term = terminalRefs[idx]
      if (term) { term.refitTerminal(); term.focus() }
    })
  }
}

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

  ensureInitialized()
  let idx = findLanguageTerminal(language)
  if (idx === -1) {
    idx = addLanguageTerminal(language)
    if (idx === -1) return
    activeTerminal.value = idx
    workspace.openBottomPanel()
    setTimeout(() => sendCodeToTerminal(idx, code, language), 500)
    return
  }

  activeTerminal.value = idx
  workspace.openBottomPanel()
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

defineExpose({
  focusTerminal() {
    ensureInitialized()
    if (terminals.length === 0) {
      terminals.push({ id: termNextId++, label: 'Terminal 1' })
      activeTerminal.value = 0
    }
    workspace.openBottomPanel()
    nextTick(() => {
      const term = terminalRefs[activeTerminal.value]
      if (term) { term.refitTerminal(); term.focus() }
    })
  },
})
</script>
