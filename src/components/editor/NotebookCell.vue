<template>
  <div
    class="notebook-cell"
    :class="{
      'cell-active': active,
      'cell-code': cell.type === 'code',
      'cell-markdown': cell.type === 'markdown',
      'cell-running': running,
      'cell-pending-add': pendingAdd,
      'cell-pending-delete': pendingDelete,
      'cell-pending-edit': !!pendingEdit,
    }"
    @click="$emit('focus')"
  >
    <!-- Cell toolbar (visible on hover or when active) -->
    <div class="cell-toolbar">
      <div class="cell-toolbar-left">
        <!-- Execution count (code cells only) -->
        <span v-if="cell.type === 'code'" class="exec-count" :class="{ 'exec-running': running }">
          [{{ running ? '*' : (cell.executionCount || ' ') }}]
        </span>
        <!-- Type badge -->
        <span class="cell-type-badge">{{ cell.type === 'code' ? 'Code' : 'Md' }}</span>
        <!-- Task indicator (inline in toolbar) -->
        <button
          v-if="taskCount > 0"
          class="cell-task-btn"
          @click.stop="$emit('open-task')"
          :title="`${taskCount} task${taskCount > 1 ? 's' : ''}`"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
            <path d="M2 2h12a1 1 0 011 1v8a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1z"/>
          </svg>
          {{ taskCount }}
        </button>
      </div>
      <div class="cell-toolbar-right" v-if="!hasPendingState">
        <button v-if="cell.type === 'code'" class="cell-btn cell-btn-run" @click.stop="$emit('run')" title="Run cell (Shift+Enter)">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><polygon points="4,2 14,8 4,14"/></svg>
        </button>
        <button class="cell-btn" @click.stop="$emit('add-above')" title="Add cell above">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>
          </svg>
          <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 1L1 5h6z"/></svg>
        </button>
        <button class="cell-btn" @click.stop="$emit('add-below')" title="Add cell below">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>
          </svg>
          <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor"><path d="M4 7L1 3h6z"/></svg>
        </button>
        <button class="cell-btn" @click.stop="$emit('toggle-type')" title="Toggle code/markdown">
          {{ cell.type === 'code' ? 'M↓' : '</>' }}
        </button>
        <button class="cell-btn" @click.stop="$emit('move-up')" :disabled="index === 0" title="Move up">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3L3 9h10z"/></svg>
        </button>
        <button class="cell-btn" @click.stop="$emit('move-down')" title="Move down">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 13L3 7h10z"/></svg>
        </button>
        <button class="cell-btn cell-btn-delete" @click.stop="$emit('delete')" title="Delete cell">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Editor area (code cell, or markdown in edit mode) -->
    <div v-if="cell.type === 'code' || editing" ref="editorContainer" class="cell-editor"></div>

    <!-- Rendered markdown (view mode) -->
    <div
      v-if="cell.type === 'markdown' && !editing"
      class="cell-markdown-rendered"
      @dblclick="startEditing"
      v-html="renderedMarkdown"
    ></div>

    <!-- Output area (code cells only) -->
    <CellOutput v-if="cell.type === 'code' && !pendingAdd" :outputs="cell.outputs" />

    <!-- Review action bar (visible when any pending state) -->
    <div v-if="hasPendingState" class="cell-review-bar">
      <span class="cell-review-label">
        {{ pendingAdd ? 'New cell' : pendingDelete ? 'Cell will be deleted' : 'Cell edited' }}
      </span>
      <div class="cell-review-actions">
        <button class="review-bar-btn review-bar-accept" @click.stop="$emit('accept-edit', editId)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3,8 7,12 13,4"/></svg>
          Accept
        </button>
        <button class="review-bar-btn review-bar-reject" @click.stop="$emit('reject-edit', editId)">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>
          Reject
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { EditorView, keymap } from '@codemirror/view'
import { Prec } from '@codemirror/state'
import { languages } from '@codemirror/language-data'
import { createEditorExtensions, createEditorState } from '../../editor/setup'
import { ghostSuggestionExtension } from '../../editor/ghostSuggestion'
import { mergeViewExtension, reconfigureMergeView } from '../../editor/diffOverlay'
import { useWorkspaceStore } from '../../stores/workspace'
import CellOutput from './CellOutput.vue'
import { computeMinimalChange } from '../../utils/textDiff'

const props = defineProps({
  cell: { type: Object, required: true },
  index: { type: Number, required: true },
  active: { type: Boolean, default: false },
  running: { type: Boolean, default: false },
  language: { type: String, default: 'python' },
  taskCount: { type: Number, default: 0 },
  pendingEdit: { type: Object, default: null },
  pendingDelete: { type: Boolean, default: false },
  pendingAdd: { type: Boolean, default: false },
  editId: { type: String, default: null },
})

const emit = defineEmits([
  'focus', 'run', 'delete', 'move-up', 'move-down',
  'toggle-type', 'add-above', 'add-below', 'content-change',
  'open-task', 'accept-edit', 'reject-edit',
])

const hasPendingState = computed(() => !!props.pendingEdit || props.pendingDelete || props.pendingAdd)

const workspace = useWorkspaceStore()

const editorContainer = ref(null)
const editing = ref(false) // for markdown cells: edit mode
let view = null

// Simple markdown rendering (inline HTML)
const renderedMarkdown = computed(() => {
  const c = props.cell
  if (c.type !== 'markdown') return ''
  const src = c.source || ''
  if (!src.trim()) return '<p style="color: var(--fg-muted); font-style: italic;">Double-click to edit</p>'
  return renderSimpleMarkdown(src)
})

function renderSimpleMarkdown(text) {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Code blocks
  html = html.replace(/```[\s\S]*?```/g, (match) => {
    const inner = match.slice(3, -3).replace(/^[^\n]*\n/, '')
    return `<pre><code>${inner}</code></pre>`
  })
  // Lists
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
  // Line breaks (paragraphs)
  html = html.replace(/\n\n/g, '</p><p>')
  html = '<p>' + html + '</p>'
  return html
}

async function loadLanguage() {
  const langName = props.language || 'python'
  const matched = languages.filter(l =>
    l.name.toLowerCase() === langName ||
    (l.extensions && l.extensions.includes(langName))
  )
  if (matched.length > 0) {
    return await matched[0].load()
  }
  // Fallback: try by alias
  const byAlias = languages.filter(l =>
    l.alias && l.alias.some(a => a.toLowerCase() === langName)
  )
  if (byAlias.length > 0) {
    return await byAlias[0].load()
  }
  return null
}

async function mountEditor() {
  if (!editorContainer.value) return
  if (view) {
    view.destroy()
    view = null
  }

  const langExt = await loadLanguage()
  const extraExtensions = [
    // Shift+Enter / Cmd+Enter = run cell (Prec.highest to beat defaultKeymap's Mod-Enter → insertBlankLine)
    Prec.highest(keymap.of([
      {
        key: 'Shift-Enter',
        run: () => {
          syncContent()
          emit('run')
          return true
        },
      },
      {
        key: 'Mod-Enter',
        run: () => {
          syncContent()
          emit('run')
          return true
        },
      },
      {
        key: 'Escape',
        run: () => {
          if (props.cell.type === 'markdown') {
            syncContent()
            editing.value = false
          }
          return true
        },
      },
    ])),
    // Sync content on blur
    EditorView.domEventHandlers({
      blur: () => {
        syncContent()
        if (props.cell.type === 'markdown') {
          editing.value = false
        }
      },
    }),
    // Ghost suggestions (++ trigger)
    ghostSuggestionExtension(
      () => workspace,
      () => workspace.systemPrompt,
      { isEnabled: () => workspace.ghostEnabled, getInstructions: () => workspace.instructions },
    ),
    // Merge view for review diffs
    mergeViewExtension(),
  ]

  const extensions = createEditorExtensions({
    onSave: null,
    onCursorChange: null,
    onStats: null,
    softWrap: true,
    languageExtension: langExt,
    extraExtensions,
  })

  const state = createEditorState(props.cell.source || '', extensions)
  view = new EditorView({
    state,
    parent: editorContainer.value,
  })

  // If there's already a pending edit (e.g. notebook reopened with reviews), activate merge view
  if (props.pendingEdit && view) {
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: props.pendingEdit.new_source },
    })
    reconfigureMergeView(view, props.pendingEdit.old_source)
  }
}

function syncContent() {
  if (!view) return
  const content = view.state.doc.toString()
  if (content !== props.cell.source) {
    emit('content-change', content)
  }
}

function startEditing() {
  editing.value = true
  nextTick(() => {
    mountEditor()
    nextTick(() => {
      if (view) view.focus()
    })
  })
}

// Mount editor for code cells immediately; markdown cells wait for dblclick
onMounted(() => {
  if (props.cell.type === 'code') {
    nextTick(() => mountEditor())
  }
})

onUnmounted(() => {
  if (view) {
    syncContent()
    view.destroy()
    view = null
  }
})

// Watch for external source changes (e.g., AI tool edits)
watch(() => props.cell.source, (newSource) => {
  if (!view) return
  const current = view.state.doc.toString()
  const change = computeMinimalChange(current, newSource)
  if (change) {
    view.dispatch({ changes: change })
  }
})

// Watch pendingEdit to activate/deactivate merge view
watch(() => props.pendingEdit, (edit) => {
  if (!view) return
  if (edit) {
    // Show merge view: set editor content to new_source, show diff against old_source
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: edit.new_source },
    })
    reconfigureMergeView(view, edit.old_source)
  } else {
    reconfigureMergeView(view, null)
  }
}, { immediate: true })

// Watch cell type changes (toggling code/markdown)
watch(() => props.cell.type, () => {
  if (view) {
    syncContent()
    view.destroy()
    view = null
  }
  editing.value = false
  if (props.cell.type === 'code') {
    nextTick(() => mountEditor())
  }
})

defineExpose({
  focus() {
    if (view) view.focus()
    else if (props.cell.type === 'markdown') startEditing()
  },
  syncContent,
  getView() { return view },
  getSelection() {
    if (!view) return null
    const sel = view.state.selection.main
    if (sel.from === sel.to) return null
    return {
      from: sel.from,
      to: sel.to,
      text: view.state.sliceDoc(sel.from, sel.to),
    }
  },
})
</script>

<style scoped>
.notebook-cell {
  position: relative;
  border: 1px solid transparent;
  border-radius: 4px;
  transition: border-color 0.15s;
  margin-bottom: 2px;
}

.notebook-cell:hover,
.cell-active {
  border-color: var(--border);
}

.cell-active {
  border-color: var(--accent);
}

.cell-running {
  border-color: var(--warning, #e2b93d);
}

/* Toolbar */
.cell-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 6px;
  min-height: 24px;
  opacity: 0;
  transition: opacity 0.15s;
}

.notebook-cell:hover .cell-toolbar,
.cell-active .cell-toolbar {
  opacity: 1;
}

.cell-toolbar-left,
.cell-toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.exec-count {
  font-family: var(--font-mono, monospace);
  font-size: 11px;
  color: var(--fg-muted);
  min-width: 28px;
  text-align: right;
}

.exec-running {
  color: var(--warning, #e2b93d);
}

.cell-type-badge {
  font-size: 10px;
  padding: 0 4px;
  border-radius: 3px;
  color: var(--fg-muted);
  background: var(--bg-secondary);
}

.cell-btn {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 2px 4px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  border-radius: 3px;
  font-size: 10px;
  line-height: 1;
  transition: background 0.1s, color 0.1s;
}

.cell-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.cell-btn:disabled {
  opacity: 0.3;
  cursor: default;
}

.cell-btn-run {
  color: var(--success, #50fa7b);
}

.cell-btn-run:hover {
  color: var(--success, #50fa7b);
  background: rgba(80, 250, 123, 0.1);
}

.cell-btn-delete:hover {
  color: var(--error, #ff5555);
  background: rgba(255, 85, 85, 0.1);
}

/* Task button (inline in toolbar) */
.cell-task-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  border: none;
  border-radius: 6px;
  background: rgba(122, 162, 247, 0.15);
  color: var(--accent);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
  line-height: 1;
}

.cell-task-btn:hover {
  background: rgba(122, 162, 247, 0.3);
}

/* Pending review states */
.cell-pending-add {
  border-color: var(--success, #50fa7b) !important;
  background: rgba(80, 250, 123, 0.04);
}

.cell-pending-delete {
  border-color: var(--error, #f7768e) !important;
  opacity: 0.6;
  background: rgba(247, 118, 142, 0.04);
}

.cell-pending-edit {
  border-color: var(--warning, #e2b93d) !important;
  background: rgba(226, 185, 61, 0.04);
}

/* Review action bar */
.cell-review-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(224, 175, 104, 0.06);
  border-top: 1px solid var(--border);
}

.cell-pending-add .cell-review-bar {
  background: rgba(80, 250, 123, 0.06);
}

.cell-pending-delete .cell-review-bar {
  background: rgba(247, 118, 142, 0.06);
}

.cell-review-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
}

.cell-review-actions {
  display: flex;
  gap: 6px;
}

.review-bar-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.review-bar-accept {
  color: var(--success, #50fa7b);
  border-color: rgba(80, 250, 123, 0.3);
}

.review-bar-accept:hover {
  background: rgba(80, 250, 123, 0.1);
  border-color: var(--success, #50fa7b);
}

.review-bar-reject {
  color: var(--error, #f7768e);
  border-color: rgba(247, 118, 142, 0.3);
}

.review-bar-reject:hover {
  background: rgba(247, 118, 142, 0.1);
  border-color: var(--error, #f7768e);
}

/* Editor area */
.cell-editor {
  min-height: 24px;
}

.cell-editor :deep(.cm-editor) {
  border-radius: 0 0 4px 4px;
}

.cell-editor :deep(.cm-gutters) {
  min-width: 36px;
}

/* Rendered markdown */
.cell-markdown-rendered {
  padding: 8px 12px;
  font-size: 14px;
  line-height: 1.6;
  color: var(--fg-primary);
  cursor: text;
  min-height: 28px;
}

.cell-markdown-rendered:hover {
  background: var(--bg-secondary);
  border-radius: 4px;
}

.cell-markdown-rendered :deep(h1) { font-size: 1.5em; font-weight: 600; margin: 0.3em 0; }
.cell-markdown-rendered :deep(h2) { font-size: 1.3em; font-weight: 600; margin: 0.3em 0; }
.cell-markdown-rendered :deep(h3) { font-size: 1.1em; font-weight: 600; margin: 0.3em 0; }
.cell-markdown-rendered :deep(p) { margin: 0.4em 0; }
.cell-markdown-rendered :deep(code) {
  background: var(--bg-secondary);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 0.9em;
}
.cell-markdown-rendered :deep(pre) {
  background: var(--bg-secondary);
  padding: 8px;
  border-radius: 4px;
  overflow-x: auto;
}
.cell-markdown-rendered :deep(li) { margin-left: 1.5em; list-style-type: disc; }
.cell-markdown-rendered :deep(strong) { font-weight: 600; }
.cell-markdown-rendered :deep(em) { font-style: italic; }
</style>
