<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Header -->
    <div
      class="flex items-center h-7 shrink-0 px-2 gap-1 select-none"
      :style="{ color: 'var(--fg-muted)', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }"
    >
      <div class="flex items-center gap-1 cursor-pointer" @click="$emit('toggle-collapse')">
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
          :style="{ transform: collapsed ? '' : 'rotate(90deg)', transition: 'transform 0.1s' }"
        >
          <path d="M6 4l4 4-4 4"/>
        </svg>
        <span class="text-[11px] font-medium uppercase tracking-wider">Outline</span>
      </div>
      <span
        v-if="headings.length > 0"
        class="text-[11px] px-1.5 py-0.5 rounded-full"
        :style="{ background: 'var(--bg-tertiary)', color: 'var(--fg-muted)' }"
      >
        {{ headings.length }}
      </span>
    </div>

    <!-- Content -->
    <template v-if="!collapsed">
      <div v-if="!hasOutlineSupport" class="px-3 py-3 text-[11px]" style="color: var(--fg-muted);">
        No outline
      </div>
      <div v-else-if="headings.length === 0" class="px-3 py-3 text-[11px]" style="color: var(--fg-muted);">
        No headings
      </div>
      <div v-else class="flex-1 overflow-y-auto py-1">
        <div
          v-for="(h, i) in headings"
          :key="i"
          class="flex items-center py-0.5 px-2 cursor-pointer select-none rounded-sm hover:bg-[var(--bg-hover)]"
          :class="{ 'bg-[var(--bg-hover)]': i === activeHeadingIndex }"
          :style="{
            paddingLeft: (h.level - 1) * 12 + 8 + 'px',
            color: i === activeHeadingIndex ? 'var(--fg-primary)' : 'var(--fg-secondary)',
            fontSize: 'var(--ui-font-size)',
          }"
          @click="navigateToHeading(h)"
        >
          <span class="truncate">{{ h.text }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useLinksStore, parseHeadings } from '../../stores/links'
import { isMarkdown, isLatex, getViewerType } from '../../utils/fileTypes'

defineProps({
  collapsed: { type: Boolean, default: false },
})
defineEmits(['toggle-collapse'])

const editorStore = useEditorStore()
const filesStore = useFilesStore()
const linksStore = useLinksStore()

// Determine if active file supports outline
const activeFile = computed(() => editorStore.activeTab)

const fileType = computed(() => {
  const path = activeFile.value
  if (!path) return null
  const vt = getViewerType(path)
  if (vt === 'text' && isMarkdown(path)) return 'markdown'
  if (vt === 'text' && isLatex(path)) return 'latex'
  if (vt === 'docx') return 'docx'
  if (vt === 'notebook') return 'notebook'
  return null
})

const hasOutlineSupport = computed(() => fileType.value !== null)

// Extract headings based on file type
const headings = computed(() => {
  const path = activeFile.value
  if (!path || !fileType.value) return []

  const ft = fileType.value

  if (ft === 'markdown') {
    // Use links store structured headings (already indexed)
    const structured = linksStore.structuredHeadingsForFile(path)
    if (structured.length > 0) return structured
    // Fallback: parse from content cache
    const content = filesStore.fileContents[path]
    if (!content) return []
    return parseHeadings(content)
  }

  if (ft === 'latex') {
    const content = filesStore.fileContents[path]
    if (!content) return []
    return parseLatexHeadings(content)
  }

  if (ft === 'notebook') {
    const content = filesStore.fileContents[path]
    if (!content) return []
    return parseNotebookHeadings(content)
  }

  if (ft === 'docx') {
    void editorStore.docxUpdateCount // reactive trigger — bumped on every DOCX editor update (incl. style changes)
    return parseDocxHeadings(path)
  }

  return []
})

// Current heading highlight (for CM6 files)
const activeHeadingIndex = computed(() => {
  const ft = fileType.value
  if (!ft || ft === 'docx') return -1
  const offset = editorStore.cursorOffset
  if (offset == null) return -1

  let lastIdx = -1
  for (let i = 0; i < headings.value.length; i++) {
    if (headings.value[i].offset <= offset) {
      lastIdx = i
    } else {
      break
    }
  }
  return lastIdx
})

// --- Heading parsers ---

const LATEX_SECTION_RE = /^\\(part|chapter|section|subsection|subsubsection|paragraph)\{([^}]*)\}/gm
const LATEX_LEVELS = { part: 0, chapter: 1, section: 2, subsection: 3, subsubsection: 4, paragraph: 5 }

function parseLatexHeadings(content) {
  const result = []
  let m
  LATEX_SECTION_RE.lastIndex = 0
  while ((m = LATEX_SECTION_RE.exec(content)) !== null) {
    result.push({
      text: m[2].trim(),
      level: (LATEX_LEVELS[m[1]] || 2) + 1, // normalize to 1-based
      offset: m.index,
    })
  }
  return result
}

function parseNotebookHeadings(content) {
  let nb
  try { nb = JSON.parse(content) } catch { return [] }
  if (!nb.cells) return []

  const result = []
  let charOffset = 0
  for (let ci = 0; ci < nb.cells.length; ci++) {
    const cell = nb.cells[ci]
    if (cell.cell_type === 'markdown') {
      const src = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '')
      const re = /^(#{1,6})\s+(.+)$/gm
      let m
      while ((m = re.exec(src)) !== null) {
        result.push({
          text: m[2].trim(),
          level: m[1].length,
          offset: charOffset + m.index,
          cellIndex: ci,
        })
      }
    }
    const cellSrc = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '')
    charOffset += cellSrc.length + 1
  }
  return result
}

function parseDocxHeadings(path) {
  const superdoc = editorStore.getAnySuperdoc(path)
  if (!superdoc?.activeEditor) return []

  const result = []
  superdoc.activeEditor.state.doc.descendants((node, pos) => {
    if (node.type.name === 'paragraph') {
      const styleId = node.attrs?.paragraphProperties?.styleId || ''
      const match = styleId.match(/^Heading(\d+)$/i)
      if (match) {
        result.push({
          text: node.textContent || '(untitled)',
          level: parseInt(match[1], 10),
          offset: pos,
        })
      }
    }
  })
  return result
}

// --- Navigation ---

function navigateToHeading(heading) {
  const path = activeFile.value
  if (!path) return

  const ft = fileType.value

  if (ft === 'markdown' || ft === 'latex') {
    // Find CM6 editor view for the active pane
    const view = editorStore.getEditorView(editorStore.activePaneId, path)
    if (!view) return
    const pos = Math.min(heading.offset, view.state.doc.length)
    view.dispatch({
      selection: { anchor: pos },
      effects: [
        // Scroll the heading into view
        ...(view.scrollIntoView ? [] : []),
      ],
      scrollIntoView: true,
    })
    view.focus()
  }

  if (ft === 'notebook') {
    if (heading.cellIndex != null) {
      window.dispatchEvent(new CustomEvent('notebook-scroll-to-cell', {
        detail: { path, cellIndex: heading.cellIndex },
      }))
    }
  }

  if (ft === 'docx') {
    const superdoc = editorStore.getAnySuperdoc(path)
    if (!superdoc?.activeEditor) return
    try {
      // Set PM selection at heading position
      superdoc.activeEditor.commands.setTextSelection(heading.offset)

      // Scroll visible painted layer — same text-search approach as TaskThread.navigateDocx()
      const wrapper = document.querySelector('.docx-editor .overflow-auto')
      if (!wrapper) return
      const needle = (heading.text || '').replace(/\s+/g, ' ').trim().toLowerCase()
      if (needle) {
        const lines = wrapper.querySelectorAll('.superdoc-line')
        for (const line of lines) {
          const lineText = (line.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase()
          if (lineText.includes(needle)) {
            line.scrollIntoView({ behavior: 'smooth', block: 'center' })
            return
          }
        }
      }
      // Fallback: wait for painter to update caret, then scroll to it
      setTimeout(() => {
        const caret = wrapper.querySelector('.presentation-editor__selection-caret')
        if (caret) caret.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 100)
    } catch { /* ignore */ }
  }
}
</script>
