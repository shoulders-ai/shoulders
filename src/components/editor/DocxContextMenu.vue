<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999]" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div class="docx-ctx" :style="menuStyle">
        <!-- Clipboard -->
        <div class="docx-ctx-item" @click="execCmd('cut')">
          <IconCut :size="14" />
          <span>Cut</span>
          <span class="docx-ctx-shortcut">Cmd+X</span>
        </div>
        <div class="docx-ctx-item" @click="execCmd('copy')">
          <IconCopy :size="14" />
          <span>Copy</span>
          <span class="docx-ctx-shortcut">Cmd+C</span>
        </div>
        <div class="docx-ctx-item" @click="execCmd('paste')">
          <IconClipboard :size="14" />
          <span>Paste</span>
          <span class="docx-ctx-shortcut">Cmd+V</span>
        </div>

        <div class="context-menu-separator"></div>

        <!-- Formatting -->
        <div class="docx-ctx-item" @click="toggle('toggleBold')">
          <IconBold :size="14" />
          <span>Bold</span>
          <IconCheck v-if="isBold" :size="12" class="docx-ctx-check" />
        </div>
        <div class="docx-ctx-item" @click="toggle('toggleItalic')">
          <IconItalic :size="14" />
          <span>Italic</span>
          <IconCheck v-if="isItalic" :size="12" class="docx-ctx-check" />
        </div>
        <div class="docx-ctx-item" @click="toggle('toggleUnderline')">
          <IconUnderline :size="14" />
          <span>Underline</span>
          <IconCheck v-if="isUnderline" :size="12" class="docx-ctx-check" />
        </div>
        <div class="docx-ctx-item" @click="clearFormatting">
          <IconClearFormatting :size="14" />
          <span>Clear Formatting</span>
        </div>

        <div class="context-menu-separator"></div>

        <!-- Native comment -->
        <div class="docx-ctx-item" @click="addNativeComment" :class="{ 'docx-ctx-disabled': !hasSelection }">
          <IconMessage :size="14" />
          <span>Comment</span>
        </div>

        <div class="context-menu-separator"></div>

        <!-- AI Tasks (only with selection) -->
        <div class="docx-ctx-item" @click="addAITask" :class="{ 'docx-ctx-disabled': !hasSelection }">
          <IconMessageDots :size="14" />
          <span>AI Task</span>
          <span class="docx-ctx-shortcut">&#x21E7;&#x2318;C</span>
        </div>
        <div class="docx-ctx-item" @click="askAI" :class="{ 'docx-ctx-disabled': !hasSelection }">
          <IconSparkles :size="14" />
          <span>Ask AI</span>
          <span class="docx-ctx-shortcut">&#x21E7;&#x2318;L</span>
        </div>

        <!-- Citations -->
        <template v-if="referencesStore.refCount > 0">
          <div class="context-menu-separator"></div>
          <div class="docx-ctx-item" @click="insertCitation">
            <IconQuote :size="14" />
            <span>Insert Citation</span>
          </div>
          <div v-if="hasCitations" class="docx-ctx-item" @click="doBibliography">
            <IconListNumbers :size="14" />
            <span>Insert Bibliography</span>
          </div>
        </template>

        <!-- Track Changes (conditional) -->
        <template v-if="hasTrackedChange">
          <div class="context-menu-separator"></div>
          <div class="docx-ctx-item docx-ctx-accept" @click="acceptChange">
            <IconCheck :size="14" />
            <span>Accept Change</span>
          </div>
          <div class="docx-ctx-item docx-ctx-reject" @click="rejectChange">
            <IconX :size="14" />
            <span>Reject Change</span>
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import {
  IconCut, IconCopy, IconClipboard,
  IconBold, IconItalic, IconUnderline, IconClearFormatting,
  IconMessage, IconMessageDots, IconSparkles, IconCheck, IconX, IconListNumbers, IconQuote,
} from '@tabler/icons-vue'
import { useTasksStore } from '../../stores/tasks'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { useReferencesStore } from '../../stores/references'
import { getAllCitationIds, hasBibliography, insertBibliography, refreshBibliography } from '../../services/docxCitationImporter'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  superdoc: { type: Object, default: null },
  filePath: { type: String, default: '' },
  savedSelection: { type: Object, default: null },  // { from, to } captured before right-click collapsed it
})

const emit = defineEmits(['close', 'add-comment'])

const tasks = useTasksStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()
const referencesStore = useReferencesStore()

// Access raw editor directly — superdoc is markRaw'd, no Vue Proxy.
// SuperDoc uses #private class fields which break through Proxies.
function getEditor() {
  return props.superdoc?.activeEditor || null
}

// Snapshot state at mount time (context menu is short-lived)
const ed = getEditor()
const isBold = ref(ed?.isActive('bold') || false)
const isItalic = ref(ed?.isActive('italic') || false)
const isUnderline = ref(ed?.isActive('underline') || false)
const hasTrackedChange = ref(
  ed?.isActive('trackInsert') ||
  ed?.isActive('trackDelete') ||
  ed?.isActive('trackFormat') || false
)
// Use savedSelection (captured before right-click collapsed the ProseMirror selection)
const hasSelection = ref(!!props.savedSelection)
const hasCitations = ref(getAllCitationIds().length > 0)

// Clamp menu within viewport
const menuStyle = computed(() => {
  const menuW = 200, menuH = 340
  const x = Math.min(props.x, window.innerWidth - menuW - 8)
  const y = Math.min(props.y, window.innerHeight - menuH - 8)
  return {
    left: x + 'px',
    top: y + 'px',
  }
})

// Clipboard via execCommand (works in SuperDoc's editable host)
function execCmd(name) {
  document.execCommand(name)
  emit('close')
}

function toggle(cmdName) {
  const ed = getEditor()
  if (!ed?.commands?.[cmdName]) return
  ed.commands[cmdName]()
  emit('close')
  ed.view?.focus()
}

function clearFormatting() {
  const ed = getEditor()
  if (!ed) return
  if (ed.commands.unsetAllMarks) ed.commands.unsetAllMarks()
  if (ed.commands.clearNodes) ed.commands.clearNodes()
  emit('close')
  ed.view?.focus()
}

/**
 * Restore the saved selection in ProseMirror before calling a SuperDoc command
 * that reads editor.state.selection (e.g., addComment).
 * Right-click mousedown collapses the selection — this puts it back.
 */
function restoreSelection(ed) {
  const sel = props.savedSelection
  if (!sel || !ed?.view) return false
  try {
    const state = ed.view.state
    // Reuse the current selection's constructor (TextSelection) to create a new range
    const newSel = state.selection.constructor.create(state.doc, sel.from, sel.to)
    ed.view.dispatch(state.tr.setSelection(newSel))
    return true
  } catch (e) {
    return false
  }
}

function addNativeComment() {
  const sel = props.savedSelection
  if (!sel) { emit('close'); return }

  // Emit to DocxEditor which shows our own comment input dialog.
  // The dialog calls ed.commands.addComment() — SuperDoc's public API —
  // which handles marks, store, events, and DOCX export. No sidebar needed.
  emit('add-comment', { savedSelection: sel, x: props.x, y: props.y })
  emit('close')
}

function addAITask() {
  const sel = props.savedSelection
  const ed = getEditor()
  if (!ed || !sel) { emit('close'); return }

  restoreSelection(ed)

  const selectedText = ed.state.doc.textBetween(sel.from, sel.to, '\n', ' ')
  const docSize = ed.state.doc.content.size
  const contextBefore = ed.state.doc.textBetween(Math.max(0, sel.from - 5000), sel.from, '\n', ' ')
  const contextAfter = ed.state.doc.textBetween(sel.to, Math.min(docSize, sel.to + 1000), '\n', ' ')
  const threadId = tasks.createThread(props.filePath, { from: sel.from, to: sel.to }, selectedText, null, null, { contextBefore, contextAfter })

  // Open right sidebar to tasks
  if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('open-tasks', { detail: { threadId } }))
  }, 100)

  emit('close')
}

function askAI() {
  const sel = props.savedSelection
  const ed = getEditor()
  if (!ed || !sel) { emit('close'); return }

  const doc = ed.state.doc
  const text = doc.textBetween(sel.from, sel.to, '\n', ' ')
  const beforeStart = Math.max(1, sel.from - 200)
  const afterEnd = Math.min(doc.content.size, sel.to + 200)
  const contextBefore = sel.from > 1 ? doc.textBetween(beforeStart, sel.from, '\n', ' ') : ''
  const contextAfter = sel.to < doc.content.size ? doc.textBetween(sel.to, afterEnd, '\n', ' ') : ''

  window.dispatchEvent(new CustomEvent('chat-with-selection', {
    detail: { file: props.filePath, text, contextBefore, contextAfter },
  }))

  // Open sidebar to chat
  if (!workspace.rightSidebarOpen) workspace.rightSidebarOpen = true
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('open-chat'))
  }, 100)

  emit('close')
}

function insertCitation() {
  window.dispatchEvent(new CustomEvent('docx-insert-citation', {
    detail: { x: props.x, y: props.y },
  }))
  emit('close')
}

function doBibliography() {
  const ed = getEditor()
  if (!ed) { emit('close'); return }

  const style = referencesStore.citationStyle || 'apa'
  if (hasBibliography(ed.view.state.doc)) {
    refreshBibliography(ed, style, referencesStore)
  } else {
    insertBibliography(ed, style, referencesStore)
  }
  emit('close')
  ed.view?.focus()
}

function acceptChange() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.acceptTrackedChangeBySelection?.()
  emit('close')
  ed.view?.focus()
}

function rejectChange() {
  const ed = getEditor()
  if (!ed) return
  ed.commands.rejectTrackedChangeOnSelection?.()
  emit('close')
  ed.view?.focus()
}
</script>

<style scoped>
.docx-ctx {
  position: fixed;
  z-index: 10000;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.3);
  padding: 4px;
  min-width: 180px;
  font-family: var(--ui-font, 'Inter', sans-serif);
}
.docx-ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  color: var(--fg-primary);
  white-space: nowrap;
}
.docx-ctx-item:hover {
  background: var(--bg-hover);
}
.docx-ctx-shortcut {
  margin-left: auto;
  font-size: 10px;
  color: var(--fg-muted);
  opacity: 0.6;
}
.docx-ctx-check {
  margin-left: auto;
  color: var(--accent);
}
.docx-ctx-disabled {
  opacity: 0.4;
  pointer-events: none;
}
.docx-ctx-accept:hover {
  color: #9ece6a;
}
.docx-ctx-reject:hover {
  color: #f7768e;
}
</style>
