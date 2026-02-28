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

    <!-- Prompt textarea -->
    <textarea
      ref="textareaRef"
      class="prompt-textarea nopan nodrag"
      :value="data.content"
      placeholder="Ask a question..."
      @input="onInput"
      @keydown.stop="onKeydown"
      @mousedown.stop
    />

    <!-- Bottom bar: model + run count + run button -->
    <div class="prompt-footer">
      <button class="model-label nopan nodrag" @mousedown.stop @click.stop="cycleModel">
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

    <!-- Connection handles -->
    <Handle type="target" :position="Position.Top" class="canvas-handle" />
    <Handle type="source" :position="Position.Bottom" class="canvas-handle" />
    <Handle type="target" :position="Position.Left" id="left" class="canvas-handle" />
    <Handle type="source" :position="Position.Right" id="right" class="canvas-handle" />
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
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

const canvasNodeUpdate = inject('canvasNodeUpdate', null)
const canvasNodeResize = inject('canvasNodeResize', null)

function emit(event, payload) {
  if (event === 'update' && canvasNodeUpdate) canvasNodeUpdate(props.id, payload)
  else if (event === 'resize' && canvasNodeResize) canvasNodeResize(props.id, payload)
}

const isStreaming = computed(() => canvasStore.streamingNodeId !== null)

const displayModel = computed(() => {
  const id = props.data.modelId || workspace.selectedModelId || 'sonnet'
  if (id.includes('sonnet')) return 'Sonnet'
  if (id.includes('opus')) return 'Opus'
  if (id.includes('haiku')) return 'Haiku'
  if (id.includes('gpt-4')) return 'GPT-4o'
  if (id.includes('o1')) return 'o1'
  if (id.includes('o3')) return 'o3'
  if (id.includes('gemini')) return 'Gemini'
  return id.split('/').pop()?.split('-')[0] || id
})

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

function cycleModel() {
  const models = workspace.modelsConfig?.models?.map(m => m.id) || ['sonnet']
  const current = props.data.modelId || workspace.selectedModelId || models[0]
  const idx = models.indexOf(current)
  const next = models[(idx + 1) % models.length]
  emit('update', { modelId: next })
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
  height: 100%;
}

.canvas-prompt-node.selected {
  border-style: solid;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent) 20%, transparent);
}

.canvas-prompt-node.streaming {
  border-style: solid;
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

:deep(.resize-line) { border-color: transparent !important; }
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
</style>
