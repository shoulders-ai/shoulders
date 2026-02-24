import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from './workspace'
import { useFilesStore } from './files'

export const useReferencesStore = defineStore('references', {
  state: () => ({
    library: [],
    keyMap: {},         // citeKey → index in library
    initialized: false,
    loading: false,
    activeKey: null,
    selectedKeys: new Set(),
    sortBy: 'addedAt',  // field name: 'addedAt' | 'author' | 'year' | 'title'
    sortDir: 'desc',    // 'asc' | 'desc'
    citationStyle: 'apa',
  }),

  getters: {
    getByKey: (state) => (key) => {
      const idx = state.keyMap[key]
      return idx !== undefined ? state.library[idx] : null
    },

    allKeys: (state) => state.library.map(r => r._key),

    refCount: (state) => state.library.length,

    refsWithPdf: (state) => state.library.filter(r => r._pdfFile),

    sortedLibrary: (state) => {
      const copy = [...state.library]
      const dir = state.sortDir === 'asc' ? 1 : -1
      switch (state.sortBy) {
        case 'author':
          return copy.sort((a, b) => {
            const aAuth = a.author?.[0]?.family || ''
            const bAuth = b.author?.[0]?.family || ''
            return dir * aAuth.localeCompare(bAuth)
          })
        case 'year':
          return copy.sort((a, b) => {
            const aYear = a.issued?.['date-parts']?.[0]?.[0] || 0
            const bYear = b.issued?.['date-parts']?.[0]?.[0] || 0
            return dir * (aYear - bYear)
          })
        case 'title':
          return copy.sort((a, b) => dir * (a.title || '').localeCompare(b.title || ''))
        case 'addedAt':
        default:
          return copy.sort((a, b) => {
            const aDate = a._addedAt || ''
            const bDate = b._addedAt || ''
            return dir * aDate.localeCompare(bDate)
          })
      }
    },

    // Citation index: key → [filePaths] that cite it
    citedIn: (state) => {
      const filesStore = useFilesStore()
      const map = {}
      // Pandoc-style: [@key], [@key1; @key2]
      const citationRe = /\[([^\[\]]*@[a-zA-Z][\w]*[^\[\]]*)\]/g
      const keyRe = /@([a-zA-Z][\w]*)/g
      // LaTeX-style: \cite{key}, \citep{key1, key2}
      const latexCiteRe = /\\(?:cite[tp]?|citealp|citealt|citeauthor|citeyear|autocite|textcite|parencite|nocite|footcite|fullcite|supercite|smartcite|Cite[tp]?|Parencite|Textcite|Autocite|Smartcite|Footcite|Fullcite)\{([^}]*)\}/g
      const latexKeyRe = /([a-zA-Z][\w.-]*)/g

      for (const [path, content] of Object.entries(filesStore.fileContents)) {
        if (!content) continue

        if (path.endsWith('.md')) {
          citationRe.lastIndex = 0
          let match
          while ((match = citationRe.exec(content)) !== null) {
            keyRe.lastIndex = 0
            let keyMatch
            while ((keyMatch = keyRe.exec(match[1])) !== null) {
              const key = keyMatch[1]
              if (!map[key]) map[key] = []
              if (!map[key].includes(path)) map[key].push(path)
            }
          }
        } else if (path.endsWith('.tex') || path.endsWith('.latex')) {
          latexCiteRe.lastIndex = 0
          let match
          while ((match = latexCiteRe.exec(content)) !== null) {
            latexKeyRe.lastIndex = 0
            let keyMatch
            while ((keyMatch = latexKeyRe.exec(match[1])) !== null) {
              const key = keyMatch[1]
              if (!map[key]) map[key] = []
              if (!map[key].includes(path)) map[key].push(path)
            }
          }
        }
      }
      return map
    },

    citedKeys() {
      return new Set(Object.keys(this.citedIn))
    },
  },

  actions: {
    // --- Persistence ---

    async loadLibrary() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return

      this.loading = true
      const libPath = `${workspace.projectDir}/references/library.json`

      try {
        const exists = await invoke('path_exists', { path: libPath })
        if (!exists) {
          this.library = []
          this.keyMap = {}
          this.initialized = true
          this.loading = false
          return
        }

        const content = await invoke('read_file', { path: libPath })
        const data = JSON.parse(content)
        if (!Array.isArray(data)) {
          this.library = []
        } else {
          this.library = data
        }
        this._rebuildKeyMap()
      } catch (e) {
        console.warn('Failed to load reference library:', e)
        this.library = []
        this.keyMap = {}
      }

      // Load persisted citation style
      try {
        const stylePath = `${workspace.projectDir}/citation-style.json`
        const exists = await invoke('path_exists', { path: stylePath })
        if (exists) {
          const raw = await invoke('read_file', { path: stylePath })
          const data = JSON.parse(raw)
          if (data.citationStyle) this.citationStyle = data.citationStyle
        }
      } catch { /* use default */ }

      // Load user-added CSL styles from .project/styles/
      try {
        await this._loadUserStyles(workspace.projectDir)
      } catch { /* no user styles */ }

      this.initialized = true
      this.loading = false
      this.startWatching()
    },

    async _loadUserStyles(baseDir) {
      const stylesDir = `${baseDir}/styles`
      const exists = await invoke('path_exists', { path: stylesDir })
      if (!exists) return

      const entries = await invoke('read_dir', { path: stylesDir })
      const cslFiles = (entries || []).filter(e => e.name?.endsWith('.csl'))
      if (cslFiles.length === 0) return

      const { parseCslMetadata, deriveStyleId } = await import('../utils/cslParser')
      const { setUserStyles } = await import('../services/citationStyleRegistry')

      const styles = []
      for (const entry of cslFiles) {
        try {
          const xml = await invoke('read_file', { path: `${stylesDir}/${entry.name}` })
          const meta = parseCslMetadata(xml)
          const id = deriveStyleId(meta.id, meta.title)
          styles.push({
            id,
            name: meta.title,
            category: meta.category || 'Custom',
            filename: entry.name,
          })
        } catch {
          // Skip malformed CSL files
        }
      }

      if (styles.length > 0) {
        setUserStyles(styles)
      }
    },

    _saveTimer: null,
    async saveLibrary() {
      // Debounced save
      clearTimeout(this._saveTimer)
      this._saveTimer = setTimeout(() => this._doSave(), 500)
    },

    async _doSave() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return

      this._selfWriteCount = (this._selfWriteCount || 0) + 1
      try {
        await invoke('write_file', {
          path: `${workspace.projectDir}/references/library.json`,
          content: JSON.stringify(this.library, null, 2),
        })
      } catch (e) {
        this._selfWriteCount = Math.max(0, (this._selfWriteCount || 0) - 1)
        console.warn('Failed to save reference library:', e)
      }
    },

    async startWatching() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      if (this._unlisten) this._unlisten()

      const { listen } = await import('@tauri-apps/api/event')

      this._unlisten = await listen('fs-change', async (event) => {
        const paths = event.payload?.paths || []
        if (paths.some(p => p.includes('library.json'))) {
          if (this._selfWriteCount > 0) {
            this._selfWriteCount--
            return
          }
          await this.loadLibrary()
        }
      })
    },

    stopWatching() {
      if (this._unlisten) { this._unlisten(); this._unlisten = null }
    },

    async setCitationStyle(style) {
      this.citationStyle = style
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      try {
        await invoke('write_file', {
          path: `${workspace.projectDir}/citation-style.json`,
          content: JSON.stringify({ citationStyle: style }),
        })
      } catch (e) {
        console.warn('Failed to save citation style:', e)
      }
    },

    _rebuildKeyMap() {
      this.keyMap = {}
      for (let i = 0; i < this.library.length; i++) {
        const key = this.library[i]._key || this.library[i].id
        if (key) this.keyMap[key] = i
      }
    },

    // --- CRUD ---

    addReference(cslJson) {
      // Generate key if missing
      if (!cslJson._key) {
        cslJson._key = this.generateKey(cslJson)
      }
      cslJson.id = cslJson._key

      // Check duplicates
      const existingKey = this.findDuplicate(cslJson)
      if (existingKey) {
        return { key: cslJson._key, status: 'duplicate', existingKey }
      }

      if (!cslJson._addedAt) {
        cslJson._addedAt = new Date().toISOString()
      }

      this.library.push(cslJson)
      this._rebuildKeyMap()
      this.saveLibrary()

      return { key: cslJson._key, status: 'added' }
    },

    addReferences(cslArray) {
      const report = { added: [], duplicates: [], errors: [] }
      for (const csl of cslArray) {
        try {
          const result = this.addReference({ ...csl })
          if (result.status === 'added') report.added.push(result.key)
          else report.duplicates.push(result.key)
        } catch (e) {
          report.errors.push({ csl, error: e.message })
        }
      }
      return report
    },

    updateReference(key, updates) {
      const idx = this.keyMap[key]
      if (idx === undefined) return false

      Object.assign(this.library[idx], updates)

      // If key changed, rebuild map
      if (updates._key && updates._key !== key) {
        this.library[idx].id = updates._key
        this._rebuildKeyMap()
      }

      this.saveLibrary()
      return true
    },

    removeReference(key) {
      const idx = this.keyMap[key]
      if (idx === undefined) return false

      const ref = this.library[idx]

      // Clean up associated PDF and fulltext files
      const workspace = useWorkspaceStore()
      if (workspace.projectDir) {
        if (ref._pdfFile) {
          invoke('delete_path', { path: `${workspace.projectDir}/references/pdfs/${ref._pdfFile}` }).catch(() => {})
        }
        if (ref._textFile) {
          invoke('delete_path', { path: `${workspace.projectDir}/references/fulltext/${ref._textFile}` }).catch(() => {})
        }
      }

      this.library.splice(idx, 1)
      this._rebuildKeyMap()

      if (this.activeKey === key) this.activeKey = null
      this.selectedKeys.delete(key)

      this.saveLibrary()
      return true
    },

    removeReferences(keys) {
      for (const key of keys) {
        this.removeReference(key)
      }
    },

    // --- Search ---

    searchRefs(query) {
      if (!query || !query.trim()) return this.sortedLibrary

      const tokens = query.toLowerCase().split(/\s+/).filter(Boolean)
      return this.library.filter(ref => {
        const searchable = [
          ref.title || '',
          ref._key || '',
          ref.DOI || '',
          String(ref.issued?.['date-parts']?.[0]?.[0] || ''),
          ...(ref.author || []).map(a => `${a.family || ''} ${a.given || ''}`),
          ...(ref._tags || []),
          ref['container-title'] || '',
          ref.abstract || '',
        ].join(' ').toLowerCase()

        return tokens.every(t => searchable.includes(t))
      })
    },

    // --- Key generation ---

    generateKey(cslJson) {
      let base = ''

      // Author family name
      const firstAuthor = cslJson.author?.[0]
      if (firstAuthor?.family) {
        base = firstAuthor.family.toLowerCase()
          .replace(/[^a-z]/g, '')
      } else {
        base = 'ref'
      }

      // Year
      const year = cslJson.issued?.['date-parts']?.[0]?.[0]
      if (year) base += year

      // Ensure uniqueness with a/b/c suffixes
      if (!this.keyMap[base]) return base

      for (let i = 0; i < 26; i++) {
        const suffix = String.fromCharCode(97 + i) // a, b, c...
        const candidate = base + suffix
        if (!this.keyMap[candidate]) return candidate
      }

      // Fallback: add random chars
      return base + Math.random().toString(36).slice(2, 5)
    },

    // --- Dedup ---

    findDuplicate(cslJson) {
      // DOI exact match
      if (cslJson.DOI) {
        const normalDoi = cslJson.DOI.toLowerCase().trim()
        const match = this.library.find(r =>
          r.DOI && r.DOI.toLowerCase().trim() === normalDoi
        )
        if (match) return match._key
      }

      // Title Jaccard similarity > 0.85
      if (cslJson.title) {
        const newTokens = new Set(cslJson.title.toLowerCase().split(/\s+/))
        for (const ref of this.library) {
          if (!ref.title) continue
          const refTokens = new Set(ref.title.toLowerCase().split(/\s+/))
          const intersection = new Set([...newTokens].filter(t => refTokens.has(t)))
          const union = new Set([...newTokens, ...refTokens])
          if (union.size > 0 && intersection.size / union.size > 0.85) return ref._key
        }
      }

      return null
    },

    isDuplicate(cslJson) {
      return this.findDuplicate(cslJson) !== null
    },

    // --- PDF storage ---

    async storePdf(key, sourcePath) {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return

      const pdfsDir = `${workspace.projectDir}/references/pdfs`
      const textDir = `${workspace.projectDir}/references/fulltext`
      const destPdf = `${pdfsDir}/${key}.pdf`

      try {
        await invoke('copy_file', { src: sourcePath, dest: destPdf })
        this.updateReference(key, { _pdfFile: `${key}.pdf` })
      } catch (e) {
        console.warn('Failed to store PDF:', e)
      }

      // Extract text for full-text search
      try {
        const { extractTextFromPdf } = await import('../utils/pdfMetadata')
        const text = await extractTextFromPdf(destPdf)
        if (text) {
          await invoke('write_file', {
            path: `${textDir}/${key}.txt`,
            content: text,
          })
          this.updateReference(key, { _textFile: `${key}.txt` })
        }
      } catch (e) {
        console.warn('Failed to extract PDF text:', e)
      }
    },

    // --- Export ---

    exportBibTeX(keys) {
      const refs = keys
        ? keys.map(k => this.getByKey(k)).filter(Boolean)
        : this.library

      return refs.map(ref => {
        const type = cslTypeToBibtex(ref.type)
        const key = ref._key || ref.id
        const fields = []

        if (ref.title) fields.push(`  title = {${ref.title}}`)
        if (ref.author) {
          const authors = ref.author.map(a =>
            `${a.family || ''}${a.given ? ', ' + a.given : ''}`
          ).join(' and ')
          fields.push(`  author = {${authors}}`)
        }
        if (ref.issued?.['date-parts']?.[0]?.[0]) {
          fields.push(`  year = {${ref.issued['date-parts'][0][0]}}`)
        }
        if (ref['container-title']) fields.push(`  journal = {${ref['container-title']}}`)
        if (ref.volume) fields.push(`  volume = {${ref.volume}}`)
        if (ref.issue) fields.push(`  number = {${ref.issue}}`)
        if (ref.page) fields.push(`  pages = {${ref.page}}`)
        if (ref.DOI) fields.push(`  doi = {${ref.DOI}}`)
        if (ref.publisher) fields.push(`  publisher = {${ref.publisher}}`)

        return `@${type}{${key},\n${fields.join(',\n')}\n}`
      }).join('\n\n')
    },

    exportRis(keys) {
      const refs = keys
        ? keys.map(k => this.getByKey(k)).filter(Boolean)
        : this.library

      return refs.map(ref => {
        const lines = []
        lines.push(`TY  - ${cslTypeToRis(ref.type)}`)

        if (ref.title) lines.push(`TI  - ${ref.title}`)
        if (ref.author) {
          for (const a of ref.author) {
            const name = a.family && a.given ? `${a.family}, ${a.given}` : (a.family || a.given || '')
            if (name) lines.push(`AU  - ${name}`)
          }
        }
        if (ref.issued?.['date-parts']?.[0]) {
          const parts = ref.issued['date-parts'][0]
          const yr = parts[0]
          const mo = parts[1] ? String(parts[1]).padStart(2, '0') : ''
          const dy = parts[2] ? String(parts[2]).padStart(2, '0') : ''
          lines.push(`PY  - ${yr}`)
          if (mo) lines.push(`DA  - ${yr}/${mo}${dy ? '/' + dy : ''}`)
        }
        if (ref['container-title']) lines.push(`JO  - ${ref['container-title']}`)
        if (ref.volume) lines.push(`VL  - ${ref.volume}`)
        if (ref.issue) lines.push(`IS  - ${ref.issue}`)
        if (ref.page) {
          const [sp, ep] = ref.page.split('-')
          lines.push(`SP  - ${sp.trim()}`)
          if (ep) lines.push(`EP  - ${ep.trim()}`)
        }
        if (ref.DOI) lines.push(`DO  - ${ref.DOI}`)
        if (ref.URL) lines.push(`UR  - ${ref.URL}`)
        if (ref.abstract) lines.push(`AB  - ${ref.abstract}`)
        if (ref.publisher) lines.push(`PB  - ${ref.publisher}`)
        if (ref.ISSN) lines.push(`SN  - ${ref.ISSN}`)
        else if (ref.ISBN) lines.push(`SN  - ${ref.ISBN}`)
        if (ref._tags?.length) {
          for (const tag of ref._tags) lines.push(`KW  - ${tag}`)
        }
        lines.push('ER  -')

        return lines.join('\n')
      }).join('\n\n')
    },
  },
})

function cslTypeToRis(type) {
  const map = {
    'article-journal': 'JOUR',
    'book': 'BOOK',
    'chapter': 'CHAP',
    'paper-conference': 'CONF',
    'report': 'RPRT',
    'thesis': 'THES',
    'webpage': 'ELEC',
    'article-magazine': 'MGZN',
    'article-newspaper': 'NEWS',
    'manuscript': 'UNPB',
    'legislation': 'BILL',
    'legal_case': 'CASE',
    'dataset': 'DATA',
    'patent': 'PAT',
    'motion_picture': 'VIDEO',
    'song': 'SOUND',
    'map': 'MAP',
  }
  return map[type] || 'GEN'
}

function cslTypeToBibtex(type) {
  const map = {
    'article-journal': 'article',
    'paper-conference': 'inproceedings',
    'book': 'book',
    'chapter': 'incollection',
    'thesis': 'phdthesis',
    'report': 'techreport',
    'webpage': 'misc',
  }
  return map[type] || 'misc'
}
