<template>
  <div
    class="comment-input-wrapper"
    :style="{
      border: '1px solid ' + (isFocused ? 'var(--accent)' : 'var(--border)'),
      borderRadius: '6px',
      background: 'var(--bg-secondary)',
      boxShadow: isFocused ? '0 0 0 1px var(--accent)' : 'none',
      transition: 'border-color 0.15s, box-shadow 0.15s',
    }"
  >
    <!-- File chips -->
    <div v-if="attachedFiles.length" class="flex flex-wrap gap-1 px-2 pt-2">
      <span
        v-for="(file, i) in attachedFiles"
        :key="file.path"
        class="comment-file-chip inline-flex items-center gap-1"
        :style="{
          fontSize: 'calc(var(--ui-font-size, 13px) - 3px)',
          background: 'var(--bg-tertiary)',
          borderRadius: '3px',
          padding: '1px 6px',
          color: 'var(--fg-secondary)',
        }"
      >
        {{ fileName(file.path) }}
        <button
          class="bg-transparent border-none cursor-pointer p-0 flex items-center"
          style="color: var(--fg-muted);"
          @click="removeFile(i)"
        >
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
        v-model="inputText"
        :placeholder="placeholder"
        class="comment-panel-input w-full resize-none bg-transparent px-2 py-2 outline-none"
        :style="{
          border: 'none',
          minHeight: '36px',
          maxHeight: '160px',
          overflowY: 'auto',
          lineHeight: '1.5',
          fontFamily: 'inherit',
          color: 'var(--fg-primary)',
          background: 'transparent',
        }"
        rows="2"
        autocorrect="off"
        @input="onInput"
        @keydown="onKeydown"
        @focus="isFocused = true"
        @blur="isFocused = false"
      ></textarea>
    </div>

    <!-- Action row -->
    <div class="flex items-center gap-2 px-2 pb-2">
      <!-- @ button -->
      <button
        class="p-1 rounded bg-transparent border-none cursor-pointer flex items-center transition-colors"
        style="color: var(--fg-muted);"
        title="Attach file (@)"
        @mousedown.prevent
        @click="triggerAtMention"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"/>
          <path d="M16 8v5a3 3 0 006 0v-1a10 10 0 10-3.92 7.94"/>
        </svg>
      </button>

      <div class="flex-1"></div>

      <!-- Save button -->
      <button
        class="comment-btn-secondary"
        :disabled="!canSave"
        :style="{ opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }"
        @click="handleSave"
      >
        Save
      </button>

      <!-- Submit button (save + send to AI) -->
      <button
        v-if="showSubmit"
        class="comment-btn-primary"
        :disabled="!canSave"
        :style="{ opacity: canSave ? 1 : 0.5, cursor: canSave ? 'pointer' : 'default' }"
        @click="handleSaveAndSubmit"
      >
        Submit
      </button>
    </div>

    <!-- File ref popover -->
    <Teleport to="body">
      <div
        v-if="showFileRef"
        class="comment-file-popover fixed z-[1000]"
        :style="fileRefPosition"
        @mousedown.prevent
      >
        <FileRefPopover
          ref="filePopoverRef"
          :filter="fileRefQuery"
          @select="onFileSelected"
          @close="showFileRef = false"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import FileRefPopover from '../shared/FileRefPopover.vue'

const props = defineProps({
  placeholder: { type: String, default: 'Type a comment...' },
  autofocus: { type: Boolean, default: false },
  fileRefs: { type: Array, default: () => [] },
  showSubmit: { type: Boolean, default: false },
})

const emit = defineEmits(['save', 'save-and-submit', 'cancel'])

const inputText = ref('')
const textareaRef = ref(null)
const textareaWrapperRef = ref(null)
const filePopoverRef = ref(null)
const attachedFiles = ref([...props.fileRefs])
const showFileRef = ref(false)
const fileRefQuery = ref('')
const fileRefPosition = ref({})
const isFocused = ref(false)

const canSave = computed(() => !!inputText.value.trim())

function fileName(path) {
  return path.split('/').pop()
}

function removeFile(idx) {
  attachedFiles.value.splice(idx, 1)
}

// ─── Auto-grow textarea ─────────────────────────────────────────

function autoGrow() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(160, Math.max(36, el.scrollHeight)) + 'px'
}

// ─── @ trigger logic ─────────────────────────────────────────────

function onInput() {
  autoGrow()
  checkAtTrigger()
}

function checkAtTrigger() {
  const el = textareaRef.value
  if (!el) return
  const val = el.value
  const pos = el.selectionStart

  if (showFileRef.value) {
    const atIdx = val.lastIndexOf('@', pos - 1)
    if (atIdx >= 0) {
      const filterText = val.substring(atIdx + 1, pos)
      if (filterText.includes(' ') || filterText.includes('\n')) {
        showFileRef.value = false
      } else {
        fileRefQuery.value = filterText
      }
    } else {
      showFileRef.value = false
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
    fileRefPosition.value = {
      bottom: (window.innerHeight - rect.top + 4) + 'px',
      left: rect.left + 'px',
      width: rect.width + 'px',
    }
  }
  showFileRef.value = true
  fileRefQuery.value = ''
}

function triggerAtMention() {
  const el = textareaRef.value
  if (!el) return
  const pos = el.selectionStart
  const val = inputText.value
  const needsSpace = pos > 0 && val[pos - 1] !== ' ' && val[pos - 1] !== '\n'
  const insert = (needsSpace ? ' ' : '') + '@'
  inputText.value = val.substring(0, pos) + insert + val.substring(pos)
  nextTick(() => {
    el.focus()
    const newPos = pos + insert.length
    el.selectionStart = newPos
    el.selectionEnd = newPos
    openFilePopover()
  })
}

async function onFileSelected(file) {
  showFileRef.value = false

  const el = textareaRef.value
  if (el) {
    const val = el.value
    const pos = el.selectionStart
    const atIdx = val.lastIndexOf('@', pos - 1)
    if (atIdx >= 0) {
      inputText.value = val.substring(0, atIdx) + val.substring(pos)
      nextTick(() => {
        el.selectionStart = atIdx
        el.selectionEnd = atIdx
      })
    }
  }

  attachedFiles.value.push({ path: file.path, content: '', loading: true })
  const idx = attachedFiles.value.length - 1

  try {
    const content = await invoke('read_file', { path: file.path })
    attachedFiles.value[idx].content = content.length > 50000
      ? content.slice(0, 50000) + '\n... [truncated at 50KB]'
      : content
  } catch (e) {
    attachedFiles.value[idx].content = `[Error reading file: ${e}]`
  }
  attachedFiles.value[idx].loading = false

  nextTick(() => textareaRef.value?.focus())
}

// ─── Keyboard handling ───────────────────────────────────────────

function onKeydown(e) {
  // File popover navigation
  if (showFileRef.value) {
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
      showFileRef.value = false
      return
    }
  }

  // Cmd+Enter / Ctrl+Enter → save-and-submit
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault()
    handleSaveAndSubmit()
    return
  }

  // Enter (without Shift) → save
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSave()
    return
  }

  // Escape → cancel
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
    return
  }
}

// ─── Save / Submit ───────────────────────────────────────────────

function buildPayload() {
  return {
    text: inputText.value.trim(),
    fileRefs: [...attachedFiles.value],
  }
}

function handleSave() {
  const trimmed = inputText.value.trim()
  if (!trimmed) return

  emit('save', buildPayload())

  inputText.value = ''
  attachedFiles.value = []
  nextTick(() => {
    const el = textareaRef.value
    if (el) el.style.height = '36px'
  })
}

function handleSaveAndSubmit() {
  const trimmed = inputText.value.trim()
  if (!trimmed) return

  emit('save-and-submit', buildPayload())

  inputText.value = ''
  attachedFiles.value = []
  nextTick(() => {
    const el = textareaRef.value
    if (el) el.style.height = '36px'
  })
}

// ─── Focus ───────────────────────────────────────────────────────

function focus() {
  nextTick(() => textareaRef.value?.focus())
}

onMounted(() => {
  if (props.autofocus) {
    focus()
  }
})

defineExpose({ focus })
</script>
