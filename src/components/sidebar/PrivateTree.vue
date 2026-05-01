<template>
  <div class="flex flex-col h-full" style="background: rgb(var(--bg-secondary));">
    <!-- Header -->
    <div
      class="flex items-center h-7 shrink-0 px-2 gap-1 select-none"
      :style="{ color: 'rgb(var(--fg-muted))', borderBottom: collapsed ? 'none' : '1px solid rgb(var(--border))' }"
    >
      <div class="flex items-center gap-1 cursor-pointer" @click="$emit('toggle-collapse')">
        <IconChevronRight :size="16" :class="{ 'rotate-90': !collapsed }" class="transition-transform duration-100" />
        <span class="text-[11px] font-medium uppercase tracking-wider">Private</span>
      </div>
      <div class="flex-1"></div>
      <IconLock :size="12" :stroke-width="1.5" style="color: rgb(var(--fg-muted)); opacity: 0.6;" />
      <div v-if="!collapsed" class="flex items-center gap-1 ml-1">
        <button
          ref="newBtnEl"
          class="h-5 flex items-center gap-0.5 rounded px-1 hover:opacity-80 text-[11px]"
          style="color: rgb(var(--fg-muted));"
          @click.stop="toggleNewMenu"
          title="New File or Folder">
          <IconPlus :size="12" :stroke-width="2" />
          <span>New</span>
        </button>
      </div>
    </div>

    <template v-if="!collapsed">
    <!-- Tree -->
    <div
      ref="treeContainer"
      class="flex-1 overflow-y-auto overflow-x-hidden py-1 outline-none"
      tabindex="0"
      @contextmenu.prevent="showContextMenuOnEmpty"
    >
      <!-- Inline input for new file at root level -->
      <div v-if="renaming.active && renaming.isNew && renaming.parentDir === privateDir"
        class="flex items-center py-0.5 px-1" style="padding-left: 28px;">
        <input
          ref="renameInput"
          v-model="renaming.value"
          class="w-full px-1 py-0.5 rounded border outline-none"
          style="background: rgb(var(--bg-tertiary)); color: rgb(var(--fg-primary)); border-color: rgb(var(--accent)); font-size: var(--ui-font-size);"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          @keydown.enter.stop="finishRename"
          @keydown.escape.stop="cancelRename"
          @blur="finishRename"
        />
      </div>

      <FileTreeItem
        v-for="entry in files.privateTree"
        :key="entry.path"
        :entry="entry"
        :depth="0"
        :renamingPath="renaming.active && !renaming.isNew ? renaming.originalPath : null"
        :newItemParent="renaming.active && renaming.isNew ? renaming.parentDir : null"
        :newItemValue="renaming.value"
        :newItemIsDir="renaming.isDir"
        :selectedPaths="selectedPaths"
        :dragOverDir="null"
        filterQuery=""
        :forceExpand="false"
        filterHighlightPath=""
        @open-file="openFile"
        @select-file="onSelectFile"
        @context-menu="showContextMenu"
        @start-rename-input="() => {}"
        @rename-input-change="(v) => renaming.value = v"
        @rename-input-submit="finishRename"
        @rename-input-cancel="cancelRename"
      />

      <div v-if="files.privateTree.length === 0 && !renaming.active" class="px-3 py-4 text-xs" style="color: rgb(var(--fg-muted));">
        Your private files live here
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
          <div class="context-menu-item" @click="handleNewMenuCreate({ ext: '.tex' })">
            <IconMath :size="14" :stroke-width="1.5" />
            <span class="flex-1">LaTeX</span>
            <span class="context-menu-ext">.tex</span>
          </div>
        </div>
      </div>
    </Teleport>
    </template>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useFilesStore } from '../../stores/files'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import FileTreeItem from './FileTreeItem.vue'
import ContextMenu from './ContextMenu.vue'
import {
  IconChevronRight, IconLock, IconPlus, IconFileText, IconMath,
  IconFilePlus, IconFolderPlus,
} from '@tabler/icons-vue'
import { ask } from '@tauri-apps/plugin-dialog'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
})
defineEmits(['toggle-collapse'])

const files = useFilesStore()
const editor = useEditorStore()
const workspace = useWorkspaceStore()

const privateDir = computed(() => workspace.privateDir)

const treeContainer = ref(null)
const renameInput = ref(null)
const newBtnEl = ref(null)
const newMenuOpen = ref(false)
const contextMenu = reactive({ show: false, x: 0, y: 0, entry: null })
const selectedPaths = reactive(new Set())

const renaming = reactive({
  active: false,
  value: '',
  originalPath: '',
  isNew: false,
  isDir: false,
  autoExtension: '',
  parentDir: '',
})

function openFile(path) {
  editor.openFile(path)
}

function onSelectFile({ path, event }) {
  selectedPaths.clear()
  selectedPaths.add(path)
}

const newMenuStyle = computed(() => {
  if (!newBtnEl.value) return {}
  const rect = newBtnEl.value.getBoundingClientRect()
  const menuWidth = 200
  const menuHeight = 200
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

async function createTypedFile(dir, ext) {
  if (!dir) return
  if (dir !== privateDir.value) {
    files.expandedDirs.add(dir)
  }

  const baseName = 'Untitled'
  let name = `${baseName}${ext}`
  let i = 2
  while (await invoke('path_exists', { path: `${dir}/${name}` })) {
    name = `${baseName} ${i}${ext}`
    i++
  }

  const path = await files.createFile(dir, name)
  if (path) {
    editor.openFile(path)
    await nextTick()
    handleRename({ name, path })
    renaming.autoExtension = ext
  }
}

function handleNewMenuCreate({ ext, isDir }) {
  newMenuOpen.value = false
  const dir = privateDir.value
  if (!dir) return

  if (isDir) {
    startInlineCreate(dir, true)
  } else if (!ext) {
    startInlineCreate(dir, false)
  } else {
    createTypedFile(dir, ext)
  }
}

function handleContextCreate({ ext, isDir }) {
  const dir = contextMenu.entry?.is_dir ? contextMenu.entry.path : privateDir.value
  if (!dir) return

  if (isDir) {
    startInlineCreate(dir, true)
  } else if (!ext) {
    startInlineCreate(dir, false)
  } else {
    createTypedFile(dir, ext)
  }
}

function startInlineCreate(dir, isDir) {
  if (dir !== privateDir.value) {
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
    if (dir === privateDir.value && renameInput.value) {
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

async function handleDuplicate(entry) {
  const newPath = await files.duplicatePath(entry.path)
  if (newPath) {
    const newName = newPath.split('/').pop()
    if (!entry.is_dir) {
      editor.openFile(newPath)
    }
    handleRename({ name: newName, path: newPath })
  }
}

let isFinishing = false
async function finishRename() {
  if (!renaming.active || isFinishing) return
  isFinishing = true

  try {
    let name = renaming.value.trim()
    if (!name) return

    if (renaming.isNew) {
      if (renaming.autoExtension && !name.includes('.')) {
        name = name + renaming.autoExtension
      }

      if (renaming.isDir) {
        await files.createFolder(renaming.parentDir, name)
      } else {
        const path = await files.createFile(renaming.parentDir, name)
        if (path) editor.openFile(path)
      }
    } else if (renaming.originalPath) {
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

async function revealInFinder(entry) {
  const isMacOS = /Mac|iPhone|iPad/.test(navigator.platform)
  const isWin = /Win/.test(navigator.platform)
  const dir = entry.is_dir ? entry.path : entry.path.substring(0, entry.path.lastIndexOf('/'))

  let cmd
  if (isMacOS) {
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
</script>
