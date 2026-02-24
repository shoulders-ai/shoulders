import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { ensureBibFile } from '../services/latexBib'

export const useLatexStore = defineStore('latex', {
  state: () => ({
    // Per-file compile state: { [texPath]: { status, errors, warnings, pdfPath, synctexPath, log, durationMs, lastCompiled } }
    compileState: {},
    // Whether Tectonic is enabled (global toggle)
    tectonicEnabled: true,
    // Whether auto-compile on save is enabled
    autoCompile: true,
    // Debounce timers per file
    _timers: {},
    // Recompile flags per file (set when compile is requested while one is running)
    _recompileNeeded: {},
    // Tectonic install state
    tectonicInstalled: false,
    tectonicPath: null,
    downloading: false,
    downloadProgress: 0,
    downloadError: null,
  }),

  getters: {
    stateForFile: (state) => (texPath) => {
      return state.compileState[texPath] || null
    },

    isCompiling: (state) => (texPath) => {
      const s = state.compileState[texPath]
      return s?.status === 'compiling'
    },

    errorsForFile: (state) => (texPath) => {
      return state.compileState[texPath]?.errors || []
    },

    warningsForFile: (state) => (texPath) => {
      return state.compileState[texPath]?.warnings || []
    },
  },

  actions: {
    scheduleAutoCompile(texPath) {
      if (!this.tectonicEnabled || !this.autoCompile) return

      // Clear existing timer for this file
      if (this._timers[texPath]) {
        clearTimeout(this._timers[texPath])
      }

      // 4s debounce (auto-save is 1s, so total ~5s from last keystroke)
      this._timers[texPath] = setTimeout(() => {
        delete this._timers[texPath]
        this.compile(texPath)
      }, 4000)
    },

    async compile(texPath) {
      if (!this.tectonicEnabled) return

      // If already compiling, set recompile flag and return
      const current = this.compileState[texPath]
      if (current?.status === 'compiling') {
        this._recompileNeeded[texPath] = true
        return
      }

      // Set compiling state
      this.compileState[texPath] = {
        ...this.compileState[texPath],
        status: 'compiling',
        errors: [],
        warnings: [],
      }

      try {
        // Generate .bib file from reference library before compiling
        try { await ensureBibFile(texPath) } catch {}

        const result = await invoke('compile_latex', { texPath })

        this.compileState[texPath] = {
          status: result.success ? 'success' : 'error',
          errors: result.errors,
          warnings: result.warnings,
          pdfPath: result.pdf_path,
          synctexPath: result.synctex_path,
          log: result.log,
          durationMs: result.duration_ms,
          lastCompiled: Date.now(),
        }

        // Dispatch event for PDF viewer to refresh
        window.dispatchEvent(new CustomEvent('latex-compile-done', {
          detail: { texPath, ...result },
        }))

        // If recompile was requested during compilation, compile again
        if (this._recompileNeeded[texPath]) {
          delete this._recompileNeeded[texPath]
          this.compile(texPath)
        }
      } catch (err) {
        this.compileState[texPath] = {
          ...this.compileState[texPath],
          status: 'error',
          errors: [{ line: null, message: err, severity: 'error' }],
          warnings: [],
        }
      }
    },

    async setTectonicEnabled(enabled) {
      this.tectonicEnabled = enabled
      try {
        await invoke('set_tectonic_enabled', { enabled })
      } catch (e) {
        console.error('Failed to set tectonic enabled:', e)
      }
    },

    async loadTectonicEnabled() {
      try {
        this.tectonicEnabled = await invoke('is_tectonic_enabled')
      } catch (e) {
        // Default to true if command fails
        this.tectonicEnabled = true
      }
    },

    cancelAutoCompile(texPath) {
      if (this._timers[texPath]) {
        clearTimeout(this._timers[texPath])
        delete this._timers[texPath]
      }
    },

    clearState(texPath) {
      delete this.compileState[texPath]
      this.cancelAutoCompile(texPath)
      delete this._recompileNeeded[texPath]
    },

    cleanup() {
      for (const texPath of Object.keys(this._timers)) {
        clearTimeout(this._timers[texPath])
      }
      this._timers = {}
      this._recompileNeeded = {}
      this.compileState = {}
    },

    async checkTectonic() {
      try {
        const result = await invoke('check_tectonic')
        this.tectonicInstalled = result.installed
        this.tectonicPath = result.path || null
      } catch {
        this.tectonicInstalled = false
        this.tectonicPath = null
      }
    },

    async downloadTectonic() {
      this.downloading = true
      this.downloadProgress = 0
      this.downloadError = null

      const unlisten = await listen('tectonic-download-progress', (event) => {
        this.downloadProgress = event.payload.percent
      })

      try {
        const path = await invoke('download_tectonic')
        this.tectonicInstalled = true
        this.tectonicPath = path
      } catch (e) {
        this.downloadError = typeof e === 'string' ? e : e.message || 'Download failed'
      } finally {
        unlisten()
        this.downloading = false
      }
    },
  },
})
