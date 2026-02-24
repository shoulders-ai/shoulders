import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useWorkspaceStore } from './workspace'
import { isBinaryFile } from '../utils/fileTypes'

// Minimal valid DOCX — includes styles, numbering, settings, custom props
// (SuperDoc's export pipeline requires all of these or it silently fails)
const EMPTY_DOCX_BASE64 = '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'

export const useFilesStore = defineStore('files', {
  state: () => ({
    tree: [],
    expandedDirs: new Set(),
    activeFilePath: null,
    fileContents: {}, // cache: path → content
    deletingPaths: new Set(), // paths currently being deleted (prevents save-on-unmount race)
    unlisten: null,
  }),

  getters: {
    // Flat list of all files for search
    flatFiles: (state) => {
      const files = []
      const walk = (entries) => {
        for (const entry of entries) {
          if (!entry.is_dir) {
            files.push(entry)
          }
          if (entry.children) {
            walk(entry.children)
          }
        }
      }
      walk(state.tree)
      return files
    },
  },

  actions: {
    async loadFileTree() {
      const workspace = useWorkspaceStore()
      if (!workspace.path) return

      try {
        this.tree = await invoke('read_dir_recursive', { path: workspace.path })
      } catch (e) {
        console.error('Failed to load file tree:', e)
        this.tree = []
      }
    },

    async startWatching() {
      // Listen for filesystem changes
      if (this.unlisten) {
        this.unlisten()
      }
      if (this._pollTimer) {
        clearInterval(this._pollTimer)
        this._pollTimer = null
      }

      let debounceTimer = null
      let accumulatedPaths = new Set()
      this.unlisten = await listen('fs-change', async (event) => {
        
        if (import.meta.env.DEV) {
          console.debug('[fs-watch]', event.payload?.kind, event.payload?.paths)
        }
        // Accumulate paths across debounced events so none are lost
        const paths = event.payload?.paths || []
        for (const p of paths) accumulatedPaths.add(p)

        // Debounce rapid fs events (e.g. auto-save triggering its own watch)
        clearTimeout(debounceTimer)
        debounceTimer = setTimeout(async () => {
          const changedPaths = [...accumulatedPaths]
          accumulatedPaths = new Set()

          await this.loadFileTree()

          // Reload any open files that changed externally
          const { useEditorStore } = await import('./editor')
          const editorStore = useEditorStore()
          const openFiles = editorStore.allOpenFiles

          for (const changedPath of changedPaths) {
            if (openFiles.has(changedPath)) {
              await this.reloadFile(changedPath)
            }
            // Update wiki link index for changed .md files
            if (changedPath.endsWith('.md')) {
              const { useLinksStore } = await import('./links')
              const linksStore = useLinksStore()
              linksStore.updateFile(changedPath)
            }
          }
        }, 300)
      })

      // Periodic poll as fallback — catches events the notify watcher may miss
      // Only updates this.tree when the tree actually changed (avoids unnecessary Vue re-renders)
      let lastTreeJson = JSON.stringify(this.tree)
      this._pollTimer = setInterval(async () => {
        const workspace = useWorkspaceStore()
        if (!workspace.path) return
        try {
          const newTree = await invoke('read_dir_recursive', { path: workspace.path })
          const newJson = JSON.stringify(newTree)
          if (newJson !== lastTreeJson) {
            this.tree = newTree
            lastTreeJson = newJson
          }
        } catch (e) { /* workspace may have closed */ }
      }, 5000)
    },

    toggleDir(path) {
      if (this.expandedDirs.has(path)) {
        this.expandedDirs.delete(path)
      } else {
        this.expandedDirs.add(path)
      }
    },

    isDirExpanded(path) {
      return this.expandedDirs.has(path)
    },

    async readFile(path) {
      // PDF: extract text and cache it (for chat dedup and @file refs)
      if (path.toLowerCase().endsWith('.pdf')) {
        try {
          const { extractTextFromPdf } = await import('../utils/pdfMetadata')
          const text = await extractTextFromPdf(path)
          this.fileContents[path] = text
          return text
        } catch (e) {
          console.error('Failed to extract PDF text:', e)
          return null
        }
      }
      // Other binary files (DOCX, images) are handled by their own viewers
      if (isBinaryFile(path)) return null
      try {
        const content = await invoke('read_file', { path })
        this.fileContents[path] = content
        return content
      } catch (e) {
        console.error('Failed to read file:', e)
        return null
      }
    },

    async reloadFile(path) {
      const content = await this.readFile(path)
      // The editor will detect this change via the store
      return content
    },

    async saveFile(path, content) {
      try {
        await invoke('write_file', { path, content })
        this.fileContents[path] = content

        // Update wiki link index (markdown only)
        if (path.endsWith('.md')) {
          const { useLinksStore } = await import('./links')
          const linksStore = useLinksStore()
          linksStore.updateFile(path)
        }
      } catch (e) {
        console.error('Failed to save file:', e)
        const { useToastStore } = await import('./toast')
        const { formatFileError } = await import('../utils/errorMessages')
        useToastStore().showOnce(`save:${path}`, formatFileError('save', path, e), { type: 'error', duration: 5000 })
      }
    },

    async createFile(dirPath, name) {
      const fullPath = `${dirPath}/${name}`

      // DOCX: binary template (SuperDoc needs a valid ZIP/OOXML structure)
      if (name.endsWith('.docx')) {
        try {
          // Check for collision (write_file_base64 would silently overwrite)
          const exists = await invoke('path_exists', { path: fullPath })
          if (exists) {
            const { useToastStore } = await import('./toast')
            useToastStore().showOnce(`create:${fullPath}`, `"${name}" already exists`, { type: 'error', duration: 4000 })
            return null
          }
          await invoke('write_file_base64', { path: fullPath, data: EMPTY_DOCX_BASE64 })
          await this.loadFileTree()
          return fullPath
        } catch (e) {
          console.error('Failed to create DOCX:', e)
          const { useToastStore } = await import('./toast')
          useToastStore().showOnce(`create:${fullPath}`, `Failed to create "${name}"`, { type: 'error', duration: 4000 })
          return null
        }
      }

      let content = ''
      if (name.endsWith('.ipynb')) {
        content = JSON.stringify({
          cells: [{ id: 'cell-1', cell_type: 'code', source: [], metadata: {}, outputs: [], execution_count: null }],
          metadata: { kernelspec: { display_name: 'Python 3', language: 'python', name: 'python3' }, language_info: { name: 'python' } },
          nbformat: 4, nbformat_minor: 5,
        }, null, 1) + '\n'
      } else if (name.endsWith('.tex')) {
        const title = name.replace(/\.tex$/, '').replace(/-/g, ' ')
        content = `\\documentclass{article}\n\\title{${title}}\n\\author{}\n\\date{}\n\n\\begin{document}\n\\maketitle\n\n\n\n\\end{document}\n`
      }
      try {
        await invoke('create_file', { path: fullPath, content })
        await this.loadFileTree()
        return fullPath
      } catch (e) {
        console.error('Failed to create file:', e)
        const { useToastStore } = await import('./toast')
        useToastStore().showOnce(`create:${fullPath}`, `"${name}" already exists`, { type: 'error', duration: 4000 })
        return null
      }
    },

    async duplicatePath(path) {
      const name = path.split('/').pop()
      const dir = path.substring(0, path.lastIndexOf('/'))
      const isDir = await invoke('is_directory', { path })

      // Generate unique name: "name copy.ext", "name copy 2.ext", etc.
      let newName
      if (isDir) {
        newName = `${name} copy`
        let i = 2
        while (await invoke('path_exists', { path: `${dir}/${newName}` })) {
          newName = `${name} copy ${i}`
          i++
        }
      } else {
        const dotIdx = name.lastIndexOf('.')
        const base = dotIdx > 0 ? name.substring(0, dotIdx) : name
        const suffix = dotIdx > 0 ? name.substring(dotIdx) : ''
        newName = `${base} copy${suffix}`
        let i = 2
        while (await invoke('path_exists', { path: `${dir}/${newName}` })) {
          newName = `${base} copy ${i}${suffix}`
          i++
        }
      }

      const newPath = `${dir}/${newName}`
      try {
        if (isDir) {
          await invoke('copy_dir', { src: path, dest: newPath })
        } else {
          await invoke('copy_file', { src: path, dest: newPath })
        }
        await this.loadFileTree()
        return newPath
      } catch (e) {
        console.error('Failed to duplicate:', e)
        return null
      }
    },

    async createFolder(dirPath, name) {
      const fullPath = `${dirPath}/${name}`
      try {
        await invoke('create_dir', { path: fullPath })
        await this.loadFileTree()
        this.expandedDirs.add(fullPath)
        return fullPath
      } catch (e) {
        console.error('Failed to create folder:', e)
        return null
      }
    },

    async renamePath(oldPath, newPath) {
      // Prevent overwriting an existing file
      if (oldPath !== newPath) {
        const exists = await invoke('path_exists', { path: newPath })
        if (exists) {
          const { useToastStore } = await import('./toast')
          const name = newPath.split('/').pop()
          useToastStore().showOnce(`rename:${newPath}`, `"${name}" already exists`, { type: 'error', duration: 4000 })
          return false
        }
      }
      try {
        await invoke('rename_path', { oldPath, newPath })
        await this.loadFileTree()

        // Update active file if it was renamed
        if (this.activeFilePath === oldPath) {
          this.activeFilePath = newPath
        }

        // Migrate cached file content
        if (oldPath in this.fileContents) {
          this.fileContents[newPath] = this.fileContents[oldPath]
          delete this.fileContents[oldPath]
        }

        // Update editor tabs so the open tab follows the rename
        const { useEditorStore } = await import('./editor')
        const editorStore = useEditorStore()
        editorStore.updateFilePath(oldPath, newPath)

        // Update expanded dirs
        if (this.expandedDirs.has(oldPath)) {
          this.expandedDirs.delete(oldPath)
          this.expandedDirs.add(newPath)
        }

        // Update wiki links across workspace
        const { useLinksStore } = await import('./links')
        const linksStore = useLinksStore()
        await linksStore.handleRename(oldPath, newPath)

        return true
      } catch (e) {
        console.error('Failed to rename:', e)
        return false
      }
    },

    async movePath(srcPath, destDir) {
      const name = srcPath.split('/').pop()
      let destPath = `${destDir}/${name}`
      if (srcPath === destPath) return true

      // Avoid overwriting: auto-rename if destination exists
      const exists = await invoke('path_exists', { path: destPath })
      if (exists) {
        const isDir = await invoke('is_directory', { path: srcPath })
        if (isDir) {
          let i = 2
          while (await invoke('path_exists', { path: `${destDir}/${name} ${i}` })) i++
          destPath = `${destDir}/${name} ${i}`
        } else {
          const dotIdx = name.lastIndexOf('.')
          const base = dotIdx > 0 ? name.substring(0, dotIdx) : name
          const suffix = dotIdx > 0 ? name.substring(dotIdx) : ''
          let i = 2
          while (await invoke('path_exists', { path: `${destDir}/${base} ${i}${suffix}` })) i++
          destPath = `${destDir}/${base} ${i}${suffix}`
        }
      }

      try {
        await invoke('rename_path', { oldPath: srcPath, newPath: destPath })
        await this.loadFileTree()

        // Update wiki links
        const { useLinksStore } = await import('./links')
        const linksStore = useLinksStore()
        await linksStore.handleRename(srcPath, destPath)

        // Update editor tabs
        const { useEditorStore } = await import('./editor')
        const editorStore = useEditorStore()
        editorStore.updateFilePath(srcPath, destPath)

        return true
      } catch (e) {
        console.error('Failed to move:', e)
        return false
      }
    },

    async copyExternalFile(srcPath, destDir) {
      const isDir = await invoke('is_directory', { path: srcPath })
      const name = srcPath.split('/').pop()
      let destPath = `${destDir}/${name}`
      // Avoid overwriting
      const exists = await invoke('path_exists', { path: destPath })
      if (exists) {
        if (isDir) {
          let i = 2
          while (await invoke('path_exists', { path: `${destDir}/${name} ${i}` })) i++
          destPath = `${destDir}/${name} ${i}`
        } else {
          const ext = name.lastIndexOf('.')
          const base = ext > 0 ? name.substring(0, ext) : name
          const suffix = ext > 0 ? name.substring(ext) : ''
          let i = 2
          while (await invoke('path_exists', { path: `${destDir}/${base} ${i}${suffix}` })) i++
          destPath = `${destDir}/${base} ${i}${suffix}`
        }
      }
      try {
        if (isDir) {
          await invoke('copy_dir', { src: srcPath, dest: destPath })
        } else {
          await invoke('copy_file', { src: srcPath, dest: destPath })
        }
        await this.loadFileTree()
        return { path: destPath, isDir }
      } catch (e) {
        console.error('Failed to copy external file:', e)
        return null
      }
    },

    async deletePath(path) {
      try {
        this.deletingPaths.add(path)
        await invoke('delete_path', { path })
        await this.loadFileTree()

        // Close all tabs for the deleted file
        const { useEditorStore } = await import('./editor')
        const editorStore = useEditorStore()
        editorStore.closeFileFromAllPanes(path)

        // Remove from file contents cache
        delete this.fileContents[path]

        // Update wiki link index
        const { useLinksStore } = await import('./links')
        const linksStore = useLinksStore()
        linksStore.handleDelete(path)

        return true
      } catch (e) {
        console.error('Failed to delete:', e)
        return false
      } finally {
        this.deletingPaths.delete(path)
      }
    },

    cleanup() {
      if (this.unlisten) {
        this.unlisten()
        this.unlisten = null
      }
      if (this._pollTimer) {
        clearInterval(this._pollTimer)
        this._pollTimer = null
      }
      this.tree = []
      this.expandedDirs = new Set()
      this.activeFilePath = null
      this.fileContents = {}
    },
  },
})
