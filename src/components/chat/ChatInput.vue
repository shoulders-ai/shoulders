<template>
  <div class="px-2 pb-2 pt-1">
    <!-- Container: rounded border -->
    <div
      class="rounded-md border transition-all"
      :style="{
        borderColor: isFocused ? 'var(--accent)' : 'var(--border)',
        background: isLightTheme ? 'var(--bg-primary)' : 'var(--bg-secondary)',
        boxShadow: isFocused
          ? (isLightTheme ? '0 0 0 1.5px var(--accent)' : 'none')
          : (isLightTheme ? '0 2px 14px rgba(0,0,0,0.06)' : 'none'),
      }"
    >
      <!-- Rich text input (contenteditable — supports inline @mentions and context pills) -->
      <div class="px-2.5 py-2">
        <RichTextInput
          ref="richInputRef"
          :placeholder="placeholder"
          :models="availableModels"
          :on-model-select="handleModelSelect"
          @submit="send"
          @input="onRichInput"
          @focus="isFocused = true"
          @blur="isFocused = false"
        />
      </div>

      <!-- Bottom action row: [@] [Model ▾] ———spacer——— [token donut] [Send] -->
      <div class="flex items-center px-1.5 pb-1.5 gap-1">
        <!-- @ button -->
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

        <!-- Model picker -->
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

        <!-- Review mode toggle -->
        <button
          class="ui-text-lg px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none flex items-center"
          :style="reviews.directMode
            ? { color: 'var(--warning)' }
            : { color: 'var(--fg-muted)', opacity: '0.6' }"
          title="Controls how AI-suggested edits are applied — affects all AI features"
          @click="reviews.toggleDirectMode()">
          {{ reviews.directMode ? 'Auto-apply' : 'Review changes' }}
        </button>

        <!-- Spacer -->
        <div class="flex-1"></div>

        <!-- Budget reached label -->
        <span v-if="isOverBudget" class="ui-text-lg" style="color: var(--error); margin-right: 4px;">Budget reached</span>

        <!-- Token donut -->
        <div v-if="props.estimatedTokens !== null"
          class="shrink-0 flex items-center token-donut-wrap px-1">
          <svg width="18" height="18" viewBox="0 0 20 20">
            <circle cx="10" cy="10" r="7" fill="none"
              stroke="var(--border)" stroke-width="3" />
            <circle cx="10" cy="10" r="7" fill="none"
              :stroke="donutColor" stroke-width="3"
              stroke-linecap="round"
              :stroke-dasharray="donutCircumference"
              :stroke-dashoffset="donutOffset"
              style="transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset 0.3s ease;" />
          </svg>
          <span class="token-donut-tip">{{ tokenTooltip }}</span>
        </div>

        <!-- Send button -->
        <button
          v-if="!isStreaming"
          class="shrink-0 w-7 h-7 rounded flex items-center justify-center border-none cursor-pointer transition-colors mx-1"
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
          class="shrink-0 w-7 h-7 rounded flex items-center justify-center border-none cursor-pointer ml-1"
          style="background: var(--error); color: white;"
          @click="$emit('abort')">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <rect x="1" y="1" width="8" height="8" rx="1"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Model dropdown -->
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
              <span v-if="m.recommended" class="recommended-badge">default</span>
              <span v-else-if="showRouteBadges && m.route === 'direct'" class="route-label">API Key</span>
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
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { IconNotes } from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useEditorStore } from '../../stores/editor'
import { useUsageStore } from '../../stores/usage'
import { useChatStore } from '../../stores/chat'
import { useReviewsStore } from '../../stores/reviews'
import { getBillingRoute } from '../../services/apiClient'
import RichTextInput from '../shared/RichTextInput.vue'

const props = defineProps({
  isStreaming:      { type: Boolean, default: false },
  modelId:          { type: String,  default: '' },
  estimatedTokens:  { type: Number,  default: null },
  contextWindow:    { type: Number,  default: 200000 },
  sessionId:        { type: String,  default: '' },
})

const emit = defineEmits(['send', 'abort', 'update-model'])

const workspace   = useWorkspaceStore()
const editorStore = useEditorStore()
const usageStore  = useUsageStore()
const chatStore   = useChatStore()
const reviews     = useReviewsStore()

const isOverBudget = computed(() => usageStore.isOverBudget)

const isLightTheme = computed(() =>
  ['light', 'one-light', 'humane', 'solarized'].includes(workspace.theme)
)

const richInputRef    = ref(null)
const modelButtonRef  = ref(null)
const isFocused       = ref(false)
const hasContent      = ref(false)   // tracks whether richInput is empty (for canSend)
const showModelPicker = ref(false)
const modelDropdownPos = ref({})

const canSend = computed(() => hasContent.value && !isOverBudget.value)

// Keep hasContent in sync with RichTextInput changes
function onRichInput() {
  hasContent.value = richInputRef.value ? !richInputRef.value.isEmpty() : false
}

// Pre-fill from suggestion chips ("Ask about selection", etc.)
function handleChatSetInput(e) {
  if (props.sessionId && chatStore.activeSessionId !== props.sessionId) return
  const { message } = e.detail || {}
  if (message && richInputRef.value) {
    richInputRef.value.setText(message)
    onRichInput()
  }
}

// Selection-to-chat: insert context pill inline
function handleChatWithSelection(e) {
  if (props.sessionId && chatStore.activeSessionId !== props.sessionId) return
  chatStore.pendingSelection = null  // clear on any consumption
  const { file, text: selText, contextBefore, contextAfter } = e.detail || {}
  if (file && selText && richInputRef.value) {
    richInputRef.value.insertContextPill({
      file,
      selection: true,
      text: selText,
      contextBefore: contextBefore || '',
      contextAfter:  contextAfter  || '',
    })
    nextTick(() => richInputRef.value?.focus())
  }
}

onMounted(() => {
  window.addEventListener('chat-set-input',        handleChatSetInput)
  window.addEventListener('chat-with-selection',   handleChatWithSelection)
  // Consume any prefill/selection queued before this async component finished mounting
  if (chatStore.pendingPrefill) {
    handleChatSetInput({ detail: { message: chatStore.pendingPrefill } })
    chatStore.pendingPrefill = null
  }
  if (chatStore.pendingSelection) {
    handleChatWithSelection({ detail: chatStore.pendingSelection })
    // handleChatWithSelection clears pendingSelection itself
  }
})
onUnmounted(() => {
  window.removeEventListener('chat-set-input',       handleChatSetInput)
  window.removeEventListener('chat-with-selection',  handleChatWithSelection)
})

// ─── Token donut ─────────────────────────────────────────────────────────────

const tokenPercent = computed(() => {
  if (props.estimatedTokens === null || !props.contextWindow) return 0
  return Math.min(100, Math.round((props.estimatedTokens / props.contextWindow) * 100))
})

const donutCircumference = 2 * Math.PI * 7

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
  const pct  = tokenPercent.value
  const used = formatTokens(props.estimatedTokens)
  const max  = formatTokens(props.contextWindow)
  return `${pct}% used\n(${used} / ${max} tokens)`
})

// ─── Placeholder ──────────────────────────────────────────────────────────────

const placeholder = computed(() => 'Message... (@ to attach files)')

// ─── Model picker ─────────────────────────────────────────────────────────────

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
  // Determine if user has ANY direct API key (vs Shoulders-account-only)
  const hasAnyDirectKey = config.models.some(m => {
    const keyEnv = config.providers?.[m.provider]?.apiKeyEnv
    const key = keyEnv ? workspace.apiKeys?.[keyEnv] : null
    return key && !key.includes('your-')
  })
  const isShouldersOnly = !hasAnyDirectKey && !!workspace.shouldersAuth?.token
  return config.models.map(m => {
    const providerConfig = config.providers?.[m.provider]
    const keyEnv = providerConfig?.apiKeyEnv
    const key = keyEnv ? workspace.apiKeys?.[keyEnv] : null
    const hasDirectKey = key && !key.includes('your-')
    const hasProxyAccess = !!workspace.shouldersAuth?.token
    const route = getBillingRoute(m.id, workspace)
    const recommended = isShouldersOnly && m.id.toLowerCase().includes('sonnet')
    return { ...m, hasKey: hasDirectKey || hasProxyAccess, route: route?.route || null, recommended }
  }).filter(m => m.hasKey)
})

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

// ─── Actions ──────────────────────────────────────────────────────────────────

function triggerAtMention() {
  richInputRef.value?.triggerAtMention()
}

function send() {
  if (props.isStreaming || isOverBudget.value) return
  if (!richInputRef.value) return

  const { text, fileRefs, context } = richInputRef.value.extractPayload()

  // Auto-capture editor selection if no explicit context pill
  let finalContext = context
  if (!finalContext) {
    const pane = editorStore.activePane
    if (pane && pane.activeTab) {
      const view = editorStore.getEditorView(pane.id, pane.activeTab)
      if (view) {
        const sel = view.state.selection.main
        if (sel.from !== sel.to) {
          finalContext = {
            file:      pane.activeTab,
            selection: true,
            text:      view.state.sliceDoc(sel.from, sel.to),
          }
        }
      }
    }
  }

  if (!text && fileRefs.length === 0) return

  const richHtml = richInputRef.value.getSerializedHtml()
  emit('send', { text, fileRefs, context: finalContext, richHtml })
  richInputRef.value.clear()
  hasContent.value = false
}

function handleModelSelect(modelId) {
  const m = availableModels.value.find(m => m.id === modelId)
  if (m) selectModel(m)
}

function openInstructions() {
  workspace.openInstructionsFile()
}

function focus() {
  richInputRef.value?.focus()
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

.recommended-badge {
  margin-left: auto;
  font-size: 10px;
  background: var(--accent);
  color: var(--bg-primary);
  padding: 1px 5px;
  border-radius: 3px;
  opacity: 0.85;
  flex-shrink: 0;
}
</style>
