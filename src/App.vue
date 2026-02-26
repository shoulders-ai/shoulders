<template>
  <div class="flex flex-col h-screen w-screen overflow-hidden">
    <!-- Header (always visible) -->
    <Header
      ref="headerRef"
      @open-settings="workspace.openSettings()"
      @open-folder="pickWorkspace"
      @open-workspace="openWorkspace"
      @close-folder="closeWorkspace"
    />

    <!-- Launcher (no workspace open) -->
    <Launcher
      v-if="!workspace.isOpen"
      @open-folder="pickWorkspace"
      @open-workspace="openWorkspace"
    />

    <!-- Main content area (workspace open) -->
    <template v-if="workspace.isOpen">
      <div class="flex flex-1 overflow-hidden">
        <!-- Left sidebar: File tree + References -->
        <div
          v-if="workspace.leftSidebarOpen"
          data-sidebar="left"
          class="shrink-0 overflow-hidden border-r"
          :style="{ width: workspace.leftSidebarWidth + 'px', borderColor: 'var(--border)' }"
        >
          <LeftSidebar
            ref="leftSidebarRef"
            @version-history="openVersionHistory"
          />
        </div>

        <!-- Left resize handle -->
        <ResizeHandle
          v-if="workspace.leftSidebarOpen"
          direction="vertical"
          @resize="onLeftResize"
        />

        <!-- Center: Editor panes -->
        <div class="flex-1 flex flex-col overflow-hidden" style="min-width: 200px;">
          <!-- Pane container -->
          <div class="flex-1 overflow-hidden">
            <PaneContainer
              :node="editorStore.paneTree"
              @cursor-change="onCursorChange"
              @editor-stats="onEditorStats"
            />
          </div>
        </div>

        <!-- Right resize handle -->
        <ResizeHandle
          v-if="workspace.rightSidebarOpen"
          direction="vertical"
          @resize="onRightResize"
          @dblclick="onRightResizeSnap"
        />

        <!-- Right sidebar: Terminal + Tasks (v-show to preserve running terminals) -->
        <div
          v-show="workspace.rightSidebarOpen"
          class="shrink-0 overflow-hidden border-l"
          :style="{ width: workspace.rightSidebarWidth + 'px', borderColor: 'var(--border)' }"
        >
          <RightPanel ref="rightPanelRef" />
        </div>
      </div>

      <!-- Footer -->
      <Footer ref="footerRef" @open-settings="(s) => workspace.openSettings(s)" />
    </template>

    <!-- Version History Modal -->
    <VersionHistory
      :visible="versionHistoryVisible"
      :filePath="versionHistoryFile"
      @close="versionHistoryVisible = false"
    />

    <!-- Settings Modal -->
    <Settings :visible="workspace.settingsOpen" :initialSection="workspace.settingsSection" @close="workspace.closeSettings()" />

    <!-- Setup Wizard (first-time) -->
    <SetupWizard :visible="setupWizardVisible" @close="setupWizardVisible = false" />

    <!-- Toasts -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from './stores/workspace'
import { useFilesStore } from './stores/files'
import { useEditorStore } from './stores/editor'
import { useReviewsStore } from './stores/reviews'
import { useTasksStore } from './stores/tasks'
import { useLinksStore } from './stores/links'
import { useChatStore } from './stores/chat'
import { useReferencesStore } from './stores/references'
import { useTypstStore } from './stores/typst'
import { useLatexStore } from './stores/latex'
import { useKernelStore } from './stores/kernel'
import { useToastStore } from './stores/toast'
import { gitAdd, gitCommit, gitStatus } from './services/git'
import { checkForUpdate, downloadUpdate, installAndRestart, isAutoCheckEnabled } from './services/appUpdater'
import { isMod } from './platform'

import Header from './components/layout/Header.vue'
import Footer from './components/layout/Footer.vue'
import ResizeHandle from './components/layout/ResizeHandle.vue'
import LeftSidebar from './components/sidebar/LeftSidebar.vue'
import PaneContainer from './components/editor/PaneContainer.vue'
import RightPanel from './components/right/RightPanel.vue'
import Launcher from './components/Launcher.vue'
import VersionHistory from './components/VersionHistory.vue'
import Settings from './components/settings/Settings.vue'
import SetupWizard from './components/SetupWizard.vue'
import ToastContainer from './components/layout/ToastContainer.vue'

const workspace = useWorkspaceStore()
const filesStore = useFilesStore()
const editorStore = useEditorStore()
const reviews = useReviewsStore()
const tasks = useTasksStore()
const linksStore = useLinksStore()
const chatStore = useChatStore()
const referencesStore = useReferencesStore()
const typstStore = useTypstStore()
const latexStore = useLatexStore()
const kernelStore = useKernelStore()
const toastStore = useToastStore()

const footerRef = ref(null)
const headerRef = ref(null)
const leftSidebarRef = ref(null)
const rightPanelRef = ref(null)
const setupWizardVisible = ref(false)
const versionHistoryVisible = ref(false)
const versionHistoryFile = ref('')

const rightSidebarPreSnapWidth = ref(null)
let sidebarWidthSaveTimer = null

// Startup
onMounted(async () => {
  // Restore saved theme + font sizes
  workspace.restoreTheme()
  workspace.applyFontSizes()

  // Silent update check (non-blocking, respects user preference)
  if (isAutoCheckEnabled()) {
    silentUpdateCheck()
  }

  // Try to restore last workspace
  const lastWorkspace = localStorage.getItem('lastWorkspace')
  if (lastWorkspace) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const exists = await invoke('path_exists', { path: lastWorkspace })
      if (exists) {
        await openWorkspace(lastWorkspace)
        return
      }
    } catch (e) {
      // Fall through to launcher
    }
  }
  // No workspace to restore — launcher will show automatically (workspace.isOpen is false)
})

async function silentUpdateCheck() {
  const update = await checkForUpdate()
  if (!update?.available) return

  toastStore.show(`Shoulders ${update.version} available`, {
    type: 'info',
    duration: 0,
    action: {
      label: 'Download',
      onClick: () => startUpdateDownload(update),
    },
  })
}

async function startUpdateDownload(update) {
  toastStore.show('Downloading update...', { type: 'info', duration: 0 })
  const ok = await downloadUpdate(update, (pct) => {
    // Progress updates handled in Settings if open; toast stays as "Downloading..."
  })
  if (ok) {
    toastStore.show('Update ready. Restart to apply.', {
      type: 'success',
      duration: 0,
      action: {
        label: 'Restart',
        onClick: () => installAndRestart(),
      },
    })
  } else {
    toastStore.show('Download failed. Try again from Settings.', { type: 'error', duration: 5000 })
  }
}


async function pickWorkspace() {
  const { homeDir } = await import('@tauri-apps/api/path')
  const home = await homeDir()
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Open Workspace',
    defaultPath: home,
  })

  if (selected) {
    await openWorkspace(selected)
  }
}

async function openWorkspace(path) {
  // Close any currently open workspace first
  if (workspace.isOpen) {
    await closeWorkspace()
  }

  try {
    await workspace.openWorkspace(path)
    await filesStore.loadFileTree()
    editorStore.loadRecentFiles(path)
    await filesStore.startWatching()
    await reviews.startWatching()
    await linksStore.fullScan()
    await chatStore.loadSessions()
    await tasks.loadThreads()
    await referencesStore.loadLibrary()
    await typstStore.loadSettings()
  } catch (e) {
    console.error('Failed to open workspace:', e)
    await closeWorkspace()
    toastStore.show(`Failed to open workspace: ${e.message || e}`, { type: 'error', duration: 8000 })
    return
  }

  // Show setup wizard on first launch
  if (!localStorage.getItem('setupComplete')) {
    setupWizardVisible.value = true
  }
}

async function closeWorkspace() {
  editorStore.cleanup()
  filesStore.cleanup()
  reviews.cleanup()
  await kernelStore.shutdownAll()
  latexStore.cleanup()
  await workspace.closeWorkspace()
}


// Keyboard shortcuts
function handleKeydown(e) {
  // Cmd+S: Force save + commit
  if (isMod(e) && e.key === 's') {
    e.preventDefault()
    forceSaveAndCommit()
    return
  }

  // Cmd+O: Open folder
  if (isMod(e) && e.key === 'o') {
    e.preventDefault()
    pickWorkspace()
    return
  }

  // Cmd+N: New file
  if (isMod(e) && e.key === 'n') {
    e.preventDefault()
    leftSidebarRef.value?.createNewMarkdown()
    return
  }

  // Cmd+B: Toggle left sidebar (but not for DOCX/MD — they use Cmd+B for bold)
  if (isMod(e) && e.key === 'b') {
    const tab = editorStore.activeTab
    if (tab?.endsWith('.docx') || tab?.endsWith('.md')) return // let editor handle bold
    e.preventDefault()
    workspace.toggleLeftSidebar()
    return
  }

  // Cmd+J: Toggle right sidebar
  if (isMod(e) && e.key === 'j') {
    e.preventDefault()
    workspace.toggleRightSidebar()
    if (workspace.rightSidebarOpen) {
      setTimeout(() => {
        rightPanelRef.value?.focusChat()
      }, 150)
    }
    return
  }

  // Cmd+,: Settings
  if (isMod(e) && e.key === ',') {
    e.preventDefault()
    workspace.settingsOpen ? workspace.closeSettings() : workspace.openSettings()
    return
  }

  // Cmd+P: Focus header search
  if (isMod(e) && e.key === 'p') {
    e.preventDefault()
    headerRef.value?.focusSearch()
    return
  }

  // Cmd+\: Split vertical
  if (isMod(e) && e.key === '\\') {
    e.preventDefault()
    if (e.shiftKey) {
      editorStore.splitPane('horizontal')
    } else {
      editorStore.splitPane('vertical')
    }
    return
  }

  // Cmd+Option+Left/Right: Switch tabs
  if (isMod(e) && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    editorStore.switchTab(e.key === 'ArrowLeft' ? -1 : 1)
    return
  }

  // Cmd+W: Close tab
  if (isMod(e) && e.key === 'w') {
    e.preventDefault()
    const pane = editorStore.activePane
    if (pane && pane.activeTab) {
      editorStore.closeTab(pane.id, pane.activeTab)
    }
    return
  }

  // Cmd+Shift+C: Add task
  if (isMod(e) && e.shiftKey && (e.key === 'C' || e.key === 'c' || e.code === 'KeyC')) {
    e.preventDefault()
    startTask()
    return
  }

  // Cmd+Shift+L: Focus AI Chat (with optional selection capture)
  if (isMod(e) && e.shiftKey && (e.key === 'L' || e.key === 'l' || e.code === 'KeyL')) {
    e.preventDefault()
    // Capture selection from active editor if present
    const pane = editorStore.activePane
    if (pane && pane.activeTab) {
      let captured = false

      if (pane.activeTab.endsWith('.docx')) {
        // DOCX: read from SuperDoc's ProseMirror state
        const sd = editorStore.getAnySuperdoc(pane.activeTab)
        if (sd?.activeEditor) {
          const { from, to, empty } = sd.activeEditor.state.selection
          if (!empty) {
            const doc = sd.activeEditor.state.doc
            const text = doc.textBetween(from, to, '\n', ' ')
            const beforeStart = Math.max(1, from - 200)  // ProseMirror: pos 0 is before doc root
            const afterEnd = Math.min(doc.content.size, to + 200)
            const contextBefore = from > 1 ? doc.textBetween(beforeStart, from, '\n', ' ') : ''
            const contextAfter = to < doc.content.size ? doc.textBetween(to, afterEnd, '\n', ' ') : ''
            window.dispatchEvent(new CustomEvent('chat-with-selection', {
              detail: { file: pane.activeTab, text, contextBefore, contextAfter },
            }))
            captured = true
          }
        }
      }

      if (!captured) {
        // CodeMirror: read from EditorView state
        const view = editorStore.getEditorView(pane.id, pane.activeTab)
        if (view) {
          const sel = view.state.selection.main
          if (sel.from !== sel.to) {
            const text = view.state.sliceDoc(sel.from, sel.to)
            const beforeStart = Math.max(0, sel.from - 200)
            const afterEnd = Math.min(view.state.doc.length, sel.to + 200)
            const contextBefore = view.state.sliceDoc(beforeStart, sel.from)
            const contextAfter = view.state.sliceDoc(sel.to, afterEnd)
            window.dispatchEvent(new CustomEvent('chat-with-selection', {
              detail: { file: pane.activeTab, text, contextBefore, contextAfter },
            }))
          }
        }
      }
    }
    if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
    setTimeout(() => {
      rightPanelRef.value?.focusChat()
    }, 100)
    return
  }

  // Cmd+= / Cmd+-: Zoom in/out (CSS vars — DOCX page zoom is in its own toolbar)
  if (isMod(e) && (e.key === '=' || e.key === '+')) {
    e.preventDefault()
    workspace.zoomIn()
    return
  }
  if (isMod(e) && e.key === '-') {
    e.preventDefault()
    workspace.zoomOut()
    return
  }
  if (isMod(e) && e.key === '0') {
    e.preventDefault()
    workspace.resetZoom()
    return
  }

  // Cmd+F: Route to file tree filter when sidebar is focused
  if (isMod(e) && e.key === 'f') {
    const sidebarEl = document.querySelector('[data-sidebar="left"]')
    if (sidebarEl && sidebarEl.contains(document.activeElement)) {
      e.preventDefault()
      leftSidebarRef.value?.activateFilter()
      return
    }
    // Otherwise fall through to CodeMirror's built-in search
  }

  // Escape: Close modals
  if (e.key === 'Escape') {
    if (workspace.settingsOpen) {
      workspace.closeSettings()
      e.preventDefault()
      return
    }
    if (versionHistoryVisible.value) {
      versionHistoryVisible.value = false
      e.preventDefault()
      return
    }
  }
}

function handleOpenChat() {
  if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
  setTimeout(() => {
    rightPanelRef.value?.focusChat()
  }, 100)
}

function handleChatPrefill(e) {
  const { message } = e.detail || {}
  if (!message) return
  // Open right sidebar and focus chat, then set the input text
  if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
  setTimeout(() => {
    rightPanelRef.value?.focusChat()
    // Dispatch to chat input
    window.dispatchEvent(new CustomEvent('chat-set-input', { detail: { message } }))
  }, 150)
}

// Alt+Z: capture phase so it fires before CodeMirror consumes the event
// (Option+Z produces Ω on macOS, which CM would insert as text)
// Alt+Z: capture phase so it fires before CodeMirror consumes the event
// (Option+Z produces Ω on macOS, which CM would insert as text)
// e.code is physical-position-based: QWERTY='KeyZ', QWERTZ='KeyY'
function handleAltZ(e) {
  if (e.altKey && !e.metaKey && !e.ctrlKey
      && (e.code === 'KeyZ' || e.code === 'KeyY' || e.key.toLowerCase() === 'z')) {
    e.preventDefault()
    workspace.toggleSoftWrap()
  }
}

// Refresh file tree when window regains focus (catches files added via Finder etc.)
let lastFocusRefresh = 0
function handleVisibilityChange() {
  if (document.visibilityState === 'visible' && workspace.isOpen) {
    const now = Date.now()
    if (now - lastFocusRefresh < 2000) return
    lastFocusRefresh = now
    filesStore.loadFileTree()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('keydown', handleAltZ, true)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('open-tasks', handleOpenTasks)
  window.addEventListener('open-chat', handleOpenChat)
  window.addEventListener('chat-prefill', handleChatPrefill)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('keydown', handleAltZ, true)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('open-tasks', handleOpenTasks)
  window.removeEventListener('open-chat', handleOpenChat)
  window.removeEventListener('chat-prefill', handleChatPrefill)
  workspace.cleanup()
  filesStore.cleanup()
  reviews.cleanup()
})

// Force save + commit
async function forceSaveAndCommit() {
  if (!workspace.path) return

  try {
    // Save all open files by triggering a flush on every editor view
    const openFiles = editorStore.allOpenFiles
    for (const filePath of openFiles) {
      // Skip virtual paths (reference tabs)
      if (filePath.startsWith('ref:@')) continue
      // DOCX files: trigger binary save via custom event
      if (filePath.endsWith('.docx')) {
        window.dispatchEvent(new CustomEvent('docx-save-now', { detail: { path: filePath } }))
        continue
      }
      const content = filesStore.fileContents[filePath]
      if (content !== undefined) {
        await filesStore.saveFile(filePath, content)
      }
    }

    // Stage all changes (freezes the snapshot)
    await gitAdd(workspace.path)

    // Check if there are actually changes to commit
    const status = await gitStatus(workspace.path)
    const hasChanges = status && status.trim().length > 0

    if (!hasChanges) {
      footerRef.value?.showCenterMessage('All saved (no changes)')
      return
    }

    // Changes exist — show save confirmation in footer center
    const name = await footerRef.value?.beginSaveConfirmation()

    // Determine commit message
    let commitMessage
    if (name && name.trim()) {
      commitMessage = name.trim()
    } else {
      const now = new Date()
      const ts = now.toISOString().replace('T', ' ').slice(0, 16)
      commitMessage = `Save: ${ts}`
    }

    await gitCommit(workspace.path, commitMessage)
  } catch (e) {
    const errStr = String(e)
    if (errStr.includes('nothing to commit')) {
      footerRef.value?.showCenterMessage('All saved (no changes)')
    } else {
      console.error('Save+commit error:', e)
      footerRef.value?.showSaveMessage('Saved (commit failed)')
    }
  }
}

// Resize handlers
function debounceSidebarWidthSave() {
  clearTimeout(sidebarWidthSaveTimer)
  sidebarWidthSaveTimer = setTimeout(() => {
    localStorage.setItem('leftSidebarWidth', String(workspace.leftSidebarWidth))
    localStorage.setItem('rightSidebarWidth', String(workspace.rightSidebarWidth))
  }, 300)
}

function onLeftResize(e) {
  workspace.leftSidebarWidth = Math.max(160, Math.min(500, e.x))
  debounceSidebarWidthSave()
}

function onRightResize(e) {
  const maxWidth = Math.floor(window.innerWidth * 0.8)
  workspace.rightSidebarWidth = Math.max(200, Math.min(maxWidth, window.innerWidth - e.x))
  rightSidebarPreSnapWidth.value = null // clear snap memory on manual resize
  debounceSidebarWidthSave()
}

function onRightResizeSnap() {
  const halfWindow = Math.floor(window.innerWidth / 2)
  if (rightSidebarPreSnapWidth.value !== null) {
    // Snap back to previous width
    workspace.rightSidebarWidth = rightSidebarPreSnapWidth.value
    rightSidebarPreSnapWidth.value = null
  } else {
    // Store current width, snap to 50%
    rightSidebarPreSnapWidth.value = workspace.rightSidebarWidth
    workspace.rightSidebarWidth = halfWindow
  }
}

// Footer updates
function onCursorChange(pos) {
  footerRef.value?.setCursorPos(pos)
  if (pos.offset != null) editorStore.cursorOffset = pos.offset
}

function onEditorStats(stats) {
  footerRef.value?.setEditorStats(stats)
}

// Version history
function openVersionHistory(entry) {
  versionHistoryFile.value = entry.path
  versionHistoryVisible.value = true
}

// Task system
function startTask() {
  const pane = editorStore.activePane
  if (!pane || !pane.activeTab) return

  // Notebook path: delegate to NotebookEditor via event
  if (pane.activeTab.endsWith('.ipynb')) {
    window.dispatchEvent(new CustomEvent('notebook-cell-task', {
      detail: { path: pane.activeTab },
    }))
    if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
    return
  }

  // DOCX path: use SuperDoc editor
  if (pane.activeTab.endsWith('.docx')) {
    const sd = editorStore.getAnySuperdoc(pane.activeTab)
    if (!sd?.activeEditor) return
    const { from, to, empty } = sd.activeEditor.state.selection
    if (empty) { footerRef.value?.showSaveMessage('Select text first'); return }
    const selectedText = sd.activeEditor.state.doc.textBetween(from, to, '\n', ' ')
    const docSize = sd.activeEditor.state.doc.content.size
    const contextBefore = sd.activeEditor.state.doc.textBetween(Math.max(0, from - 5000), from, '\n', ' ')
    const contextAfter = sd.activeEditor.state.doc.textBetween(to, Math.min(docSize, to + 1000), '\n', ' ')
    const threadId = tasks.createThread(pane.activeTab, { from, to }, selectedText, null, null, { contextBefore, contextAfter })
    if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
    setTimeout(() => rightPanelRef.value?.focusTasks(threadId), 100)
    return
  }

  // CodeMirror path
  const view = editorStore.getEditorView(pane.id, pane.activeTab)
  if (!view) return

  const sel = view.state.selection.main
  if (sel.from === sel.to) {
    footerRef.value?.showSaveMessage('Select text first to add a task')
    return
  }

  const selectedText = view.state.sliceDoc(sel.from, sel.to)
  const docText = view.state.doc.toString()
  const contextBefore = docText.slice(Math.max(0, sel.from - 5000), sel.from)
  const contextAfter = docText.slice(sel.to, sel.to + 1000)
  const threadId = tasks.createThread(pane.activeTab, { from: sel.from, to: sel.to }, selectedText, null, null, { contextBefore, contextAfter })

  // Open right sidebar to tasks tab
  if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
  setTimeout(() => {
    rightPanelRef.value?.focusTasks(threadId)
  }, 100)
}

function handleOpenTasks(event) {
  const threadId = event.detail?.threadId
  if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
  setTimeout(() => {
    rightPanelRef.value?.focusTasks(threadId)
  }, 100)
}

</script>
