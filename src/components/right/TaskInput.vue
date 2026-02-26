<template>
  <div class="px-2 pb-2 pt-1" style="background: var(--bg-secondary);">
    <div
      class="rounded-lg border transition-all"
      :style="{
        borderColor: isFocused ? 'var(--accent)' : 'var(--border)',
        background: 'var(--bg-primary)',
        boxShadow: isFocused ? '0 0 0 1px var(--accent)' : 'none',
      }"
    >
      <!-- File chips -->
      <div v-if="fileRefs.length > 0" class="flex flex-wrap gap-1 px-2.5 pt-2">
        <span v-for="(ref, i) in fileRefs" :key="ref.path"
          class="inline-flex items-center gap-1 ui-text-base px-1.5 py-0.5 rounded border"
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

      <!-- Textarea -->
      <div ref="textareaWrapperRef">
        <textarea
          ref="textareaRef"
          v-model="text"
          class="w-full resize-none bg-transparent px-2.5 py-2 ui-text-xl outline-none"
          style="color: var(--fg-primary); font-family: inherit; line-height: 1.5; min-height: 36px; max-height: 280px; overflow-y: auto; border: none;"
          placeholder="Reply... (@ to attach files)"
          :disabled="isStreaming"
          autocorrect="off"
          @input="onInput"
          @keydown="onKeydown"
          @focus="isFocused = true"
          @blur="isFocused = false"
        ></textarea>
      </div>

      <!-- Bottom row -->
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
          class="ui-text-base px-1.5 py-0.5 rounded cursor-pointer bg-transparent border-none flex items-center gap-0.5"
          style="color: var(--fg-muted);"
          @click.stop="toggleModelPicker">
          {{ currentModelName }}
          <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1 2.5l3 3 3-3z"/>
          </svg>
        </button>

        <div class="flex-1"></div>

        <!-- Send button -->
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

    <!-- File ref popover -->
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
              class="px-3 py-1.5 ui-text-lg cursor-pointer hover:bg-[var(--bg-hover)]"
              style="color: var(--fg-secondary);"
              @click="selectModel(m)">
              {{ m.name }}
              <span v-if="m.id === currentModelId" class="ml-1" style="color: var(--accent);">&#x2713;</span>
            </div>
          </template>
          <div v-else class="px-3 py-2 ui-text-md" style="color: var(--fg-muted);">
            No models available. Add API keys in Settings or sign in.
          </div>
        </div>
      </template>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../../stores/workspace'
import FileRefPopover from './FileRefPopover.vue'

const props = defineProps({
  isStreaming: { type: Boolean, default: false },
  modelId: { type: String, default: '' },
})

const emit = defineEmits(['send', 'abort', 'update-model'])

const workspace = useWorkspaceStore()

const text = ref('')
const textareaRef = ref(null)
const textareaWrapperRef = ref(null)
const modelButtonRef = ref(null)
const filePopoverRef = ref(null)
const fileRefs = ref([])
const showFilePopover = ref(false)
const fileFilter = ref('')
const showModelPicker = ref(false)
const isFocused = ref(false)

const popoverPos = ref({})
const modelDropdownPos = ref({})

const canSend = computed(() => text.value.trim() || fileRefs.value.length > 0)

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
    return { ...m, hasKey: hasDirectKey || hasProxyAccess }
  }).filter(m => m.hasKey)
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

function onInput() {
  autoGrow()
  checkAtTrigger()
}

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(100, Math.max(36, el.scrollHeight)) + 'px'
}

function checkAtTrigger() {
  const el = textareaRef.value
  if (!el) return
  const val = el.value
  const pos = el.selectionStart

  if (showFilePopover.value) {
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

  if (pos > 0 && val[pos - 1] === '@' && (pos === 1 || val[pos - 2] === ' ' || val[pos - 2] === '\n')) {
    openFilePopover()
  }
}

function openFilePopover() {
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

async function onFileSelect(file) {
  showFilePopover.value = false

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

  fileRefs.value.push({ path: file.path, content: '', loading: true })
  const idx = fileRefs.value.length - 1

  try {
    const content = await invoke('read_file', { path: file.path })
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

function onKeydown(e) {
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
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    send()
    return
  }

  if (e.key === 'Escape') {
    textareaRef.value?.blur()
  }
}

function send() {
  if (props.isStreaming) return
  const trimmed = text.value.trim()
  if (!trimmed && fileRefs.value.length === 0) return

  emit('send', {
    text: trimmed,
    fileRefs: [...fileRefs.value],
  })

  text.value = ''
  fileRefs.value = []
  nextTick(() => {
    const el = textareaRef.value
    if (el) el.style.height = '36px'
  })
}

function focus() {
  nextTick(() => textareaRef.value?.focus())
}

defineExpose({ focus })
</script>
