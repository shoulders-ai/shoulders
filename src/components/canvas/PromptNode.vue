<template>
  <div
    class="canvas-prompt-node"
    :class="{ 'selected': selected, 'streaming': isStreaming }"
  >
    <!-- Resize (first child) -->
    <NodeResizer
      :is-visible="selected"
      :min-width="200"
      :min-height="80"
      :line-class="'resize-line'"
      :handle-class="'resize-handle'"
      @resize="onResize"
    />

    <!-- Content: edit or display mode -->
    <textarea
      v-if="editing"
      ref="textareaRef"
      class="prompt-textarea nopan nodrag"
      :value="data.content"
      placeholder="Ask a question..."
      @input="onInput"
      @blur="editing = false"
      @keydown.stop="onKeydown"
      @mousedown.stop
    />
    <div
      v-else
      class="prompt-display"
      @dblclick.stop="startEditing"
    >
      {{ data.content || 'Double-click to write a prompt...' }}
    </div>

    <!-- Bottom bar: model + run count + run button -->
    <div class="prompt-footer">
      <button ref="modelLabelRef" class="model-label nopan nodrag" @mousedown.stop @click.stop="toggleModelPopover">
        {{ displayModel }}
      </button>
      <span v-if="data.runCount > 0" class="run-count">{{ data.runCount }}×</span>
      <div class="footer-spacer" />
      <button
        class="run-btn nopan nodrag"
        :disabled="!data.content?.trim() || isStreaming"
        @mousedown.stop
        @click.stop="runPrompt"
        :title="isStreaming ? 'Streaming...' : 'Run (⌘↵)'"
      >
        <svg v-if="!isStreaming" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="6,3 20,12 6,21" />
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      </button>
    </div>

    <!-- Model selector popover -->
    <Teleport to="body">
      <div v-if="modelPopoverOpen" class="fixed inset-0 z-50" style="background: transparent;" @click="modelPopoverOpen = false">
        <div class="model-popover" :style="modelPopoverStyle" @click.stop>
          <div
            v-for="model in availableModels"
            :key="model.id"
            class="model-option nopan nodrag"
            :class="{ active: model.id === currentModelId }"
            @click.stop="selectModel(model.id)"
          >
            <span class="model-option-name">{{ model.name }}</span>
            <span class="model-option-provider">{{ model.provider }}</span>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Connection handles -->
    <Handle type="target" :position="Position.Top" class="canvas-handle" />
    <Handle type="source" :position="Position.Bottom" class="canvas-handle" />
    <Handle type="target" :position="Position.Left" id="left" class="canvas-handle" />
    <Handle type="source" :position="Position.Right" id="right" class="canvas-handle" />
  </div>
</template>

<script setup>
import { ref, computed, inject, nextTick } from 'vue'
import { Handle, Position } from '@vue-flow/core'
import { NodeResizer } from '@vue-flow/node-resizer'
import { useCanvasStore } from '../../stores/canvas'
import { useWorkspaceStore } from '../../stores/workspace'

const props = defineProps({
  id: { type: String, required: true },
  data: { type: Object, required: true },
  selected: { type: Boolean, default: false },
})

const canvasStore = useCanvasStore()
const workspace = useWorkspaceStore()
const textareaRef = ref(null)
const modelLabelRef = ref(null)
const editing = ref(false)
const modelPopoverOpen = ref(false)

const canvasNodeUpdate = inject('canvasNodeUpdate', null)
const canvasNodeResize = inject('canvasNodeResize', null)

function emit(event, payload) {
  if (event === 'update' && canvasNodeUpdate) canvasNodeUpdate(props.id, payload)
  else if (event === 'resize' && canvasNodeResize) canvasNodeResize(props.id, payload)
}

const isStreaming = computed(() => canvasStore.streamingNodeId !== null)

const currentModelId = computed(() => props.data.modelId || workspace.selectedModelId || 'sonnet')

const availableModels = computed(() => {
  return workspace.modelsConfig?.models || [{ id: 'sonnet', name: 'Sonnet', provider: 'anthropic' }]
})

const displayModel = computed(() => {
  const model = availableModels.value.find(m => m.id === currentModelId.value)
  return model?.name || currentModelId.value
})

const modelPopoverStyle = computed(() => {
  if (!modelLabelRef.value) return {}
  const rect = modelLabelRef.value.getBoundingClientRect()
  const popoverHeight = availableModels.value.length * 30 + 8
  const maxY = window.innerHeight - popoverHeight - 8
  return {
    left: rect.left + 'px',
    top: Math.min(rect.top - popoverHeight - 4, maxY) + 'px',
  }
})

function toggleModelPopover() {
  modelPopoverOpen.value = !modelPopoverOpen.value
}

function selectModel(id) {
  emit('update', { modelId: id })
  workspace.setSelectedModelId(id)
  modelPopoverOpen.value = false
}

function startEditing() {
  editing.value = true
  nextTick(() => {
    textareaRef.value?.focus()
  })
}

function onInput(e) {
  emit('update', { content: e.target.value })
}

function onKeydown(e) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    runPrompt()
  }
}

function runPrompt() {
  if (!props.data.content?.trim() || isStreaming.value) return
  canvasStore.sendPrompt(props.id)
}

function onResize(resizeEvent) {
  const { width, height } = resizeEvent.params ?? resizeEvent
  emit('resize', { width, height })
}
</script>

<style scoped>
.canvas-prompt-node {
  background: var(--bg-primary);
  border: 2px dashed var(--accent);
  border-radius: 10px;
  min-width: 200px;
  min-height: 80px;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100%;
}

.canvas-prompt-node.selected {
  border-style: solid;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.canvas-prompt-node.streaming {
  border-style: solid;
}

.prompt-display {
  flex: 1;
  padding: 10px 12px 6px;
  color: var(--fg-primary);
  font-family: var(--font-sans, system-ui);
  font-size: 13px;
  line-height: 1.5;
  cursor: default;
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow: hidden;
  min-height: 36px;
}

.prompt-display:empty::before,
.prompt-display:only-child:not(:focus)::before {
  color: var(--fg-muted);
  font-style: italic;
}

.prompt-textarea {
  flex: 1;
  width: 100%;
  padding: 10px 12px 6px;
  border: none;
  background: transparent;
  color: var(--fg-primary);
  font-family: var(--font-sans, system-ui);
  font-size: 13px;
  line-height: 1.5;
  resize: none;
  outline: none;
  min-height: 36px;
}

.prompt-textarea::placeholder {
  color: var(--fg-muted);
  font-style: italic;
}

/* Bottom bar */
.prompt-footer {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 6px 6px;
}

.model-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 12%, transparent);
  border: none;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  transition: background 0.1s;
}

.model-label:hover {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.run-count {
  font-size: 9px;
  color: var(--fg-muted);
  font-weight: 500;
}

.footer-spacer {
  flex: 1;
}

.run-btn {
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--accent);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.8;
  transition: opacity 0.15s, transform 0.1s;
}

.run-btn:hover:not(:disabled) {
  opacity: 1;
  transform: scale(1.05);
}

.run-btn:disabled {
  opacity: 0.25;
  cursor: default;
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

.canvas-prompt-node:hover .canvas-handle,
.canvas-prompt-node.selected .canvas-handle {
  opacity: 1;
}

:deep(.resize-line) { border-color: transparent !important; border-width: 12px !important; }
:deep(.resize-handle) {
  width: 10px !important; height: 10px !important;
  border-radius: 2px !important;
  background: var(--accent) !important;
  border: none !important;
  opacity: 0;
  transition: opacity 0.15s;
  z-index: 10;
}
.canvas-prompt-node.selected :deep(.resize-handle) { opacity: 0.6; }
.canvas-prompt-node.selected :deep(.resize-handle:hover) { opacity: 1; }

/* Model popover */
.model-popover {
  position: fixed;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  min-width: 160px;
  z-index: 51;
}

.model-option {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 11px;
  color: var(--fg-primary);
  transition: background 0.1s;
}

.model-option:hover {
  background: var(--bg-secondary);
}

.model-option.active {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.model-option-name {
  font-weight: 500;
}

.model-option-provider {
  font-size: 9px;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
</style>
