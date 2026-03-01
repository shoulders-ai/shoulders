<template>
  <div
    class="canvas-text-node"
    :class="{
      'selected': selected,
      'context-highlight': isContextHighlighted,
      'streaming': isStreaming,
      [`border-${data.borderWidth || 'thin'}`]: true,
      [`font-${data.fontSize || 'medium'}`]: true,
      [`align-${data.textAlign || 'left'}`]: true,
    }"
    :data-color="data.color || undefined"
  >
    <!-- Resize handles (first child for stacking context) -->
    <NodeResizer
      :is-visible="selected"
      :min-width="160"
      :min-height="40"
      :line-class="'resize-line'"
      :handle-class="'resize-handle'"
      @resize="onResize"
    />

    <!-- Inner container — clips content when node is resized smaller than content -->
    <div class="node-inner">
      <!-- Title -->
      <input
        v-if="data.title !== null && data.title !== undefined"
        class="node-title-input nopan nodrag"
        :value="data.title"
        placeholder="Title..."
        @input="e => emit('update', { title: e.target.value })"
        @keydown.stop
        @mousedown.stop
      />

      <!-- Version label for AI-generated nodes with siblings -->
      <span v-if="data.versionLabel" class="version-label">{{ data.versionLabel }}</span>

      <!-- Content -->
      <div
        v-if="editing"
        class="node-content-edit"
      >
        <textarea
          ref="textareaRef"
          class="node-textarea nopan nodrag"
          :value="data.content"
          @input="onInput"
          @blur="editing = false"
          @keydown.stop
          @mousedown.stop
        />
      </div>
      <div
        v-else
        class="node-content"
        :class="{ 'has-title': !!data.title }"
        @dblclick.stop="startEditing"
        v-html="renderedContent"
      />

      <!-- Regenerate button for AI-generated nodes -->
      <button
        v-if="data.aiGenerated && data._parentPromptId && !isStreaming"
        class="regenerate-btn nopan nodrag"
        title="Regenerate"
        @mousedown.stop
        @click.stop="regenerate"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
        </svg>
      </button>
    </div>

    <!-- Streaming indicator -->
    <div v-if="isStreaming" class="streaming-bar" />

    <!-- Connection handles -->
    <Handle type="target" :position="Position.Top" class="canvas-handle" />
    <Handle type="source" :position="Position.Bottom" class="canvas-handle" />
    <Handle type="target" :position="Position.Left" id="left" class="canvas-handle" />
    <Handle type="source" :position="Position.Right" id="right" class="canvas-handle" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, inject } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { renderMarkdown } from '../../utils/chatMarkdown'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const canvasNodeUpdate = inject('canvasNodeUpdate', null)
const canvasNodeResize = inject('canvasNodeResize', null)
const canvasRegenerate = inject('canvasRegenerate', null)

function emit(event, payload) {
  if (event === 'update' && canvasNodeUpdate) canvasNodeUpdate(props.id, payload)
  else if (event === 'resize' && canvasNodeResize) canvasNodeResize(props.id, payload)
}

const editing = ref(false)
const textareaRef = ref(null)

// Check canvas store for context highlighting and streaming
const isContextHighlighted = computed(() => {
  return props.data._contextHighlight || false
})

const isStreaming = computed(() => {
  return props.data._streaming || false
})

const renderedContent = computed(() => {
  if (!props.data.content) return '<span class="placeholder">Double-click to edit</span>'
  return renderMarkdown(props.data.content)
})

function startEditing() {
  editing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function onInput(e) {
  emit('update', { content: e.target.value })
}

function regenerate() {
  if (props.data._parentPromptId && canvasRegenerate) {
    canvasRegenerate(props.id)
  }
}

function onResize(resizeEvent) {
  const { width, height } = resizeEvent.params ?? resizeEvent
  emit('resize', { width, height })
}
</script>

<style scoped>
.canvas-text-node {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  min-width: 160px;
  min-height: 40px;
  position: relative;
  transition: border-color 0.15s, box-shadow 0.15s;
  display: flex;
  flex-direction: column;
  height: 100%;
}

.node-inner {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  border-radius: 0 0 5px 5px;
}

.canvas-text-node.selected {
  border-color: var(--accent);
}

/* Semantic node colors — resolved via CSS vars per theme */
.canvas-text-node[data-color="yellow"] { background: var(--canvas-yellow); }
.canvas-text-node[data-color="blue"]   { background: var(--canvas-blue); }
.canvas-text-node[data-color="green"]  { background: var(--canvas-green); }
.canvas-text-node[data-color="pink"]   { background: var(--canvas-pink); }
.canvas-text-node[data-color="purple"] { background: var(--canvas-purple); }
.canvas-text-node[data-color="orange"] { background: var(--canvas-orange); }
.canvas-text-node[data-color="gray"]   { background: var(--canvas-gray); }

.canvas-text-node.context-highlight {
  box-shadow: 0 0 0 2px var(--accent-muted, rgba(95, 158, 160, 0.3));
}

/* Border width variants */
.canvas-text-node.border-thin { border-width: 1px; }
.canvas-text-node.border-medium { border-width: 2px; }
.canvas-text-node.border-thick { border-width: 3px; }

/* Font size variants */
.canvas-text-node.font-small { font-size: 11px; }
.canvas-text-node.font-medium { font-size: 13px; }
.canvas-text-node.font-large { font-size: 15px; }

/* Text alignment */
.canvas-text-node.align-left { text-align: left; }
.canvas-text-node.align-center { text-align: center; }
.canvas-text-node.align-right { text-align: right; }

.node-title-input {
  display: block;
  width: 100%;
  padding: 6px 10px 2px;
  font-size: 10px;
  font-weight: 600;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: none;
  border: none;
  outline: none;
  font-family: inherit;
}

.node-title-input::placeholder {
  color: var(--fg-muted);
  opacity: 0.5;
}

.version-label {
  position: absolute;
  top: 4px;
  right: 6px;
  font-size: 9px;
  color: var(--fg-muted);
  opacity: 0.6;
  font-weight: 500;
}

.node-content {
  padding: 8px 10px;
  color: var(--fg-primary);
  line-height: 1.5;
  overflow: hidden;
  word-wrap: break-word;
  cursor: default;
  border-radius: 0 0 6px 6px;
  flex: 1;
  min-height: 0;
}

.node-content.has-title {
  padding-top: 4px;
}

.node-content :deep(p) { margin: 0 0 4px; }
.node-content :deep(p:last-child) { margin-bottom: 0; }
.node-content :deep(ul), .node-content :deep(ol) { margin: 2px 0; padding-left: 18px; }
.node-content :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-secondary);
  padding: 1px 3px;
  border-radius: 3px;
}
.node-content :deep(pre) {
  background: var(--bg-secondary);
  padding: 6px 8px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 4px 0;
}
.node-content :deep(a) { color: var(--accent); }
.node-content :deep(.placeholder) { color: var(--fg-muted); font-style: italic; }

.node-content-edit {
  padding: 0;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.node-textarea {
  width: 100%;
  flex: 1;
  min-height: 60px;
  padding: 8px 10px;
  border: none;
  background: transparent;
  color: var(--fg-primary);
  font-family: var(--font-sans, system-ui);
  font-size: inherit;
  line-height: 1.5;
  resize: none;
  outline: none;
}

/* Regenerate button */
.regenerate-btn {
  position: absolute;
  bottom: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border-radius: 5px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  color: var(--fg-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.15s, color 0.1s, background 0.1s;
}

.canvas-text-node:hover .regenerate-btn {
  opacity: 0.6;
}

.regenerate-btn:hover {
  opacity: 1 !important;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-secondary));
  border-color: var(--accent);
}

.streaming-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--accent);
  animation: pulse-bar 1.5s ease-in-out infinite;
}

@keyframes pulse-bar {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 1; }
}

/* Connection handles */
.canvas-handle {
  width: 12px !important;
  height: 12px !important;
  background: var(--accent) !important;
  border: 2px solid var(--bg-primary) !important;
  border-radius: 50% !important;
  opacity: 0.3;
  transition: opacity 0.15s;
}

.canvas-text-node:hover .canvas-handle,
.canvas-text-node.selected .canvas-handle {
  opacity: 1;
}

/* Resize handles — wide invisible hit area for easier grabbing */
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

.canvas-text-node.selected :deep(.resize-handle) {
  opacity: 0.6;
}

.canvas-text-node.selected :deep(.resize-handle:hover) {
  opacity: 1;
}
</style>
