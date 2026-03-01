<template>
  <div
    class="canvas-label-node"
    :class="{
      'selected': selected,
      [`font-${data.fontSize || 'large'}`]: true,
      [`align-${data.textAlign || 'left'}`]: true,
    }"
    :data-color="data.color || undefined"
  >
    <NodeResizer
      :is-visible="selected"
      :min-width="80"
      :min-height="20"
      :line-class="'resize-line'"
      :handle-class="'resize-handle'"
      @resize="onResize"
    />

    <input
      v-if="editing"
      ref="inputRef"
      class="label-input nopan nodrag"
      :value="data.content"
      placeholder="Label..."
      @input="onInput"
      @blur="editing = false"
      @keydown.stop="onKeydown"
      @mousedown.stop
    />
    <div
      v-else
      class="label-display"
      @dblclick.stop="startEditing"
    >
      {{ data.content || 'Label' }}
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, inject } from 'vue'
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

const editing = ref(false)
const inputRef = ref(null)

function startEditing() {
  editing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

function onInput(e) {
  emit('update', { content: e.target.value })
}

function onKeydown(e) {
  if (e.key === 'Enter') {
    e.preventDefault()
    editing.value = false
  }
}

function onResize(resizeEvent) {
  const { width, height } = resizeEvent.params ?? resizeEvent
  emit('resize', { width, height })
}
</script>

<style scoped>
.canvas-label-node {
  position: relative;
  min-width: 80px;
  min-height: 20px;
  padding: 2px 4px;
  cursor: default;
  user-select: none;
}

/* Font sizes — extended range for headings */
.canvas-label-node.font-small { font-size: 11px; }
.canvas-label-node.font-medium { font-size: 13px; }
.canvas-label-node.font-large { font-size: 15px; font-weight: 600; }
.canvas-label-node.font-x-large { font-size: 20px; font-weight: 700; }
.canvas-label-node.font-xx-large { font-size: 28px; font-weight: 700; }

/* Text alignment */
.canvas-label-node.align-left { text-align: left; }
.canvas-label-node.align-center { text-align: center; }
.canvas-label-node.align-right { text-align: right; }

/* Color as text color */
.canvas-label-node { color: var(--fg-primary); }
.canvas-label-node[data-color="yellow"] { color: var(--canvas-yellow); }
.canvas-label-node[data-color="blue"]   { color: var(--canvas-blue); }
.canvas-label-node[data-color="green"]  { color: var(--canvas-green); }
.canvas-label-node[data-color="pink"]   { color: var(--canvas-pink); }
.canvas-label-node[data-color="purple"] { color: var(--canvas-purple); }
.canvas-label-node[data-color="orange"] { color: var(--canvas-orange); }
.canvas-label-node[data-color="gray"]   { color: var(--canvas-gray); }

/* Selection outline */
.canvas-label-node.selected {
  outline: 1.5px dashed var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}

.label-display {
  line-height: 1.3;
  word-wrap: break-word;
  white-space: pre-wrap;
}

.label-input {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  font: inherit;
  line-height: 1.3;
  outline: none;
}

.label-input::placeholder {
  color: var(--fg-muted);
  opacity: 0.5;
}

/* Resize handles */
:deep(.resize-line) {
  border-color: transparent !important;
  border-width: 10px !important;
}

:deep(.resize-handle) {
  width: 8px !important;
  height: 8px !important;
  border-radius: 2px !important;
  background: var(--accent) !important;
  border: none !important;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}

.canvas-label-node.selected :deep(.resize-handle) {
  opacity: 0.6;
}

.canvas-label-node.selected :deep(.resize-handle:hover) {
  opacity: 1;
}
</style>
