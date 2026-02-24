<template>
  <Teleport to="body">
    <div v-if="visible" class="fixed inset-0 z-[999]" @click="$emit('close')" @contextmenu.prevent="$emit('close')"></div>
    <div v-if="visible" class="context-menu py-1 ui-text-md" :style="menuStyle">
      <!-- Spell suggestions (inline, at top) -->
      <template v-if="spellSuggestions.length > 0">
        <div
          v-for="s in spellSuggestions.slice(0, 5)"
          :key="s"
          class="context-menu-item spell-suggestion"
          @click="applySuggestion(s)"
        >{{ s }}</div>
        <div class="context-menu-separator"></div>
      </template>

      <template v-if="hasSelection">
        <div class="context-menu-item" @click="askAI">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2a4 4 0 0 1 4 4c0 1.5-.8 2.8-2 3.4V11h3a3 3 0 0 1 3 3v1.5a2.5 2.5 0 0 1-5 0V14H9v1.5a2.5 2.5 0 0 1-5 0V14a3 3 0 0 1 3-3h3V9.4A4 4 0 0 1 12 2"/>
            <circle cx="12" cy="6" r="1"/>
          </svg>
          Ask AI
          <span class="ml-auto" style="color: var(--fg-muted); font-size: 11px;">&#x21E7;&#x2318;L</span>
        </div>
        <div class="context-menu-item" @click="addTask">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
          Add Task
          <span class="ml-auto" style="color: var(--fg-muted); font-size: 11px;">&#x21E7;&#x2318;C</span>
        </div>
        <div class="context-menu-separator"></div>
        <div class="context-menu-item" @click="cut">Cut</div>
        <div class="context-menu-item" @click="copy">Copy</div>
        <div class="context-menu-item" @click="paste">Paste</div>
      </template>
      <template v-else>
        <div class="context-menu-item" @click="paste">Paste</div>
        <div class="context-menu-item" @click="selectAll">Select All</div>
      </template>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const props = defineProps({
  visible: { type: Boolean, default: false },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  hasSelection: { type: Boolean, default: false },
  filePath: { type: String, default: '' },
  view: { type: Object, default: null },
  spellcheckEnabled: { type: Boolean, default: false },
})

const emit = defineEmits(['close'])

const spellSuggestions = ref([])
// Word range in the document for replacement
let wordFrom = 0
let wordTo = 0

const menuStyle = ref({})

// When menu opens, compute position + fetch spell suggestions
watch(() => props.visible, async (show) => {
  if (!show) {
    spellSuggestions.value = []
    return
  }

  // Position
  const menuW = 200, menuH = props.hasSelection ? 280 : 80
  const x = Math.min(props.x, window.innerWidth - menuW - 8)
  const y = Math.min(props.y, window.innerHeight - menuH - 8)
  menuStyle.value = { left: x + 'px', top: y + 'px' }

  // Spell check: get word at click position
  if (props.spellcheckEnabled && props.view) {
    const pos = props.view.posAtCoords({ x: props.x, y: props.y })
    if (pos !== null) {
      const word = getWordAt(props.view.state, pos)
      if (word) {
        wordFrom = word.from
        wordTo = word.to
        try {
          const suggestions = await invoke('spell_suggest', { word: word.text })
          // Only show if menu is still open
          if (props.visible) {
            spellSuggestions.value = suggestions
          }
        } catch { /* non-macOS or error */ }
      }
    }
  }
})

function getWordAt(state, pos) {
  const line = state.doc.lineAt(pos)
  const text = line.text
  const col = pos - line.from

  // Walk back to find word start
  let start = col
  while (start > 0 && /[\w\u00C0-\u024F'-]/.test(text[start - 1])) start--
  // Walk forward to find word end
  let end = col
  while (end < text.length && /[\w\u00C0-\u024F'-]/.test(text[end])) end++

  if (start === end) return null
  return {
    text: text.slice(start, end),
    from: line.from + start,
    to: line.from + end,
  }
}

function applySuggestion(suggestion) {
  if (!props.view) return
  props.view.dispatch({
    changes: { from: wordFrom, to: wordTo, insert: suggestion },
  })
  emit('close')
}

function getSelectionWithContext() {
  if (!props.view) return null
  const state = props.view.state
  const sel = state.selection.main
  if (sel.from === sel.to) return null

  const text = state.sliceDoc(sel.from, sel.to)
  const beforeStart = Math.max(0, sel.from - 200)
  const afterEnd = Math.min(state.doc.length, sel.to + 200)
  const contextBefore = state.sliceDoc(beforeStart, sel.from)
  const contextAfter = state.sliceDoc(sel.to, afterEnd)

  return { file: props.filePath, text, contextBefore, contextAfter }
}

function askAI() {
  const detail = getSelectionWithContext()
  if (detail) {
    window.dispatchEvent(new CustomEvent('chat-with-selection', { detail }))
    window.dispatchEvent(new CustomEvent('open-chat'))
  }
  emit('close')
}

function addTask() {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'C', code: 'KeyC', shiftKey: true, metaKey: true, bubbles: true,
  }))
  emit('close')
}

function cut() {
  document.execCommand('cut')
  emit('close')
}

function copy() {
  document.execCommand('copy')
  emit('close')
}

function paste() {
  document.execCommand('paste')
  emit('close')
}

function selectAll() {
  if (props.view) {
    props.view.dispatch({
      selection: { anchor: 0, head: props.view.state.doc.length },
    })
  }
  emit('close')
}
</script>

<style scoped>
.spell-suggestion {
  font-weight: 600;
  color: var(--accent) !important;
}
</style>
