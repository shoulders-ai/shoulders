<template>
  <div class="h-screen w-screen overflow-hidden bg-surface">
    <!-- Popout editor window -->
    <PopoutEditor v-if="isPopout" :filePath="popoutFilePath" :workspacePath="popoutWorkspacePath" />

    <!-- Launcher (no workspace open) -->
    <Launcher
      v-else-if="!workspace.isOpen"
      :auto-clone="pendingClone"
      :auto-team-action="pendingTeamAction"
      @open-folder="pickWorkspace"
      @open-workspace="openWorkspace"
      @team-created="handleTeamCreated"
    />

    <!-- Workspace layout -->
    <div v-else class="flex flex-col h-full">
      <Header
        @open-folder="pickWorkspace"
        @open-workspace="openWorkspace"
        @clone="handleCloneFromHeader"
        @create-team="teamCreateDialogVisible = true"
        @join-team="teamJoinDialogVisible = true"
      />

      <!-- Content row -->
      <div class="flex flex-1 overflow-hidden">
        <!-- Left sidebar (only when open — no rail) -->
        <template v-if="workspace.leftSidebarOpen">
          <div data-sidebar="left" class="shrink-0 h-full overflow-hidden bg-surface-secondary"
            :style="{ width: workspace.leftSidebarWidth + 'px' }">
            <LeftSidebar ref="leftSidebarRef" @version-history="openVersionHistory" />
          </div>
          <ResizeHandle direction="vertical" @resize="onLeftResize" @dblclick="workspace.toggleLeftSidebar()" />
        </template>

        <!-- Main panel -->
        <div class="flex-1 flex flex-col overflow-hidden bg-surface" style="min-width: 200px;">
          <div class="flex-1 overflow-hidden">
            <PaneContainer
              :node="editorStore.paneTree"
              @cursor-change="onCursorChange"
              @editor-stats="onEditorStats"
            />
          </div>
          <ResizeHandle v-if="workspace.bottomPanelOpen" direction="horizontal" @resize="onBottomResize" />
          <BottomPanel ref="bottomPanelRef" />
        </div>

        <!-- Right resize handle -->
        <ResizeHandle v-if="workspace.rightSidebarOpen" direction="vertical" @resize="onRightResize" @dblclick="onRightResizeSnap" />

        <!-- Right sidebar -->
        <div v-show="workspace.rightSidebarOpen" class="shrink-0 h-full overflow-hidden bg-surface-secondary" :style="{ width: workspace.rightSidebarWidth + 'px' }">
          <RightPanel ref="rightPanelRef" />
        </div>
      </div>

      <Footer ref="footerRef" />
    </div>

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

    <!-- Search Dialog -->
    <SearchDialog
      :visible="searchDialogOpen"
      @close="searchDialogOpen = false"
      @select-file="handleSearchSelectFile"
      @select-citation="handleSearchSelectCitation"
      @select-chat="handleSearchSelectChat"
    />


    <!-- Snapshot Dialog (Cmd+S save naming) -->
    <SnapshotDialog :visible="snapshotDialogVisible" @resolve="handleSnapshotResolve" />

    <!-- Team Create Dialog (inline from workspace switcher) -->
    <TeamCreateDialog
      :visible="teamCreateDialogVisible"
      @close="teamCreateDialogVisible = false"
      @open-workspace="openWorkspace"
      @team-created="handleTeamCreated"
    />

    <!-- Team Invite Dialog (shown after creating a team workspace) -->
    <TeamInviteDialog
      :visible="teamInviteDialogVisible"
      :invite-token="teamInviteToken"
      @close="teamInviteDialogVisible = false"
    />

    <!-- Team Join Dialog (inline join from workspace switcher) -->
    <TeamJoinDialog
      :visible="teamJoinDialogVisible"
      @close="teamJoinDialogVisible = false"
      @open-workspace="openWorkspace"
    />

    <!-- Toasts -->
    <ToastContainer />
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from './stores/workspace'
import { useFilesStore } from './stores/files'
import { useEditorStore } from './stores/editor'
import { useReviewsStore } from './stores/reviews'
import { useCommentsStore } from './stores/comments'
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
import { isNewTab, getViewerType, isMarkdown } from './utils/fileTypes'
import { useAISidebarStore } from './stores/aiSidebar'
import { useWorkflowsStore } from './stores/workflows'

import ResizeHandle from './components/layout/ResizeHandle.vue'
import Header from './components/layout/Header.vue'
import Footer from './components/layout/Footer.vue'
import LeftSidebar from './components/sidebar/LeftSidebar.vue'
import PaneContainer from './components/editor/PaneContainer.vue'
import RightPanel from './components/panel/RightPanel.vue'
import Launcher from './components/Launcher.vue'
import VersionHistory from './components/VersionHistory.vue'
import Settings from './components/settings/Settings.vue'
import SetupWizard from './components/SetupWizard.vue'
import ToastContainer from './components/layout/ToastContainer.vue'
import BottomPanel from './components/layout/BottomPanel.vue'
import SearchDialog from './components/layout/SearchDialog.vue'
import SnapshotDialog from './components/layout/SnapshotDialog.vue'
import PopoutEditor from './components/editor/PopoutEditor.vue'
import TeamCreateDialog from './components/TeamCreateDialog.vue'
import TeamInviteDialog from './components/TeamInviteDialog.vue'
import TeamJoinDialog from './components/TeamJoinDialog.vue'

// Popout window detection (query params set by popout service)
const _urlParams = new URLSearchParams(window.location.search)
const popoutFilePath = _urlParams.get('popout')
const popoutWorkspacePath = _urlParams.get('workspace')
const isPopout = !!popoutFilePath

const workspace = useWorkspaceStore()
const filesStore = useFilesStore()
const editorStore = useEditorStore()
const reviews = useReviewsStore()
const commentsStore = useCommentsStore()
const linksStore = useLinksStore()
const chatStore = useChatStore()
const aiSidebar = useAISidebarStore()
const workflowsStore = useWorkflowsStore()
const referencesStore = useReferencesStore()
const typstStore = useTypstStore()
const latexStore = useLatexStore()
const kernelStore = useKernelStore()
const toastStore = useToastStore()

const leftSidebarRef = ref(null)
const rightPanelRef = ref(null)
const bottomPanelRef = ref(null)
const footerRef = ref(null)
const setupWizardVisible = ref(false)
const versionHistoryVisible = ref(false)
const versionHistoryFile = ref('')
const searchDialogOpen = ref(false)
const snapshotDialogVisible = ref(false)

const rightSidebarPreSnapWidth = ref(null)
const pendingClone = ref(false)
const pendingTeamAction = ref(null)
const teamInviteDialogVisible = ref(false)
const teamInviteToken = ref('')
const teamCreateDialogVisible = ref(false)
const teamJoinDialogVisible = ref(false)
let sidebarWidthSaveTimer = null

let unlistenPopoutClosed = null

// Startup
onMounted(async () => {
  if (isPopout) return // PopoutEditor handles its own init

  // Listen for popout windows being closed — re-add their tabs
  import('@tauri-apps/api/event').then(({ listen }) => {
    listen('popout-closed', (event) => {
      const { filePath } = event.payload || {}
      if (filePath && workspace.isOpen) {
        editorStore.openFile(filePath)
      }
    }).then(fn => { unlistenPopoutClosed = fn })
  })

  // Telemetry: app launched
  import('./services/telemetry').then(({ events }) => events.appOpen())

  // Restore saved theme + font sizes + prose font
  workspace.restoreTheme()
  workspace.applyFontSizes()
  workspace.restoreProseFont()

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
  // The original toast is auto-dismissed on click, so show a new one for progress.
  const dlToastId = toastStore.show('Downloading update...', { type: 'info', duration: 0 })
  const ok = await downloadUpdate(update)
  toastStore.dismiss(dlToastId)
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

async function handleCloneFromHeader() {
  pendingClone.value = true
  if (workspace.isOpen) {
    await closeWorkspace()
  }
}

function handleTeamCreated({ inviteToken }) {
  teamInviteToken.value = inviteToken
  teamInviteDialogVisible.value = true
}

async function openWorkspace(path) {
  // Close any currently open workspace first
  if (workspace.isOpen) {
    await closeWorkspace()
  }

  try {
    await workspace.openWorkspace(path)
    pendingClone.value = false
    editorStore.loadRecentFiles(path)

    // Critical path: file tree + editor restore in parallel → UI is usable immediately
    await Promise.all([
      filesStore.loadFileTree(),
      editorStore.restoreEditorState(),
    ])
    if (editorStore.allOpenFiles.size === 0) editorStore.openNewTab()

    // Background: don't block the editor opening
    filesStore.startWatching()
    reviews.startWatching()
    linksStore.fullScan()
    chatStore.loadSessions()
    workflowsStore.loadAllRunsMeta()

    const { usePromptsStore } = await import('./stores/prompts')
    usePromptsStore().loadPrompts()
    aiSidebar.reset()
    commentsStore.loadComments()
    referencesStore.loadLibrary()
    typstStore.loadSettings()
    import('./stores/docxExport').then(({ useDocxExportStore }) => useDocxExportStore().loadSettings())
    import('./stores/quarto').then(({ useQuartoStore }) => {
      const quartoStore = useQuartoStore()
      quartoStore.checkAvailability()
      quartoStore.loadSettings()
    })

    // Zotero: init + auto-sync (non-blocking)
    import('./services/zoteroSync').then(({ initZotero }) => initZotero())

    // Word Bridge: init event handlers + start server (non-blocking)
    import('./services/wordBridge').then(({ initWordBridge, connect }) => {
      initWordBridge()
      connect()
    })
    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke('addin_start').catch(e => console.warn('[wordBridge] Server start failed:', e))
    })

    // Tool Server: local HTTP API for Claude Code and other CLI tools (non-blocking)
    if (localStorage.getItem('toolServerEnabled') !== 'false') {
      Promise.all([
        import('./services/toolServer'),
        import('@tauri-apps/api/core'),
      ]).then(([{ initToolServer, writeToolDocs }, { invoke: inv }]) => {
        initToolServer(workspace)
        inv('tool_server_start').then(({ port, token }) => {
          writeToolDocs(workspace, port, token)
        }).catch(e => console.warn('[toolServer] Start failed:', e))
      })
    }
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
  // Word Bridge cleanup
  import('./services/wordBridge').then(({ disconnect }) => disconnect())
  import('@tauri-apps/api/core').then(({ invoke }) => invoke('addin_stop').catch(() => {}))

  // Tool Server cleanup
  import('./services/toolServer').then(({ destroyToolServer }) => destroyToolServer())
  import('@tauri-apps/api/core').then(({ invoke }) => invoke('tool_server_stop').catch(() => {}))

  // Save editor state before cleanup resets the pane tree
  await editorStore.saveEditorStateImmediate()
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

  // Cmd+N: Open AI sidebar → New screen → focus chat input
  if (isMod(e) && e.key === 'n') {
    e.preventDefault()
    aiSidebar.openSidebar()
    aiSidebar.goToNew()
    nextTick(() => rightPanelRef.value?.focusAI())
    return
  }

  // Cmd+B: Toggle left sidebar (unless editor is focused on a file that uses Cmd+B for bold)
  if (isMod(e) && e.key === 'b') {
    const tab = editorStore.activeTab
    const editorHasBold = tab && (isMarkdown(tab) || tab.endsWith('.docx'))
    const focusInEditor = document.activeElement?.closest('.cm-editor, .presentation-editor')
    if (editorHasBold && focusInEditor) return // let editor handle bold
    e.preventDefault()
    workspace.toggleLeftSidebar()
    return
  }

  // Cmd+T: New tab page in current pane
  if (isMod(e) && e.key === 't') {
    e.preventDefault()
    editorStore.openNewTab()
    return
  }

  // Cmd+J: Toggle AI sidebar. When opening, focus current view.
  if (isMod(e) && e.key === 'j') {
    e.preventDefault()
    if (workspace.rightSidebarOpen) {
      workspace.rightSidebarOpen = false
      localStorage.setItem('rightSidebarOpen', 'false')
    } else {
      aiSidebar.openSidebar()
      nextTick(() => rightPanelRef.value?.focusAI())
    }
    return
  }

  // Cmd+,: Settings
  if (isMod(e) && e.key === ',') {
    e.preventDefault()
    workspace.settingsOpen ? workspace.closeSettings() : workspace.openSettings()
    return
  }

  // Cmd+P: Open search dialog
  if (isMod(e) && e.key === 'p') {
    e.preventDefault()
    searchDialogOpen.value = true
    return
  }

  // Cmd+Option+Left/Right: Switch tabs
  if (isMod(e) && e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    e.preventDefault()
    editorStore.switchTab(e.key === 'ArrowLeft' ? -1 : 1)
    return
  }

  // Cmd+W: Close tab, or close empty pane
  if (isMod(e) && e.key === 'w') {
    e.preventDefault()
    const pane = editorStore.activePane
    if (!pane) return
    if (pane.activeTab) {
      editorStore.closeTab(pane.id, pane.activeTab)
    } else {
      // No tabs — collapse pane if it's not the root
      const parent = editorStore.findParent(editorStore.paneTree, pane.id)
      if (parent) editorStore.collapsePane(pane.id)
    }
    return
  }

  // Cmd+Shift+L: Add comment on selection
  if (isMod(e) && e.shiftKey && (e.key === 'L' || e.key === 'l' || e.code === 'KeyL')) {
    e.preventDefault()

    const pane = editorStore.activePane
    if (!pane || !pane.activeTab) return

    // Only for text files
    const vt = getViewerType(pane.activeTab)
    if (vt !== 'text') return

    // Get the editor view and check for selection
    const view = editorStore.getEditorView(pane.id, pane.activeTab)
    if (!view) return
    const sel = view.state.selection.main
    if (sel.from === sel.to) return // no selection

    // Auto-show margin
    if (!commentsStore.isMarginVisible(pane.activeTab)) {
      commentsStore.toggleMargin(pane.activeTab)
    }

    // Dispatch event for EditorPane to handle
    window.dispatchEvent(new CustomEvent('comment-create', {
      detail: { paneId: pane.id }
    }))
    return
  }

  // Ctrl+`: Toggle terminal panel
  if (e.ctrlKey && !e.metaKey && e.key === '`') {
    e.preventDefault()
    workspace.toggleBottomPanel()
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
    if (searchDialogOpen.value) {
      searchDialogOpen.value = false
      e.preventDefault()
      return
    }
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

function handleChatPrefill(e) {
  const { message } = e.detail || {}
  if (!message) return
  aiSidebar.focusSidebarChat(null, { prefill: message })
}

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

function handleFocusSearch() { searchDialogOpen.value = true }
function handleNewFile() { leftSidebarRef.value?.createNewFile('.md') }

// Search dialog handlers
function handleSearchSelectFile(path) {
  editorStore.openFile(path)
}

function handleSearchSelectCitation(key) {
  const pane = editorStore.activePane
  if (pane?.activeTab) {
    const view = editorStore.getEditorView(pane.id, pane.activeTab)
    if (view) {
      const cite = `[@${key}]`
      const pos = view.state.selection.main.head
      view.dispatch({
        changes: { from: pos, to: pos, insert: cite },
        selection: { anchor: pos + cite.length },
      })
      view.focus()
    }
  }
}

function handleSearchSelectChat(sessionId) {
  aiSidebar.focusSidebarChat(sessionId)
}

// Editor stats → footer
function onEditorStats(stats) {
  footerRef.value?.setEditorStats(stats)
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
  if (isPopout) return
  document.addEventListener('keydown', handleKeydown)
  document.addEventListener('keydown', handleAltZ, true)
  document.addEventListener('visibilitychange', handleVisibilityChange)
  window.addEventListener('chat-prefill', handleChatPrefill)
  window.addEventListener('app:focus-search', handleFocusSearch)
  window.addEventListener('app:new-file', handleNewFile)
})

onUnmounted(() => {
  unlistenPopoutClosed?.()
  if (isPopout) return
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('keydown', handleAltZ, true)
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  window.removeEventListener('chat-prefill', handleChatPrefill)
  window.removeEventListener('app:focus-search', handleFocusSearch)
  window.removeEventListener('app:new-file', handleNewFile)
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
      // Skip virtual paths (reference tabs, chat tabs, new tabs)
      if (filePath.startsWith('ref:@') || filePath.startsWith('chat:') || filePath.startsWith('newtab:')) continue
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
      toastStore.show('All saved (no changes)', { type: 'info', duration: 2000 })
      return
    }

    // Auto-commit with timestamp, then offer snapshot naming
    const now = new Date()
    const ts = now.toISOString().replace('T', ' ').slice(0, 16)
    const commitMessage = `Save: ${ts}`

    await gitCommit(workspace.path, commitMessage)
    snapshotDialogVisible.value = true
  } catch (e) {
    const errStr = String(e)
    if (errStr.includes('nothing to commit')) {
      toastStore.show('All saved (no changes)', { type: 'info', duration: 2000 })
    } else {
      console.error('Save+commit error:', e)
      toastStore.show('Saved (commit failed)', { type: 'warning', duration: 3000 })
    }
  }
}

// Snapshot dialog resolve: rename commit if user provides a name, otherwise auto-named commit stands
async function handleSnapshotResolve(name) {
  snapshotDialogVisible.value = false
  if (!name || !workspace.path) return
  try {
    // Amend the last commit message with the user-provided snapshot name
    const safeName = name.replace(/"/g, '\\"')
    const { invoke: inv } = await import('@tauri-apps/api/core')
    await inv('run_shell_command', { cwd: workspace.path, command: `git commit --amend -m "${safeName}"` })
    toastStore.show(`Snapshot: ${name}`, { type: 'success', duration: 2000 })
  } catch (e) {
    console.warn('Failed to rename snapshot:', e)
    toastStore.show('Saved (rename failed)', { type: 'warning', duration: 2000 })
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

function onBottomResize(e) {
  workspace.setBottomPanelHeight(Math.max(100, Math.min(600, window.innerHeight - e.y)))
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

// Cursor position update
function onCursorChange(pos) {
  if (pos.offset != null) editorStore.cursorOffset = pos.offset
}

// Version history
function openVersionHistory(entry) {
  versionHistoryFile.value = entry.path
  versionHistoryVisible.value = true
}
</script>
