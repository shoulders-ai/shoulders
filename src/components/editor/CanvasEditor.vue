<template>
  <div class="canvas-editor h-full" @keydown="onKeydown" @contextmenu.prevent>
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      :node-types="nodeTypes"
      :default-edge-options="defaultEdgeOptions"
      :snap-to-grid="true"
      :snap-grid="[20, 20]"
      :min-zoom="0.1"
      :max-zoom="4"
      :fit-view-on-init="false"
      :delete-key-code="null"
      :zoom-on-double-click="false"
      :pan-on-scroll="true"
      :pan-on-scroll-mode="'free'"
      :edges-updatable="true"
      @connect="onConnect"
      @connect-start="onConnectStart"
      @connect-end="onConnectEnd"
      @pane-click="onPaneClick"
      @node-drag-stop="onNodeDragStop"
      @move-end="onMoveEnd"
      @pane-context-menu="onPaneContextMenu"
      @node-context-menu="onNodeContextMenu"
      @edge-context-menu="onEdgeContextMenu"
      @drop="onDrop"
      @dragover.prevent
    >
      <Background :gap="20" :size="1.5" variant="dots" />
      <MiniMap v-if="showMinimap" />
    </VueFlow>

    <!-- Empty state -->
    <div v-if="nodes.length === 0 && !loading" class="empty-state">
      Double-click to start thinking.
    </div>

    <!-- Context menu -->
    <CanvasContextMenu
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :type="contextMenu.type"
      :nodeId="contextMenu.nodeId"
      :edgeId="contextMenu.edgeId"
      @close="contextMenu.show = false"
      @add-text-node="addTextNodeAtMenu"
      @add-prompt-node="addPromptNodeAtMenu"
      @add-label-node="addLabelNodeAtMenu"
      @add-group-node="addGroupNodeAtMenu"
      @delete-selected="deleteFromContextMenu"
      @duplicate-selected="duplicateFromContextMenu"
      @select-all="selectAllFromContextMenu"
    />

    <!-- Floating style bar -->
    <FloatingStyleBar
      v-if="selectedNodes.length > 0"
      :nodes="selectedNodes"
      @update-style="onUpdateStyle"
      @delete="deleteSelected"
      @toggle-type="onToggleType"
      @toggle-title="onToggleTitle"
      @expand-height="onExpandHeight"
      @collapse-height="onCollapseHeight"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, markRaw, nextTick } from 'vue'
import { VueFlow, useVueFlow, Position, MarkerType } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { MiniMap } from '@vue-flow/minimap'
import { invoke } from '@tauri-apps/api/core'
import { useFilesStore } from '../../stores/files'
import { useCanvasStore } from '../../stores/canvas'
import { parseCanvas, serializeCanvas } from '../../utils/canvasFormat'
import { nanoid } from '../../stores/utils'
import TextNodeVue from '../canvas/TextNode.vue'
import PromptNodeVue from '../canvas/PromptNode.vue'
import FileNodeVue from '../canvas/FileNode.vue'
import LabelNodeVue from '../canvas/LabelNode.vue'
import GroupNodeVue from '../canvas/GroupNode.vue'
import CanvasContextMenu from '../canvas/CanvasContextMenu.vue'
import FloatingStyleBar from '../canvas/FloatingStyleBar.vue'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const filesStore = useFilesStore()
const canvasStore = useCanvasStore()

const nodes = ref([])
const edges = ref([])
const loading = ref(true)
const showMinimap = ref(false)

const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  type: 'pane', // 'pane' | 'node' | 'edge'
  nodeId: null,
  edgeId: null,
})

// Node types — markRaw() per Vue proxy gotcha
const nodeTypes = {
  text: markRaw(TextNodeVue),
  prompt: markRaw(PromptNodeVue),
  file: markRaw(FileNodeVue),
  label: markRaw(LabelNodeVue),
  group: markRaw(GroupNodeVue),
}

const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: false,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { stroke: 'var(--fg-muted)', strokeWidth: 1.5, strokeOpacity: 0.5 },
}

const { screenToFlowCoordinate, fitView, getSelectedNodes, addSelectedNodes, removeSelectedNodes, getNodes, getEdges } = useVueFlow()

const selectedNodes = computed(() => nodes.value.filter(n => n.selected))

// --- Load / Save ---

let saveTimer = null
let viewport = { x: 0, y: 0, zoom: 1 }

async function loadCanvas() {
  loading.value = true
  try {
    let content = filesStore.fileContents[props.filePath]
    if (!content) {
      content = await invoke('read_file', { path: props.filePath })
      filesStore.fileContents[props.filePath] = content
    }

    const data = parseCanvas(content)
    viewport = data.viewport

    // Convert to Vue Flow node format
    const defaultWidths = { file: 200, label: 200, group: 600, prompt: 300, text: 280 }
    nodes.value = data.nodes.map(n => {
      const defaultW = defaultWidths[n.type] || 280
      const node = {
        id: n.id,
        type: n.type,
        position: { ...n.position },
        data: { ...n.data },
        style: {
          width: n.dimensions?.width ? `${n.dimensions.width}px` : `${defaultW}px`,
          ...(n.dimensions?.height ? { height: `${n.dimensions.height}px` } : (n.type === 'group' ? { height: '400px' } : {})),
        },
      }
      if (n.type === 'group') node.zIndex = -1
      return node
    })

    edges.value = data.edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle || null,
      targetHandle: e.targetHandle || null,
      type: e.type || 'smoothstep',
    }))

    // Initialize canvas store
    canvasStore.load(props.filePath, data)

    // Restore viewport after next tick
    nextTick(() => {
      if (data.nodes.length > 0) {
        fitView({ padding: 0.2, duration: 0 })
      }
    })
  } catch (e) {
    console.error('Failed to load canvas:', e)
  } finally {
    loading.value = false
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(saveCanvas, 1500)
}

async function saveCanvas() {
  try {
    // Convert Vue Flow nodes back to canvas format
    const canvasNodes = nodes.value.map(n => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      dimensions: {
        width: n.dimensions?.width ?? (parseInt(n.style?.width) || null),
        height: n.dimensions?.height ?? (parseInt(n.style?.height) || null),
      },
      data: { ...n.data },
    }))

    const content = serializeCanvas(canvasNodes, edges.value, viewport, canvasStore.aiState)
    await invoke('write_file', { path: props.filePath, content })
    filesStore.fileContents[props.filePath] = content

    // Sync back to store
    canvasStore.syncFromEditor(canvasNodes, edges.value, viewport)
  } catch (e) {
    console.error('Failed to save canvas:', e)
  }
}

// Watch for external file changes
watch(() => filesStore.fileContents[props.filePath], (newContent, oldContent) => {
  if (!newContent || !oldContent) return
  // Only reload if the change came from outside (not our own save)
  // Compare against what we last saved
}, { flush: 'post' })

// --- Node CRUD ---

function addTextNode(position, data = {}) {
  const id = `n_${nanoid(8)}`
  const node = {
    id,
    type: 'text',
    position: { ...position },
    data: {
      content: data.content || '',
      title: data.title || null,
      color: data.color || null,
      borderWidth: 'thin',
      fontSize: 'medium',
      aiGenerated: data.aiGenerated || false,
      ...data,
    },
    style: { width: `${data.width || 280}px` },
  }
  canvasStore.pushSnapshot(nodes.value, edges.value)
  nodes.value.push(node)
  scheduleSave()
  return id
}

function addPromptNode(position, data = {}) {
  const id = `n_${nanoid(8)}`
  const node = {
    id,
    type: 'prompt',
    position: { ...position },
    data: {
      content: data.content || '',
      title: null,
      modelId: data.modelId || null,
      runCount: 0,
      ...data,
    },
    style: { width: '300px' },
  }
  canvasStore.pushSnapshot(nodes.value, edges.value)
  nodes.value.push(node)
  scheduleSave()
  return id
}

function addFileNode(position, data) {
  const id = `n_${nanoid(8)}`
  const node = {
    id,
    type: 'file',
    position: { ...position },
    data: {
      filePath: data.filePath,
      preview: data.preview || '',
      ...data,
    },
    style: { width: '200px' },
  }
  canvasStore.pushSnapshot(nodes.value, edges.value)
  nodes.value.push(node)
  scheduleSave()
  return id
}

function addLabelNode(position, data = {}) {
  const id = `n_${nanoid(8)}`
  const node = {
    id,
    type: 'label',
    position: { ...position },
    data: {
      content: data.content || '',
      fontSize: 'large',
      color: null,
      textAlign: 'left',
      ...data,
    },
    style: { width: `${data.width || 200}px` },
  }
  canvasStore.pushSnapshot(nodes.value, edges.value)
  nodes.value.push(node)
  scheduleSave()
  return id
}

function addGroupNode(position, data = {}) {
  const id = `n_${nanoid(8)}`
  const node = {
    id,
    type: 'group',
    position: { ...position },
    data: {
      title: 'Group',
      color: null,
      ...data,
    },
    style: { width: `${data.width || 600}px`, height: `${data.height || 400}px` },
    zIndex: -1,
  }
  canvasStore.pushSnapshot(nodes.value, edges.value)
  nodes.value.push(node)
  scheduleSave()
  return id
}

function deleteSelected() {
  const selectedNodeIds = nodes.value.filter(n => n.selected).map(n => n.id)
  const selectedEdgeIds = edges.value.filter(e => e.selected).map(e => e.id)

  if (selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) return

  canvasStore.pushSnapshot(nodes.value, edges.value)

  // Remove edges connected to deleted nodes
  edges.value = edges.value.filter(e =>
    !selectedEdgeIds.includes(e.id) &&
    !selectedNodeIds.includes(e.source) &&
    !selectedNodeIds.includes(e.target)
  )

  nodes.value = nodes.value.filter(n => !selectedNodeIds.includes(n.id))
  scheduleSave()
}

function duplicateSelected() {
  const selected = nodes.value.filter(n => n.selected)
  if (selected.length === 0) return

  canvasStore.pushSnapshot(nodes.value, edges.value)

  const idMap = {}
  for (const node of selected) {
    const newId = `n_${nanoid(8)}`
    idMap[node.id] = newId
    nodes.value.push({
      ...JSON.parse(JSON.stringify(node)),
      id: newId,
      position: { x: node.position.x + 40, y: node.position.y + 40 },
      selected: false,
    })
  }

  // Duplicate edges between selected nodes
  for (const edge of edges.value) {
    if (idMap[edge.source] && idMap[edge.target]) {
      edges.value.push({
        id: `e_${nanoid(8)}`,
        source: idMap[edge.source],
        target: idMap[edge.target],
        sourceHandle: edge.sourceHandle || null,
        targetHandle: edge.targetHandle || null,
        type: edge.type,
      })
    }
  }

  scheduleSave()
}

function selectAll() {
  nodes.value.forEach(n => { n.selected = true })
}

// --- Event handlers ---

function onPaneClick(event) {
  contextMenu.show = false
  // Double-click on pane → add text node
  // Vue Flow doesn't have a double-click pane event, so we handle it via @dblclick on the wrapper
}

let pendingConnectionSource = null

function onConnect(params) {
  pendingConnectionSource = null // Connection completed — don't also create node
  canvasStore.pushSnapshot(nodes.value, edges.value)
  edges.value.push({
    id: `e_${nanoid(8)}`,
    source: params.source,
    target: params.target,
    sourceHandle: params.sourceHandle || null,
    targetHandle: params.targetHandle || null,
    type: 'smoothstep',
  })
  scheduleSave()
}

let pendingConnectionSourceHandle = null

function onConnectStart({ nodeId, handleId }) {
  pendingConnectionSource = nodeId
  pendingConnectionSourceHandle = handleId || null
}

function onConnectEnd(event) {
  const sourceId = pendingConnectionSource
  const sourceHandle = pendingConnectionSourceHandle
  pendingConnectionSource = null
  pendingConnectionSourceHandle = null
  if (!event || !sourceId) return
  // If released on a handle or node, the @connect handler already fired
  if (event.target?.closest('.vue-flow__handle') || event.target?.closest('.vue-flow__node')) return

  const pos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const newId = addTextNode(pos)
  edges.value.push({
    id: `e_${nanoid(8)}`,
    source: sourceId,
    target: newId,
    sourceHandle: sourceHandle,
    targetHandle: null,
    type: 'smoothstep',
  })
  scheduleSave()
}

function onNodeDragStop() {
  canvasStore.pushSnapshot(nodes.value, edges.value)
  scheduleSave()
}

function onMoveEnd(event) {
  if (event.flowTransform) {
    viewport = {
      x: event.flowTransform.x,
      y: event.flowTransform.y,
      zoom: event.flowTransform.zoom,
    }
  }
}

function onPaneContextMenu(event) {
  if (event.preventDefault) event.preventDefault()
  contextMenu.show = true
  contextMenu.x = event.clientX || event.x
  contextMenu.y = event.clientY || event.y
  contextMenu.type = 'pane'
  contextMenu.nodeId = null
  contextMenu.edgeId = null
  contextMenu._flowPosition = screenToFlowCoordinate({ x: event.clientX || event.x, y: event.clientY || event.y })
}

function onNodeContextMenu({ event, node }) {
  event.preventDefault()
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.type = 'node'
  contextMenu.nodeId = node.id
}

function onEdgeContextMenu({ event, edge }) {
  event.preventDefault()
  // Select the edge so Delete key works
  const e = edges.value.find(ed => ed.id === edge.id)
  if (e) e.selected = true
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.type = 'edge'
  contextMenu.edgeId = edge.id
}

function addTextNodeAtMenu() {
  const pos = contextMenu._flowPosition || { x: 100, y: 100 }
  addTextNode(pos)
  contextMenu.show = false
}

function addPromptNodeAtMenu() {
  const pos = contextMenu._flowPosition || { x: 100, y: 100 }
  addPromptNode(pos)
  contextMenu.show = false
}

function addLabelNodeAtMenu() {
  const pos = contextMenu._flowPosition || { x: 100, y: 100 }
  addLabelNode(pos)
  contextMenu.show = false
}

function addGroupNodeAtMenu() {
  const pos = contextMenu._flowPosition || { x: 100, y: 100 }
  addGroupNode(pos)
  contextMenu.show = false
}

// Context menu action wrappers — close menu + handle edge-specific deletion
function deleteFromContextMenu() {
  if (contextMenu.type === 'edge' && contextMenu.edgeId) {
    canvasStore.pushSnapshot(nodes.value, edges.value)
    edges.value = edges.value.filter(e => e.id !== contextMenu.edgeId)
    scheduleSave()
  } else {
    deleteSelected()
  }
  contextMenu.show = false
}

function duplicateFromContextMenu() {
  duplicateSelected()
  contextMenu.show = false
}

function selectAllFromContextMenu() {
  selectAll()
  contextMenu.show = false
}

// --- Keyboard shortcuts ---

function onKeydown(e) {
  // Don't handle when editing text
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.target.isContentEditable) return

  const mod = e.metaKey || e.ctrlKey

  if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
    e.preventDefault()
    deleteSelected()
    return
  }

  if (mod && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    const snapshot = canvasStore.undo()
    if (snapshot) {
      nodes.value = snapshot.nodes
      edges.value = snapshot.edges
      scheduleSave()
    }
    return
  }

  if (mod && e.key === 'z' && e.shiftKey) {
    e.preventDefault()
    const snapshot = canvasStore.redo()
    if (snapshot) {
      nodes.value = snapshot.nodes
      edges.value = snapshot.edges
      scheduleSave()
    }
    return
  }

  if (mod && e.key === 'd') {
    e.preventDefault()
    duplicateSelected()
    return
  }

  if (mod && e.key === 'a') {
    e.preventDefault()
    selectAll()
    return
  }

  // Press Enter with nodes selected → create prompt node connected to selection
  if (e.key === 'Enter' && !mod && selectedNodes.value.length > 0) {
    e.preventDefault()
    const selected = selectedNodes.value
    // Position below the lowest selected node
    const maxY = Math.max(...selected.map(n => n.position.y + 100))
    const avgX = selected.reduce((sum, n) => sum + n.position.x, 0) / selected.length

    const promptId = addPromptNode({ x: avgX, y: maxY + 60 })
    // Connect each selected node to the new prompt
    for (const node of selected) {
      edges.value.push({
        id: `e_${nanoid(8)}`,
        source: node.id,
        target: promptId,
        type: 'smoothstep',
      })
    }
    scheduleSave()
    return
  }

  // Fit view
  if (e.key === '1' && !mod) {
    fitView({ padding: 0.2 })
    return
  }

  // Reset zoom
  if (e.key === '0' && !mod) {
    fitView({ padding: 0.2 })
    return
  }

  // Toggle minimap
  if (e.key === 'm' && !mod) {
    showMinimap.value = !showMinimap.value
    return
  }
}

// --- Double-click on canvas to add text node ---
function handleDblClick(e) {
  // Only if clicking on the canvas pane itself, not on a node
  if (e.target.closest('.vue-flow__node')) return
  const paneEl = e.target.closest('.vue-flow__pane')
  if (!paneEl) return

  const flowPos = screenToFlowCoordinate({ x: e.clientX, y: e.clientY })
  addTextNode(flowPos)
}

// --- Drag & drop files from sidebar ---
function onDrop(event) {
  const filePath = event.dataTransfer?.getData('text/plain') || event.dataTransfer?.getData('application/x-filepath')
  if (!filePath) return

  const flowPos = screenToFlowCoordinate({ x: event.clientX, y: event.clientY })
  const fileName = filePath.split('/').pop() || filePath

  addFileNode(flowPos, {
    filePath,
    preview: fileName,
  })
}

// Handle file tree custom drag (mouse-based, not HTML5 drag API)
function onFileTreeDragEnd(event) {
  const { paths, x, y } = event.detail || {}
  if (!paths?.length || !x || !y) return

  // Check if the drop landed over our canvas
  const canvasEl = document.querySelector('.canvas-editor .vue-flow')
  if (!canvasEl) return
  const rect = canvasEl.getBoundingClientRect()
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return

  const flowPos = screenToFlowCoordinate({ x, y })
  canvasStore.pushSnapshot(nodes.value, edges.value)
  for (let i = 0; i < paths.length; i++) {
    const filePath = paths[i]
    const fileName = filePath.split('/').pop() || filePath
    addFileNode(
      { x: flowPos.x + i * 30, y: flowPos.y + i * 30 },
      { filePath, preview: fileName }
    )
  }
}

// --- Node events from custom nodes ---
function handleNodeUpdate(nodeId, patch) {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return
  canvasStore.pushSnapshot(nodes.value, edges.value)
  Object.assign(node.data, patch)
  scheduleSave()
}

function handleNodeResize(nodeId, dimensions) {
  const node = nodes.value.find(n => n.id === nodeId)
  if (!node) return
  const newStyle = { ...node.style }
  if (dimensions.width) newStyle.width = `${dimensions.width}px`
  if (dimensions.height) newStyle.height = `${dimensions.height}px`
  node.style = newStyle
  node.dimensions = { width: dimensions.width, height: dimensions.height }
  scheduleSave()
}

// Style updates from floating bar
function onUpdateStyle(patch) {
  canvasStore.pushSnapshot(nodes.value, edges.value)
  for (const node of selectedNodes.value) {
    Object.assign(node.data, patch)
  }
  scheduleSave()
}

function onToggleType() {
  const node = selectedNodes.value[0]
  if (!node) return
  canvasStore.pushSnapshot(nodes.value, edges.value)
  node.type = node.type === 'prompt' ? 'text' : 'prompt'
  scheduleSave()
}

function onToggleTitle() {
  canvasStore.pushSnapshot(nodes.value, edges.value)
  for (const node of selectedNodes.value) {
    if (node.data.title !== null && node.data.title !== undefined) {
      node.data.title = null
    } else {
      // Auto-generate from first ~40 chars of content
      const content = node.data.content || ''
      node.data.title = content.slice(0, 40).split('\n')[0] || ''
    }
  }
  scheduleSave()
}

function onExpandHeight() {
  for (const node of selectedNodes.value) {
    // Set height to auto — lets content determine height
    node.style = { ...node.style, height: 'auto' }
    if (node.dimensions) delete node.dimensions.height
  }
  scheduleSave()
}

function onCollapseHeight() {
  for (const node of selectedNodes.value) {
    // Set to compact 3-line height (~70px)
    node.style = { ...node.style, height: '70px' }
    node.dimensions = { ...node.dimensions, height: 70 }
  }
  scheduleSave()
}

// Expose methods for canvas store to call
canvasStore.setEditorMethods({
  addTextNode,
  addPromptNode,
  addFileNode,
  addLabelNode,
  addGroupNode,
  getNodes: () => nodes.value,
  getEdges: () => edges.value,
  updateNodeData: handleNodeUpdate,
  scheduleSave,
})

// --- Lifecycle ---

onMounted(() => {
  loadCanvas()
  // Double-click handler on the pane
  nextTick(() => {
    const el = document.querySelector('.canvas-editor .vue-flow__pane')
    if (el) el.addEventListener('dblclick', handleDblClick)
  })
  // Listen for file tree drag-and-drop onto canvas
  window.addEventListener('filetree-drag-end', onFileTreeDragEnd)
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  // Final save on unmount
  if (!filesStore.deletingPaths?.has?.(props.filePath)) {
    saveCanvas()
  }
  canvasStore.unload()

  const el = document.querySelector('.canvas-editor .vue-flow__pane')
  if (el) el.removeEventListener('dblclick', handleDblClick)
  window.removeEventListener('filetree-drag-end', onFileTreeDragEnd)
})

// Provide node event handlers to child components via provide/inject
import { provide } from 'vue'
provide('canvasNodeUpdate', handleNodeUpdate)
provide('canvasNodeResize', handleNodeResize)
provide('canvasRegenerate', (nodeId) => {
  if (canvasStore.streamingNodeId) return
  canvasStore.regenerateNode(nodeId)
})
</script>

<style>
/* Import Vue Flow styles */
@import '@vue-flow/core/dist/style.css';
@import '@vue-flow/core/dist/theme-default.css';
@import '@vue-flow/minimap/dist/style.css';
@import '@vue-flow/node-resizer/dist/style.css';
@import '@vue-flow/controls/dist/style.css';
</style>

<style scoped>
.canvas-editor {
  position: relative;
  outline: none;
}

.canvas-editor :deep(.vue-flow) {
  height: 100%;
}

/* Canvas background */
.canvas-editor :deep(.vue-flow__background) {
  background: var(--bg-primary);
}

.canvas-editor :deep(.vue-flow__background pattern circle) {
  fill: var(--fg-muted);
  opacity: 0.4;
}

/* Edge styling */
.canvas-editor :deep(.vue-flow__edge-path) {
  stroke: var(--fg-muted) !important;
  stroke-width: 1.5 !important;
  stroke-opacity: 0.4 !important;
}

.canvas-editor :deep(.vue-flow__edge.selected .vue-flow__edge-path) {
  stroke: var(--accent) !important;
  stroke-width: 2.5 !important;
  stroke-opacity: 1 !important;
}

/* Connection line */
.canvas-editor :deep(.vue-flow__connection-path) {
  stroke: var(--accent);
  stroke-width: 1.5;
}

/* Minimap */
.canvas-editor :deep(.vue-flow__minimap) {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 6px;
}

/* Node selection — remove default outline, nodes handle their own selected state */
.canvas-editor :deep(.vue-flow__node.selected),
.canvas-editor :deep(.vue-flow__node:focus),
.canvas-editor :deep(.vue-flow__node:focus-visible) {
  outline: none !important;
  box-shadow: none !important;
}

/* Selection box */
.canvas-editor :deep(.vue-flow__selection) {
  background: rgba(95, 158, 160, 0.08);
  border: 1px solid var(--accent);
  border-radius: 2px;
}

/* Empty state */
.empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--fg-muted);
  font-size: 14px;
  pointer-events: none;
  user-select: none;
  opacity: 0.5;
}
</style>
