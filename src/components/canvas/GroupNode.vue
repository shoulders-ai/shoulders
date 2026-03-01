<template>
  <div
    class="canvas-group-node"
    :class="{ 'selected': selected }"
    :data-color="data.color || undefined"
  >
    <NodeResizer
      :is-visible="selected"
      :min-width="200"
      :min-height="120"
      :line-class="'resize-line'"
      :handle-class="'resize-handle'"
      @resize="onResize"
    />

    <input
      class="group-title-input nopan nodrag"
      :value="data.title"
      placeholder="Group..."
      @input="e => emit('update', { title: e.target.value })"
      @keydown.stop
      @mousedown.stop
    />
  </div>
</template>

<script setup>
import { inject } from 'vue'
import { NodeResizer } from '@vue-flow/node-resizer'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const canvasNodeUpdate = inject('canvasNodeUpdate', null)
const canvasNodeResize = inject('canvasNodeResize', null)

function emit(event, payload) {
  if (event === 'update' && canvasNodeUpdate) canvasNodeUpdate(props.id, payload)
  else if (event === 'resize' && canvasNodeResize) canvasNodeResize(props.id, payload)
}

function onResize(resizeEvent) {
  const { width, height } = resizeEvent.params ?? resizeEvent
  emit('resize', { width, height })
}
</script>

<style scoped>
.canvas-group-node {
  position: relative;
  min-width: 200px;
  min-height: 120px;
  height: 100%;
  border: 1.5px dashed var(--border);
  border-radius: 8px;
  background: transparent;
}

.canvas-group-node.selected {
  border-color: var(--accent);
}

/* Colored backgrounds at low opacity */
.canvas-group-node[data-color="yellow"] {
  background: color-mix(in srgb, var(--canvas-yellow) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-yellow) 50%, var(--border));
}
.canvas-group-node[data-color="blue"] {
  background: color-mix(in srgb, var(--canvas-blue) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-blue) 50%, var(--border));
}
.canvas-group-node[data-color="green"] {
  background: color-mix(in srgb, var(--canvas-green) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-green) 50%, var(--border));
}
.canvas-group-node[data-color="pink"] {
  background: color-mix(in srgb, var(--canvas-pink) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-pink) 50%, var(--border));
}
.canvas-group-node[data-color="purple"] {
  background: color-mix(in srgb, var(--canvas-purple) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-purple) 50%, var(--border));
}
.canvas-group-node[data-color="orange"] {
  background: color-mix(in srgb, var(--canvas-orange) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-orange) 50%, var(--border));
}
.canvas-group-node[data-color="gray"] {
  background: color-mix(in srgb, var(--canvas-gray) 15%, transparent);
  border-color: color-mix(in srgb, var(--canvas-gray) 50%, var(--border));
}

.canvas-group-node.selected[data-color] {
  border-color: var(--accent);
}

.group-title-input {
  display: block;
  padding: 8px 12px;
  font-size: 10px;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: none;
  border: none;
  outline: none;
  font-family: inherit;
  width: auto;
  max-width: 100%;
}

.group-title-input::placeholder {
  color: var(--fg-muted);
  opacity: 0.4;
}

/* Resize handles */
:deep(.resize-line) {
  border-color: transparent !important;
  border-width: 12px !important;
}

:deep(.resize-handle) {
  width: 10px !important;
  height: 10px !important;
  border-radius: 2px !important;
  background: var(--accent) !important;
  border: none !important;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.canvas-group-node.selected :deep(.resize-handle) {
  opacity: 0.6;
}

.canvas-group-node.selected :deep(.resize-handle:hover) {
  opacity: 1;
}
</style>
