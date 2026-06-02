<template>
  <div class="h-full flex flex-col">
    <!-- Scrollable message area -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto min-h-0">
      <div class="w-full mx-auto px-4 py-4" style="max-width: min(80ch, 100%);">
        <template v-for="(group, gi) in stepGroups" :key="gi">

          <!-- Receipt -->
          <div v-if="group.type === 'receipt'" class="mb-4 pb-4 border-b border-line">
            <div class="text-content font-medium ui-text-lg mb-1">{{ group.msg.workflowName }}</div>
            <div v-if="group.msg.description" class="text-content-secondary ui-text-base mb-2">{{ group.msg.description }}</div>
            <div v-if="group.msg.inputs && Object.keys(group.msg.inputs).length" class="flex flex-col gap-0.5">
              <div
                v-for="(value, key) in group.msg.inputs"
                :key="key"
                class="ui-text-sm text-content-muted"
              >
                <span class="text-content-secondary">{{ key }}:</span>
                {{ typeof value === 'string' && value.includes('/') ? value.split('/').pop() : value }}
              </div>
            </div>
          </div>

          <!-- Step group -->
          <div v-else-if="group.type === 'step'" class="mt-3">
            <!-- Step header — clickable to toggle -->
            <button
              class="flex items-center gap-2 w-full bg-transparent border-none text-left cursor-pointer py-1 group"
              @click="toggleStep(group.step.name)"
            >
              <!-- Expand chevron -->
              <svg class="shrink-0 text-content-muted transition-transform duration-150"
                :style="{ transform: isStepVisible(group) ? 'rotate(90deg)' : '' }"
                width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
                <path d="M2 1l4 3-4 3z"/>
              </svg>

              <!-- Status indicator -->
              <div v-if="group.step.status === 'running'" class="workflow-step-active shrink-0"></div>
              <span v-else-if="group.step.status === 'completed'" class="text-success ui-text-sm leading-none select-none">&#10003;</span>
              <span v-else class="text-error ui-text-sm leading-none select-none">&#10007;</span>

              <!-- Step name -->
              <span class="text-content font-medium ui-text-base">{{ group.step.name }}</span>

              <!-- Summary (completed only, truncated) -->
              <span v-if="group.step.status === 'completed' && group.step.summary"
                class="text-content-muted ui-text-sm truncate flex-1 min-w-0">
                {{ group.step.summary }}
              </span>

              <!-- Duration -->
              <span v-if="group.step.completedAt && group.step.startedAt"
                class="text-content-muted ui-text-sm shrink-0 ml-auto tabular-nums">
                {{ formatDuration(group.step.startedAt, group.step.completedAt) }}
              </span>
            </button>

            <!-- Step content (collapsible) -->
            <div v-if="isStepVisible(group)" class="pl-4 mt-1 border-l-2 border-line/30">
              <template v-for="(msg, ci) in group.children" :key="ci">

                <!-- AI output — reuse ChatMessage -->
                <div v-if="msg.type === 'ai-output'" class="my-1">
                  <ChatMessage
                    :message="msg"
                    :isLastAssistant="isLastAiOutputInGroup(group, ci)"
                  />
                </div>

                <!-- Log message -->
                <div v-else-if="msg.type === 'log'" class="text-content-muted ui-text-sm py-0.5">
                  {{ msg.message }}
                </div>

                <!-- Interaction (only show responded ones here — pending ones are promoted above) -->
                <div v-else-if="msg.type === 'interaction' && !(msg.response === null && run.pendingInteraction)" class="my-3 border-l-2 border-accent/30 pl-3">
                  <!-- Prompt -->
                  <div class="text-content ui-text-base mb-2">{{ msg.prompt }}</div>

                  <!-- Already responded -->
                  <template v-if="msg.response !== null">
                    <div v-if="msg.kind === 'confirm'" class="ui-text-sm text-content-muted">
                      {{ msg.response ? 'Confirmed' : 'Declined' }}
                    </div>
                    <div v-else-if="msg.kind === 'approve'" class="ui-text-sm"
                      :class="msg.response === 'approve' ? 'text-success' : 'text-error'">
                      {{ msg.response === 'approve' ? 'Approved' : 'Rejected' }}
                    </div>
                    <div v-else-if="msg.kind === 'form'" class="ui-text-sm text-content-muted">
                      <div v-for="(val, key) in msg.response" :key="key">
                        <span class="text-content-secondary">{{ key }}:</span> {{ val }}
                      </div>
                    </div>
                    <div v-else-if="msg.kind === 'pickModel'" class="ui-text-sm text-content-muted">
                      Model: {{ msg.response }}
                    </div>
                    <div v-else class="ui-text-sm text-content-muted italic">
                      {{ typeof msg.response === 'string' ? msg.response : JSON.stringify(msg.response) }}
                    </div>
                  </template>

                  <!-- Pending — show interactive controls -->
                  <template v-else-if="isPendingInteraction(msg)">
                    <!-- Chat input -->
                    <div v-if="msg.kind === 'chat'" class="flex gap-2 mt-1">
                      <input
                        v-model="chatInput"
                        type="text"
                        placeholder="Type your response..."
                        class="flex-1 bg-surface-secondary border border-line rounded px-2.5 py-1.5 ui-text-base text-content placeholder:text-content-muted outline-none focus:border-accent"
                        @keydown.enter="respondChat"
                      />
                      <button
                        class="shrink-0 px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25"
                        :disabled="!chatInput.trim()"
                        @click="respondChat"
                      >
                        Send
                      </button>
                    </div>

                    <!-- Confirm -->
                    <div v-else-if="msg.kind === 'confirm'" class="flex gap-2 mt-1">
                      <button
                        class="px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25"
                        @click="respond(true)"
                      >Yes</button>
                      <button
                        class="px-3 py-1.5 bg-surface-secondary text-content-secondary rounded ui-text-base hover:bg-surface-tertiary"
                        @click="respond(false)"
                      >No</button>
                    </div>

                    <!-- Approve -->
                    <div v-else-if="msg.kind === 'approve'" class="mt-1">
                      <div v-if="msg.details" class="chat-md ui-text-sm text-content-secondary mb-2 bg-surface-secondary rounded p-2 max-h-48 overflow-y-auto"
                        v-html="renderMarkdown(msg.details)">
                      </div>
                      <div class="flex gap-2">
                        <button
                          class="px-3 py-1.5 bg-success/15 text-success rounded ui-text-base hover:bg-success/25"
                          @click="respond('approve')"
                        >Approve</button>
                        <button
                          class="px-3 py-1.5 bg-error/15 text-error rounded ui-text-base hover:bg-error/25"
                          @click="respond('reject')"
                        >Reject</button>
                      </div>
                    </div>

                    <!-- Form -->
                    <div v-else-if="msg.kind === 'form' && msg.schema" class="mt-1">
                      <WorkflowFormRenderer
                        :schema="msg.schema"
                        v-model="formValues"
                        class="mb-3"
                      />
                      <button
                        class="px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25"
                        @click="respondForm"
                      >Submit</button>
                    </div>

                    <!-- Pick Model -->
                    <div v-else-if="msg.kind === 'pickModel'" class="mt-1">
                      <div class="text-content-secondary ui-text-sm mb-2">Select a model</div>
                      <div class="flex flex-wrap gap-1.5">
                        <button v-for="m in availableModels" :key="m.id"
                          class="px-3 py-1.5 bg-surface-secondary text-content rounded ui-text-sm hover:bg-accent/15 hover:text-accent border border-line/50"
                          @click="respond(m.id)"
                        >{{ m.label }}</button>
                      </div>
                    </div>
                  </template>
                </div>

              </template>
            </div>
          </div>

          <!-- Pending interaction — promoted to top-level, outside step collapse -->
          <div v-if="group.type === 'step' && hasPendingChild(group)" class="mt-3 ml-0">
            <div
              v-for="(msg, ci) in group.children.filter(c => c.type === 'interaction' && c.response === null && run.pendingInteraction)"
              :key="'pending-' + ci"
              class="rounded-lg border border-accent/30 bg-accent/5 p-4"
            >
              <!-- Header -->
              <div class="flex items-center gap-2 mb-3">
                <div class="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
                <span class="ui-text-sm text-accent font-medium">{{ group.step.name }}</span>
              </div>

              <!-- Approve -->
              <template v-if="msg.kind === 'approve'">
                <div v-if="msg.title" class="text-content font-medium ui-text-base mb-2">{{ msg.title }}</div>
                <div v-if="msg.details"
                  class="chat-md ui-text-sm text-content-secondary mb-3 bg-surface rounded-lg p-3 max-h-72 overflow-y-auto border border-line/30"
                  v-html="renderMarkdown(msg.details)">
                </div>
                <div class="flex gap-2">
                  <button class="px-4 py-2 bg-success/15 text-success rounded font-medium ui-text-base hover:bg-success/25" @click="respond('approve')">Approve</button>
                  <button class="px-4 py-2 bg-error/15 text-error rounded font-medium ui-text-base hover:bg-error/25" @click="respond('reject')">Reject</button>
                </div>
              </template>

              <!-- Chat -->
              <template v-else-if="msg.kind === 'chat'">
                <div class="text-content ui-text-base mb-2">{{ msg.prompt }}</div>
                <div class="flex gap-2">
                  <input v-model="chatInput" type="text" placeholder="Type your response..."
                    class="flex-1 bg-surface border border-line rounded px-2.5 py-1.5 ui-text-base text-content placeholder:text-content-muted outline-none focus:border-accent"
                    @keydown.enter="respondChat" />
                  <button class="shrink-0 px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25"
                    :disabled="!chatInput.trim()" @click="respondChat">Send</button>
                </div>
              </template>

              <!-- Confirm -->
              <template v-else-if="msg.kind === 'confirm'">
                <div class="text-content ui-text-base mb-2">{{ msg.prompt }}</div>
                <div class="flex gap-2">
                  <button class="px-4 py-2 bg-accent/15 text-accent rounded font-medium ui-text-base hover:bg-accent/25" @click="respond(true)">Yes</button>
                  <button class="px-4 py-2 bg-surface-secondary text-content-secondary rounded font-medium ui-text-base hover:bg-surface-tertiary" @click="respond(false)">No</button>
                </div>
              </template>

              <!-- Form -->
              <template v-else-if="msg.kind === 'form' && msg.schema">
                <WorkflowFormRenderer :schema="msg.schema" v-model="formValues" class="mb-3" />
                <button class="px-4 py-2 bg-accent/15 text-accent rounded font-medium ui-text-base hover:bg-accent/25" @click="respondForm">Submit</button>
              </template>

              <!-- Pick Model -->
              <template v-else-if="msg.kind === 'pickModel'">
                <div class="text-content ui-text-base mb-2">Select a model</div>
                <div class="flex flex-wrap gap-2">
                  <button v-for="m in availableModels" :key="m.id"
                    class="px-4 py-2 bg-surface text-content rounded font-medium ui-text-base hover:bg-accent/15 hover:text-accent border border-line/50"
                    @click="respond(m.id)"
                  >{{ m.label }}</button>
                </div>
              </template>
            </div>
          </div>

          <!-- Finish -->
          <div v-else-if="group.type === 'finish'" class="mt-4 pt-4 border-t border-line">
            <div class="chat-md ui-text-lg text-content workflow-finish-files" v-html="renderFinish(group.msg.output)" @click="handleFinishClick"></div>
          </div>

          <!-- Error -->
          <div v-else-if="group.type === 'error'" class="bg-error/10 text-error rounded-lg p-3 my-2 ui-text-base">
            {{ group.msg.message }}
          </div>

          <!-- Orphan messages (outside any step) -->
          <template v-else-if="group.type === 'orphan'">
            <div v-if="group.msg.type === 'ai-output'" class="my-1">
              <ChatMessage
                :message="group.msg"
                :isLastAssistant="false"
              />
            </div>
            <div v-else-if="group.msg.type === 'log'" class="text-content-muted ui-text-sm pl-4 py-0.5">
              {{ group.msg.message }}
            </div>
            <div v-else-if="group.msg.type === 'interaction' && !(group.msg.response === null && run.pendingInteraction)" class="my-3 pl-4 border-l-2 border-accent/30">
              <div class="text-content ui-text-base mb-2">{{ group.msg.prompt }}</div>
              <template v-if="group.msg.response !== null">
                <div v-if="group.msg.kind === 'confirm'" class="ui-text-sm text-content-muted">
                  {{ group.msg.response ? 'Confirmed' : 'Declined' }}
                </div>
                <div v-else-if="group.msg.kind === 'approve'" class="ui-text-sm"
                  :class="group.msg.response === 'approve' ? 'text-success' : 'text-error'">
                  {{ group.msg.response === 'approve' ? 'Approved' : 'Rejected' }}
                </div>
                <div v-else class="ui-text-sm text-content-muted italic">
                  {{ typeof group.msg.response === 'string' ? group.msg.response : JSON.stringify(group.msg.response) }}
                </div>
              </template>
              <template v-else-if="isPendingInteraction(group.msg)">
                <div v-if="group.msg.kind === 'chat'" class="flex gap-2 mt-1">
                  <input
                    v-model="chatInput"
                    type="text"
                    placeholder="Type your response..."
                    class="flex-1 bg-surface-secondary border border-line rounded px-2.5 py-1.5 ui-text-base text-content placeholder:text-content-muted outline-none focus:border-accent"
                    @keydown.enter="respondChat"
                  />
                  <button
                    class="shrink-0 px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25"
                    :disabled="!chatInput.trim()"
                    @click="respondChat"
                  >Send</button>
                </div>
                <div v-else-if="group.msg.kind === 'confirm'" class="flex gap-2 mt-1">
                  <button class="px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25" @click="respond(true)">Yes</button>
                  <button class="px-3 py-1.5 bg-surface-secondary text-content-secondary rounded ui-text-base hover:bg-surface-tertiary" @click="respond(false)">No</button>
                </div>
                <div v-else-if="group.msg.kind === 'approve'" class="mt-1">
                  <div v-if="group.msg.details" class="ui-text-sm text-content-secondary mb-2 bg-surface-secondary rounded p-2">{{ group.msg.details }}</div>
                  <div class="flex gap-2">
                    <button class="px-3 py-1.5 bg-success/15 text-success rounded ui-text-base hover:bg-success/25" @click="respond('approve')">Approve</button>
                    <button class="px-3 py-1.5 bg-error/15 text-error rounded ui-text-base hover:bg-error/25" @click="respond('reject')">Reject</button>
                  </div>
                </div>
                <div v-else-if="group.msg.kind === 'form' && group.msg.schema" class="mt-1">
                  <WorkflowFormRenderer :schema="group.msg.schema" v-model="formValues" class="mb-3" />
                  <button class="px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25" @click="respondForm">Submit</button>
                </div>
                <div v-else-if="group.msg.kind === 'pickModel'" class="mt-1">
                  <div class="flex flex-wrap gap-1.5">
                    <button v-for="m in availableModels" :key="m.id"
                      class="px-3 py-1.5 bg-surface-secondary text-content rounded ui-text-sm hover:bg-accent/15 hover:text-accent border border-line/50"
                      @click="respond(m.id)"
                    >{{ m.label }}</button>
                  </div>
                </div>
              </template>
            </div>
          </template>

        </template>
      </div>
    </div>

    <!-- Bottom action bar -->
    <div v-if="run.status !== 'running'" class="flex items-center gap-2 px-4 py-3 border-t border-line">
      <button
        v-if="run.status === 'completed' && finishOutput"
        class="px-3 py-1.5 bg-accent/15 text-accent rounded ui-text-base hover:bg-accent/25"
        @click="saveAsFile"
      >Save as file</button>
      <button
        v-if="run.status === 'completed' && finishOutput"
        class="px-3 py-1.5 bg-surface-secondary text-content-secondary rounded ui-text-base hover:bg-surface-tertiary"
        @click="copyOutput"
      >{{ copied ? 'Copied' : 'Copy' }}</button>
      <button
        v-if="run.status === 'completed' && finishOutput"
        class="px-3 py-1.5 bg-surface-secondary text-content-secondary rounded ui-text-base hover:bg-surface-tertiary"
        @click="discussInChat"
      >Discuss in chat</button>
      <button
        class="px-3 py-1.5 bg-surface-secondary text-content-secondary rounded ui-text-base hover:bg-surface-tertiary"
        @click="$emit('rerun')"
      >Re-run</button>
    </div>

    <!-- Cancel button (while running) -->
    <div v-else class="flex items-center gap-2 px-4 py-3 border-t border-line">
      <button
        class="px-3 py-1.5 bg-error/15 text-error rounded ui-text-base hover:bg-error/25"
        @click="$emit('cancel')"
      >Cancel</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { renderMarkdown } from '../../utils/chatMarkdown'
import { useWorkflowsStore } from '../../stores/workflows'
import { useWorkspaceStore } from '../../stores/workspace'
import { resolveAbsPath } from '../../utils/paths'
import ChatMessage from '../chat/ChatMessage.vue'
import WorkflowFormRenderer from './WorkflowFormRenderer.vue'

const props = defineProps({
  run: { type: Object, required: true },
  runId: { type: String, required: true },
})

const emit = defineEmits(['cancel', 'rerun'])

const workflowsStore = useWorkflowsStore()
const workspace = useWorkspaceStore()

const availableModels = computed(() =>
  workspace.modelsConfig?.models?.map(m => ({ id: m.id, label: m.id, provider: m.provider })) || []
)

// ─── Interaction state ────────────────────────────────────────────

const chatInput = ref('')
const formValues = reactive({})
const copied = ref(false)

// ─── Scroll ───────────────────────────────────────────────────────

const scrollContainer = ref(null)

watch(
  () => props.run.messages.length,
  () => {
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
      }
    })
  }
)

// Also scroll on streaming text changes
watch(
  () => props.run.streamingText,
  () => {
    nextTick(() => {
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
      }
    })
  }
)

// ─── Step grouping ───────────────────────────────────────────────

const stepGroups = computed(() => {
  const groups = []
  let currentGroup = null

  for (const msg of props.run.messages) {
    if (msg.type === 'receipt') {
      groups.push({ type: 'receipt', msg })
      currentGroup = null
    } else if (msg.type === 'step') {
      currentGroup = { type: 'step', step: msg, children: [] }
      groups.push(currentGroup)
    } else if (msg.type === 'finish') {
      currentGroup = null
      groups.push({ type: 'finish', msg })
    } else if (msg.type === 'error') {
      currentGroup = null
      groups.push({ type: 'error', msg })
    } else if (currentGroup) {
      currentGroup.children.push(msg)
    } else {
      groups.push({ type: 'orphan', msg })
    }
  }

  return groups
})

// ─── Expand/collapse state ────────────────────────────────────────

const expandedSteps = reactive({})

function isStepExpanded(stepName) {
  if (expandedSteps[stepName] !== undefined) return expandedSteps[stepName]
  // Default: collapsed for completed steps
  return false
}

function isStepVisible(group) {
  // Running steps are ALWAYS visible (can't collapse active work)
  if (group.step.status === 'running') return true
  // User-toggled
  return isStepExpanded(group.step.name)
}

function toggleStep(stepName) {
  expandedSteps[stepName] = !isStepExpanded(stepName)
}

// ─── Helpers ──────────────────────────────────────────────────────

function isLastAiOutputInGroup(group, childIndex) {
  // Only show streaming dots if the run is actively running
  if (props.run.status !== 'running') return false
  // Only the running step can have streaming
  if (group.step.status !== 'running') return false
  // Check if this child is the last ai-output in the group
  for (let i = group.children.length - 1; i >= 0; i--) {
    if (group.children[i].type === 'ai-output') {
      return i === childIndex
    }
  }
  return false
}

function isPendingInteraction(msg) {
  return props.run.pendingInteraction && msg.response === null
}

function formatDuration(start, end) {
  const startMs = start instanceof Date ? start.getTime() : new Date(start).getTime()
  const endMs = end instanceof Date ? end.getTime() : new Date(end).getTime()
  const sec = Math.round((endMs - startMs) / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`
}

function renderFinish(output) {
  if (!output) return ''
  return renderMarkdown(output)
}

function hasPendingChild(group) {
  if (!props.run.pendingInteraction) return false
  return group.children?.some(c => c.type === 'interaction' && c.response === null)
}

function renderMd(text) {
  if (!text) return ''
  return renderMarkdown(text)
}

const finishOutput = computed(() => {
  const finish = props.run.messages.find(m => m.type === 'finish')
  return finish?.output || ''
})

// ─── Interaction responses ────────────────────────────────────────

function respond(value) {
  workflowsStore.respondToInteraction(props.runId, value)
}

function respondChat() {
  const text = chatInput.value.trim()
  if (!text) return
  workflowsStore.respondToInteraction(props.runId, text)
  chatInput.value = ''
}

function respondForm() {
  workflowsStore.respondToInteraction(props.runId, { ...formValues })
}

// ─── Output actions ───────────────────────────────────────────────

async function copyOutput() {
  if (!finishOutput.value) return
  try {
    await navigator.clipboard.writeText(finishOutput.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch (e) {
    console.warn('Copy failed:', e)
  }
}

async function discussInChat() {
  if (!finishOutput.value) return

  const { useAISidebarStore } = await import('../../stores/aiSidebar')
  const aiSidebar = useAISidebarStore()

  const workflowName = props.run.workflow?.name || 'Workflow'
  const inputsSummary = Object.entries(props.run.inputs || {})
    .map(([k, v]) => `${k}: ${typeof v === 'string' && v.includes('/') ? v.split('/').pop() : v}`)
    .filter(s => s)
    .join(', ')

  const contextText = `I just ran the "${workflowName}" workflow${inputsSummary ? ` (${inputsSummary})` : ''}. Here are the results:\n\n<workflow-output name="${workflowName}">\n${finishOutput.value}\n</workflow-output>\n\nPlease help me understand, refine, or iterate on these results.`

  await aiSidebar.createChatAndDrillIn({ text: contextText })
}

async function handleFinishClick(event) {
  const code = event.target.closest('code')
  if (!code) return
  const text = code.textContent.trim()
  // Looks like a file path: has a slash, no spaces, has an extension
  if (text && text.includes('/') && !text.includes(' ') && /\.\w+$/.test(text)) {
    const workspace = (await import('../../stores/workspace')).useWorkspaceStore()
    const { useEditorStore } = await import('../../stores/editor')
    const editor = useEditorStore()
    const absPath = resolveAbsPath(text, workspace.path)
    editor.openFile(absPath)
  }
}

async function saveAsFile() {
  if (!finishOutput.value) return
  try {
    const { save } = await import('@tauri-apps/plugin-dialog')
    const path = await save({
      defaultPath: `${props.run.workflow?.name?.toLowerCase().replace(/\s+/g, '-') || 'output'}.md`,
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })
    if (path) {
      await invoke('write_file', { path, content: finishOutput.value })
    }
  } catch (e) {
    console.warn('Save failed:', e)
  }
}
</script>

<style scoped>
.workflow-finish-files :deep(code) {
  cursor: pointer;
}
.workflow-finish-files :deep(li code:hover) {
  text-decoration: underline;
  color: rgb(var(--accent));
}
</style>
