<template>
  <div class="px-2 pb-2 pt-1" style="background: var(--bg-secondary);">
    <!-- Container: rounded border, no overflow-hidden -->
    <div
      class="rounded-lg border transition-all"
      :style="{
        borderColor: isFocused ? 'var(--accent)' : 'var(--border)',
        background: 'var(--bg-primary)',
        boxShadow: isFocused ? '0 0 0 1px var(--accent)' : 'none',
      }"
    >
      <!-- File chips (inside container, above textarea) -->
      <div v-if="fileRefs.length > 0" class="flex flex-wrap gap-1 px-2.5 pt-2">
        <span v-for="(ref, i) in fileRefs" :key="ref.path"
          class="inline-flex items-center gap-1 ui-text-lg px-1.5 py-0.5 rounded border"
          style="background: var(--bg-tertiary); border-color: var(--border); color: var(--fg-secondary);">
          {{ ref.path.split('/').pop() }}
          <button class="bg-transparent border-none cursor-pointer p-0 flex items-center"
            style="color: var(--fg-muted);"
            @click="removeFileRef(i)">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 2l6 6M8 2l-6 6"/>
            </svg>
          </button>
        </span>
      </div>

      <!-- Editor context chip -->
      <div v-if="editorContext" class="px-2.5 pt-2"
        :class="{ 'pt-1': fileRefs.length > 0 }">
        <span class="inline-flex items-center gap-1 ui-text-lg px-1.5 py-0.5 rounded border"
          style="background: var(--bg-tertiary); border-color: var(--accent); border-style: dashed; color: var(--fg-secondary); max-width: 100%;">
          <svg class="shrink-0" width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="var(--accent)" stroke-width="1.5">
            <path d="M6 3l-4 5 4 5M10 3l4 5-4 5"/>
          </svg>
          <span class="truncate" style="max-width: 220px;">"{{ truncatedSelection }}"</span>
          <button class="bg-transparent border-none cursor-pointer p-0 flex items-center shrink-0"
            style="color: var(--fg-muted);"
            @click="editorContext = null">
            <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 2l6 6M8 2l-6 6"/>
            </svg>
          </button>
        </span>
      </div>

      <!-- Textarea -->
      <div ref="textareaWrapperRef">
        <textarea
          ref="textareaRef"
          v-model="text"
          class="w-full resize-none bg-transparent px-2.5 py-2 ui-text-2xl outline-none"
          style="color: var(--fg-primary); font-family: inherit; line-height: 1.5; min-height: 36px; max-height: 160px; overflow-y: auto; border: none;"
          :placeholder="placeholder"
          :disabled="isStreaming"
          autocorrect="off"
          @input="onInput"
          @keydown="onKeydown"
          @focus="isFocused = true"
          @blur="isFocused = false"
        ></textarea>
      </div>

      <!-- Bottom action row: [@] [Model ▾] ———spacer——— [Send] -->
      <div class="flex items-center px-1.5 pb-1.5 gap-1">
        <!-- @ button (mousedown.prevent keeps textarea focused) -->
        <button
          class="p-1 rounded bg-transparent border-none cursor-pointer flex items-center transition-colors"
          style="color: var(--fg-muted);"
          title="Attach file (@)"
          @mousedown.prevent
          @click="triggerAtMention">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="4"/>
            <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/>
          </svg>
        </button>

        <!-- Model picker (left-aligned, next to @ button) -->
        <button
          ref="modelButtonRef"
          class="ui-text-lg px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none flex items-center gap-1"
          style="color: var(--fg-muted);"
          @click.stop="toggleModelPicker">
          {{ currentModelName }}
          <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor">
            <path d="M1 3l4 4 4-4z"/>
          </svg>
        </button>

        <!-- Token donut -->
        <div v-if="tokenPercent > 0"
          class="shrink-0 flex items-center token-donut-wrap">
          <svg width="16" height="16" viewBox="0 0 20 20">
            <!-- Background ring -->
            <circle cx="10" cy="10" r="7" fill="none"
              stroke="var(--border)" stroke-width="2.5" />
            <!-- Fill ring -->
            <circle cx="10" cy="10" r="7" fill="none"
              :stroke="donutColor" stroke-width="2.5"
              stroke-linecap="round"
              :stroke-dasharray="donutCircumference"
              :stroke-dashoffset="donutOffset"
              style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 0.3s ease;" />
          </svg>
          <span class="token-donut-tip">{{ tokenTooltip }}</span>
        </div>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Budget reached label -->
        <span v-if="isOverBudget" class="ui-text-lg" style="color: var(--error); margin-right: 4px;">Budget reached</span>

        <!-- Send button (rectangular, paper-plane icon) -->
        <button
          v-if="!isStreaming"
          class="shrink-0 w-7 h-7 rounded flex items-center justify-center border-none cursor-pointer transition-colors"
          :style="{
            background: canSend ? 'var(--accent)' : 'var(--bg-tertiary)',
            color: canSend ? 'var(--bg-primary)' : 'var(--fg-muted)',
          }"
          :disabled="!canSend"
          @click="send">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2.5 2.5l11 5.5-11 5.5V9.5L9 8l-6.5-1.5z"/>
          </svg>
        </button>
        <!-- Stop button -->
        <button
          v-else
          class="shrink-0 w-7 h-7 rounded flex items-center justify-center border-none cursor-pointer"
          style="background: var(--error); color: white;"
          @click="$emit('abort')">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="1" y="1" width="8" height="8" rx="1"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- File ref popover: Teleported to body to escape overflow-hidden ancestors -->
    <Teleport to="body">
      <div v-if="showFilePopover"
        class="fixed z-[100]"
        :style="popoverPos"
        @mousedown.prevent>
        <FileRefPopover
          ref="filePopoverRef"
          :filter="fileFilter"
          @select="onFileSelect"
          @close="showFilePopover = false"
        />
      </div>
    </Teleport>

    <!-- Model dropdown: Teleported to body to escape overflow-hidden ancestors -->
    <Teleport to="body">
      <template v-if="showModelPicker">
        <div class="fixed inset-0 z-[90]" @click="showModelPicker = false"></div>
        <div
          class="fixed z-[100] rounded border min-w-[160px] py-1"
          :style="modelDropdownPos"
          style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
          <template v-if="availableModels.length > 0">
            <div v-for="m in availableModels" :key="m.id"
              class="px-3 py-1.5 ui-text-base cursor-pointer hover:bg-[var(--bg-hover)] flex items-center"
              style="color: var(--fg-secondary);"
              @click="selectModel(m)">
              <span v-if="m.id === currentModelId" class="mr-1.5" style="color: var(--accent);">&#x2713;</span>
              <span v-else style="width: 16px; display: inline-block;"></span>
              {{ m.name }}
              <span v-if="showRouteBadges && m.route === 'direct'" class="route-label">API Key</span>
            </div>
          </template>
          <div v-else class="px-3 py-2 ui-text-sm" style="color: var(--fg-muted);">
            No models available. Add API keys in Settings or sign in.
          </div>
          <!-- Divider + Instructions -->
          <div class="my-1 border-t" style="border-color: var(--border);"></div>
          <div
            class="px-3 py-1.5 ui-text-base cursor-pointer hover:bg-[var(--bg-hover)] flex items-center gap-2"
            style="color: var(--fg-secondary);"
            @click="openInstructions(); showModelPicker = false">
            <IconNotes :size="14" :stroke-width="1.5" />
            Instructions
          </div>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { IconNotes } from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useUsageStore } from '../../stores/usage'
import { getBillingRoute } from '../../services/apiClient'
import { getViewerType } from '../../utils/fileTypes'
import FileRefPopover from './FileRefPopover.vue'

const props = defineProps({
  isStreaming: { type: Boolean, default: false },
  modelId: { type: String, default: '' },
  estimatedTokens: { type: Number, default: 0 },
  contextWindow: { type: Number, default: 200000 },
})

const emit = defineEmits(['send', 'abort', 'update-model'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const usageStore = useUsageStore()

const isOverBudget = computed(() => usageStore.isOverBudget)

const text = ref('')
const textareaRef = ref(null)
const textareaWrapperRef = ref(null)
const modelButtonRef = ref(null)
const filePopoverRef = ref(null)
const fileRefs = ref([])
const editorContext = ref(null)
const showFilePopover = ref(false)
const fileFilter = ref('')
const showModelPicker = ref(false)
const isFocused = ref(false)

// Fixed position for Teleported popovers (calculated from bounding rects)
const popoverPos = ref({})
const modelDropdownPos = ref({})

const canSend = computed(() => (text.value.trim() || fileRefs.value.length > 0) && !isOverBudget.value)

// Listen for external pre-fill requests (e.g., "Ask AI to fix" from LaTeX error panel)
function handleChatSetInput(e) {
  const { message } = e.detail || {}
  if (message) {
    text.value = message
    nextTick(() => {
      autoGrow()
      textareaRef.value?.focus()
    })
  }
}

// Listen for selection-to-chat events (Cmd+Shift+L or context menu "Ask AI")
function handleChatWithSelection(e) {
  const { file, text: selText, contextBefore, contextAfter } = e.detail || {}
  if (file && selText) {
    editorContext.value = {
      file,
      selection: true,
      text: selText,
      contextBefore: contextBefore || '',
      contextAfter: contextAfter || '',
    }
    nextTick(() => textareaRef.value?.focus())
  }
}

onMounted(() => {
  window.addEventListener('chat-set-input', handleChatSetInput)
  window.addEventListener('chat-with-selection', handleChatWithSelection)
})
onUnmounted(() => {
  window.removeEventListener('chat-set-input', handleChatSetInput)
  window.removeEventListener('chat-with-selection', handleChatWithSelection)
})

// Token donut
const tokenPercent = computed(() => {
  if (!props.estimatedTokens || !props.contextWindow) return 0
  return Math.min(100, Math.round((props.estimatedTokens / props.contextWindow) * 100))
})

const donutCircumference = 2 * Math.PI * 7 // r=7

const donutOffset = computed(() => {
  const pct = tokenPercent.value / 100
  return donutCircumference * (1 - pct)
})

const donutColor = computed(() => {
  const pct = tokenPercent.value
  if (pct >= 90) return 'var(--error)'
  if (pct >= 70) return 'var(--warning)'
  return 'var(--fg-muted)'
})

function formatTokens(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

const tokenTooltip = computed(() => {
  const pct = tokenPercent.value
  const used = formatTokens(props.estimatedTokens)
  const max = formatTokens(props.contextWindow)
  return `${pct}% used\n(${used} / ${max} tokens)`
})

const truncatedSelection = computed(() => {
  if (!editorContext.value) return ''
  const t = editorContext.value.text.replace(/\s+/g, ' ').trim()
  return t.length > 50 ? t.slice(0, 50) + '...' : t
})

const placeholder = computed(() => {
  if (editorContext.value) return 'Ask about selection...'
  return 'Message... (@ to attach files)'
})

const currentModelId = computed(() => props.modelId)
const currentModelName = computed(() => {
  const config = workspace.modelsConfig
  if (!config) return 'Sonnet'
  const model = config.models?.find(m => m.id === currentModelId.value)
  return model?.name || 'Sonnet'
})

const availableModels = computed(() => {
  const config = workspace.modelsConfig
  if (!config || !config.models) return []
  return config.models.map(m => {
    const providerConfig = config.providers?.[m.provider]
    const keyEnv = providerConfig?.apiKeyEnv
    const key = keyEnv ? workspace.apiKeys?.[keyEnv] : null
    const hasDirectKey = key && !key.includes('your-')
    const hasProxyAccess = !!workspace.shouldersAuth?.token
    const route = getBillingRoute(m.id, workspace)
    return { ...m, hasKey: hasDirectKey || hasProxyAccess, route: route?.route || null }
  }).filter(m => m.hasKey)
})

// Show route badges only when models have mixed billing routes
const showRouteBadges = computed(() => {
  const routes = new Set(availableModels.value.map(m => m.route).filter(Boolean))
  return routes.size > 1
})

function selectModel(m) {
  emit('update-model', m.id)
  showModelPicker.value = false
}

function toggleModelPicker() {
  if (showModelPicker.value) {
    showModelPicker.value = false
    return
  }
  // Calculate position from model button
  const el = modelButtonRef.value
  if (el) {
    const rect = el.getBoundingClientRect()
    modelDropdownPos.value = {
      bottom: (window.innerHeight - rect.top + 4) + 'px',
      left: rect.left + 'px',
    }
  }
  showModelPicker.value = true
}

// --- Input handling ---

function onInput() {
  autoGrow()
  checkAtTrigger()
}

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(160, Math.max(36, el.scrollHeight)) + 'px'
}

function checkAtTrigger() {
  const el = textareaRef.value
  if (!el) return
  const val = el.value
  const pos = el.selectionStart

  if (showFilePopover.value) {
    // Popover already open: track the filter text typed after @
    const atIdx = val.lastIndexOf('@', pos - 1)
    if (atIdx >= 0) {
      const filterText = val.substring(atIdx + 1, pos)
      if (filterText.includes(' ') || filterText.includes('\n')) {
        showFilePopover.value = false
      } else {
        fileFilter.value = filterText
      }
    } else {
      showFilePopover.value = false
    }
    return
  }

  // Detect fresh @ trigger: preceded by space/newline or at start
  if (pos > 0 && val[pos - 1] === '@' && (pos === 1 || val[pos - 2] === ' ' || val[pos - 2] === '\n')) {
    openFilePopover()
  }
}

function openFilePopover() {
  // Calculate position from textarea wrapper
  const el = textareaWrapperRef.value
  if (el) {
    const rect = el.getBoundingClientRect()
    popoverPos.value = {
      bottom: (window.innerHeight - rect.top + 4) + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
    }
  }
  showFilePopover.value = true
  fileFilter.value = ''
}

// @ button click: insert @ at cursor position and open popover
function triggerAtMention() {
  const el = textareaRef.value
  if (!el) return
  const pos = el.selectionStart
  const val = text.value
  const needsSpace = pos > 0 && val[pos - 1] !== ' ' && val[pos - 1] !== '\n'
  const insert = (needsSpace ? ' ' : '') + '@'
  text.value = val.substring(0, pos) + insert + val.substring(pos)
  nextTick(() => {
    el.focus()
    const newPos = pos + insert.length
    el.selectionStart = newPos
    el.selectionEnd = newPos
    openFilePopover()
  })
}

// --- File selection ---

async function onFileSelect(file) {
  showFilePopover.value = false

  // Remove @filter text from textarea
  const el = textareaRef.value
  if (el) {
    const val = el.value
    const pos = el.selectionStart
    const atIdx = val.lastIndexOf('@', pos - 1)
    if (atIdx >= 0) {
      text.value = val.substring(0, atIdx) + val.substring(pos)
      nextTick(() => {
        el.selectionStart = atIdx
        el.selectionEnd = atIdx
      })
    }
  }

  // Push then access via index (reactive proxy, not raw object)
  fileRefs.value.push({ path: file.path, content: '', loading: true })
  const idx = fileRefs.value.length - 1

  try {
    let content
    const viewerType = getViewerType(file.path)
    if (viewerType === 'pdf') {
      fileRefs.value[idx]._isPdf = true
      const { extractTextFromPdf } = await import('../../utils/pdfMetadata')
      content = await extractTextFromPdf(file.path)
    } else {
      content = await invoke('read_file', { path: file.path })
    }
    fileRefs.value[idx].content = content.length > 50000
      ? content.slice(0, 50000) + '\n... [truncated at 50KB]'
      : content
  } catch (e) {
    fileRefs.value[idx].content = `[Error reading file: ${e}]`
  }
  fileRefs.value[idx].loading = false

  nextTick(() => textareaRef.value?.focus())
}

function removeFileRef(idx) {
  fileRefs.value.splice(idx, 1)
}

// --- Keyboard ---

function onKeydown(e) {
  // When file popover is open, route keys to it
  if (showFilePopover.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      filePopoverRef.value?.selectNext()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      filePopoverRef.value?.selectPrev()
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      filePopoverRef.value?.confirmSelection()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      showFilePopover.value = false
      return
    }
    // All other keys: let through to textarea (updates filter via onInput)
  }

  // Normal Enter (no shift) → send
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
    return
  }

  // Escape → blur
  if (e.key === 'Escape') {
    textareaRef.value?.blur()
  }
}

// --- Send ---

function send() {
  if (props.isStreaming) return
  if (isOverBudget.value) return
  const trimmed = text.value.trim()
  if (!trimmed && fileRefs.value.length === 0) return

  // Auto-capture editor selection if not already set
  if (!editorContext.value) {
    const pane = editorStore.activePane
    if (pane && pane.activeTab) {
      const view = editorStore.getEditorView(pane.id, pane.activeTab)
      if (view) {
        const sel = view.state.selection.main
        if (sel.from !== sel.to) {
          editorContext.value = {
            file: pane.activeTab,
            selection: true,
            text: view.state.sliceDoc(sel.from, sel.to),
          }
        }
      }
    }
  }

  emit('send', {
    text: trimmed,
    fileRefs: [...fileRefs.value],
    context: editorContext.value,
  })

  text.value = ''
  fileRefs.value = []
  editorContext.value = null
  nextTick(() => {
    const el = textareaRef.value
    if (el) el.style.height = '36px'
  })
}

function openInstructions() {
  workspace.openInstructionsFile()
}

function focus() {
  nextTick(() => textareaRef.value?.focus())
}

defineExpose({ focus })
</script>

<style scoped>
.token-donut-wrap {
  position: relative;
  cursor: default;
}
.token-donut-tip {
  display: none;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  white-space: pre;
  font-size: calc(var(--ui-font-size) - 1px);
  line-height: 1.4;
  padding: 4px 8px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  border: 1px solid var(--border);
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  pointer-events: none;
  z-index: 50;
}
.token-donut-wrap:hover .token-donut-tip {
  display: block;
}

.route-label {
  margin-left: auto;
  font-size: 10px;
  color: var(--fg-muted);
  opacity: 0.7;
  flex-shrink: 0;
}
</style>
