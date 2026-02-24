import { defineStore } from 'pinia'
import { nanoid } from './utils'
import { useFilesStore } from './files'
import { useWorkspaceStore } from './workspace'

// Pane tree: either a leaf (has tabs) or a split (has children)
// { type: 'leaf', id, tabs: [path, ...], activeTab: path }
// { type: 'split', direction: 'horizontal'|'vertical', ratio: 0.5, children: [pane, pane] }

export const useEditorStore = defineStore('editor', {
  state: () => ({
    paneTree: {
      type: 'leaf',
      id: 'pane-root',
      tabs: [],
      activeTab: null,
    },
    activePaneId: 'pane-root',
    // Track which editors have unsaved changes
    dirtyFiles: new Set(),
    // Editor view instances (not persisted)
    editorViews: {},
    // SuperDoc instances: key = `${paneId}:${path}` -> { superdoc, taskBridge }
    superdocInstances: {},
    // Cursor offset in the active editor (for outline highlight)
    cursorOffset: 0,
    // Bumped on every DOCX editor update (triggers outline re-eval even for attribute-only changes)
    docxUpdateCount: 0,
    // PDF viewer states preserved across remounts: key = filePath -> { zoom, currentPage }
    pdfViewerStates: {},
    // Recent files per workspace (persisted to localStorage)
    recentFiles: [],  // { path, openedAt }
  }),

  getters: {
    activePane(state) {
      return this.findPane(state.paneTree, state.activePaneId)
    },

    activeTab(state) {
      const pane = this.findPane(state.paneTree, state.activePaneId)
      return pane?.activeTab || null
    },

    allOpenFiles(state) {
      const files = new Set()
      const walk = (node) => {
        if (node.type === 'leaf') {
          node.tabs.forEach((t) => files.add(t))
        } else if (node.children) {
          node.children.forEach(walk)
        }
      }
      walk(state.paneTree)
      return files
    },

    recentFilesForEmptyState(state) {
      const filesStore = useFilesStore()
      const flatPaths = new Set(filesStore.flatFiles.map(f => f.path))
      return state.recentFiles
        .filter(entry => flatPaths.has(entry.path))
        .slice(0, 5)
    },
  },

  actions: {
    setPdfViewerState(filePath, state) {
      this.pdfViewerStates[filePath] = { ...this.pdfViewerStates[filePath], ...state }
    },
    getPdfViewerState(filePath) {
      return this.pdfViewerStates[filePath] || null
    },
    findPane(node, id) {
      if (!node) return null
      if (node.type === 'leaf' && node.id === id) return node
      if (node.type === 'split' && node.children) {
        for (const child of node.children) {
          const found = this.findPane(child, id)
          if (found) return found
        }
      }
      return null
    },

    findParent(node, id, parent = null) {
      if (!node) return null
      if (node.type === 'leaf' && node.id === id) return parent
      if (node.type === 'split' && node.children) {
        for (const child of node.children) {
          const found = this.findParent(child, id, node)
          if (found !== null) return found
        }
      }
      return null
    },

    openFile(path) {
      const pane = this.findPane(this.paneTree, this.activePaneId)
      if (!pane) return

      // If already open in this pane, switch to it
      if (pane.tabs.includes(path)) {
        pane.activeTab = path
        this.recordFileOpen(path)
        return
      }

      // Add new tab
      pane.tabs.push(path)
      pane.activeTab = path
      this.recordFileOpen(path)
    },

    closeTab(paneId, path) {
      const pane = this.findPane(this.paneTree, paneId)
      if (!pane) return

      const idx = pane.tabs.indexOf(path)
      if (idx === -1) return

      pane.tabs.splice(idx, 1)

      // Update active tab
      if (pane.activeTab === path) {
        if (pane.tabs.length > 0) {
          pane.activeTab = pane.tabs[Math.min(idx, pane.tabs.length - 1)]
        } else {
          pane.activeTab = null
        }
      }

      // If pane is empty and it's not the root, collapse it
      if (pane.tabs.length === 0 && pane.id !== 'pane-root') {
        this.collapsePane(paneId)
      }
    },

    collapsePane(paneId) {
      const parent = this.findParent(this.paneTree, paneId)
      if (!parent || parent.type !== 'split') return

      // Find sibling
      const idx = parent.children.findIndex(
        (c) => c.type === 'leaf' && c.id === paneId
      )
      if (idx === -1) return

      const sibling = parent.children[1 - idx]

      // Replace parent with sibling
      Object.keys(parent).forEach((k) => delete parent[k])
      Object.assign(parent, sibling)

      // Update active pane if needed
      if (this.activePaneId === paneId) {
        if (sibling.type === 'leaf') {
          this.activePaneId = sibling.id
        } else {
          // Find first leaf in sibling
          const firstLeaf = this.findFirstLeaf(sibling)
          if (firstLeaf) this.activePaneId = firstLeaf.id
        }
      }
    },

    findFirstLeaf(node) {
      if (node.type === 'leaf') return node
      if (node.children) {
        for (const child of node.children) {
          const leaf = this.findFirstLeaf(child)
          if (leaf) return leaf
        }
      }
      return null
    },

    splitPane(direction) {
      const pane = this.findPane(this.paneTree, this.activePaneId)
      if (!pane) return

      const newPaneId = `pane-${nanoid()}`

      // Clone current pane data
      const currentData = {
        type: 'leaf',
        id: pane.id,
        tabs: [...pane.tabs],
        activeTab: pane.activeTab,
      }

      const newPane = {
        type: 'leaf',
        id: newPaneId,
        tabs: pane.activeTab ? [pane.activeTab] : [],
        activeTab: pane.activeTab,
      }

      // Transform current pane into a split
      Object.keys(pane).forEach((k) => delete pane[k])
      Object.assign(pane, {
        type: 'split',
        direction,
        ratio: 0.5,
        children: [currentData, newPane],
      })

      // Focus the new pane
      this.activePaneId = newPaneId
    },

    /**
     * Split a pane and immediately set the new pane's tab.
     * Avoids the race condition where splitPane + nextTick causes a
     * transient mount of the wrong component in the new pane.
     */
    splitPaneWith(paneId, direction, tab) {
      const pane = this.findPane(this.paneTree, paneId)
      if (!pane) return null

      const newPaneId = `pane-${nanoid()}`

      const currentData = {
        type: 'leaf',
        id: pane.id,
        tabs: [...pane.tabs],
        activeTab: pane.activeTab,
      }

      const newPane = {
        type: 'leaf',
        id: newPaneId,
        tabs: [tab],
        activeTab: tab,
      }

      Object.keys(pane).forEach((k) => delete pane[k])
      Object.assign(pane, {
        type: 'split',
        direction,
        ratio: 0.5,
        children: [currentData, newPane],
      })

      // Keep focus on the original pane
      this.activePaneId = paneId
      return newPaneId
    },

    setActivePane(paneId) {
      this.activePaneId = paneId
    },

    setSplitRatio(splitNode, ratio) {
      splitNode.ratio = Math.max(0.15, Math.min(0.85, ratio))
    },

    updateFilePath(oldPath, newPath) {
      const walk = (node) => {
        if (node.type === 'leaf') {
          const idx = node.tabs.indexOf(oldPath)
          if (idx !== -1) {
            node.tabs[idx] = newPath
            if (node.activeTab === oldPath) node.activeTab = newPath
          }
        } else if (node.children) {
          node.children.forEach(walk)
        }
      }
      walk(this.paneTree)

      // Update in recent files
      const entry = this.recentFiles.find(e => e.path === oldPath)
      if (entry) {
        entry.path = newPath
        this._persistRecentFiles()
      }
    },

    closeFileFromAllPanes(path) {
      const leaves = []
      const walk = (node) => {
        if (node.type === 'leaf' && node.tabs.includes(path)) {
          leaves.push(node)
        } else if (node.children) {
          node.children.forEach(walk)
        }
      }
      walk(this.paneTree)
      for (const pane of leaves) {
        this.closeTab(pane.id, path)
      }
    },

    switchTab(delta) {
      const pane = this.activePane
      if (!pane || pane.tabs.length < 2) return
      const idx = pane.tabs.indexOf(pane.activeTab)
      const next = (idx + delta + pane.tabs.length) % pane.tabs.length
      pane.activeTab = pane.tabs[next]
    },

    reorderTabs(paneId, fromIdx, toIdx) {
      const pane = this.findPane(this.paneTree, paneId)
      if (!pane || fromIdx === toIdx) return
      const [moved] = pane.tabs.splice(fromIdx, 1)
      pane.tabs.splice(toIdx, 0, moved)
    },

    registerEditorView(paneId, path, view) {
      const key = `${paneId}:${path}`
      this.editorViews[key] = view
    },

    unregisterEditorView(paneId, path) {
      const key = `${paneId}:${path}`
      delete this.editorViews[key]
    },

    getEditorView(paneId, path) {
      return this.editorViews[`${paneId}:${path}`]
    },

    registerSuperdoc(paneId, path, superdoc, taskBridge, aiActions) {
      this.superdocInstances[`${paneId}:${path}`] = { superdoc, taskBridge, aiActions }
    },

    unregisterSuperdoc(paneId, path) {
      delete this.superdocInstances[`${paneId}:${path}`]
    },

    getSuperdoc(paneId, path) {
      return this.superdocInstances[`${paneId}:${path}`]?.superdoc
    },

    getAnySuperdoc(path) {
      for (const key in this.superdocInstances) {
        if (key.endsWith(`:${path}`)) return this.superdocInstances[key].superdoc
      }
      return null
    },

    getDocxTaskBridge(path) {
      for (const key in this.superdocInstances) {
        if (key.endsWith(`:${path}`)) return this.superdocInstances[key].taskBridge
      }
      return null
    },

    getAnyAiActions(path) {
      for (const key in this.superdocInstances) {
        if (key.endsWith(`:${path}`)) return this.superdocInstances[key].aiActions
      }
      return null
    },

    bumpDocxUpdate() {
      this.docxUpdateCount++
    },

    recordFileOpen(path) {
      if (path.startsWith('ref:@') || path.startsWith('preview:')) return
      this.recentFiles = this.recentFiles.filter(e => e.path !== path)
      this.recentFiles.unshift({ path, openedAt: Date.now() })
      if (this.recentFiles.length > 20) this.recentFiles.length = 20
      this._persistRecentFiles()
    },

    loadRecentFiles(workspacePath) {
      try {
        const stored = localStorage.getItem(`recentFiles:${workspacePath}`)
        this.recentFiles = stored ? JSON.parse(stored) : []
      } catch {
        this.recentFiles = []
      }
    },

    _persistRecentFiles() {
      const workspace = useWorkspaceStore()
      if (!workspace.path) return
      localStorage.setItem(`recentFiles:${workspace.path}`, JSON.stringify(this.recentFiles))
    },

    cleanup() {
      // Destroy all CodeMirror EditorView instances
      for (const key of Object.keys(this.editorViews)) {
        try { this.editorViews[key]?.destroy() } catch (e) { /* component may already be unmounted */ }
      }
      this.editorViews = {}

      // Destroy all SuperDoc instances
      for (const key of Object.keys(this.superdocInstances)) {
        try { this.superdocInstances[key]?.superdoc?.destroy() } catch (e) { /* may already be gone */ }
      }
      this.superdocInstances = {}

      // Reset pane tree to initial empty state
      this.paneTree = { type: 'leaf', id: 'pane-root', tabs: [], activeTab: null }
      this.activePaneId = 'pane-root'
      this.dirtyFiles = new Set()
      this.pdfViewerStates = {}
      this.recentFiles = []
      this.cursorOffset = 0
      this.docxUpdateCount = 0
    },
  },
})
