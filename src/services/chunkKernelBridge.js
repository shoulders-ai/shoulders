// Kernel lifecycle bridge for .Rmd/.qmd inline chunk execution.
// Jupyter kernel ONLY — no subprocess fallback.
// Returns a clear setup error when no kernel is available.

import { useKernelStore } from '../stores/kernel'
import { useEnvironmentStore } from '../stores/environment'

const LANG_SPEC_PATTERNS = {
  r: ['ir', 'r'],
  python: ['python3', 'python', 'ipykernel'],
  julia: ['julia'],
}

const INSTALL_HINTS = {
  r: 'install.packages("IRkernel"); IRkernel::installspec()',
  python: 'pip install ipykernel',
  julia: 'using Pkg; Pkg.add("IJulia")',
}

function normalizeOutput(raw) {
  const type = raw.output_type || raw.type
  if (type === 'stream') {
    return {
      output_type: 'stream',
      name: raw.name || raw.data?.name || 'stdout',
      text: raw.text || raw.data?.text || '',
    }
  }
  if (type === 'display_data') {
    return { output_type: 'display_data', data: raw.data || {}, metadata: raw.metadata || {} }
  }
  if (type === 'execute_result') {
    return { output_type: 'execute_result', data: raw.data || {}, metadata: raw.metadata || {}, execution_count: raw.execution_count || null }
  }
  if (type === 'error') {
    return { output_type: 'error', ename: raw.ename || raw.data?.ename || 'Error', evalue: raw.evalue || raw.data?.evalue || '', traceback: raw.traceback || raw.data?.traceback || [] }
  }
  return { output_type: 'stream', name: 'stdout', text: typeof raw === 'string' ? raw : JSON.stringify(raw) }
}

export class ChunkKernelBridge {
  constructor(workspacePath) {
    this._kernels = {}
    this._launching = {}
    this._destroyed = false
    this._envDetected = false
  }

  async _ensureEnvDetected() {
    if (this._envDetected) return
    this._envDetected = true
    try {
      const envStore = useEnvironmentStore()
      if (!envStore.detected) await envStore.detect()
      const kernelStore = useKernelStore()
      if (kernelStore.kernelspecs.length === 0) await kernelStore.discover()
    } catch {}
  }

  _findSpec(language) {
    const kernelStore = useKernelStore()
    const specs = kernelStore.kernelspecs
    const patterns = LANG_SPEC_PATTERNS[language] || [language]

    for (const pattern of patterns) {
      const match = specs.find(s => s.name.toLowerCase().includes(pattern))
      if (match) return match.name
    }
    const byLang = specs.find(s => s.language?.toLowerCase() === language)
    if (byLang) return byLang.name
    return null
  }

  async ensureKernel(language) {
    if (this._destroyed) return null
    const kernelStore = useKernelStore()

    const existingId = this._kernels[language]
    if (existingId) {
      const info = kernelStore.kernels[existingId]
      if (info && info.status !== 'dead') return existingId
      delete this._kernels[language]
    }

    if (this._launching[language]) return this._launching[language]

    this._launching[language] = (async () => {
      try {
        await this._ensureEnvDetected()
        const specName = this._findSpec(language)
        if (!specName) return null

        const kernelId = await kernelStore.launch(specName)
        this._kernels[language] = kernelId
        return kernelId
      } catch (e) {
        console.warn(`Kernel launch failed for ${language}:`, e)
        return null
      } finally {
        delete this._launching[language]
      }
    })()

    return this._launching[language]
  }

  /**
   * Execute code via Jupyter kernel.
   * Returns { outputs, success } on success.
   * Returns a setup-error output when no kernel is available (never null).
   */
  async execute(code, language) {
    const kernelId = await this.ensureKernel(language)

    if (!kernelId) {
      const hint = INSTALL_HINTS[language] || `Install a Jupyter kernel for ${language}`
      const langLabel = language.charAt(0).toUpperCase() + language.slice(1)
      return {
        outputs: [{
          output_type: 'error',
          ename: 'NoKernel',
          evalue: `No ${langLabel} kernel found. Install one to get inline outputs:\n\n  ${hint}\n\nThen restart the app.`,
          traceback: [],
        }],
        success: false,
      }
    }

    const kernelStore = useKernelStore()
    try {
      const result = await kernelStore.execute(kernelId, code)
      return {
        outputs: (result.outputs || []).map(normalizeOutput),
        success: result.success,
      }
    } catch (e) {
      console.warn(`Kernel execution failed for ${language}:`, e)
      delete this._kernels[language]
      return {
        outputs: [{
          output_type: 'error',
          ename: 'ExecutionError',
          evalue: e.message || String(e),
          traceback: [],
        }],
        success: false,
      }
    }
  }

  async shutdown() {
    this._destroyed = true
    const kernelStore = useKernelStore()
    const ids = Object.values(this._kernels)
    this._kernels = {}
    for (const id of ids) {
      try { await kernelStore.shutdown(id) } catch {}
    }
  }
}
