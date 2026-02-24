<template>
  <div
    class="flex flex-col h-full"
    :class="{ 'outline outline-1 outline-[var(--accent)]': isActive }"
    @mousedown="editorStore.setActivePane(paneId)"
  >
    <!-- Tab bar -->
    <TabBar
      v-if="tabs.length > 0"
      :tabs="tabs"
      :activeTab="activeTab"
      :paneId="paneId"
      @select-tab="selectTab"
      @close-tab="closeTab"
      @split-vertical="splitVertical"
      @split-horizontal="splitHorizontal"
      @close-pane="closePane"
      @run-code="handleRunCode"
      @run-file="handleRunFile"
      @render-document="handleRenderDocument"
      @compile-tex="handleCompileTex"
      @sync-tex="handleSyncTex"
      @ask-ai-fix="handleAskAiFix"
      @preview-markdown="handlePreviewMarkdown"
      @export-pdf="handleExportPdf"
    />

    <!-- File-specific review bar -->
    <ReviewBar v-if="activeTab && viewerType === 'text'" :filePath="activeTab" />
    <DocxReviewBar v-else-if="activeTab && viewerType === 'docx'" :filePath="activeTab" :paneId="paneId" />
    <NotebookReviewBar v-else-if="activeTab && viewerType === 'notebook'" :filePath="activeTab" />

    <!-- Editor or empty state -->
    <div class="flex-1 overflow-hidden" style="background: var(--bg-primary);">
      <TextEditor
        v-if="activeTab && viewerType === 'text'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
        @cursor-change="(pos) => $emit('cursor-change', pos)"
        @editor-stats="(stats) => $emit('editor-stats', stats)"
      />
      <LatexPdfViewer
        v-else-if="activeTab && viewerType === 'pdf' && hasTexSource"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
      />
      <PdfViewer
        v-else-if="activeTab && viewerType === 'pdf'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
      />
      <CsvEditor
        v-else-if="activeTab && viewerType === 'csv'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
      />
      <DocxEditor
        v-else-if="activeTab && viewerType === 'docx'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
        @cursor-change="(pos) => $emit('cursor-change', pos)"
        @editor-stats="(stats) => $emit('editor-stats', stats)"
      />
      <ImageViewer
        v-else-if="activeTab && viewerType === 'image'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
      />
      <NotebookEditor
        v-else-if="activeTab && viewerType === 'notebook'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
      />
      <MarkdownPreview
        v-else-if="activeTab && viewerType === 'markdown-preview'"
        :key="activeTab"
        :filePath="activeTab"
        :paneId="paneId"
      />
      <ReferenceView
        v-else-if="activeTab && viewerType === 'reference'"
        :key="activeTab"
        :refKey="refKey"
        :paneId="paneId"
      />
      <div v-else-if="!activeTab" class="empty-pane">
        <div class="empty-pane-col">
          <div class="empty-pane-brand">Shoulders</div>
          <div class="empty-pane-rule"></div>

          <!-- A: Returning user — recent files -->
          <template v-if="recentFiles.length > 0">
            <div class="empty-pane-group">
              <div class="empty-pane-label">Recent</div>
              <button
                v-for="entry in recentFiles"
                :key="entry.path"
                class="empty-pane-row empty-pane-file"
                @click="editorStore.openFile(entry.path)"
              >
                <svg class="empty-pane-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="16" y1="13" x2="8" y2="13"></line>
                  <line x1="16" y1="17" x2="8" y2="17"></line>
                  <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
                <span class="truncate">{{ fileName(entry.path) }}</span>
              </button>
            </div>
            <div class="empty-pane-group">
              <button class="empty-pane-row" @click="triggerSearch">
                <span>Search files</span>
                <span class="empty-pane-shortcut">{{ modKey }}+P</span>
              </button>
              <button class="empty-pane-row" @click="triggerNewFile">
                <span>New file</span>
                <span class="empty-pane-shortcut">{{ modKey }}+N</span>
              </button>
              <button class="empty-pane-row" @click="triggerChat">
                <span>AI chat</span>
                <span class="empty-pane-shortcut">{{ modKey }}+J</span>
              </button>
            </div>
          </template>

          <!-- B: First time in this workspace (has files but no recents) -->
          <template v-else-if="hasWorkspaceFiles">
            <div class="empty-pane-group">
              <button class="empty-pane-row" @click="triggerSearch">
                <span>Search files</span>
                <span class="empty-pane-shortcut">{{ modKey }}+P</span>
              </button>
              <button class="empty-pane-row" @click="triggerNewFile">
                <span>New file</span>
                <span class="empty-pane-shortcut">{{ modKey }}+N</span>
              </button>
              <button class="empty-pane-row" @click="triggerChat">
                <span>AI chat</span>
                <span class="empty-pane-shortcut">{{ modKey }}+J</span>
              </button>
            </div>
          </template>

          <!-- C: Empty workspace (no files) -->
          <template v-else>
            <div class="empty-pane-group">
              <button class="empty-pane-row" @click="triggerNewFile">
                <span>New file</span>
                <span class="empty-pane-shortcut">{{ modKey }}+N</span>
              </button>
              <button class="empty-pane-row" @click="triggerChat">
                <span>AI chat</span>
                <span class="empty-pane-shortcut">{{ modKey }}+J</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import { useEditorStore } from '../../stores/editor'
import { useFilesStore } from '../../stores/files'
import { useToastStore } from '../../stores/toast'
import { modKey, isMac } from '../../platform'
import { getViewerType, isReferencePath, referenceKeyFromPath, getLanguage, isLatex, isRmdOrQmd } from '../../utils/fileTypes'
import { sendCode, runFile, renderDocument } from '../../services/codeRunner'
import { useLatexStore } from '../../stores/latex'
import TabBar from './TabBar.vue'
import ReviewBar from './ReviewBar.vue'
import TextEditor from './TextEditor.vue'
import PdfViewer from './PdfViewer.vue'
import CsvEditor from './CsvEditor.vue'
import ImageViewer from './ImageViewer.vue'
const DocxEditor = defineAsyncComponent(() => import('./DocxEditor.vue'))
const DocxReviewBar = defineAsyncComponent(() => import('./DocxReviewBar.vue'))
const ReferenceView = defineAsyncComponent(() => import('./ReferenceView.vue'))
const NotebookEditor = defineAsyncComponent(() => import('./NotebookEditor.vue'))
const NotebookReviewBar = defineAsyncComponent(() => import('./NotebookReviewBar.vue'))
const LatexPdfViewer = defineAsyncComponent(() => import('./LatexPdfViewer.vue'))
const MarkdownPreview = defineAsyncComponent(() => import('./MarkdownPreview.vue'))

const props = defineProps({
  paneId: { type: String, required: true },
  tabs: { type: Array, default: () => [] },
  activeTab: { type: String, default: null },
})

const emit = defineEmits(['cursor-change', 'editor-stats'])

const editorStore = useEditorStore()
const filesStore = useFilesStore()
const latexStore = useLatexStore()
const toastStore = useToastStore()

const isActive = computed(() => editorStore.activePaneId === props.paneId)
const viewerType = computed(() => props.activeTab ? getViewerType(props.activeTab) : null)
const recentFiles = computed(() => editorStore.recentFilesForEmptyState)
const hasWorkspaceFiles = computed(() => filesStore.flatFiles.length > 0)

function fileName(path) {
  return path.split('/').pop() || path
}

function triggerSearch() {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'p', code: 'KeyP', metaKey: isMac, ctrlKey: !isMac, bubbles: true, cancelable: true,
  }))
}

function triggerNewFile() {
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'n', code: 'KeyN', metaKey: isMac, ctrlKey: !isMac, bubbles: true, cancelable: true,
  }))
}

function triggerChat() {
  // Use 'j' for Cmd+J (toggle right sidebar/chat)
  document.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'j', code: 'KeyJ', metaKey: isMac, ctrlKey: !isMac, bubbles: true, cancelable: true,
  }))
}
const refKey = computed(() => props.activeTab && isReferencePath(props.activeTab) ? referenceKeyFromPath(props.activeTab) : null)

// Check if this PDF has a corresponding .tex source (for LaTeX PDF viewer)
const hasTexSource = computed(() => {
  if (viewerType.value !== 'pdf' || !props.activeTab) return false
  const texPath = props.activeTab.replace(/\.pdf$/, '.tex')
  // Check if .tex file is known to the file system (open or in tree)
  return filesStore.fileContents[texPath] !== undefined ||
         filesStore.flatFiles.some(f => f.path === texPath)
})

function selectTab(path) {
  const pane = editorStore.findPane(editorStore.paneTree, props.paneId)
  if (pane) pane.activeTab = path
}

function closeTab(path) {
  editorStore.closeTab(props.paneId, path)
}

function splitVertical() {
  editorStore.setActivePane(props.paneId)
  editorStore.splitPane('vertical')
}

function splitHorizontal() {
  editorStore.setActivePane(props.paneId)
  editorStore.splitPane('horizontal')
}

function handleRunCode() {
  if (!props.activeTab) return
  const lang = getLanguage(props.activeTab)
  if (!lang) return
  const editorView = editorStore.getEditorView(props.paneId, props.activeTab)
  if (!editorView) return

  const state = editorView.state
  const sel = state.selection.main

  if (isRmdOrQmd(props.activeTab)) {
    // Dispatch through chunk-execute so it routes through the kernel bridge in TextEditor
    import('../../editor/codeChunks').then(({ chunkField, chunkAtPosition }) => {
      const chunks = state.field(chunkField)
      const chunk = chunkAtPosition(chunks, state.doc, sel.head)
      if (!chunk) return // Cursor in prose — do nothing
      const idx = chunks.indexOf(chunk)
      if (idx >= 0) {
        editorView.dom.dispatchEvent(new CustomEvent('chunk-execute', {
          bubbles: true,
          detail: { chunkIdx: idx },
        }))
      }
    })
    return
  }

  // Plain script: send line or selection
  let code
  if (sel.from !== sel.to) {
    code = state.sliceDoc(sel.from, sel.to)
  } else {
    const line = state.doc.lineAt(sel.head)
    code = line.text
    if (line.number < state.doc.lines) {
      const nextLine = state.doc.line(line.number + 1)
      editorView.dispatch({
        selection: { anchor: nextLine.from },
        scrollIntoView: true,
      })
    }
  }
  if (code) sendCode(code, lang)
}

function handleRunFile() {
  if (!props.activeTab) return
  const lang = getLanguage(props.activeTab)
  if (!lang) return

  if (isRmdOrQmd(props.activeTab)) {
    // Single event → TextEditor runs all chunks sequentially (shared kernel state)
    const editorView = editorStore.getEditorView(props.paneId, props.activeTab)
    if (!editorView) return
    editorView.dom.dispatchEvent(new CustomEvent('chunk-execute-all', { bubbles: true }))
    return
  }

  runFile(props.activeTab, lang)
}

function handleRenderDocument() {
  if (!props.activeTab) return
  renderDocument(props.activeTab)
}

async function handleCompileTex() {
  if (!props.activeTab || !isLatex(props.activeTab)) return
  await latexStore.compile(props.activeTab)
  const state = latexStore.stateForFile(props.activeTab)
  if (state?.status === 'success' && state.pdfPath) {
    ensurePdfOpen(state.pdfPath)
  }
}

function handleSyncTex() {
  if (!props.activeTab || !isLatex(props.activeTab)) return
  window.dispatchEvent(new CustomEvent('latex-request-cursor', {
    detail: { texPath: props.activeTab },
  }))
}

async function handleAskAiFix(err) {
  if (!props.activeTab) return
  let context = ''
  try {
    const content = filesStore.fileContents[props.activeTab] || await filesStore.readFile(props.activeTab)
    if (content && err.line) {
      const lines = content.split('\n')
      const start = Math.max(0, err.line - 6)
      const end = Math.min(lines.length, err.line + 5)
      context = lines.slice(start, end).map((l, i) => `${start + i + 1}: ${l}`).join('\n')
    }
  } catch {}
  const fileName = props.activeTab.split('/').pop()
  const lineInfo = err.line ? ` line ${err.line}` : ''
  const message = `LaTeX compilation error in ${fileName}${lineInfo}:\n\`\`\`\n${err.message}\n\`\`\`\n${context ? `Code around the error:\n\`\`\`tex\n${context}\n\`\`\`\n` : ''}Briefly explain what this means, then fix it.`
  window.dispatchEvent(new CustomEvent('open-chat'))
  window.dispatchEvent(new CustomEvent('chat-prefill', { detail: { message } }))
}

function handlePreviewMarkdown() {
  if (!props.activeTab) return
  const previewPath = `preview:${props.activeTab}`

  // Check if preview already open in any pane
  const leaves = getAllLeaves(editorStore.paneTree)
  if (leaves.some(p => p.tabs.includes(previewPath))) return

  // Use activePaneId (always a leaf) — props.paneId may point to a split after prior operations
  const sourcePaneId = editorStore.activePaneId
  editorStore.splitPaneWith(sourcePaneId, 'vertical', previewPath)
}

async function handleExportPdf(settingsOverride) {
  if (!props.activeTab) return
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { useTypstStore } = await import('../../stores/typst')
    const { useWorkspaceStore } = await import('../../stores/workspace')
    const typstStore = useTypstStore()
    const workspace = useWorkspaceStore()

    // For .Rmd/.qmd: knit first (execute chunks, produce clean .md), then export that
    let mdPathForExport = props.activeTab
    let tempMdPath = null
    if (isRmdOrQmd(props.activeTab)) {
      const content = filesStore.fileContents[props.activeTab]
      if (content) {
        const { knitRmd } = await import('../../services/rmdKnit')
        // Write to .md with same stem so Typst outputs correctly-named PDF
        tempMdPath = props.activeTab.replace(/\.(rmd|qmd)$/i, '.md')
        const imageDir = props.activeTab.substring(0, props.activeTab.lastIndexOf('/'))
        const knitted = await knitRmd(content, workspace.path, { imageDir })
        await invoke('write_file', { path: tempMdPath, content: knitted })
        mdPathForExport = tempMdPath
      }
    }

    // Resolve settings: popover override > saved per-file > defaults
    const settings = settingsOverride || typstStore.getSettings(props.activeTab)

    // Inject citation style from references store if not already set
    if (!settings.bib_style) {
      const { useReferencesStore } = await import('../../stores/references')
      settings.bib_style = useReferencesStore().citationStyle
    }

    // For non-built-in styles, copy .csl file next to the .typ and pass filename
    const builtinTypstStyles = ['apa', 'chicago', 'ieee', 'harvard', 'vancouver']
    if (settings.bib_style && !builtinTypstStyles.includes(settings.bib_style)) {
      try {
        const cslUrl = `/csl/${settings.bib_style}.csl`
        const resp = await fetch(cslUrl)
        if (resp.ok) {
          const cslContent = await resp.text()
          const dir = props.activeTab.substring(0, props.activeTab.lastIndexOf('/'))
          const cslPath = `${dir}/${settings.bib_style}.csl`
          await invoke('write_file', { path: cslPath, content: cslContent })
          settings.bib_style = `${settings.bib_style}.csl`
        }
      } catch {
        // Fall back to APA if CSL file can't be loaded
        settings.bib_style = 'apa'
      }
    }

    // Check if PDF already exists before export
    const expectedPdfPath = props.activeTab.replace(/\.(md|rmd|qmd)$/i, '.pdf')
    const pdfExisted = await invoke('path_exists', { path: expectedPdfPath })

    // Generate .bib file from reference library (reuses LaTeX pipeline)
    let bibPath = null
    try {
      const { ensureBibFile } = await import('../../services/latexBib')
      bibPath = await ensureBibFile(props.activeTab)
    } catch (e) {
      // No references or bib generation failed — continue without
    }

    const result = await typstStore.exportToPdf(mdPathForExport, bibPath, settings)

    // Clean up temp files for .Rmd exports
    if (tempMdPath) {
      invoke('delete_path', { path: tempMdPath }).catch(() => {})
      // Clean up temp chunk images (_chunk_img_*.png/jpg)
      const dir = tempMdPath.substring(0, tempMdPath.lastIndexOf('/'))
      invoke('run_shell_command', {
        cwd: dir,
        command: 'rm -f _chunk_img_*',
      }).catch(() => {})
    }

    if (result?.success && result.pdf_path) {
      if (!pdfExisted) {
        const pdfName = result.pdf_path.split('/').pop()
        const dur = result.duration_ms ? ` in ${result.duration_ms}ms` : ''
        toastStore.show(`Created ${pdfName}${dur}`)
      }

      ensurePdfOpen(result.pdf_path)
      window.dispatchEvent(new CustomEvent('pdf-updated', {
        detail: { path: result.pdf_path },
      }))
    } else if (result?.errors?.length) {
      const errMsg = result.errors.map(e => e.message).join('\n')
      window.dispatchEvent(new CustomEvent('open-chat'))
      window.dispatchEvent(new CustomEvent('chat-prefill', {
        detail: { message: `Typst export error:\n\`\`\`\n${errMsg}\n\`\`\`\nBriefly explain and fix.` },
      }))
    }
  } catch (e) {
    console.error('PDF export failed:', e)
  }
}

function ensurePdfOpen(pdfPath) {
  // Check if PDF is already open in any pane
  const leaves = getAllLeaves(editorStore.paneTree)
  if (leaves.some(p => p.tabs.includes(pdfPath))) return

  // Use activePaneId (always a leaf) — props.paneId may point to a split after prior operations
  const sourcePaneId = editorStore.activePaneId
  editorStore.splitPaneWith(sourcePaneId, 'vertical', pdfPath)
}

function getAllLeaves(node) {
  if (!node) return []
  if (node.type === 'leaf') return [node]
  return (node.children || []).flatMap(getAllLeaves)
}

// Auto-open PDF on first successful auto-compile for .tex files in this pane
function handleLatexCompileDone(e) {
  const { texPath, pdf_path, success } = e.detail || {}
  if (!success || !pdf_path) return
  // Only handle if the .tex file is in THIS pane
  if (!props.tabs.includes(texPath)) return
  ensurePdfOpen(pdf_path)
}

onMounted(() => {
  window.addEventListener('latex-compile-done', handleLatexCompileDone)
})
onUnmounted(() => {
  window.removeEventListener('latex-compile-done', handleLatexCompileDone)
})

function closePane() {
  const pane = editorStore.findPane(editorStore.paneTree, props.paneId)
  if (!pane) return

  const parent = editorStore.findParent(editorStore.paneTree, pane.id)
  if (!parent) {
    // Root pane - just clear all tabs
    pane.tabs = []
    pane.activeTab = null
    return
  }

  // Directly collapse this pane so sibling expands to fill space
  editorStore.collapsePane(props.paneId)
}
</script>

<style scoped>
/* ── Layout ── */
.empty-pane {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  user-select: none;
  -webkit-user-select: none;
}

.empty-pane-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 260px; /* Slightly wider to accommodate filenames */
}

/* ── Brand wordmark ── */
.empty-pane-brand {
  font-family: 'Lora', ui-serif, Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: 2.25rem; /* text-4xl approx, consistent with original vision */
  color: var(--fg-primary);
  opacity: 0.25; /* Subtlety key to "sophisticated" */
  letter-spacing: -0.02em;
}

/* ── Editorial rule ── */
.empty-pane-rule {
  width: 32px;
  height: 1px;
  background: var(--fg-muted);
  opacity: 0.2;
  margin: 16px 0 24px;
}

/* ── Section groups ── */
.empty-pane-group {
  width: 100%;
}

.empty-pane-group + .empty-pane-group {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* ── Section label ── */
.empty-pane-label {
  font-size: 9px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--fg-muted);
  padding: 0 10px 6px;
  opacity: 0.8;
}

/* ── Shared interactive row ── */
.empty-pane-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: transparent;
  color: var(--fg-secondary);
  font-size: 13px;
  line-height: 1.5;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s, color 0.15s;
}

.empty-pane-row:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

/* ── File entries ── */
.empty-pane-file {
  display: flex;
  align-items: center;
  justify-content: flex-start; /* Ensure icon and text are grouped left */
}

.empty-pane-icon {
  flex-shrink: 0;
  margin-right: 8px;
  color: var(--fg-muted);
  opacity: 0.7;
}

.empty-pane-row:hover .empty-pane-icon {
  color: var(--fg-secondary);
  opacity: 1;
}

.truncate {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Shortcut hint ── */
.empty-pane-shortcut {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--fg-secondary);
  opacity: 1;
  flex-shrink: 0;
  margin-left: 16px;
  background: var(--bg-secondary);
  padding: 2px 4px;
  border-radius: 3px;
}
</style>
