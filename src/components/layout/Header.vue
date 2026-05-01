<template>
  <header
    class="shrink-0 grid items-center bg-surface-secondary border-b border-line select-none"
    style="grid-template-columns: 1fr auto 1fr; height: 36px;"
    data-tauri-drag-region
  >
    <!-- macOS: placeholder dots when window unfocused -->
    <div
      v-if="isMac && !windowFocused"
      class="fixed pointer-events-none z-50"
      style="top: 0; left: 0;"
    >
      <div class="absolute rounded-full bg-content-muted/20" style="width: 12px; height: 12px; left: 15px; top: 11px;" />
      <div class="absolute rounded-full bg-content-muted/20" style="width: 12px; height: 12px; left: 34px; top: 11px;" />
      <div class="absolute rounded-full bg-content-muted/20" style="width: 12px; height: 12px; left: 54px; top: 11px;" />
    </div>

    <!-- Left cell -->
    <div class="flex items-center" data-tauri-drag-region>
      <div v-if="isMac" class="w-[78px] shrink-0" data-tauri-drag-region />
      <div v-else class="w-3 shrink-0" />
      <SidebarToggleButton
        side="left"
        :title="workspace.leftSidebarOpen ? 'Collapse sidebar (⌘B)' : 'Expand sidebar (⌘B)'"
        @click="workspace.toggleLeftSidebar()"
      />
      <div class="w-2 shrink-0" />
      <ProjectSwitcherButton
        ref="projectBtnRef"
        :name="projectName"
        @click="switcherOpen = !switcherOpen"
      />
      <div class="w-1 shrink-0" />
      <ChromeIconButton
        title="Settings (⌘,)"
        @click="workspace.openSettings()"
      >
        <IconSettings :size="16" :stroke-width="1.5" />
      </ChromeIconButton>
      <div class="flex-1 h-full" data-tauri-drag-region />
    </div>

    <!-- Center cell: search trigger (styled as input) -->
    <button
      class="flex items-center gap-2 h-[26px] px-3 rounded-md border border-line bg-surface
             text-content-muted hover:border-content-muted/50 cursor-pointer transition-colors duration-75"
      style="width: 320px;"
      title="Search files (⌘P)"
      @click="openSearch"
    >
      <IconSearch :size="13" :stroke-width="1.5" class="shrink-0 opacity-60" />
      <span class="ui-text-base flex-1 text-left truncate">Go to file...</span>
      <kbd class="ui-text-xs px-1.5 py-0.5 rounded bg-surface-tertiary text-content-muted font-mono">{{ modKey }}P</kbd>
    </button>

    <!-- Right cell -->
    <div class="flex items-center justify-end" data-tauri-drag-region>
      <div class="flex-1 h-full" data-tauri-drag-region />
      <SidebarToggleButton
        side="right"
        :title="workspace.rightSidebarOpen ? 'Close AI sidebar (⌘J)' : 'Open AI sidebar (⌘J)'"
        @click="workspace.toggleRightSidebar()"
      />
      <div class="w-2 shrink-0" />
    </div>
  </header>

  <!-- WorkspaceSwitcher dropdown (outside grid to avoid layout interference) -->
  <WorkspaceSwitcher
    :open="switcherOpen"
    :trigger-el="projectBtnRef?.$el"
    @close="switcherOpen = false"
    @open-folder="$emit('open-folder')"
    @open-workspace="(p) => $emit('open-workspace', p)"
    @open-settings="workspace.openSettings()"
    @clone="$emit('clone')"
    @create-team="$emit('create-team')"
    @join-team="$emit('join-team')"
  />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { IconSettings, IconSearch } from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { isMac, modKey } from '../../platform'
import ChromeIconButton from '../shared/ChromeIconButton.vue'
import ProjectSwitcherButton from '../shared/ProjectSwitcherButton.vue'
import SidebarToggleButton from '../shared/SidebarToggleButton.vue'
import WorkspaceSwitcher from './WorkspaceSwitcher.vue'

defineEmits(['open-folder', 'open-workspace', 'clone', 'create-team', 'join-team'])

const workspace = useWorkspaceStore()
const projectBtnRef = ref(null)
const switcherOpen = ref(false)
const windowFocused = ref(true)

const projectName = computed(() => {
  if (!workspace.path) return 'No Project'
  return workspace.path.split('/').pop()
})

function openSearch() {
  window.dispatchEvent(new CustomEvent('app:focus-search'))
}

function onFocus() { windowFocused.value = true }
function onBlur() { windowFocused.value = false }

onMounted(() => {
  window.addEventListener('focus', onFocus)
  window.addEventListener('blur', onBlur)
})

onUnmounted(() => {
  window.removeEventListener('focus', onFocus)
  window.removeEventListener('blur', onBlur)
})
</script>
