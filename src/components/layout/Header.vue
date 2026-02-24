<template>
  <header class="grid items-center select-none shrink-0 relative"
    data-tauri-drag-region
    :style="{
      gridTemplateColumns: '1fr auto 1fr',
      background: 'var(--bg-secondary)',
      borderBottom: '1px solid var(--border)',
      paddingLeft: isMac ? '78px' : '12px',
      paddingRight: '8px',
      height: '38px',
    }"
  >
    <!-- Left: hamburger menu -->
    <div class="flex items-center" data-tauri-drag-region>
      <button
        ref="menuBtnRef"
        class="w-7 h-7 flex items-center justify-center rounded-md border-none bg-transparent cursor-pointer transition-colors"
        style="color: var(--fg-muted);"
        title="Menu"
        @click="toggleMenu"
        @mouseover="$event.currentTarget.style.background='var(--bg-hover)';$event.currentTarget.style.color='var(--fg-primary)'"
        @mouseout="$event.currentTarget.style.background='transparent';$event.currentTarget.style.color='var(--fg-muted)'"
      >
        <IconMenu2 :size="16" :stroke-width="1.5" />
      </button>
    </div>

    <!-- Hamburger dropdown -->
    <Teleport to="body">
      <div v-if="menuOpen" ref="menuDropdownRef" class="context-menu" :style="menuStyle">
        <div class="context-menu-item" style="font-size: 12px;" @click="doOpenFolder">
          Open Folder...
          <span class="context-menu-ext" style="opacity: 1;">{{ modKey }}+O</span>
        </div>
        <template v-if="recents.length">
          <div class="context-menu-separator"></div>
          <div class="context-menu-section">Recent</div>
          <div
            v-for="r in recents"
            :key="r.path"
            class="context-menu-item"
            style="font-size: 12px;"
            @click="doOpenWorkspace(r.path)"
          >
            {{ r.name }}
          </div>
        </template>
        <template v-if="workspace.isOpen">
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" style="font-size: 12px;" @click="doCloseFolder">
            Close Folder
          </div>
        </template>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" style="font-size: 12px;" @click="doSettings">
          Settings...
          <span class="context-menu-ext" style="opacity: 1;">{{ modKey }}+,</span>
        </div>
      </div>
    </Teleport>

    <!-- Center: search input -->
    <div class="relative">
      <div class="flex items-center rounded-md"
        :style="{
          background: 'var(--bg-primary)',
          border: '1px solid ' + (searchFocused ? 'var(--fg-muted)' : 'var(--border)'),
          width: '320px',
          height: '26px',
          transition: 'border-color 150ms',
        }"
      >
        <IconSearch :size="13" :stroke-width="1.5"
          class="shrink-0 ml-2"
          :style="{ color: searchFocused ? 'var(--fg-secondary)' : 'var(--fg-muted)' }" />
        <input
          ref="searchInputRef"
          v-model="query"
          class="flex-1 bg-transparent border-none outline-none px-2"
          :style="{
            color: 'var(--fg-primary)',
            fontSize: '12px',
            fontFamily: 'inherit',
            height: '24px',
          }"
          :placeholder="searchPlaceholder"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onSearchKeydown"
        />
        <kbd v-if="!searchFocused && !query"
          class="mr-2 shrink-0"
          style="font-size: 9px; padding: 0px 4px; line-height: 16px;">
          {{ modKey }}+P
        </kbd>
      </div>

      <!-- Search results dropdown -->
      <SearchResults
        v-if="showResults"
        ref="searchResultsRef"
        :query="query"
        @select-file="onSelectFile"
        @select-citation="onSelectCitation"
        @mousedown.prevent
      />
    </div>

    <!-- Right: sidebar toggles + settings -->
    <div class="flex items-center gap-0.5 justify-self-end" data-tauri-drag-region>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-md border-none bg-transparent cursor-pointer transition-colors"
        :style="{ color: workspace.leftSidebarOpen ? 'var(--fg-primary)' : 'var(--fg-muted)' }"
        @click="workspace.toggleLeftSidebar()"
        :title="`Toggle sidebar (${modKey}+B)`"
        @mouseover="$event.currentTarget.style.background='var(--bg-hover)'"
        @mouseout="$event.currentTarget.style.background='transparent'"
      >
        <component
          :is="workspace.leftSidebarOpen ? IconLayoutSidebarFilled : IconLayoutSidebar"
          :size="16" :stroke-width="1.5"
        />
      </button>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-md border-none bg-transparent cursor-pointer transition-colors"
        :style="{ color: workspace.rightSidebarOpen ? 'var(--fg-primary)' : 'var(--fg-muted)' }"
        @click="workspace.toggleRightSidebar()"
        :title="`Toggle right panel (${modKey}+J)`"
        @mouseover="$event.currentTarget.style.background='var(--bg-hover)'"
        @mouseout="$event.currentTarget.style.background='transparent'"
      >
        <component
          :is="workspace.rightSidebarOpen ? IconLayoutSidebarRightFilled : IconLayoutSidebarRight"
          :size="16" :stroke-width="1.5"
        />
      </button>
      <button
        class="w-7 h-7 flex items-center justify-center rounded-md border-none bg-transparent cursor-pointer transition-colors"
        style="color: var(--fg-muted);"
        @click="$emit('open-settings')"
        :title="`Settings (${modKey}+,)`"
        @mouseover="$event.currentTarget.style.background='var(--bg-hover)';$event.currentTarget.style.color='var(--fg-primary)'"
        @mouseout="$event.currentTarget.style.background='transparent';$event.currentTarget.style.color='var(--fg-muted)'"
      >
        <IconSettings :size="16" :stroke-width="1.5" />
      </button>
    </div>
  </header>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import {
  IconLayoutSidebar, IconLayoutSidebarFilled,
  IconLayoutSidebarRight, IconLayoutSidebarRightFilled,
  IconSettings, IconSearch, IconMenu2,
} from '@tabler/icons-vue'
import { isMac, modKey } from '../../platform'

import SearchResults from '../SearchResults.vue'

const emit = defineEmits(['open-settings', 'open-folder', 'open-workspace', 'close-folder'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()

// Hamburger menu
const menuBtnRef = ref(null)
const menuDropdownRef = ref(null)
const menuOpen = ref(false)
const recents = computed(() => workspace.getRecentWorkspaces().slice(0, 5))

const menuStyle = computed(() => {
  if (!menuBtnRef.value) return {}
  const rect = menuBtnRef.value.getBoundingClientRect()
  return {
    top: rect.bottom + 4 + 'px',
    left: rect.left + 'px',
    minWidth: '200px',
  }
})

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function doOpenFolder() {
  closeMenu()
  emit('open-folder')
}

function doOpenWorkspace(path) {
  closeMenu()
  emit('open-workspace', path)
}

function doCloseFolder() {
  closeMenu()
  emit('close-folder')
}

function doSettings() {
  closeMenu()
  emit('open-settings')
}

function onClickOutsideMenu(e) {
  if (!menuOpen.value) return
  if (menuBtnRef.value?.contains(e.target)) return
  if (menuDropdownRef.value?.contains(e.target)) return
  closeMenu()
}

onMounted(() => {
  document.addEventListener('mousedown', onClickOutsideMenu)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutsideMenu)
})

// Search
const searchInputRef = ref(null)
const searchResultsRef = ref(null)
const query = ref('')
const searchFocused = ref(false)

const showResults = computed(() => searchFocused.value || query.value.length > 0)

const searchPlaceholder = computed(() => 'Go to file...')

function onFocus() {
  searchFocused.value = true
}

function onBlur() {
  // Small delay so click events on results can fire before we close
  setTimeout(() => {
    searchFocused.value = false
    // If no query, results will hide via showResults computed
  }, 150)
}

function onSearchKeydown(e) {
  if (e.key === 'Escape') {
    query.value = ''
    searchInputRef.value?.blur()
    e.preventDefault()
    return
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    searchResultsRef.value?.moveSelection(1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    searchResultsRef.value?.moveSelection(-1)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    searchResultsRef.value?.confirmSelection()
    return
  }
}

function onSelectFile(path) {
  editorStore.openFile(path)
  query.value = ''
  searchInputRef.value?.blur()
}

function onSelectCitation(key) {
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
  query.value = ''
  searchInputRef.value?.blur()
}

function focusSearch() {
  searchInputRef.value?.focus()
  nextTick(() => {
    searchInputRef.value?.select()
  })
}

defineExpose({ focusSearch })
</script>
