<template>
  <div class="notebook-editor h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="notebook-toolbar flex items-center gap-2 px-3 py-1.5 border-b shrink-0"
      style="background: var(--bg-secondary); border-color: var(--border);">

      <!-- Status chip (replaces kernel dropdown) -->
      <button
        ref="statusChipRef"
        class="nb-status-chip"
        :class="statusChipClass"
        @click="toggleStatusPopover"
      >
        <span class="nb-status-dot" :class="statusDotClass"></span>
        {{ statusChipLabel }}
        <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" style="margin-left: 2px; opacity: 0.6;">
          <path d="M2 3.5l3 3 3-3z"/>
        </svg>
      </button>

      <!-- Kernel status (when Jupyter mode and kernel active) -->
      <span v-if="mode === 'jupyter' && kernelId" class="text-[10px] px-1.5 py-0.5 rounded font-medium"
        :style="kernelStatusStyle">
        {{ kernelStatusLabel }}
      </span>

      <div class="flex items-center gap-1 ml-1">
        <button class="nb-toolbar-btn" @click="runAllCells" :disabled="mode === 'none'" title="Run all cells">
          <svg width="10" height="10" viewBox="0 0 20 16" fill="currentColor"><polygon points="2,2 10,8 2,14"/><polygon points="10,2 18,8 10,14"/></svg>
          Run All
        </button>
        <button v-if="mode === 'jupyter'" class="nb-toolbar-btn" @click="restartKernel" :disabled="!kernelId" title="Restart kernel">
          Restart
        </button>
        <button class="nb-toolbar-btn" @click="clearAllOutputs" title="Clear all outputs">
          Clear
        </button>
      </div>

      <span class="ml-auto text-[10px]" style="color: var(--fg-muted);">
        {{ cells.length }} cells
        <template v-if="saving"> &middot; Saving...</template>
      </span>
    </div>

    <!-- Status popover (Teleported to body to avoid overflow-hidden clipping) -->
    <Teleport to="body">
      <div v-if="showStatusPopover" class="fixed inset-0 z-[9999]" @click="showStatusPopover = false">
        <div
          class="nb-status-popover"
          :style="{ left: popoverX + 'px', top: popoverY + 'px' }"
          @click.stop
        >
          <!-- Current language info -->
          <div class="nb-pop-section">
            <div class="nb-pop-label">Notebook Language</div>
            <div class="nb-pop-value">{{ langDisplayName }}</div>
          </div>

          <!-- Status details -->
          <div class="nb-pop-section">
            <div class="nb-pop-label">Status</div>
            <div v-if="mode === 'jupyter'" class="nb-pop-status nb-pop-status-good">
              <span class="nb-pop-dot good"></span>
              Jupyter kernel ready
            </div>
            <div v-else class="nb-pop-status nb-pop-status-none">
              <span class="nb-pop-dot none"></span>
              No Jupyter kernel
              <div class="nb-pop-hint">{{ envStore.installHint(notebookLanguage) }}</div>
            </div>
          </div>

          <!-- Jupyter info -->
          <div v-if="envStore.jupyter.found" class="nb-pop-section">
            <div class="nb-pop-label">Jupyter</div>
            <div class="nb-pop-value" style="font-size: 10px; font-family: var(--font-mono); color: var(--fg-muted);">
              {{ envStore.jupyter.path }}
            </div>
          </div>

          <!-- Kernel picker (jupyter mode) -->
          <div v-if="mode === 'jupyter'" class="nb-pop-section">
            <div class="nb-pop-label">Kernel</div>
            <select
              v-model="selectedSpec"
              class="nb-pop-select"
            >
              <option v-for="k in kernelspecs" :key="k.name" :value="k.name">
                {{ k.display_name }}
              </option>
            </select>
          </div>

          <!-- Re-detect link -->
          <div class="nb-pop-footer">
            <button class="nb-pop-link" @click="redetect" :disabled="envStore.detecting">
              {{ envStore.detecting ? 'Detecting...' : 'Re-detect languages' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Setup prompt (when no kernel available) -->
    <div v-if="mode === 'none' && envStore.detected" class="nb-setup-prompt">
      <div class="nb-setup-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
          <path d="M7 8l3 3-3 3" opacity="0.7"/><line x1="13" y1="14" x2="17" y2="14" opacity="0.7"/>
        </svg>
      </div>
      <div class="nb-setup-title">Set up {{ langDisplayName }} for notebooks</div>
      <div class="nb-setup-desc">
        Running notebook cells requires a Jupyter kernel.
        {{ envStore.jupyter.found ? '' : 'Jupyter was not found on your system.' }}
      </div>

      <div class="nb-setup-steps">
        <div v-if="!envStore.jupyter.found" class="nb-setup-step">
          <span class="nb-setup-step-num">1</span>
          <div>
            <div class="nb-setup-step-title">Install Jupyter</div>
            <code class="nb-setup-code">pip3 install jupyter</code>
          </div>
        </div>
        <div class="nb-setup-step">
          <span class="nb-setup-step-num">{{ envStore.jupyter.found ? '1' : '2' }}</span>
          <div>
            <div class="nb-setup-step-title">Install the {{ langDisplayName }} kernel</div>
            <code class="nb-setup-code">{{ envStore.installCommand(notebookLanguage) }}</code>
          </div>
        </div>
      </div>

      <div class="nb-setup-actions">
        <button
          class="nb-setup-install-btn"
          :disabled="envStore.installing === notebookLanguage"
          @click="handleInstallKernel"
        >
          {{ envStore.installing === notebookLanguage ? 'Installing...' : `Install ${kernelPackageName} now` }}
        </button>
        <button class="nb-setup-redetect" @click="redetect" :disabled="envStore.detecting">
          {{ envStore.detecting ? 'Checking...' : 'Re-check' }}
        </button>
      </div>

      <div v-if="envStore.installError" class="nb-setup-error">{{ envStore.installError }}</div>
      <div v-if="envStore.installOutput && envStore.installing === notebookLanguage" class="nb-setup-output">
        <pre>{{ envStore.installOutput.slice(-500) }}</pre>
      </div>
    </div>

    <!-- Cell list -->
    <div class="flex-1 overflow-y-auto" ref="cellsContainer">
      <div class="max-w-[900px] mx-auto pt-4 pb-40 px-4">
        <NotebookCell
          v-for="(cell, idx) in displayCells"
          :key="cell.id"
          :ref="el => setCellRef(idx, el)"
          :cell="cell"
          :index="idx"
          :active="activeCell === idx"
          :running="runningCells.has(cell.id)"
          :language="notebookLanguage"
          :taskCount="cellTaskCounts[cell.id] || 0"
          :pendingEdit="cell._pendingEdit"
          :pendingDelete="cell._pendingDelete"
          :pendingAdd="cell._pendingAdd"
          :editId="cell._editId"
          @focus="activeCell = idx"
          @run="runCell(idx)"
          @delete="deleteCell(idx)"
          @move-up="moveCell(idx, -1)"
          @move-down="moveCell(idx, 1)"
          @toggle-type="toggleCellType(idx)"
          @add-above="addCell(idx, 'code')"
          @add-below="addCell(idx + 1, 'code')"
          @content-change="(src) => updateCellSource(idx, src)"
          @open-task="openCellTask(idx)"
          @accept-edit="(id) => reviews.acceptNotebookEdit(id)"
          @reject-edit="(id) => reviews.rejectNotebookEdit(id)"
        />

        <!-- Add cell button -->
        <div class="flex gap-2 justify-center mt-3">
          <button class="nb-add-cell-btn" @click="addCell(cells.length, 'code')">+ Code</button>
          <button class="nb-add-cell-btn" @click="addCell(cells.length, 'markdown')">+ Markdown</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../../stores/workspace'
import { useFilesStore } from '../../stores/files'
import { useEditorStore } from '../../stores/editor'
import { useKernelStore } from '../../stores/kernel'
import { useTasksStore } from '../../stores/tasks'
import { useReviewsStore } from '../../stores/reviews'
import { useEnvironmentStore } from '../../stores/environment'
import { parseNotebook, serializeNotebook, generateCellId, getNotebookLanguage } from '../../utils/notebookFormat'
import NotebookCell from './NotebookCell.vue'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const workspace = useWorkspaceStore()
const filesStore = useFilesStore()
const editorStore = useEditorStore()
const kernelStore = useKernelStore()
const tasksStore = useTasksStore()
const reviews = useReviewsStore()
const envStore = useEnvironmentStore()

// Notebook state
const cells = reactive([])
const metadata = ref({})
const nbformat = ref(4)
const nbformatMinor = ref(5)
const activeCell = ref(0)
const saving = ref(false)
const kernelId = ref(null)
const selectedSpec = ref('')
const runningCells = reactive(new Set())
const cellRefs = {}

// UI state
const showStatusPopover = ref(false)
const statusChipRef = ref(null)
const popoverX = ref(0)
const popoverY = ref(0)

// Computed: task counts per cell
const cellTaskCounts = computed(() => {
  const counts = {}
  for (const cell of cells) {
    const threads = tasksStore.threadsForCell(props.filePath, cell.id)
    if (threads.length > 0) counts[cell.id] = threads.length
  }
  return counts
})

// Pending notebook edits
const pendingNotebookEdits = computed(() => reviews.notebookEditsForFile(props.filePath))

// Display cells: merges real cells with phantom add-cells, annotates pending states
const displayCells = computed(() => {
  const edits = pendingNotebookEdits.value
  if (edits.length === 0) return cells.map((c) => ({ ...c, _pendingEdit: null, _pendingDelete: false, _pendingAdd: false, _editId: null }))

  const result = []
  const editsByCell = {}
  const addEdits = []

  for (const edit of edits) {
    if (edit.tool === 'NotebookAddCell') {
      addEdits.push(edit)
    } else {
      editsByCell[edit.cell_id] = edit
    }
  }

  // Insert real cells with annotations
  for (const cell of cells) {
    const edit = editsByCell[cell.id]
    result.push({
      ...cell,
      _pendingEdit: edit?.tool === 'NotebookEditCell' ? edit : null,
      _pendingDelete: edit?.tool === 'NotebookDeleteCell',
      _pendingAdd: false,
      _editId: edit?.id || null,
    })
  }

  // Insert phantom add-cells at correct positions (reverse order to keep indices stable)
  const sortedAdds = [...addEdits].sort((a, b) => b.cell_index - a.cell_index)
  for (const add of sortedAdds) {
    const idx = Math.min(add.cell_index, result.length)
    result.splice(idx, 0, {
      id: add.cell_id,
      type: add.cell_type || 'code',
      source: add.cell_source || '',
      outputs: [],
      executionCount: null,
      metadata: {},
      _pendingEdit: null,
      _pendingDelete: false,
      _pendingAdd: true,
      _editId: add.id,
    })
  }

  return result
})

// Computed
const kernelspecs = computed(() => kernelStore.kernelspecs)
const notebookLanguage = computed(() => getNotebookLanguage(metadata.value))

const langDisplayName = computed(() => {
  const lang = notebookLanguage.value
  if (lang === 'r') return 'R'
  return lang.charAt(0).toUpperCase() + lang.slice(1)
})

const mode = computed(() => envStore.capability(notebookLanguage.value))

const kernelPackageName = computed(() => {
  const map = { python: 'ipykernel', r: 'IRkernel', julia: 'IJulia' }
  return map[notebookLanguage.value] || 'kernel'
})

const statusChipLabel = computed(() => {
  return envStore.statusLabel(notebookLanguage.value)
})

const statusChipClass = computed(() => ({
  'nb-chip-jupyter': mode.value === 'jupyter',
  'nb-chip-none': mode.value === 'none',
}))

const statusDotClass = computed(() => ({
  good: mode.value === 'jupyter',
  none: mode.value === 'none',
}))

const kernelStatusLabel = computed(() => {
  if (!kernelId.value) return 'No kernel'
  const k = kernelStore.kernels[kernelId.value]
  return k ? k.status : 'disconnected'
})

const kernelStatusStyle = computed(() => {
  const status = kernelStatusLabel.value
  if (status === 'idle') return { color: 'var(--success)', background: 'rgba(80, 250, 123, 0.1)' }
  if (status === 'busy') return { color: 'var(--warning, #e2b93d)', background: 'rgba(226, 185, 61, 0.1)' }
  return { color: 'var(--fg-muted)', background: 'var(--bg-secondary)' }
})

// Cell ref management
function setCellRef(idx, el) {
  if (el) cellRefs[idx] = el
  else delete cellRefs[idx]
}

// ============ Status popover ============

function toggleStatusPopover() {
  if (showStatusPopover.value) {
    showStatusPopover.value = false
    return
  }
  if (statusChipRef.value) {
    const rect = statusChipRef.value.getBoundingClientRect()
    popoverX.value = rect.left
    popoverY.value = rect.bottom + 4
  }
  showStatusPopover.value = true
}

async function handleInstallKernel() {
  const success = await envStore.installKernel(notebookLanguage.value)
  if (success) {
    // Re-discover kernels so the kernel picker updates
    await kernelStore.discover()
    // Auto-select the new kernel
    if (kernelspecs.value.length > 0 && !selectedSpec.value) {
      selectedSpec.value = kernelspecs.value[0].name
    }
  }
}

async function redetect() {
  await envStore.detect()
  if (mode.value === 'jupyter') {
    await kernelStore.discover()
  }
}

// ============ Load notebook ============

async function loadNotebook() {
  let content = filesStore.fileContents[props.filePath]
  if (!content) {
    content = await invoke('read_file', { path: props.filePath })
    filesStore.fileContents[props.filePath] = content
  }

  const nb = parseNotebook(content)
  cells.splice(0, cells.length, ...nb.cells)
  metadata.value = nb.metadata
  nbformat.value = nb.nbformat
  nbformatMinor.value = nb.nbformat_minor

  // Auto-select kernel spec from metadata
  const specName = nb.metadata?.kernelspec?.name
  if (specName && kernelspecs.value.find(k => k.name === specName)) {
    selectedSpec.value = specName
  } else if (kernelspecs.value.length > 0) {
    selectedSpec.value = kernelspecs.value[0].name
  }
}

// ============ Save notebook ============

let saveTimer = null

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveNotebook, 1500)
}

async function saveNotebook() {
  saving.value = true
  try {
    // Sync editor content for non-pending cells only
    const pendingEdits = pendingNotebookEdits.value
    for (const [idxStr, cellRef] of Object.entries(cellRefs)) {
      if (!cellRef?.syncContent) continue
      const idx = parseInt(idxStr)
      const dc = displayCells.value[idx]
      if (dc && !dc._pendingEdit && !dc._pendingDelete && !dc._pendingAdd) {
        cellRef.syncContent()
      }
    }

    if (pendingEdits.length === 0) {
      // No pending reviews — save all cells directly
      const content = serializeNotebook(cells, metadata.value, nbformat.value, nbformatMinor.value)
      await invoke('write_file', { path: props.filePath, content })
      filesStore.fileContents[props.filePath] = content
    } else {
      // Surgical save: read disk, update only non-pending cells, write back
      const raw = await invoke('read_file', { path: props.filePath })
      const nb = parseNotebook(raw)

      for (const diskCell of nb.cells) {
        const reactiveCell = cells.find(c => c.id === diskCell.id)
        if (!reactiveCell) continue
        const pending = reviews.notebookEditForCell(props.filePath, diskCell.id)
        if (!pending) {
          diskCell.source = reactiveCell.source
        }
      }

      const content = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
      await invoke('write_file', { path: props.filePath, content })
      filesStore.fileContents[props.filePath] = content
    }
  } catch (e) {
    console.error('Notebook save failed:', e)
    const { useToastStore } = await import('../../stores/toast')
    const { formatFileError } = await import('../../utils/errorMessages')
    useToastStore().showOnce(`save:${props.filePath}`, formatFileError('save', props.filePath, e), { type: 'error', duration: 5000 })
  } finally {
    saving.value = false
  }
}

// ============ Cell operations ============

function addCell(index, type) {
  const newCell = {
    id: generateCellId(),
    type,
    source: '',
    outputs: [],
    executionCount: null,
    metadata: {},
  }
  cells.splice(index, 0, newCell)
  activeCell.value = index
  scheduleSave()
  nextTick(() => {
    if (cellRefs[index]?.focus) cellRefs[index].focus()
  })
}

function deleteCell(index) {
  if (cells.length <= 1) return
  cells.splice(index, 1)
  if (activeCell.value >= cells.length) {
    activeCell.value = cells.length - 1
  }
  scheduleSave()
}

function moveCell(index, direction) {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= cells.length) return
  const [cell] = cells.splice(index, 1)
  cells.splice(newIndex, 0, cell)
  activeCell.value = newIndex
  scheduleSave()
}

function toggleCellType(index) {
  const cell = cells[index]
  cell.type = cell.type === 'code' ? 'markdown' : 'code'
  if (cell.type === 'markdown') {
    cell.outputs = []
    cell.executionCount = null
  }
  scheduleSave()
}

function updateCellSource(index, source) {
  cells[index].source = source
  scheduleSave()
}

function clearAllOutputs() {
  for (const cell of cells) {
    if (cell.type === 'code') {
      cell.outputs = []
      cell.executionCount = null
    }
  }
  scheduleSave()
}

// ============ Cell tasks ============

function formatCellOutputsAsText(outputs) {
  if (!outputs || outputs.length === 0) return ''
  return outputs.map(o => {
    if (o.output_type === 'stream') {
      const text = Array.isArray(o.text) ? o.text.join('') : (o.text || '')
      return text.slice(0, 500)
    }
    if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
      const plain = o.data?.['text/plain']
      if (plain) return (Array.isArray(plain) ? plain.join('') : plain).slice(0, 500)
      return '[rich output]'
    }
    if (o.output_type === 'error') {
      return `${o.ename}: ${o.evalue}`.slice(0, 500)
    }
    return ''
  }).filter(Boolean).join('\n')
}

function startCellTask(cellIndex) {
  const cell = cells[cellIndex]
  if (!cell) return

  const cellRef = cellRefs[cellIndex]
  const selection = cellRef?.getSelection?.()

  // Use selection text if available, else full cell source
  const selectedText = selection?.text || cell.source || ''
  const range = selection || { from: 0, to: selectedText.length }
  const outputsText = formatCellOutputsAsText(cell.outputs)

  const threadId = tasksStore.createThread(
    props.filePath,
    range,
    selectedText,
    null,
    {
      cellId: cell.id,
      cellIndex,
      cellType: cell.type,
      cellOutputs: outputsText || null,
      cellLanguage: notebookLanguage.value,
    }
  )

  return threadId
}

function openCellTask(cellIndex) {
  const cell = cells[cellIndex]
  if (!cell) return

  const existing = tasksStore.threadsForCell(props.filePath, cell.id)
  if (existing.length > 0) {
    tasksStore.setActiveThread(existing[0].id)
  } else {
    startCellTask(cellIndex)
  }

  window.dispatchEvent(new CustomEvent('open-tasks'))
}

function scrollToCell(cellIndex) {
  const cellRef = cellRefs[cellIndex]
  if (cellRef?.$el) {
    cellRef.$el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    activeCell.value = cellIndex
    nextTick(() => cellRef.focus?.())
  }
}

// ============ Kernel management (Jupyter mode) ============

async function ensureKernel() {
  if (kernelId.value && kernelStore.kernels[kernelId.value]) {
    return kernelId.value
  }

  if (!selectedSpec.value) {
    if (kernelspecs.value.length === 0) {
      await kernelStore.discover()
    }
    if (kernelspecs.value.length === 0) {
      throw new Error('No Jupyter kernels available')
    }
    selectedSpec.value = kernelspecs.value[0].name
  }

  kernelId.value = await kernelStore.launch(selectedSpec.value)
  return kernelId.value
}

async function restartKernel() {
  if (kernelId.value) {
    await kernelStore.shutdown(kernelId.value)
    kernelId.value = null
  }
  for (const cell of cells) {
    if (cell.type === 'code') {
      cell.executionCount = null
    }
  }
  await ensureKernel()
}

// ============ Cell execution ============

let executionCounter = 0

async function runCell(index) {
  const cell = cells[index]
  if (cell.type !== 'code' || !cell.source.trim()) return

  if (mode.value !== 'jupyter') {
    cell.outputs = [{
      output_type: 'error',
      ename: 'No Kernel',
      evalue: 'Set up a Jupyter kernel to run cells. Click the status chip in the toolbar.',
      traceback: [],
    }]
    return { outputs: cell.outputs, success: false }
  }

  try {
    const kid = await ensureKernel()
    runningCells.add(cell.id)
    cell.outputs = []

    const { outputs, success } = await kernelStore.execute(kid, cell.source)

    executionCounter++
    cell.executionCount = executionCounter
    cell.outputs = outputs.map(normalizeOutput)

    scheduleSave()
    return { outputs: cell.outputs, success }
  } catch (e) {
    cell.outputs = [{
      output_type: 'error',
      ename: 'ExecutionError',
      evalue: e.message || String(e),
      traceback: [e.message || String(e)],
    }]
    return { outputs: cell.outputs, success: false }
  } finally {
    runningCells.delete(cell.id)
  }
}

async function runAllCells() {
  for (let i = 0; i < cells.length; i++) {
    if (cells[i].type === 'code') {
      const result = await runCell(i)
      if (result && !result.success) break
    }
  }
}

function normalizeOutput(raw) {
  const type = raw.output_type || raw.type
  if (type === 'stream') {
    return {
      output_type: 'stream',
      name: raw.name || raw.data?.name || 'stdout',
      text: raw.text || raw.data?.text || '',
    }
  }
  if (type === 'display_data') {
    return {
      output_type: 'display_data',
      data: raw.data || {},
      metadata: raw.metadata || {},
    }
  }
  if (type === 'execute_result') {
    return {
      output_type: 'execute_result',
      data: raw.data || {},
      metadata: raw.metadata || {},
      execution_count: raw.execution_count || null,
    }
  }
  if (type === 'error') {
    return {
      output_type: 'error',
      ename: raw.ename || raw.data?.ename || 'Error',
      evalue: raw.evalue || raw.data?.evalue || '',
      traceback: raw.traceback || raw.data?.traceback || [],
    }
  }
  return {
    output_type: 'stream',
    name: 'stdout',
    text: JSON.stringify(raw),
  }
}

// ============ External event listeners (for AI tools) ============

function onNotebookCellTask(e) {
  const { path } = e.detail || {}
  if (path !== props.filePath) return
  // Use active cell
  const idx = activeCell.value
  if (idx >= 0 && idx < cells.length) {
    const threadId = startCellTask(idx)
    if (threadId) {
      window.dispatchEvent(new CustomEvent('open-tasks', { detail: { threadId } }))
    }
  }
}

function onNotebookScrollToCell(e) {
  const { path, cellId } = e.detail || {}
  if (path !== props.filePath) return
  const idx = cells.findIndex(c => c.id === cellId)
  if (idx >= 0) scrollToCell(idx)
}

function onRunNotebookCell(e) {
  const { path, index } = e.detail || {}
  if (path !== props.filePath) return
  runCell(index).then(result => {
    const outputText = (result?.outputs || []).map(o => {
      if (o.output_type === 'stream') return Array.isArray(o.text) ? o.text.join('') : o.text
      if (o.output_type === 'execute_result' || o.output_type === 'display_data') {
        return o.data?.['text/plain'] ? (Array.isArray(o.data['text/plain']) ? o.data['text/plain'].join('') : o.data['text/plain']) : '[rich output]'
      }
      if (o.output_type === 'error') return `${o.ename}: ${o.evalue}`
      return ''
    }).join('\n')

    window.dispatchEvent(new CustomEvent('cell-execution-complete', {
      detail: {
        path,
        index,
        output: outputText || '(no output)',
        success: result?.success !== false,
        error: result?.success === false ? outputText : null,
      },
    }))
  })
}

function onRunAllNotebookCells(e) {
  const { path } = e.detail || {}
  if (path !== props.filePath) return
  runAllCells().then(() => {
    const summary = cells
      .filter(c => c.type === 'code' && c.outputs.length > 0)
      .map((c, i) => {
        const out = c.outputs.map(o => {
          if (o.output_type === 'error') return `ERROR: ${o.ename}: ${o.evalue}`
          if (o.output_type === 'stream') return (Array.isArray(o.text) ? o.text.join('') : o.text).slice(0, 200)
          return '[output]'
        }).join('\n')
        return `Cell ${i}: ${out.slice(0, 300)}`
      }).join('\n\n')

    window.dispatchEvent(new CustomEvent('all-cells-execution-complete', {
      detail: {
        path,
        summary: summary || 'All cells executed (no output)',
      },
    }))
  })
}

// ============ Notebook review events ============

function onNotebookPendingEdit(e) {
  const { file_path } = e.detail || {}
  if (file_path !== props.filePath) return
  // displayCells computed will update reactively via reviews store
}

function onNotebookReviewResolved(e) {
  const { file_path } = e.detail || {}
  if (file_path !== props.filePath) return
  // Reload notebook from disk after accept (content changed on disk)
  loadNotebook()
}

// ============ Watch for external file changes (AI edits) ============

watch(() => filesStore.fileContents[props.filePath], (newContent) => {
  if (!newContent || saving.value) return
  try {
    const nb = parseNotebook(newContent)
    if (JSON.stringify(nb.cells.map(c => c.source)) !== JSON.stringify(cells.map(c => c.source))) {
      cells.splice(0, cells.length, ...nb.cells)
      metadata.value = nb.metadata
    }
  } catch { /* ignore parse errors */ }
})

// ============ Lifecycle ============

onMounted(async () => {
  // Detect languages if not already done
  if (!envStore.detected) {
    await envStore.detect()
  }

  // Only discover kernels if we have Jupyter capability
  if (mode.value === 'jupyter') {
    await kernelStore.discover()
  }

  await loadNotebook()

  window.addEventListener('run-notebook-cell', onRunNotebookCell)
  window.addEventListener('run-all-notebook-cells', onRunAllNotebookCells)
  window.addEventListener('notebook-cell-task', onNotebookCellTask)
  window.addEventListener('notebook-scroll-to-cell', onNotebookScrollToCell)
  window.addEventListener('notebook-pending-edit', onNotebookPendingEdit)
  window.addEventListener('notebook-review-resolved', onNotebookReviewResolved)
})

onUnmounted(async () => {
  window.removeEventListener('run-notebook-cell', onRunNotebookCell)
  window.removeEventListener('run-all-notebook-cells', onRunAllNotebookCells)
  window.removeEventListener('notebook-cell-task', onNotebookCellTask)
  window.removeEventListener('notebook-scroll-to-cell', onNotebookScrollToCell)
  window.removeEventListener('notebook-pending-edit', onNotebookPendingEdit)
  window.removeEventListener('notebook-review-resolved', onNotebookReviewResolved)

  if (saveTimer) clearTimeout(saveTimer)
  if (!filesStore.deletingPaths.has(props.filePath)) {
    await saveNotebook()
  }
})
</script>

<style scoped>
.notebook-toolbar {
  font-size: 12px;
}

/* Status chip */
.nb-status-chip {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.nb-status-chip:hover {
  border-color: var(--fg-muted);
}

.nb-chip-jupyter {
  border-color: rgba(80, 250, 123, 0.3);
}

.nb-chip-none {
  border-color: rgba(247, 118, 142, 0.3);
}

.nb-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.nb-status-dot.good { background: var(--success, #50fa7b); }
.nb-status-dot.none { background: var(--fg-muted); opacity: 0.5; }

/* Status popover */
.nb-status-popover {
  position: fixed;
  z-index: 10000;
  width: 300px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  padding: 12px;
}

.nb-pop-section {
  margin-bottom: 12px;
}

.nb-pop-section:last-child {
  margin-bottom: 0;
}

.nb-pop-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--fg-muted);
  margin-bottom: 4px;
}

.nb-pop-value {
  font-size: 12px;
  color: var(--fg-primary);
  font-weight: 500;
}

.nb-pop-status {
  font-size: 11px;
  padding: 6px 8px;
  border-radius: 5px;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 6px;
}

.nb-pop-status-good {
  background: rgba(80, 250, 123, 0.06);
  color: var(--success, #50fa7b);
}

.nb-pop-status-none {
  background: rgba(247, 118, 142, 0.06);
  color: var(--error, #f7768e);
}

.nb-pop-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 4px;
}

.nb-pop-dot.good { background: var(--success, #50fa7b); }
.nb-pop-dot.none { background: var(--fg-muted); }

.nb-pop-hint {
  width: 100%;
  font-size: 10px;
  color: var(--fg-muted);
  margin-top: 4px;
  line-height: 1.4;
}

.nb-pop-select {
  width: 100%;
  padding: 4px 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 11px;
  outline: none;
}

.nb-pop-install-btn {
  padding: 5px 12px;
  border-radius: 5px;
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.nb-pop-install-btn:hover {
  background: rgba(122, 162, 247, 0.2);
}

.nb-pop-install-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.nb-pop-error {
  margin-top: 6px;
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(247, 118, 142, 0.1);
  color: var(--error);
  font-size: 10px;
}

.nb-pop-footer {
  border-top: 1px solid var(--border);
  margin-top: 8px;
  padding-top: 8px;
}

.nb-pop-link {
  font-size: 10px;
  color: var(--fg-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.1s;
}

.nb-pop-link:hover {
  color: var(--accent);
}

.nb-pop-link:disabled {
  opacity: 0.5;
  cursor: wait;
}

/* Setup prompt */
.nb-setup-prompt {
  max-width: 480px;
  margin: 60px auto 0;
  padding: 32px;
  text-align: center;
}

.nb-setup-icon {
  color: var(--fg-muted);
  opacity: 0.5;
  margin-bottom: 16px;
}

.nb-setup-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--fg-primary);
  margin-bottom: 8px;
}

.nb-setup-desc {
  font-size: 12px;
  color: var(--fg-muted);
  margin-bottom: 24px;
  line-height: 1.5;
}

.nb-setup-steps {
  text-align: left;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.nb-setup-step {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.nb-setup-step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--bg-tertiary, var(--bg-secondary));
  color: var(--fg-muted);
  font-size: 11px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nb-setup-step-title {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-primary);
  margin-bottom: 4px;
}

.nb-setup-code {
  display: block;
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--accent);
  background: var(--bg-primary);
  padding: 6px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  user-select: all;
}

.nb-setup-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}

.nb-setup-install-btn {
  padding: 7px 20px;
  border-radius: 6px;
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.nb-setup-install-btn:hover {
  background: rgba(122, 162, 247, 0.2);
}

.nb-setup-install-btn:disabled {
  opacity: 0.5;
  cursor: wait;
}

.nb-setup-redetect {
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}

.nb-setup-redetect:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}

.nb-setup-redetect:disabled {
  opacity: 0.5;
  cursor: wait;
}

.nb-setup-error {
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: 5px;
  background: rgba(247, 118, 142, 0.1);
  color: var(--error);
  font-size: 11px;
  text-align: left;
}

.nb-setup-output {
  margin-top: 8px;
  text-align: left;
}

.nb-setup-output pre {
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--fg-muted);
  background: var(--bg-primary);
  padding: 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Toolbar buttons */
.nb-toolbar-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: none;
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
  transition: background 0.1s, color 0.1s;
}

.nb-toolbar-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

.nb-toolbar-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.nb-add-cell-btn {
  padding: 4px 16px;
  border: 1px dashed var(--border);
  background: transparent;
  color: var(--fg-muted);
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
  transition: border-color 0.15s, color 0.15s;
}

.nb-add-cell-btn:hover {
  border-color: var(--accent);
  color: var(--fg-primary);
}
</style>
