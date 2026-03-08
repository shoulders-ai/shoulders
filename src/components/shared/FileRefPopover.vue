<template>
  <div class="rounded border"
    style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 -4px 12px rgba(0,0,0,0.3); max-height: 240px;"
    @mousedown.prevent>
    <div class="overflow-y-auto" style="max-height: 240px;">
      <!-- Models section -->
      <template v-if="filteredModels.length > 0">
        <div class="px-2 pt-1.5 pb-0.5 ui-text-sm uppercase tracking-wider" style="color: var(--fg-muted);">Model</div>
        <div v-for="(m, i) in filteredModels" :key="'model-' + m.id"
          class="px-2 py-1.5 ui-text-base cursor-pointer flex items-center gap-2"
          :style="{
            background: i === selectedIdx ? 'var(--bg-hover)' : 'transparent',
            color: i === selectedIdx ? 'var(--fg-primary)' : 'var(--fg-secondary)',
          }"
          @click="$emit('select-model', m.id)"
          @mouseenter="selectedIdx = i">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink:0; opacity:0.6;">
            <rect x="2" y="2" width="5" height="5" rx="1"/>
            <rect x="9" y="2" width="5" height="5" rx="1"/>
            <rect x="2" y="9" width="5" height="5" rx="1"/>
            <rect x="9" y="9" width="5" height="5" rx="1"/>
          </svg>
          <span class="truncate flex-1">{{ m.name }}</span>
        </div>
        <div v-if="filteredFiles.length > 0" class="border-t mx-2 my-1" style="border-color: var(--border);"></div>
      </template>

      <!-- Files section -->
      <template v-if="filteredFiles.length > 0">
        <div v-for="(file, i) in filteredFiles" :key="file.path"
          class="px-2 py-1.5 ui-text-base cursor-pointer flex items-center gap-2"
          :style="{
            background: (filteredModels.length + i) === selectedIdx ? 'var(--bg-hover)' : 'transparent',
            color: (filteredModels.length + i) === selectedIdx ? 'var(--fg-primary)' : 'var(--fg-secondary)',
          }"
          @click="$emit('select', file)"
          @mouseenter="selectedIdx = filteredModels.length + i">
          <span class="truncate shrink-0" style="max-width: 50%;">{{ file.name }}</span>
          <span class="ui-text-sm truncate" style="color: var(--fg-muted);">
            {{ folderPath(file.path) }}
          </span>
        </div>
      </template>

      <!-- Empty state -->
      <div v-if="filteredModels.length === 0 && filteredFiles.length === 0"
        class="px-2 py-3 ui-text-base text-center" style="color: var(--fg-muted);">
        No files found
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useFilesStore } from '../../stores/files'
import { useWorkspaceStore } from '../../stores/workspace'

const props = defineProps({
  filter: { type: String, default: '' },
  models: { type: Array,  default: () => [] },  // { id, name }[]
})
const emit = defineEmits(['select', 'select-model', 'close'])

const filesStore = useFilesStore()
const workspace = useWorkspaceStore()
const selectedIdx = ref(0)

const filteredModels = computed(() => {
  if (!props.filter || !props.models.length) return []
  const q = props.filter.toLowerCase()
  return props.models.filter(m =>
    m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
  )
})

const filteredFiles = computed(() => {
  const files = filesStore.flatFiles
  const q = props.filter.toLowerCase()
  if (!q) return files.slice(0, 20)
  return files
    .filter(f => {
      const name = f.name.toLowerCase()
      const path = f.path.toLowerCase()
      return name.includes(q) || path.includes(q)
    })
    .slice(0, 20)
})

const totalItems = computed(() => filteredModels.value.length + filteredFiles.value.length)

function relativePath(fullPath) {
  if (!workspace.path) return fullPath
  return fullPath.replace(workspace.path + '/', '')
}

function folderPath(fullPath) {
  const rel = relativePath(fullPath)
  const lastSlash = rel.lastIndexOf('/')
  return lastSlash >= 0 ? rel.substring(0, lastSlash) : ''
}

function selectNext() {
  selectedIdx.value = Math.min(selectedIdx.value + 1, totalItems.value - 1)
}

function selectPrev() {
  selectedIdx.value = Math.max(selectedIdx.value - 1, 0)
}

function confirmSelection() {
  const mLen = filteredModels.value.length
  if (selectedIdx.value < mLen) {
    const model = filteredModels.value[selectedIdx.value]
    if (model) emit('select-model', model.id)
  } else {
    const file = filteredFiles.value[selectedIdx.value - mLen]
    if (file) emit('select', file)
  }
}

watch(() => props.filter, () => {
  selectedIdx.value = 0
})

defineExpose({ selectNext, selectPrev, confirmSelection })
</script>
