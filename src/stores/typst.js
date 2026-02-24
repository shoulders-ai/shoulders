import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from './workspace'

// Default PDF settings
const DEFAULTS = {
  template: 'clean',
  font: 'STIX Two Text',
  font_size: 11,
  page_size: 'a4',
  margins: 'normal',
  spacing: 'normal',
  bib_style: null, // null = use global citation style from references store
}

export const useTypstStore = defineStore('typst', {
  state: () => ({
    available: false,
    exporting: {}, // { [path]: 'exporting' | 'done' | 'error' }
    pdfSettings: {}, // { [relativePath]: PdfSettings }
  }),

  actions: {
    async checkAvailability() {
      try {
        this.available = await invoke('is_typst_available')
      } catch {
        this.available = false
      }
    },

    getSettings(mdPath) {
      const workspace = useWorkspaceStore()
      const rel = workspace.path ? mdPath.replace(workspace.path + '/', '') : mdPath
      return { ...DEFAULTS, ...(this.pdfSettings[rel] || {}) }
    },

    setSettings(mdPath, settings) {
      const workspace = useWorkspaceStore()
      const rel = workspace.path ? mdPath.replace(workspace.path + '/', '') : mdPath
      this.pdfSettings[rel] = { ...this.getSettings(mdPath), ...settings }
      this.persistSettings()
    },

    async loadSettings() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      try {
        const content = await invoke('read_file', {
          path: `${workspace.projectDir}/pdf-settings.json`,
        })
        this.pdfSettings = JSON.parse(content)
      } catch {
        // No settings file yet — use defaults
      }
    },

    async persistSettings() {
      const workspace = useWorkspaceStore()
      if (!workspace.projectDir) return
      try {
        await invoke('write_file', {
          path: `${workspace.projectDir}/pdf-settings.json`,
          content: JSON.stringify(this.pdfSettings, null, 2),
        })
      } catch (e) {
        console.error('Failed to save PDF settings:', e)
      }
    },

    async exportToPdf(mdPath, bibPath, settings) {
      this.exporting[mdPath] = 'exporting'
      try {
        const result = await invoke('export_md_to_pdf', {
          mdPath,
          bibPath: bibPath || null,
          settings: settings || null,
        })
        this.exporting[mdPath] = result.success ? 'done' : 'error'
        return result
      } catch (e) {
        this.exporting[mdPath] = 'error'
        throw e
      }
    },
  },
})

export { DEFAULTS as PDF_DEFAULTS }
