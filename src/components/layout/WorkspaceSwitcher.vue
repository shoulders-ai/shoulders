<template>
  <Teleport to="body">
    <div v-if="open" ref="dropdownRef" class="switcher" :style="positionStyle" @keydown="onKeydown">

      <!-- Filter input -->
      <div class="switcher-filter">
        <IconSearch :size="13" :stroke-width="1.5" />
        <input
          ref="filterRef"
          v-model="filter"
          placeholder="Search projects..."
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
        />
      </div>

      <!-- Scrollable list -->
      <div class="switcher-list">
        <template v-if="visibleRecents.length">
          <div
            v-for="(r, i) in visibleRecents"
            :key="r.path"
            class="switcher-item"
            :class="{ active: i === selectedIndex }"
            @click="selectWorkspace(r.path)"
            @mouseenter="selectedIndex = i"
          >
            <IconFolder :size="14" :stroke-width="1.5" />
            <div class="switcher-item-text">
              <div class="switcher-item-name">{{ r.name }}</div>
              <div class="switcher-item-path">{{ shortenPath(r.path) }}</div>
            </div>
            <button class="switcher-remove" title="Remove from recent" @click.stop="removeRecent(r.path)">
              <IconX :size="12" :stroke-width="1.5" />
            </button>
          </div>
        </template>

        <div v-else-if="filter" class="switcher-empty">No matching projects</div>
        <div v-else class="switcher-empty">No recent projects</div>
      </div>

      <!-- Actions -->
      <div class="switcher-actions">
        <div class="switcher-action" @click="$emit('open-folder')">
          <IconFolderOpen :size="14" :stroke-width="1.5" />
          Open Folder...
          <kbd>{{ modKey }}+O</kbd>
        </div>
        <div class="switcher-action" @click="$emit('clone')">
          <IconGitBranch :size="14" :stroke-width="1.5" />
          Clone Repository...
        </div>
        <div class="switcher-separator"></div>
        <div
          class="switcher-action"
          :class="{ 'switcher-action-disabled': !isLoggedIn }"
          :title="!isLoggedIn ? 'Log in to create team workspaces' : undefined"
          @click="isLoggedIn && $emit('create-team')"
        >
          <IconUsers :size="14" :stroke-width="1.5" />
          Create Team Workspace...
        </div>
        <div
          class="switcher-action"
          :class="{ 'switcher-action-disabled': !isLoggedIn }"
          :title="!isLoggedIn ? 'Log in to join team workspaces' : undefined"
          @click="isLoggedIn && $emit('join-team')"
        >
          <IconUserPlus :size="14" :stroke-width="1.5" />
          Join Team Workspace...
        </div>
        <div class="switcher-separator"></div>
        <div class="switcher-action" @click="$emit('open-settings')">
          <IconSettings :size="14" :stroke-width="1.5" />
          Settings...
          <kbd>{{ modKey }}+,</kbd>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick, onUnmounted } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { modKey } from '../../platform'
import {
  IconSearch, IconFolder, IconFolderOpen,
  IconGitBranch, IconX, IconSettings,
  IconUsers, IconUserPlus,
} from '@tabler/icons-vue'

const props = defineProps({
  open: Boolean,
  triggerEl: Object,
})

const emit = defineEmits([
  'close', 'open-folder', 'open-workspace',
  'open-settings', 'clone', 'create-team', 'join-team',
])

const workspace = useWorkspaceStore()
const isLoggedIn = computed(() => !!workspace.shouldersAuth?.token)

const dropdownRef = ref(null)
const filterRef = ref(null)
const filter = ref('')
const selectedIndex = ref(-1)
const positionStyle = ref({})
const recentsTick = ref(0)

const recents = computed(() => {
  recentsTick.value
  return workspace.getRecentWorkspaces()
})

const visibleRecents = computed(() => {
  let list = recents.value.filter(r => r.path !== workspace.path)
  if (filter.value) {
    const q = filter.value.toLowerCase()
    list = list.filter(r =>
      r.name.toLowerCase().includes(q) ||
      shortenPath(r.path).toLowerCase().includes(q)
    )
  }
  return list
})

function shortenPath(fullPath) {
  if (!fullPath) return ''
  const home = fullPath.match(/^\/Users\/[^/]+/)
  if (home) return fullPath.replace(home[0], '~')
  return fullPath
}

function selectWorkspace(path) {
  emit('open-workspace', path)
  emit('close')
}

function removeRecent(path) {
  workspace.removeRecent(path)
  recentsTick.value++
  if (selectedIndex.value >= visibleRecents.value.length) {
    selectedIndex.value = visibleRecents.value.length - 1
  }
}

function onKeydown(e) {
  const count = visibleRecents.value.length

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (count === 0) return
    selectedIndex.value = selectedIndex.value < count - 1 ? selectedIndex.value + 1 : 0
    scrollActiveIntoView()
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (count === 0) return
    selectedIndex.value = selectedIndex.value > 0 ? selectedIndex.value - 1 : count - 1
    scrollActiveIntoView()
    return
  }

  if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedIndex.value >= 0 && selectedIndex.value < count) {
      selectWorkspace(visibleRecents.value[selectedIndex.value].path)
    } else if (count === 1) {
      selectWorkspace(visibleRecents.value[0].path)
    }
    return
  }

  if (e.key === 'Escape') {
    e.preventDefault()
    if (filter.value) {
      filter.value = ''
      selectedIndex.value = -1
    } else {
      emit('close')
    }
    return
  }
}

function scrollActiveIntoView() {
  nextTick(() => {
    dropdownRef.value?.querySelector('.switcher-item.active')?.scrollIntoView({ block: 'nearest' })
  })
}

function onClickOutside(e) {
  if (dropdownRef.value?.contains(e.target)) return
  if (props.triggerEl?.contains(e.target)) return
  emit('close')
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    filter.value = ''
    selectedIndex.value = -1
    recentsTick.value++

    const rect = props.triggerEl?.getBoundingClientRect()
    if (rect) {
      positionStyle.value = {
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
      }
    }

    nextTick(() => {
      filterRef.value?.focus()
      document.addEventListener('mousedown', onClickOutside)
    })
  } else {
    document.removeEventListener('mousedown', onClickOutside)
  }
})

watch(filter, () => {
  selectedIndex.value = -1
})

onUnmounted(() => {
  document.removeEventListener('mousedown', onClickOutside)
})
</script>

<style scoped>
.switcher {
  position: fixed;
  z-index: 1000;
  width: 280px;
  max-height: min(420px, calc(100vh - 60px));
  background: rgb(var(--bg-secondary));
  border: 1px solid rgb(var(--border));
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.switcher-filter {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid rgb(var(--border));
  color: rgb(var(--fg-muted));
  flex-shrink: 0;
}
.switcher-filter input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: rgb(var(--fg-primary));
  font-size: 12px;
  font-family: inherit;
}
.switcher-filter input::placeholder {
  color: rgb(var(--fg-muted));
}

.switcher-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.switcher-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  color: rgb(var(--fg-muted));
}
.switcher-item:hover,
.switcher-item.active {
  background: rgb(var(--bg-hover));
}
.switcher-item-text {
  flex: 1;
  min-width: 0;
}
.switcher-item-name {
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--fg-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.switcher-item-path {
  font-size: 11px;
  color: rgb(var(--fg-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.switcher-remove {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: rgb(var(--fg-muted));
  cursor: pointer;
  opacity: 0;
}
.switcher-item:hover .switcher-remove {
  opacity: 1;
}
.switcher-remove:hover {
  background: rgb(var(--bg-tertiary));
  color: rgb(var(--fg-secondary));
}

.switcher-empty {
  padding: 16px 12px;
  text-align: center;
  font-size: 12px;
  color: rgb(var(--fg-muted));
}

.switcher-actions {
  border-top: 1px solid rgb(var(--border));
  padding: 4px 0;
  flex-shrink: 0;
}
.switcher-action {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;
  color: rgb(var(--fg-secondary));
}
.switcher-action:hover:not(.switcher-action-disabled) {
  background: rgb(var(--bg-hover));
  color: rgb(var(--fg-primary));
}
.switcher-action-disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: auto;
}
.switcher-action kbd {
  margin-left: auto;
}
.switcher-separator {
  height: 1px;
  background: rgb(var(--border));
  margin: 4px 0;
}
</style>
