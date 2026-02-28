<template>
  <div
    class="canvas-file-node"
    :class="{ 'selected': selected }"
    @dblclick.stop="openFile"
  >
    <!-- File icon + name -->
    <div class="file-header">
      <component :is="iconComponent" :size="16" class="file-icon" />
      <span class="file-name">{{ fileName }}</span>
    </div>

    <!-- Preview -->
    <div v-if="data.preview" class="file-preview">{{ data.preview }}</div>

    <!-- Click hint -->
    <div class="file-hint">Click to open</div>

    <!-- Connection handles -->
    <Handle type="target" :position="Position.Top" class="canvas-handle" />
    <Handle type="source" :position="Position.Bottom" class="canvas-handle" />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { useEditorStore } from '../../stores/editor'
import { getFileIconName } from '../../utils/fileTypes'
import * as Icons from '@tabler/icons-vue'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const editorStore = useEditorStore()

const fileName = computed(() => {
  if (!props.data.filePath) return 'Unknown file'
  return props.data.filePath.split('/').pop() || props.data.filePath
})

const iconComponent = computed(() => {
  const iconName = getFileIconName(fileName.value)
  return Icons[iconName] || Icons.IconFile
})

function openFile() {
  if (props.data.filePath) {
    editorStore.openFile(props.data.filePath)
  }
}
</script>

<style scoped>
.canvas-file-node {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  width: 200px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.15s;
}

.canvas-file-node:hover {
  border-color: var(--fg-muted);
}

.canvas-file-node.selected {
  border-color: var(--accent);
}

.file-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px 4px;
}

.file-icon {
  flex-shrink: 0;
  color: var(--fg-muted);
}

.file-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-preview {
  padding: 0 10px 6px;
  font-size: 10px;
  color: var(--fg-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.file-hint {
  padding: 2px 10px 6px;
  font-size: 9px;
  color: var(--fg-muted);
  opacity: 0;
  transition: opacity 0.15s;
}

.canvas-file-node:hover .file-hint {
  opacity: 0.6;
}

/* Connection handles */
.canvas-handle {
  width: 12px !important;
  height: 12px !important;
  background: var(--accent) !important;
  border: 2px solid var(--bg-secondary) !important;
  border-radius: 50% !important;
  opacity: 0.3;
  transition: opacity 0.15s;
}

.canvas-file-node:hover .canvas-handle,
.canvas-file-node.selected .canvas-handle {
  opacity: 1;
}
</style>
