<template>
  <div>
    <div class="chat-tool-line ui-text-sm" :class="[toolStatusClass(tc.status), { 'tool-skill': isSkill }]" @click="tc._expanded = !tc._expanded">
      <!-- Status indicators -->
      <span v-if="tc.status === 'pending'" class="tool-pending-dots"><span></span><span></span><span></span></span>
      <span v-else-if="tc.status === 'running'" class="tool-status-dot tool-status-running"></span>
      <span v-else-if="tc.status === 'error'" class="tool-status-dot tool-status-error"></span>
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
      <span class="tool-label">{{ isSkill ? 'Loaded skill' : toolLabel(tc.name) }}</span>
      <span class="tool-context">{{ toolContext(tc.name, tc.input) }}</span>
    </div>
    <!-- Expanded detail -->
    <div class="chat-tool-detail" :class="{ expanded: tc._expanded }">
      <div class="chat-tool-detail-inner">
        <div v-if="tc._expanded">
          <div class="chat-tool-detail-label">Input</div>
          <pre class="chat-code-block ui-text-sm whitespace-pre-wrap mb-2">{{ formatToolInput(tc.input) }}</pre>
          <div v-if="tc.output">
            <div class="chat-tool-detail-label">Output</div>
            <pre class="chat-code-block ui-text-sm whitespace-pre-wrap max-h-32 overflow-y-auto">{{ truncateOutput(tc.output) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TOOL_LABELS, getToolContext, getToolIcon, isSkillRead } from '../../utils/chatMarkdown'

const props = defineProps({
  tc: { type: Object, required: true },
})

const isSkill = computed(() => isSkillRead(props.tc.name, props.tc.input))
const iconName = computed(() => isSkill.value ? 'sparkle' : getToolIcon(props.tc.name))

function toolLabel(name) { return TOOL_LABELS[name] || name }
function toolContext(name, input) { return getToolContext(name, input) }
function toolStatusClass(status) {
  if (status === 'pending') return 'tool-pending'
  if (status === 'done') return 'tool-done'
  return ''
}
function formatToolInput(input) {
  if (!input) return '{}'
  if (typeof input === 'string') return input
  return JSON.stringify(input, null, 2)
}
function truncateOutput(output) {
  if (!output) return ''
  if (output.length > 2000) return output.slice(0, 2000) + '\n... [truncated]'
  return output
}
</script>
