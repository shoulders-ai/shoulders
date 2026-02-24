import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'

export const useEnvironmentStore = defineStore('environment', {
  state: () => ({
    languages: {
      python: { found: false, path: null, version: null, hasKernel: false, kernelName: null },
      r: { found: false, path: null, version: null, hasKernel: false, kernelName: null },
      julia: { found: false, path: null, version: null, hasKernel: false, kernelName: null },
    },
    jupyter: { found: false, path: null, version: null },
    detected: false,
    detecting: false,
    installing: null,
    installOutput: '',
    installError: '',
  }),

  getters: {
    /**
     * What mode can we run notebooks in for this language?
     * 'jupyter' — full Jupyter kernel available
     * 'none'    — no kernel (language may or may not be installed)
     */
    capability: (state) => (lang) => {
      const info = state.languages[lang]
      if (info?.hasKernel) return 'jupyter'
      return 'none'
    },

    /** Human-readable status line for a language */
    statusLabel: (state) => (lang) => {
      const info = state.languages[lang]
      const name = lang === 'r' ? 'R' : lang.charAt(0).toUpperCase() + lang.slice(1)
      if (info?.hasKernel) {
        const ver = info.version ? ` ${info.version}` : ''
        return `${name}${ver}`
      }
      if (info?.found) return `${name} found — no Jupyter kernel`
      return `${name} not found`
    },
  },

  actions: {
    async detect() {
      if (this.detecting) return
      this.detecting = true

      try {
        // Run all checks in parallel
        const [python, r, julia, jupyter, kernels] = await Promise.all([
          this._detectLang('python3', 'python', /Python (\d+\.\d+\.\d+)/),
          this._detectLang('R', null, /R version (\d+\.\d+\.\d+)/),
          this._detectLang('julia', null, /julia version (\d+\.\d+\.\d+)/i),
          this._detectJupyter(),
          this._detectKernels(),
        ])

        this.languages.python = { ...python, hasKernel: false, kernelName: null }
        this.languages.r = { ...r, hasKernel: false, kernelName: null }
        this.languages.julia = { ...julia, hasKernel: false, kernelName: null }
        this.jupyter = jupyter

        // Match kernels to languages via `jupyter kernelspec list`
        for (const k of kernels) {
          const name = k.name.toLowerCase()
          const display = k.display.toLowerCase()
          if (name.includes('python') || display.includes('python')) {
            this.languages.python.hasKernel = true
            this.languages.python.kernelName = k.name
          } else if (name === 'ir' || display.includes(' r ') || display === 'r') {
            this.languages.r.hasKernel = true
            this.languages.r.kernelName = k.name
          } else if (name.includes('julia') || display.includes('julia')) {
            this.languages.julia.hasKernel = true
            this.languages.julia.kernelName = k.name
          }
        }

        this.detected = true
      } finally {
        this.detecting = false
      }
    },

    /** Detect a language binary on PATH */
    async _detectLang(cmd, fallbackCmd, versionRegex) {
      const result = { found: false, path: null, version: null }
      try {
        let pathOut = await this._run(`which ${cmd} 2>/dev/null`)
        let path = pathOut.trim()
        if (!path && fallbackCmd) {
          pathOut = await this._run(`which ${fallbackCmd} 2>/dev/null`)
          path = pathOut.trim()
        }
        if (!path) return result
        result.found = true
        result.path = path

        const verOut = await this._run(`"${path}" --version 2>&1`)
        const vMatch = verOut.match(versionRegex)
        if (vMatch) result.version = vMatch[1]
      } catch { /* not found */ }
      return result
    },

    /** Detect jupyter command */
    async _detectJupyter() {
      const result = { found: false, path: null, version: null }
      try {
        const pathOut = await this._run('which jupyter 2>/dev/null')
        const path = pathOut.trim()
        if (!path) return result
        result.found = true
        result.path = path

        const verOut = await this._run('jupyter --version 2>&1')
        const match = verOut.match(/jupyter_core\s*:\s*(\d+\.\d+\.\d+)/)
        if (match) result.version = match[1]
      } catch { /* not found */ }
      return result
    },

    /** Parse `jupyter kernelspec list` output into [{name, display, path}] */
    async _detectKernels() {
      try {
        const out = await this._run('jupyter kernelspec list 2>/dev/null')
        const kernels = []
        // Output format: "  python3    /path/to/kernels/python3"
        for (const line of out.split('\n')) {
          const match = line.match(/^\s+(\S+)\s+(\S+)/)
          if (match) {
            kernels.push({ name: match[1], path: match[2], display: match[1] })
          }
        }
        // Try to read display_name from kernel.json for better matching
        for (const k of kernels) {
          try {
            const json = await this._run(`cat "${k.path}/kernel.json" 2>/dev/null`)
            const spec = JSON.parse(json)
            if (spec.display_name) k.display = spec.display_name
          } catch { /* skip */ }
        }
        return kernels
      } catch {
        return []
      }
    },

    async _run(cmd) {
      try {
        return await invoke('run_shell_command', { cwd: '.', command: cmd })
      } catch {
        return ''
      }
    },

    /**
     * Install the Jupyter kernel for a language.
     * Returns true on success, false on failure.
     */
    async installKernel(language) {
      this.installing = language
      this.installOutput = ''
      this.installError = ''

      const commands = {
        python: 'pip3 install ipykernel 2>&1 || pip install ipykernel 2>&1',
        r: 'R --no-echo -e "install.packages(\'IRkernel\', repos=\'https://cloud.r-project.org\'); IRkernel::installspec()" 2>&1',
        julia: 'julia -e "using Pkg; Pkg.add(\\"IJulia\\")" 2>&1',
      }

      const cmd = commands[language]
      if (!cmd) {
        this.installError = `Unknown language: ${language}`
        this.installing = null
        return false
      }

      try {
        const output = await this._run(cmd)
        this.installOutput = output

        // Re-detect to update status
        await this.detect()

        const success = this.languages[language]?.hasKernel === true
        if (!success) {
          this.installError = 'Installation completed but kernel not detected. Try restarting the app.'
        }
        return success
      } catch (e) {
        this.installError = e.message || String(e)
        return false
      } finally {
        this.installing = null
      }
    },

    /** Platform-appropriate install instructions */
    installHint(language) {
      const isMac = navigator.platform?.startsWith('Mac')
      const hints = {
        python: isMac
          ? 'Install via Homebrew: brew install python3 && pip3 install ipykernel'
          : 'Install from python.org, then: pip install ipykernel',
        r: isMac
          ? 'Install from r-project.org, then in R: install.packages("IRkernel"); IRkernel::installspec()'
          : 'Install from r-project.org, then in R: install.packages("IRkernel"); IRkernel::installspec()',
        julia: 'Install from julialang.org, then in Julia: using Pkg; Pkg.add("IJulia")',
      }
      return hints[language] || ''
    },

    /** Quick install command (for one-click button) */
    installCommand(language) {
      return {
        python: 'pip3 install ipykernel',
        r: 'R -e "install.packages(\'IRkernel\'); IRkernel::installspec()"',
        julia: 'julia -e "using Pkg; Pkg.add(\\"IJulia\\")"',
      }[language] || ''
    },
  },
})
