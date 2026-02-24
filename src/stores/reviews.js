import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useWorkspaceStore } from './workspace'
import { useFilesStore } from './files'

const NOTEBOOK_TOOLS = ['NotebookEditCell', 'NotebookAddCell', 'NotebookDeleteCell']

export const useReviewsStore = defineStore('reviews', {
  state: () => ({
    pendingEdits: [],
    directMode: false,
    unlisten: null,
    _selfWriteCount: 0,
  }),

  getters: {
    editsForFile: (state) => (filePath) => {
      return state.pendingEdits.filter(
        (e) => e.file_path === filePath && e.status === 'pending'
      )
    },

    pendingCount: (state) => {
      return state.pendingEdits.filter((e) => e.status === 'pending').length
    },

    filesWithEdits: (state) => {
      return [
        ...new Set(
          state.pendingEdits
            .filter((e) => e.status === 'pending')
            .map((e) => e.file_path)
        ),
      ]
    },

    notebookEditsForFile: (state) => (filePath) => {
      return state.pendingEdits.filter(
        (e) => e.file_path === filePath && e.status === 'pending' && NOTEBOOK_TOOLS.includes(e.tool)
      )
    },

    notebookEditForCell: (state) => (filePath, cellId) => {
      return state.pendingEdits.find(
        (e) => e.file_path === filePath && e.cell_id === cellId && e.status === 'pending' && NOTEBOOK_TOOLS.includes(e.tool)
      ) || null
    },
  },

  actions: {
    async startWatching() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      // Initialize direct mode from filesystem
      try {
        this.directMode = await invoke('path_exists', {
          path: `${workspace.shouldersDir}/.direct-mode`,
        })
      } catch (e) {
        this.directMode = false
      }

      // Initial load
      await this.loadPendingEdits()

      // Watch for changes to pending-edits.json
      if (this.unlisten) this.unlisten()
      this.unlisten = await listen('fs-change', async (event) => {
        const paths = event.payload?.paths || []
        if (paths.some((p) => p.includes('pending-edits.json'))) {
          // Skip reload for self-triggered writes (accept/reject actions)
          if (this._selfWriteCount > 0) {
            this._selfWriteCount--
            return
          }
          await this.loadPendingEdits()
        }
      })
    },

    async loadPendingEdits() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      try {
        const content = await invoke('read_file', {
          path: `${workspace.shouldersDir}/pending-edits.json`,
        })
        this.pendingEdits = JSON.parse(content)
      } catch (e) {
        this.pendingEdits = []
      }
    },

    async savePendingEdits() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      this._selfWriteCount++
      await invoke('write_file', {
        path: `${workspace.shouldersDir}/pending-edits.json`,
        content: JSON.stringify(this.pendingEdits, null, 2),
      })
    },

    async acceptEdit(editId) {
      // Edit already applied by Claude Code - just dismiss from review
      const edit = this.pendingEdits.find((e) => e.id === editId)
      if (!edit) return

      edit.status = 'accepted'
      await this.savePendingEdits()
    },

    async rejectEdit(editId) {
      // Revert the change that Claude Code already applied
      const edit = this.pendingEdits.find((e) => e.id === editId)
      if (!edit) return

      try {
        if (edit.tool === 'Edit') {
          // Replace new_string back with old_string
          const content = await invoke('read_file', { path: edit.file_path })
          const reverted = content.replace(edit.new_string, edit.old_string)
          if (reverted !== content) {
            await invoke('write_file', { path: edit.file_path, content: reverted })
          }
        } else if (edit.tool === 'Write' && edit.old_content) {
          // Restore the old file content
          await invoke('write_file', { path: edit.file_path, content: edit.old_content })
        }
        // Only mark rejected after successful revert — edit stays pending on failure
        edit.status = 'rejected'
        await this.savePendingEdits()
      } catch (e) {
        console.warn('Failed to revert edit:', e)
        const { useToastStore } = await import('./toast')
        const { formatFileError } = await import('../utils/errorMessages')
        useToastStore().show(formatFileError('restore', edit.file_path, e), { type: 'error', duration: 5000 })
      }
    },

    async acceptNotebookEdit(editId) {
      const edit = this.pendingEdits.find((e) => e.id === editId)
      if (!edit || !NOTEBOOK_TOOLS.includes(edit.tool)) return

      const filesStore = useFilesStore()
      try {
        const raw = await invoke('read_file', { path: edit.file_path })
        const { parseNotebook, serializeNotebook } = await import('../utils/notebookFormat')
        const nb = parseNotebook(raw)

        if (edit.tool === 'NotebookEditCell') {
          const idx = nb.cells.findIndex((c) => c.id === edit.cell_id)
          if (idx === -1) throw new Error('Cell not found')
          nb.cells[idx].source = edit.new_source
        } else if (edit.tool === 'NotebookAddCell') {
          const newCell = {
            id: edit.cell_id,
            type: edit.cell_type || 'code',
            source: edit.cell_source || '',
            outputs: [],
            executionCount: null,
            metadata: {},
          }
          const idx = Math.min(Math.max(0, edit.cell_index), nb.cells.length)
          nb.cells.splice(idx, 0, newCell)
        } else if (edit.tool === 'NotebookDeleteCell') {
          const idx = nb.cells.findIndex((c) => c.id === edit.cell_id)
          if (idx !== -1) nb.cells.splice(idx, 1)
        }

        const newContent = serializeNotebook(nb.cells, nb.metadata, nb.nbformat, nb.nbformat_minor)
        await invoke('write_file', { path: edit.file_path, content: newContent })
        filesStore.fileContents[edit.file_path] = newContent
      } catch (e) {
        console.warn('Failed to apply notebook edit:', e)
      }

      edit.status = 'accepted'
      await this.savePendingEdits()
      window.dispatchEvent(new CustomEvent('notebook-review-resolved', {
        detail: { editId, file_path: edit.file_path },
      }))
    },

    async rejectNotebookEdit(editId) {
      const edit = this.pendingEdits.find((e) => e.id === editId)
      if (!edit || !NOTEBOOK_TOOLS.includes(edit.tool)) return

      edit.status = 'rejected'
      await this.savePendingEdits()
      window.dispatchEvent(new CustomEvent('notebook-review-resolved', {
        detail: { editId, file_path: edit.file_path },
      }))
    },

    async acceptAll() {
      const pending = this.pendingEdits.filter((e) => e.status === 'pending')
      // Notebook edits need individual calls (file-write side effects)
      const notebook = pending.filter((e) => NOTEBOOK_TOOLS.includes(e.tool))
      for (const edit of notebook) {
        await this.acceptNotebookEdit(edit.id)
      }
      // Batch-mark the rest in-memory, then save once
      const regular = pending.filter((e) => !NOTEBOOK_TOOLS.includes(e.tool))
      for (const edit of regular) {
        edit.status = 'accepted'
      }
      if (regular.length > 0) {
        await this.savePendingEdits()
      }
    },

    async rejectAll() {
      const pending = this.pendingEdits.filter((e) => e.status === 'pending')
      for (const edit of pending) {
        if (NOTEBOOK_TOOLS.includes(edit.tool)) {
          await this.rejectNotebookEdit(edit.id)
        } else {
          await this.rejectEdit(edit.id)
        }
      }
    },

    async acceptAllForFile(filePath) {
      const pending = this.pendingEdits.filter(
        (e) => e.file_path === filePath && e.status === 'pending'
      )
      // Notebook edits need individual calls (file-write side effects)
      const notebook = pending.filter((e) => NOTEBOOK_TOOLS.includes(e.tool))
      for (const edit of notebook) {
        await this.acceptNotebookEdit(edit.id)
      }
      // Batch-mark the rest in-memory, then save once
      const regular = pending.filter((e) => !NOTEBOOK_TOOLS.includes(e.tool))
      for (const edit of regular) {
        edit.status = 'accepted'
      }
      if (regular.length > 0) {
        await this.savePendingEdits()
      }
    },

    async rejectAllForFile(filePath) {
      const pending = this.pendingEdits.filter(
        (e) => e.file_path === filePath && e.status === 'pending'
      )
      for (const edit of pending) {
        if (NOTEBOOK_TOOLS.includes(edit.tool)) {
          await this.rejectNotebookEdit(edit.id)
        } else {
          await this.rejectEdit(edit.id)
        }
      }
    },

    async toggleDirectMode() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      this.directMode = !this.directMode
      const flagPath = `${workspace.shouldersDir}/.direct-mode`

      if (this.directMode) {
        await invoke('write_file', { path: flagPath, content: '1' })
      } else {
        try {
          await invoke('delete_path', { path: flagPath })
        } catch (e) {
          // File might not exist
        }
      }
    },

    cleanup() {
      if (this.unlisten) {
        this.unlisten()
        this.unlisten = null
      }
      this.pendingEdits = []
      this.directMode = false
      this._selfWriteCount = 0
    },
  },
})
