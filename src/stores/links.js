import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from './workspace'
import { useFilesStore } from './files'

// --- Pure helpers ---

export function normalizeName(name) {
  return name.toLowerCase().replace(/[-_\s]+/g, ' ').trim()
}

export function parseWikiLinks(content) {
  const links = []
  const re = /\[\[([^\]]+)\]\]/g
  let m
  while ((m = re.exec(content)) !== null) {
    const raw = m[1]
    const from = m.index
    const to = from + m[0].length
    let target = raw
    let display = null
    let heading = null

    // [[target|display]]
    const pipeIdx = raw.indexOf('|')
    if (pipeIdx !== -1) {
      target = raw.substring(0, pipeIdx)
      display = raw.substring(pipeIdx + 1)
    }

    // [[target#heading]]
    const hashIdx = target.indexOf('#')
    if (hashIdx !== -1) {
      heading = target.substring(hashIdx + 1)
      target = target.substring(0, hashIdx)
    }

    links.push({ target: target.trim(), display, heading, from, to, raw })
  }
  return links
}

export function parseHeadings(content) {
  const headings = []
  const re = /^(#{1,6})\s+(.+)$/gm
  let m
  while ((m = re.exec(content)) !== null) {
    headings.push({ text: m[2].trim(), level: m[1].length, offset: m.index })
  }
  return headings
}

function fileNameFromPath(path) {
  const name = path.split('/').pop()
  return name.replace(/\.md$/, '')
}

function dirFromPath(path) {
  const parts = path.split('/')
  parts.pop()
  return parts.join('/')
}

// Check if a character offset is inside a code block
function isInsideCodeBlock(content, offset) {
  // Check fenced code blocks
  const fenced = /^```[^\n]*\n[\s\S]*?^```/gm
  let m
  while ((m = fenced.exec(content)) !== null) {
    if (offset >= m.index && offset < m.index + m[0].length) return true
  }
  // Check inline code
  const inline = /`[^`]+`/g
  while ((m = inline.exec(content)) !== null) {
    if (offset >= m.index && offset < m.index + m[0].length) return true
  }
  return false
}

export const useLinksStore = defineStore('links', {
  state: () => ({
    // filePath → [{target, display, heading, from, to, resolvedPath}]
    forwardLinks: {},
    // filePath → [{sourcePath, sourceName, linkText, lineNumber, context}]
    backlinks: {},
    // normalizedName → [filePath, ...]
    nameMap: {},
    // filePath → [heading1, heading2, ...]
    headings: {},
    initialized: false,
  }),

  getters: {
    backlinksForFile: (state) => (filePath) => {
      return state.backlinks[filePath] || []
    },

    headingsForFile: (state) => (filePath) => {
      const h = state.headings[filePath] || []
      return h.map(item => typeof item === 'string' ? item : item.text)
    },

    structuredHeadingsForFile: (state) => (filePath) => {
      return state.headings[filePath] || []
    },

    allFileNames: (state) => {
      const names = []
      for (const [name, paths] of Object.entries(state.nameMap)) {
        for (const p of paths) {
          names.push({ name: fileNameFromPath(p), path: p, normalized: name })
        }
      }
      return names
    },

  },

  actions: {
    resolveLink(target, fromPath) {
      if (!target) return null
      const workspace = useWorkspaceStore()
      const normalized = normalizeName(target)

      // 1. Exact filename match (case-insensitive, .md stripped)
      const candidates = this.nameMap[normalized]
      if (!candidates || candidates.length === 0) {
        // 2. Check if target contains path separator for disambiguation
        if (target.includes('/')) {
          const normTarget = target.replace(/\.md$/, '')
          for (const [, paths] of Object.entries(this.nameMap)) {
            for (const p of paths) {
              const rel = workspace.path ? p.replace(workspace.path + '/', '') : p
              if (rel.replace(/\.md$/, '').endsWith(normTarget)) {
                return { path: p, heading: null }
              }
            }
          }
        }
        return null
      }

      if (candidates.length === 1) {
        return { path: candidates[0], heading: null }
      }

      // Ambiguous: prefer same directory, then shortest path
      const fromDir = fromPath ? dirFromPath(fromPath) : ''
      const sameDir = candidates.filter(p => dirFromPath(p) === fromDir)
      if (sameDir.length > 0) {
        return { path: sameDir[0], heading: null }
      }

      // Shortest path
      const sorted = [...candidates].sort((a, b) => a.length - b.length)
      return { path: sorted[0], heading: null }
    },

    async fullScan() {
      const workspace = useWorkspaceStore()
      const filesStore = useFilesStore()
      if (!workspace.path) return

      // Reset
      this.forwardLinks = {}
      this.backlinks = {}
      this.nameMap = {}
      this.headings = {}

      // Get all md files
      const mdFiles = filesStore.flatFiles.filter(f => f.path.endsWith('.md'))

      // Read all files and build indices
      for (const file of mdFiles) {
        try {
          let content = filesStore.fileContents[file.path]
          if (content == null) {
            content = await invoke('read_file', { path: file.path })
            filesStore.fileContents[file.path] = content
          }
          this._indexFile(file.path, content)
        } catch (e) {
          console.warn('Failed to index file:', file.path, e)
        }
      }

      // Build backlinks from forward links
      this._rebuildBacklinks()

      this.initialized = true
    },

    async updateFile(path) {
      if (!path.endsWith('.md')) return
      if (!this.initialized) return

      try {
        const content = await invoke('read_file', { path })
        // Remove old index for this file
        this._removeFileFromIndex(path)
        // Re-index
        this._indexFile(path, content)
        // Rebuild backlinks
        this._rebuildBacklinks()
      } catch (e) {
        // File may have been deleted
        this._removeFileFromIndex(path)
        this._rebuildBacklinks()
      }
    },

    async handleRename(oldPath, newPath) {
      const workspace = useWorkspaceStore()
      const filesStore = useFilesStore()
      if (!workspace.path) return

      const oldName = fileNameFromPath(oldPath)
      const newName = fileNameFromPath(newPath)

      if (oldName === newName) {
        // Just a move, not a rename — update indices only
        this._removeFileFromIndex(oldPath)
        try {
          const content = await invoke('read_file', { path: newPath })
          this._indexFile(newPath, content)
        } catch (e) { /* ignore */ }
        this._rebuildBacklinks()
        return
      }

      // Name changed: update all [[oldName]] → [[newName]] across workspace
      const mdFiles = filesStore.flatFiles.filter(f => f.path.endsWith('.md'))
      for (const file of mdFiles) {
        try {
          let content = filesStore.fileContents[file.path]
          if (content == null) {
            content = await invoke('read_file', { path: file.path })
          }

          const links = parseWikiLinks(content)
          const linksToUpdate = links.filter(l => {
            const normTarget = normalizeName(l.target)
            const normOld = normalizeName(oldName)
            return normTarget === normOld
          })

          if (linksToUpdate.length === 0) continue

          // Replace from end to start to preserve offsets
          let updated = content
          for (let i = linksToUpdate.length - 1; i >= 0; i--) {
            const link = linksToUpdate[i]
            let replacement = newName
            if (link.heading) replacement += '#' + link.heading
            if (link.display) replacement += '|' + link.display
            updated = updated.substring(0, link.from) + '[[' + replacement + ']]' + updated.substring(link.to)
          }

          if (updated !== content) {
            await filesStore.saveFile(file.path, updated)
          }
        } catch (e) {
          console.warn('Failed to update links in:', file.path, e)
        }
      }

      // Re-index the renamed file
      this._removeFileFromIndex(oldPath)
      try {
        const content = await invoke('read_file', { path: newPath })
        this._indexFile(newPath, content)
      } catch (e) { /* ignore */ }

      // Full rebuild of backlinks since many files may have changed
      this._rebuildBacklinks()
    },

    handleDelete(path) {
      this._removeFileFromIndex(path)
      this._rebuildBacklinks()
    },

    // --- Internal helpers ---

    _indexFile(path, content) {
      // Name map
      const name = fileNameFromPath(path)
      const normalized = normalizeName(name)
      if (!this.nameMap[normalized]) {
        this.nameMap[normalized] = []
      }
      if (!this.nameMap[normalized].includes(path)) {
        this.nameMap[normalized].push(path)
      }

      // Headings
      this.headings[path] = parseHeadings(content)

      // Forward links (skip those inside code blocks)
      const links = parseWikiLinks(content)
      this.forwardLinks[path] = links.filter(l => !isInsideCodeBlock(content, l.from))
    },

    _removeFileFromIndex(path) {
      const name = fileNameFromPath(path)
      const normalized = normalizeName(name)

      // Remove from nameMap
      if (this.nameMap[normalized]) {
        this.nameMap[normalized] = this.nameMap[normalized].filter(p => p !== path)
        if (this.nameMap[normalized].length === 0) {
          delete this.nameMap[normalized]
        }
      }

      // Remove headings
      delete this.headings[path]

      // Remove forward links
      delete this.forwardLinks[path]

      // Remove from backlinks
      delete this.backlinks[path]
    },

    _rebuildBacklinks() {
      // Clear all backlinks
      this.backlinks = {}

      for (const [sourcePath, links] of Object.entries(this.forwardLinks)) {
        for (const link of links) {
          const resolved = this.resolveLink(link.target, sourcePath)
          if (!resolved) continue

          const targetPath = resolved.path
          if (!this.backlinks[targetPath]) {
            this.backlinks[targetPath] = []
          }

          // Compute line number and context
          const filesStore = useFilesStore()
          const content = filesStore.fileContents[sourcePath] || ''
          const beforeLink = content.substring(0, link.from)
          const lineNumber = (beforeLink.match(/\n/g) || []).length + 1
          // Get the full line as context
          const lineStart = beforeLink.lastIndexOf('\n') + 1
          const lineEnd = content.indexOf('\n', link.to)
          const context = content.substring(lineStart, lineEnd === -1 ? content.length : lineEnd).trim()

          this.backlinks[targetPath].push({
            sourcePath,
            sourceName: fileNameFromPath(sourcePath),
            linkText: link.display || link.target,
            lineNumber,
            context,
          })
        }
      }
    },
  },
})
