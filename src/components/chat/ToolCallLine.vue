<template>
  <div>
    <div class="chat-tool-line ui-text-sm" :class="[statusClass, { 'tool-skill': isSkill }]" @click="expanded = !expanded">
      <!-- Status indicators -->
      <span v-if="status === 'pending' || status === 'running'" class="tool-pending-dots"><span></span><span></span><span></span></span>
      <span v-else-if="status === 'error'" class="tool-status-dot tool-status-error"></span>
      <span v-else-if="status === 'done'" class="tool-status-check">✓</span>
      <!-- Icon -->
      <svg class="tool-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
        <template v-if="iconName === 'sparkle'">
          <path d="M8 1l1.5 4.5L14 7l-4.5 1.5L8 13l-1.5-4.5L2 7l4.5-1.5z" fill="currentColor" stroke="none"/>
        </template>
        <template v-else-if="iconName === 'eye'">
          <path d="M1 8s3-5.5 7-5.5S15 8 15 8s-3 5.5-7 5.5S1 8 1 8z"/>
          <circle cx="8" cy="8" r="2.5"/>
        </template>
        <template v-else-if="iconName === 'pencil'">
          <path d="M11.5 1.5a2.12 2.12 0 013 3L5 14H2v-3z"/>
        </template>
        <template v-else-if="iconName === 'file-plus'">
          <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z"/>
          <path d="M9 1v4h4M8 8v4M6 10h4"/>
        </template>
        <template v-else-if="iconName === 'folder'">
          <path d="M2 4v9a1 1 0 001 1h10a1 1 0 001-1V6a1 1 0 00-1-1H8L6.5 3.5a1 1 0 00-.7-.3H3a1 1 0 00-1 .8z"/>
        </template>
        <template v-else-if="iconName === 'terminal'">
          <rect x="1" y="3" width="14" height="10" rx="1.5"/>
          <path d="M4 8l2.5 2M4 8l2.5-2"/>
        </template>
        <template v-else-if="iconName === 'search'">
          <circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/>
        </template>
        <template v-else-if="iconName === 'book'">
          <path d="M2 2h5a2 2 0 012 2v10a1.5 1.5 0 00-1.5-1.5H2zM14 2H9a2 2 0 00-2 2v10a1.5 1.5 0 011.5-1.5H14z"/>
        </template>
        <template v-else>
          <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5z"/>
          <path d="M9 1v4h4"/>
        </template>
      </svg>
      <span class="tool-label">{{ isSkill ? 'Loaded skill' : toolLabel(toolName) }}</span>
      <span v-if="filePath" class="tool-context tool-context-link"
            @click.stop="openFile" :title="filePath">
        {{ toolContext(toolName, toolInput) }}
      </span>
      <span v-else class="tool-context">{{ toolContext(toolName, toolInput) }}</span>
    </div>
    <!-- Expanded detail -->
    <div class="chat-tool-detail" :class="{ expanded }">
      <div class="chat-tool-detail-inner">
        <div v-if="expanded">
          <div class="chat-tool-detail-label">Input</div>
          <pre class="chat-code-block ui-text-sm whitespace-pre-wrap mb-2">{{ formatToolInput(toolInput) }}</pre>
          <div v-if="toolOutput">
            <div class="chat-tool-detail-label">Output</div>
            <pre class="chat-code-block ui-text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{{ truncateOutput(toolOutput) }}</pre>
          </div>
          <div v-if="errorText" class="mt-1 ui-text-sm" style="color: var(--error);">{{ errorText }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { TOOL_LABELS, getToolContext, getToolIcon, isSkillRead, getToolFilePath } from '../../utils/chatMarkdown'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { useToastStore } from '../../stores/toast'

const props = defineProps({
  // UIMessage tool part (new format)
  part: { type: Object, default: null },
  // Legacy tool call object (old format)
  tc: { type: Object, default: null },
})

const expanded = ref(false)

// ─── Unified accessors (support both part and tc props) ──────────

const toolName = computed(() => {
  if (props.part) {
    return props.part.type === 'dynamic-tool'
      ? props.part.toolName
      : props.part.type?.replace('tool-', '')
  }
  return props.tc?.name || ''
})

const status = computed(() => {
  if (props.part) {
    switch (props.part.state) {
      case 'input-streaming':
      case 'input-available': return 'running'
      case 'output-available': return 'done'
      case 'output-error': return 'error'
      default: return 'pending'
    }
  }
  return props.tc?.status || 'pending'
})

const toolInput = computed(() => {
  if (props.part) return props.part.input || props.part.args || {}
  return props.tc?.input || {}
})

const toolOutput = computed(() => {
  if (props.part) return props.part.output
  return props.tc?.output
})

const errorText = computed(() => {
  if (props.part) return props.part.errorText
  return props.tc?.status === 'error' ? props.tc?.output : undefined
})

const isSkill = computed(() => isSkillRead(toolName.value, toolInput.value))
const iconName = computed(() => isSkill.value ? 'sparkle' : getToolIcon(toolName.value))

const editorStore = useEditorStore()
const workspace = useWorkspaceStore()
const toastStore = useToastStore()

const filePath = computed(() => {
  if (isSkill.value) return null
  return getToolFilePath(toolName.value, toolInput.value)
})

async function openFile() {
  if (!filePath.value || !workspace.path) return
  const p = filePath.value
  const absolute = p.startsWith('/') ? p : workspace.path + '/' + p
  const exists = await invoke('path_exists', { path: absolute })
  if (exists) {
    editorStore.openFile(absolute)
  } else {
    toastStore.show(`File not found: ${absolute.split('/').pop()}`, { type: 'error', duration: 3000 })
  }
}

const statusClass = computed(() => {
  if (status.value === 'pending' || status.value === 'running') return 'tool-pending'
  if (status.value === 'error') return 'tool-error'
  if (status.value === 'done') return 'tool-done'
  return ''
})

// ─── Helpers ──────────────────────────────────────────────────────

function toolLabel(name) { return TOOL_LABELS[name] || name }
function toolContext(name, input) { return getToolContext(name, input) }
function formatToolInput(input) {
  if (!input) return '{}'
  if (typeof input === 'string') return input
  return JSON.stringify(input, null, 2)
}
function truncateOutput(output) {
  if (!output) return ''
  if (typeof output === 'object') {
    // Strip base64 fields from display to avoid freezing the UI
    const { base64, _dataUrl, ...safe } = output
    const str = JSON.stringify(safe, null, 2)
    if (str.length > 2000) return str.slice(0, 2000) + '\n... [truncated]'
    return str
  }
  const str = String(output)
  if (str.length > 2000) return str.slice(0, 2000) + '\n... [truncated]'
  return str
}
</script>
