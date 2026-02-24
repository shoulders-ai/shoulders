<template>
  <div class="rounded border"
    style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 -4px 12px rgba(0,0,0,0.3); max-height: 240px;"
    @mousedown.prevent>
    <div class="overflow-y-auto" style="max-height: 240px;">
      <div v-if="filtered.length === 0" class="px-2 py-3 ui-text-base text-center" style="color: var(--fg-muted);">
        No files found
      </div>
      <div v-for="(file, i) in filtered" :key="file.path"
        class="px-2 py-1.5 ui-text-base cursor-pointer flex items-center gap-2"
        :style="{
          background: i === selectedIdx ? 'var(--bg-hover)' : 'transparent',
          color: i === selectedIdx ? 'var(--fg-primary)' : 'var(--fg-secondary)',
        }"
        @click="$emit('select', file)"
        @mouseenter="selectedIdx = i">
        <span class="truncate flex-1">{{ file.name }}</span>
        <span class="ui-text-sm truncate max-w-[120px]" style="color: var(--fg-muted);">
          {{ relativePath(file.path) }}
        </span>
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
})
const emit = defineEmits(['select', 'close'])

const filesStore = useFilesStore()
const workspace = useWorkspaceStore()
const selectedIdx = ref(0)

const filtered = computed(() => {
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

function relativePath(fullPath) {
  if (!workspace.path) return fullPath
  return fullPath.replace(workspace.path + '/', '')
}

function selectNext() {
  selectedIdx.value = Math.min(selectedIdx.value + 1, filtered.value.length - 1)
}

function selectPrev() {
  selectedIdx.value = Math.max(selectedIdx.value - 1, 0)
}

function confirmSelection() {
  if (filtered.value[selectedIdx.value]) {
    emit('select', filtered.value[selectedIdx.value])
  }
}

watch(() => props.filter, () => {
  selectedIdx.value = 0
})

defineExpose({ selectNext, selectPrev, confirmSelection })
</script>
