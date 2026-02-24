<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Header -->
    <div
      class="flex items-center h-7 shrink-0 px-2 gap-1 select-none"
      :style="{ color: 'var(--fg-muted)', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }"
    >
      <div class="flex items-center gap-1 cursor-pointer" @click="$emit('toggle-collapse')">
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
          :style="{ transform: collapsed ? '' : 'rotate(90deg)', transition: 'transform 0.1s' }"
        >
          <path d="M6 4l4 4-4 4"/>
        </svg>
        <span class="text-[11px] font-medium uppercase tracking-wider">{{ workspaceName }}</span>
      </div>
      <div class="flex-1"></div>
      <div v-if="!collapsed" class="flex items-center gap-1">
        <button
          class="w-5 h-5 flex items-center justify-center rounded hover:opacity-80"
          style="color: var(--fg-muted);"
          @click.stop="collapseAllFolders"
          title="Collapse All Folders">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.27c.6.35 1 .99 1 1.73v5c0 2.21-1.79 4-4 4H6c-.74 0-1.38-.4-1.73-1H11c1.65 0 3-1.35 3-3zM9.5 7a.5.5 0 0 1 0 1h-4a.5.5 0 0 1 0-1z"/><path fill-rule="evenodd" d="M11 2c1.103 0 2 .897 2 2v7c0 1.103-.897 2-2 2H4c-1.103 0-2-.897-2-2V4c0-1.103.897-2 2-2zM4 3c-.551 0-1 .449-1 1v7c0 .552.449 1 1 1h7c.551 0 1-.448 1-1V4c0-.551-.449-1-1-1z" clip-rule="evenodd"/></svg>
        </button>
        <button
          class="w-5 h-5 flex items-center justify-center rounded hover:opacity-80"
          style="color: var(--fg-muted);"
          @click.stop="activateFilter"
          title="Filter Files (⌘F)">
          <IconSearch :size="14" :stroke-width="1.5" />
        </button>
        <button
          ref="newBtnEl"
          class="h-5 flex items-center gap-0.5 rounded px-1 hover:opacity-80 text-[11px]"
          style="color: var(--fg-muted);"
          @click.stop="toggleNewMenu"
          title="New File or Folder">
          <IconPlus :size="12" :stroke-width="2" />
          <span>New</span>
        </button>
      </div>
    </div>

    <template v-if="!collapsed">
    <!-- Filter input -->
    <div v-if="filterActive" class="flex items-center gap-1 px-2 pb-1">
      <div class="flex-1 flex items-center rounded border px-1"
        style="background: var(--bg-tertiary); border-color: var(--accent);">
        <IconSearch :size="12" :stroke-width="1.5" style="color: var(--fg-muted); flex-shrink: 0;" />
        <input
          ref="filterInputEl"
          v-model="filterQuery"
          class="flex-1 px-1 py-0.5 text-xs outline-none bg-transparent"
          style="color: var(--fg-primary);"
          placeholder="Filter files..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          @keydown="handleFilterKeydown"
        />
        <span v-if="filterQuery" class="text-[10px] tabular-nums shrink-0 mr-0.5" style="color: var(--fg-muted);">
          {{ filterMatches.length }}
        </span>
        <button class="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:opacity-80"
          style="color: var(--fg-muted);"
          @click="closeFilter">
          <IconX :size="12" :stroke-width="1.5" />
        </button>
      </div>
    </div>

    <!-- Tree -->
    <div
      ref="treeContainer"
      class="flex-1 overflow-y-auto overflow-x-hidden py-1 outline-none"
      tabindex="0"
      @contextmenu.prevent="showContextMenuOnEmpty"
      @keydown="handleTreeKeydown"
      @mouseup="onTreeMouseUp"
    >
      <!-- Inline input for new file at root level -->
      <div v-if="renaming.active && renaming.isNew && renaming.parentDir === workspace.path"
        class="flex items-center py-0.5 px-1" style="padding-left: 28px;">
        <input
          ref="renameInput"
          v-model="renaming.value"
          class="w-full px-1 py-0.5 rounded border outline-none"
          style="background: var(--bg-tertiary); color: var(--fg-primary); border-color: var(--accent); font-size: var(--ui-font-size);"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          @keydown.enter.stop="finishRename"
          @keydown.escape.stop="cancelRename"
          @blur="finishRename"
        />
      </div>

      <FileTreeItem
        v-for="entry in displayTree"
        :key="entry.path"
        :entry="entry"
        :depth="0"
        :renamingPath="renaming.active && !renaming.isNew ? renaming.originalPath : null"
        :newItemParent="renaming.active && renaming.isNew ? renaming.parentDir : null"
        :newItemValue="renaming.value"
        :newItemIsDir="renaming.isDir"
        :selectedPaths="selectedPaths"
        :dragOverDir="dragOverDir"
        :filterQuery="filterActive ? filterQuery : ''"
        :forceExpand="filterActive && !!filterQuery"
        :filterHighlightPath="filterHighlightPath"
        @open-file="openFile"
        @select-file="onSelectFile"
        @context-menu="showContextMenu"
        @start-rename-input="onStartRenameInput"
        @rename-input-change="(v) => renaming.value = v"
        @rename-input-submit="finishRename"
        @rename-input-cancel="cancelRename"
        @drag-start="onDragStart"
        @drag-over-dir="(dir) => dragOverDir = dir"
        @drag-leave-dir="onDragLeaveDir"
        @drop-on-dir="onDropOnDir"
      />

      <!-- External drop zone indicator (root level) -->
      <div v-if="externalDragOver" class="mx-2 my-1 py-2 rounded border-2 border-dashed text-center text-xs"
        style="border-color: var(--accent); color: var(--accent); opacity: 0.6;">
        Drop files here
      </div>

      <div v-if="filterActive && filterQuery && filterMatches.length === 0" class="px-3 py-4 text-xs" style="color: var(--fg-muted);">
        No matches
      </div>
      <div v-else-if="displayTree.length === 0 && !renaming.active" class="px-3 py-4 text-xs" style="color: var(--fg-muted);">
        No files yet
      </div>
    </div>

    <!-- Context menu -->
    <ContextMenu
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :entry="contextMenu.entry"
      :selectedCount="selectedPaths.size"
      @close="contextMenu.show = false"
      @create="handleContextCreate"
      @rename="handleRename"
      @duplicate="handleDuplicate"
      @delete="handleDelete"
      @delete-selected="handleDeleteSelected"
      @version-history="$emit('version-history', $event)"
      @reveal-in-finder="revealInFinder"
    />

    <!-- "+ New" dropdown menu -->
    <Teleport to="body">
      <div v-if="newMenuOpen" class="fixed inset-0 z-50" @click="newMenuOpen = false">
        <div class="context-menu" :style="newMenuStyle">
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: null, isDir: true })">
            <IconFolderPlus :size="14" :stroke-width="1.5" />
            <span class="flex-1">New Folder</span>
          </div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: null })">
            <IconFilePlus :size="14" :stroke-width="1.5" />
            <span class="flex-1">New File...</span>
          </div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.md' })">
            <IconFileText :size="14" :stroke-width="1.5" />
            <span class="flex-1">Markdown</span>
            <span class="context-menu-ext">.md</span>
          </div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.docx' })">
            <IconFileText :size="14" :stroke-width="1.5" />
            <span class="flex-1">Word</span>
            <span class="context-menu-ext">.docx</span>
          </div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.tex' })">
            <IconMath :size="14" :stroke-width="1.5" />
            <span class="flex-1">LaTeX</span>
            <span class="context-menu-ext">.tex</span>
          </div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.R' })">
            <IconCode :size="14" :stroke-width="1.5" />
            <span class="flex-1">R Script</span>
            <span class="context-menu-ext">.R</span>
          </div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.py' })">
            <IconBrandPython :size="14" :stroke-width="1.5" />
            <span class="flex-1">Python</span>
            <span class="context-menu-ext">.py</span>
          </div>
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.ipynb' })">
            <IconNotebook :size="14" :stroke-width="1.5" />
            <span class="flex-1">Notebook</span>
            <span class="context-menu-ext">.ipynb</span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Drag ghost -->
    <Teleport to="body">
      <div v-if="dragGhostVisible" class="tab-ghost" :style="{ left: dragGhostX + 'px', top: dragGhostY + 'px' }">
        {{ dragGhostLabel }}
      </div>
    </Teleport>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useFilesStore } from '../../stores/files'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import FileTreeItem from './FileTreeItem.vue'
import { isMod } from '../../platform'
import ContextMenu from './ContextMenu.vue'
import {
  IconSearch, IconX, IconPlus, IconFileText, IconNotebook, IconMath,
  IconCode, IconBrandPython, IconFilePlus, IconFolderPlus,
} from '@tabler/icons-vue'
import { ask } from '@tauri-apps/plugin-dialog'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
})
const emit = defineEmits(['version-history', 'toggle-collapse'])

const files = useFilesStore()
const editor = useEditorStore()
const workspace = useWorkspaceStore()

const workspaceName = computed(() => {
  if (!workspace.path) return 'Explorer'
  return workspace.path.split('/').pop()
})

const treeContainer = ref(null)
const renameInput = ref(null)
const filterInputEl = ref(null)
const newBtnEl = ref(null)
const newMenuOpen = ref(false)
const contextMenu = reactive({ show: false, x: 0, y: 0, entry: null })

// Filter state
const filterActive = ref(false)
const filterQuery = ref('')
const filterSelectedIdx = ref(0)
const renaming = reactive({
  active: false,
  value: '',
  originalPath: '',
  isNew: false,
  isDir: false,
  autoExtension: '', // e.g. '.md', '.docx' — auto-appended if user omits extension
  parentDir: '',
})

// Selection state
const selectedPaths = reactive(new Set())
let lastSelectedPath = null // anchor for shift+click range selection

// Flat list of visible paths (respects expanded/collapsed dirs) for shift+click range
function getVisiblePaths() {
  const result = []
  const walk = (entries) => {
    for (const entry of entries) {
      result.push(entry.path)
      if (entry.is_dir && entry.children && files.isDirExpanded(entry.path)) {
        walk(entry.children)
      }
    }
  }
  walk(displayTree.value)
  return result
}

// Internal drag state
const dragGhostVisible = ref(false)
const dragGhostX = ref(0)
const dragGhostY = ref(0)
const dragGhostLabel = ref('')
const dragOverDir = ref(null)
let draggedPaths = []

// External drag state
const externalDragOver = ref(false)

function openFile(path) {
  editor.openFile(path)
}

function onSelectFile({ path, event }) {
  if (event.shiftKey && lastSelectedPath) {
    // Range select: everything between anchor and clicked item
    try {
      const visible = getVisiblePaths()
      const anchorIdx = visible.indexOf(lastSelectedPath)
      const targetIdx = visible.indexOf(path)
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const from = Math.min(anchorIdx, targetIdx)
        const to = Math.max(anchorIdx, targetIdx)
        if (!isMod(event)) selectedPaths.clear()
        for (let i = from; i <= to; i++) {
          selectedPaths.add(visible[i])
        }
        return // don't update anchor on shift+click
      }
    } catch (e) {
      // Fall through to single select on any edge case
    }
  }

  if (isMod(event)) {
    // Toggle individual item
    if (selectedPaths.has(path)) {
      selectedPaths.delete(path)
    } else {
      selectedPaths.add(path)
    }
  } else if (!event.shiftKey) {
    // Single select
    selectedPaths.clear()
    selectedPaths.add(path)
  }

  lastSelectedPath = path
}

// Keyboard handling
function handleTreeKeydown(e) {
  if (renaming.active) return

  // Arrow Up: move cursor to previous visible item
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    navigateTree(-1)
    return
  }

  // Arrow Down: move cursor to next visible item
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    navigateTree(1)
    return
  }

  // Arrow Right: expand dir or move down
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    handleArrowRight()
    return
  }

  // Arrow Left: collapse dir or jump to parent
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    handleArrowLeft()
    return
  }

  // Space: open file or toggle dir
  if (e.key === ' ') {
    e.preventDefault()
    handleSpace()
    return
  }

  // Home: jump to first visible item
  if (e.key === 'Home') {
    e.preventDefault()
    const visible = getVisiblePaths()
    if (visible.length > 0) selectSinglePath(visible[0])
    return
  }

  // End: jump to last visible item
  if (e.key === 'End') {
    e.preventDefault()
    const visible = getVisiblePaths()
    if (visible.length > 0) selectSinglePath(visible[visible.length - 1])
    return
  }

  // Cmd+F: activate filter
  if (isMod(e) && e.key === 'f') {
    e.preventDefault()
    e.stopPropagation()
    activateFilter()
    return
  }

  // Enter: rename selected item
  if (e.key === 'Enter' && selectedPaths.size === 1) {
    e.preventDefault()
    const path = [...selectedPaths][0]
    const entry = findEntry(path)
    if (entry) handleRename(entry)
    return
  }

  // Delete / Backspace: delete selected items
  if ((e.key === 'Delete' || e.key === 'Backspace') && selectedPaths.size > 0) {
    e.preventDefault()
    handleDeleteSelected()
    return
  }
}

// Set selection to a single path and scroll it into view
function selectSinglePath(path) {
  selectedPaths.clear()
  selectedPaths.add(path)
  lastSelectedPath = path
  nextTick(() => {
    const el = treeContainer.value?.querySelector(`[data-path="${CSS.escape(path)}"]`)
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

// Arrow Up/Down: move through visible items
function navigateTree(delta) {
  const visible = getVisiblePaths()
  if (visible.length === 0) return

  const currentPath = lastSelectedPath || (selectedPaths.size > 0 ? [...selectedPaths][0] : null)
  let currentIdx = currentPath ? visible.indexOf(currentPath) : -1

  let nextIdx
  if (currentIdx === -1) {
    nextIdx = delta > 0 ? 0 : visible.length - 1
  } else {
    nextIdx = Math.max(0, Math.min(visible.length - 1, currentIdx + delta))
  }

  selectSinglePath(visible[nextIdx])
}

// Arrow Right: expand collapsed dir, or move to next item
function handleArrowRight() {
  const currentPath = lastSelectedPath || (selectedPaths.size > 0 ? [...selectedPaths][0] : null)
  if (!currentPath) { navigateTree(1); return }

  const entry = findEntry(currentPath)
  if (entry?.is_dir && !files.isDirExpanded(currentPath)) {
    files.expandedDirs.add(currentPath)
  } else {
    navigateTree(1)
  }
}

// Arrow Left: collapse expanded dir, or jump to parent
function handleArrowLeft() {
  const currentPath = lastSelectedPath || (selectedPaths.size > 0 ? [...selectedPaths][0] : null)
  if (!currentPath) return

  const entry = findEntry(currentPath)
  if (entry?.is_dir && files.isDirExpanded(currentPath)) {
    files.expandedDirs.delete(currentPath)
  } else {
    // Jump to parent directory
    const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'))
    if (parentPath && parentPath !== workspace.path && parentPath.startsWith(workspace.path)) {
      selectSinglePath(parentPath)
    }
  }
}

// Space: open file or toggle directory
function handleSpace() {
  const currentPath = lastSelectedPath || (selectedPaths.size > 0 ? [...selectedPaths][0] : null)
  if (!currentPath) return

  const entry = findEntry(currentPath)
  if (!entry) return

  if (entry.is_dir) {
    files.toggleDir(entry.path)
  } else {
    editor.openFile(entry.path)
  }
}

function findEntry(path) {
  const walk = (entries) => {
    for (const e of entries) {
      if (e.path === path) return e
      if (e.children) {
        const found = walk(e.children)
        if (found) return found
      }
    }
    return null
  }
  return walk(files.tree)
}

// --- Filter logic ---

function filterTreeEntries(entries, query) {
  const q = query.toLowerCase()
  const matchesPath = q.includes('/')
  const result = []
  for (const entry of entries) {
    const target = matchesPath ? entry.path.toLowerCase() : entry.name.toLowerCase()
    if (entry.is_dir) {
      if (target.includes(q)) {
        // Dir name matches — keep it with ALL children
        result.push(entry)
      } else if (entry.children) {
        const filteredChildren = filterTreeEntries(entry.children, query)
        if (filteredChildren.length > 0) {
          result.push({ ...entry, children: filteredChildren })
        }
      }
    } else {
      if (target.includes(q)) {
        result.push(entry)
      }
    }
  }
  return result
}

function collectFileMatches(entries, result) {
  for (const entry of entries) {
    if (entry.is_dir && entry.children) {
      collectFileMatches(entry.children, result)
    } else if (!entry.is_dir) {
      result.push(entry)
    }
  }
}

const filteredTree = computed(() => {
  if (!filterQuery.value) return files.tree
  return filterTreeEntries(files.tree, filterQuery.value)
})

const filterMatches = computed(() => {
  if (!filterQuery.value) return []
  const matches = []
  collectFileMatches(filteredTree.value, matches)
  return matches
})

const displayTree = computed(() => {
  return filterActive.value && filterQuery.value ? filteredTree.value : files.tree
})

const filterHighlightPath = computed(() => {
  if (!filterActive.value || !filterQuery.value || filterMatches.value.length === 0) return ''
  const idx = Math.min(filterSelectedIdx.value, filterMatches.value.length - 1)
  return filterMatches.value[idx]?.path || ''
})

watch(filterQuery, () => {
  filterSelectedIdx.value = 0
})

function activateFilter() {
  filterActive.value = true
  filterQuery.value = ''
  filterSelectedIdx.value = 0
  nextTick(() => {
    // rAF ensures the v-if element's template ref is assigned after DOM paint
    requestAnimationFrame(() => filterInputEl.value?.focus())
  })
}

function closeFilter() {
  filterActive.value = false
  filterQuery.value = ''
  filterSelectedIdx.value = 0
  // Return focus to tree container
  nextTick(() => {
    treeContainer.value?.focus()
  })
}

function handleFilterKeydown(e) {
  if (e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    closeFilter()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (filterMatches.value.length > 0) {
      filterSelectedIdx.value = (filterSelectedIdx.value + 1) % filterMatches.value.length
    }
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (filterMatches.value.length > 0) {
      filterSelectedIdx.value = (filterSelectedIdx.value - 1 + filterMatches.value.length) % filterMatches.value.length
    }
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    openFilteredMatch()
    return
  }
}

function openFilteredMatch() {
  if (filterMatches.value.length === 0) return
  const idx = Math.min(filterSelectedIdx.value, filterMatches.value.length - 1)
  const match = filterMatches.value[idx]
  if (match) {
    editor.openFile(match.path)
    closeFilter()
  }
}

// Internal drag handlers
function onDragStart({ path, event }) {
  // If dragging a selected item, drag all selected; otherwise just this one
  if (selectedPaths.has(path)) {
    draggedPaths = [...selectedPaths]
  } else {
    draggedPaths = [path]
  }
  const names = draggedPaths.map(p => p.split('/').pop())
  dragGhostLabel.value = names.length === 1 ? names[0] : `${names.length} items`
  dragGhostVisible.value = true
  dragGhostX.value = event.clientX
  dragGhostY.value = event.clientY
  document.body.classList.add('tab-dragging')
  window.dispatchEvent(new CustomEvent('filetree-drag-start', { detail: { paths: [...draggedPaths] } }))

  function onMouseMove(ev) {
    dragGhostX.value = ev.clientX
    dragGhostY.value = ev.clientY
  }
  function onMouseUp() {
    dragGhostVisible.value = false
    dragOverDir.value = null
    draggedPaths = []
    document.body.classList.remove('tab-dragging')
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    window.dispatchEvent(new CustomEvent('filetree-drag-end'))
  }
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onDragLeaveDir(dir) {
  if (dragOverDir.value === dir) dragOverDir.value = null
}

async function onDropOnDir(destDir) {
  if (!draggedPaths.length) return
  for (const srcPath of draggedPaths) {
    // Don't move a folder into itself
    if (destDir.startsWith(srcPath + '/') || destDir === srcPath) continue
    await files.movePath(srcPath, destDir)
  }
  dragGhostVisible.value = false
  dragOverDir.value = null
  draggedPaths = []
  selectedPaths.clear()
  document.body.classList.remove('tab-dragging')
}

// Drop onto empty tree area = move to workspace root
function onTreeMouseUp(event) {
  if (!draggedPaths.length || !workspace.path) return
  // Only handle if not already dropped on a folder (dragOverDir would be set)
  if (dragOverDir.value) return
  // Check that the drag is active
  if (!document.body.classList.contains('tab-dragging')) return
  onDropOnDir(workspace.path)
}

// Tauri native file drop handling
let unlistenDragOver = null
let unlistenDragDrop = null
let unlistenDragLeave = null
let pendingDropPaths = []

function isOverRefZone(position) {
  // Check if AddReferenceDialog is open (highest priority — it's modal)
  if (document.querySelector('[data-ref-dialog]')) return true
  // Check if cursor is within the reference panel bounds (more reliable than elementFromPoint)
  const refZone = document.querySelector('[data-ref-drop-zone]')
  if (!refZone) return false
  const rect = refZone.getBoundingClientRect()
  return position.x >= rect.left && position.x <= rect.right &&
         position.y >= rect.top && position.y <= rect.bottom
}

onMounted(async () => {
  unlistenDragOver = await listen('tauri://drag-over', (event) => {
    if (draggedPaths.length > 0) return // internal drag in progress
    const { position } = event.payload

    // Route to reference components if applicable
    if (isOverRefZone(position)) {
      externalDragOver.value = false
      dragOverDir.value = null
      window.dispatchEvent(new CustomEvent('ref-drag-over'))
      return
    }

    // Otherwise show FileTree drag state
    window.dispatchEvent(new CustomEvent('ref-drag-leave'))
    externalDragOver.value = true
    const dir = dirAtPosition(position.x, position.y)
    dragOverDir.value = dir
  })

  unlistenDragDrop = await listen('tauri://drag-drop', async (event) => {
    if (draggedPaths.length > 0) return
    const { paths, position } = event.payload
    externalDragOver.value = false

    if (!workspace.path || !paths || paths.length === 0) {
      dragOverDir.value = null
      return
    }

    // Route to reference components if applicable
    if (isOverRefZone(position)) {
      dragOverDir.value = null
      window.dispatchEvent(new CustomEvent('ref-drag-leave'))
      window.dispatchEvent(new CustomEvent('ref-file-drop', { detail: { paths } }))
      return
    }

    // Default: copy to workspace
    const destDir = dirAtPosition(position.x, position.y) || workspace.path
    dragOverDir.value = null

    let lastCopied = null
    for (const srcPath of paths) {
      const result = await files.copyExternalFile(srcPath, destDir)
      if (result) lastCopied = result
    }
    if (lastCopied) {
      files.expandedDirs.add(destDir)
      if (lastCopied.isDir) {
        files.expandedDirs.add(lastCopied.path)
      } else {
        editor.openFile(lastCopied.path)
      }
    }
  })

  unlistenDragLeave = await listen('tauri://drag-leave', () => {
    externalDragOver.value = false
    if (draggedPaths.length === 0) {
      dragOverDir.value = null
    }
    window.dispatchEvent(new CustomEvent('ref-drag-leave'))
  })
})

onUnmounted(() => {
  unlistenDragOver?.()
  unlistenDragDrop?.()
  unlistenDragLeave?.()
})

function dirAtPosition(x, y) {
  // Find the folder element under the cursor using data-dir-path attributes
  const el = document.elementFromPoint(x, y)
  if (!el) return null
  const dirEl = el.closest('[data-dir-path]')
  if (dirEl) return dirEl.dataset.dirPath
  // If over the tree container but not a folder, return workspace root
  if (treeContainer.value?.contains(el)) return workspace.path
  return null
}

function showContextMenu({ event, entry }) {
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.entry = entry
}

function showContextMenuOnEmpty(event) {
  if (event.target.closest('.group, .tree-item')) return
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.entry = null
}

// Computed style for the "+ New" dropdown (anchored below the button)
const newMenuStyle = computed(() => {
  if (!newBtnEl.value) return {}
  const rect = newBtnEl.value.getBoundingClientRect()
  const menuWidth = 200
  const menuHeight = 320
  const maxX = window.innerWidth - menuWidth - 8
  const maxY = window.innerHeight - menuHeight - 8
  return {
    left: Math.min(rect.left, maxX) + 'px',
    top: Math.min(rect.bottom + 2, maxY) + 'px',
  }
})

function toggleNewMenu() {
  newMenuOpen.value = !newMenuOpen.value
}

function collapseAllFolders() {
  files.expandedDirs.clear()
}

// Unified creation handler — creates a typed file and starts inline rename
async function createTypedFile(dir, ext) {
  if (!dir) return

  // Ensure the target directory is expanded so the new file is visible
  if (dir !== workspace.path) {
    files.expandedDirs.add(dir)
  }

  // Generate unique default name
  const baseName = 'Untitled'
  let name = `${baseName}${ext}`
  let i = 2
  while (files.flatFiles.some(f => f.name === name)) {
    name = `${baseName} ${i}${ext}`
    i++
  }

  const path = await files.createFile(dir, name)
  if (path) {
    editor.openFile(path)
    // Wait for Vue to render the new FileTreeItem before starting rename
    await nextTick()
    handleRename({ name, path })
    // Store auto-extension so finishRename can re-append if user removes it
    renaming.autoExtension = ext
  }
}

// Handle "+ New" header dropdown selection (target: workspace root)
function handleNewMenuCreate({ ext, isDir }) {
  newMenuOpen.value = false
  const dir = workspace.path
  if (!dir) return

  if (isDir) {
    startInlineCreate(dir, true)
  } else if (!ext) {
    // "Other..." — generic inline create
    startInlineCreate(dir, false)
  } else {
    createTypedFile(dir, ext)
  }
}

// Handle context menu creation (target: clicked folder or workspace root)
function handleContextCreate({ ext, isDir }) {
  const dir = contextMenu.entry?.is_dir ? contextMenu.entry.path : workspace.path
  if (!dir) return

  if (isDir) {
    startInlineCreate(dir, true)
  } else if (!ext) {
    startInlineCreate(dir, false)
  } else {
    createTypedFile(dir, ext)
  }
}

// Duplicate a file or folder
async function handleDuplicate(entry) {
  const newPath = await files.duplicatePath(entry.path)
  if (newPath) {
    const newName = newPath.split('/').pop()
    if (!entry.is_dir) {
      editor.openFile(newPath)
    }
    // Start inline rename so user can give it a proper name
    handleRename({ name: newName, path: newPath })
  }
}

function startInlineCreate(dir, isDir) {
  if (dir !== workspace.path) {
    files.expandedDirs.add(dir)
  }

  renaming.active = true
  renaming.isNew = true
  renaming.isDir = isDir
  renaming.autoExtension = ''
  renaming.parentDir = dir
  renaming.value = isDir ? 'new-folder' : ''
  renaming.originalPath = ''

  nextTick(() => {
    if (dir === workspace.path && renameInput.value) {
      renameInput.value.select()
    }
  })
}

function handleRename(entry) {
  renaming.active = true
  renaming.isNew = false
  renaming.autoExtension = ''
  renaming.value = entry.name
  renaming.originalPath = entry.path
  renaming.parentDir = ''
}

function onStartRenameInput() {
  // Called by FileTreeItem when the inline input is mounted
}

let isFinishing = false
async function finishRename() {
  if (!renaming.active || isFinishing) return
  isFinishing = true

  try {
    let name = renaming.value.trim()
    if (!name) {
      return
    }

    if (renaming.isNew) {
      // Auto-append extension if user omits it (for typed file creation)
      if (renaming.autoExtension && !name.includes('.')) {
        name = name + renaming.autoExtension
      }

      if (renaming.isDir) {
        await files.createFolder(renaming.parentDir, name)
      } else {
        const path = await files.createFile(renaming.parentDir, name)
        if (path) {
          editor.openFile(path)
        }
      }
    } else if (renaming.originalPath) {
      // Auto-append extension if user omits it (for typed file rename after creation)
      if (renaming.autoExtension && !name.includes('.')) {
        name = name + renaming.autoExtension
      }
      const dir = renaming.originalPath.substring(0, renaming.originalPath.lastIndexOf('/'))
      const newPath = `${dir}/${name}`
      if (newPath !== renaming.originalPath) {
        await files.renamePath(renaming.originalPath, newPath)
      }
    }
  } catch (e) {
    console.error('Rename failed:', e)
  } finally {
    cancelRename()
    isFinishing = false
  }
}

function cancelRename() {
  renaming.active = false
  renaming.value = ''
  renaming.originalPath = ''
}

async function handleDelete(entry) {
  const yes = await ask(`Delete "${entry.name}"?`, { title: 'Confirm Delete', kind: 'warning' })
  if (yes) {
    await files.deletePath(entry.path)
  }
}

async function handleDeleteSelected() {
  const paths = [...selectedPaths]
  if (paths.length === 0) return
  const msg = paths.length === 1
    ? `Delete "${paths[0].split('/').pop()}"?`
    : `Delete ${paths.length} items?`
  const yes = await ask(msg, { title: 'Confirm Delete', kind: 'warning' })
  if (yes) {
    for (const path of paths) {
      await files.deletePath(path)
    }
    selectedPaths.clear()
  }
}

async function revealInFinder(entry) {
  const isMacOS = /Mac|iPhone|iPad/.test(navigator.platform)
  const isWin = /Win/.test(navigator.platform)
  const dir = entry.is_dir ? entry.path : entry.path.substring(0, entry.path.lastIndexOf('/'))

  let cmd
  if (isMacOS) {
    // -R reveals and selects the file in Finder
    cmd = entry.is_dir ? `open "${entry.path}"` : `open -R "${entry.path}"`
  } else if (isWin) {
    cmd = entry.is_dir ? `explorer "${entry.path}"` : `explorer /select,"${entry.path}"`
  } else {
    cmd = `xdg-open "${dir}"`
  }

  try {
    await invoke('run_shell_command', { cwd: dir, command: cmd })
  } catch (e) {
    console.error('Failed to reveal in file manager:', e)
  }
}

defineExpose({
  activateFilter,
  createNewMarkdown() {
    let targetDir = workspace.path

    if (selectedPaths.size > 0) {
      const selectedPath = lastSelectedPath || [...selectedPaths][0]
      const entry = findEntry(selectedPath)
      if (entry) {
        if (entry.is_dir) {
          targetDir = entry.path
          files.expandedDirs.add(targetDir)
        } else {
          targetDir = selectedPath.substring(0, selectedPath.lastIndexOf('/'))
        }
      }
    }

    createTypedFile(targetDir, '.md')
  },
})
</script>
