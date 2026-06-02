import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from './workspace'
import { resolveAbsPath } from '../utils/paths'

// Default Quarto export settings (sidecar — NOT written to YAML)
const DEFAULTS = {
  engine: 'quarto',       // 'shoulders' | 'quarto'
  format: 'docx',         // 'docx' | 'pdf' | 'html'
  font: 'Calibri',
  font_size: 11,
  page_size: 'a4',
  margins: 'normal',      // maps to geometry metadata
  toc: false,
  number_sections: false,
  reference_doc: null,     // path to .docx template (relative to workspace)
}

// Margins → Quarto geometry value
const MARGIN_MAP = {
  narrow: '1.5cm',
  normal: '2.5cm',
  wide: '3.5cm',
}

export const useQuartoStore = defineStore('quarto', {
  state: () => ({
    available: false,
    rendering: {},       // { [path]: 'rendering' | 'done' | 'error' }
    quartoSettings: {},  // { [relativePath]: QuartoSettings }
    lastResult: {},      // { [path]: QuartoRenderResult } — for error panel
  }),

  actions: {
    async checkAvailability() {
      try {
        this.available = await invoke('is_quarto_available')
      } catch {
        this.available = false
      }
    },

    getSettings(filePath) {
      const workspace = useWorkspaceStore()
      const rel = workspace.path ? filePath.replace(workspace.path + '/', '') : filePath
      return { ...DEFAULTS, ...(this.quartoSettings[rel] || {}) }
    },

    setSettings(filePath, settings) {
      const workspace = useWorkspaceStore()
      const rel = workspace.path ? filePath.replace(workspace.path + '/', '') : filePath
      this.quartoSettings[rel] = { ...this.getSettings(filePath), ...settings }
      this.persistSettings()
    },

    async loadSettings() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      try {
        const content = await invoke('read_file', {
          path: `${workspace.projectDir}/quarto-settings.json`,
        })
        this.quartoSettings = JSON.parse(content)
      } catch {
        // No settings file yet — use defaults
      }
    },

    async persistSettings() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      try {
        await invoke('write_file', {
          path: `${workspace.projectDir}/quarto-settings.json`,
          content: JSON.stringify(this.quartoSettings, null, 2),
        })
      } catch (e) {
        console.error('Failed to save Quarto settings:', e)
      }
    },

    /**
     * Build --metadata flags from popover settings.
     */
    buildMetadata(settings) {
      const meta = []

      if (settings.font) {
        meta.push(['mainfont', settings.font])
      }
      if (settings.font_size) {
        meta.push(['fontsize', `${settings.font_size}pt`])
      }
      if (settings.page_size) {
        meta.push(['papersize', settings.page_size])
      }
      if (settings.margins && MARGIN_MAP[settings.margins]) {
        meta.push(['geometry', `margin=${MARGIN_MAP[settings.margins]}`])
      }
      if (settings.toc) {
        meta.push(['toc', 'true'])
      }
      if (settings.number_sections) {
        meta.push(['number-sections', 'true'])
      }
      if (settings.reference_doc) {
        const workspace = useWorkspaceStore()
        // Resolve relative path against workspace
        const absPath = resolveAbsPath(settings.reference_doc, workspace.path)
        meta.push(['reference-doc', absPath])
      }

      return meta
    },

    /**
     * List available .docx templates in .project/templates/
     */
    async listTemplates() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return []
      const templatesDir = `${workspace.projectDir}/templates`
      try {
        const exists = await invoke('path_exists', { path: templatesDir })
        if (!exists) return []
        const entries = await invoke('read_dir_recursive', {
          path: templatesDir,
          maxDepth: 1,
        })
        return (entries || [])
          .filter(e => !e.is_dir && e.name.endsWith('.docx'))
          .map(e => ({
            name: e.name.replace(/\.docx$/, ''),
            path: e.path,
            relativePath: `.project/templates/${e.name}`,
          }))
      } catch {
        return []
      }
    },

    /**
     * Render a file via Quarto CLI.
     */
    async render(filePath, settings) {
      const merged = { ...this.getSettings(filePath), ...settings }
      const metadata = this.buildMetadata(merged)
      // Map popover format names to Quarto CLI format names
      const rawFormat = merged.format || 'docx'
      const format = rawFormat === 'word' ? 'docx' : rawFormat

      this.rendering[filePath] = 'rendering'
      this.lastResult[filePath] = null

      try {
        const result = await invoke('quarto_render', {
          request: {
            path: filePath,
            format,
            metadata,
            output_dir: null,
          },
        })

        this.lastResult[filePath] = result
        this.rendering[filePath] = result.success ? 'done' : 'error'

        if (result.success) {
          import('../services/telemetry').then(({ events }) => {
            if (events.exportQuarto) events.exportQuarto()
          }).catch(() => {})
        }

        return result
      } catch (e) {
        const errorResult = {
          success: false,
          output_path: null,
          errors: [{ line: null, message: String(e), severity: 'error' }],
          warnings: [],
          log: String(e),
          duration_ms: 0,
        }
        this.lastResult[filePath] = errorResult
        this.rendering[filePath] = 'error'
        return errorResult
      }
    },

    /** Clear render state for a file. */
    clearResult(filePath) {
      delete this.lastResult[filePath]
      delete this.rendering[filePath]
    },
  },
})

export { DEFAULTS as QUARTO_DEFAULTS }
