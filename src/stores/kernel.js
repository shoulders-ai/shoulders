import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

export const useKernelStore = defineStore('kernel', {
  state: () => ({
    kernelspecs: [],      // [{ name, display_name, language, path }]
    kernels: {},          // { kernelId: { specName, displayName, language, status } }
    cellOutputs: {},      // { `${kernelId}::${msgId}`: [output, ...] }
    cellStatus: {},       // { `${kernelId}::${msgId}`: 'running'|'done'|'error' }
    _listeners: {},       // { kernelId: [unlistenFn, ...] } — internal cleanup
  }),

  getters: {
    availableKernels: (state) => state.kernelspecs,
    activeKernels: (state) => Object.entries(state.kernels).map(([id, k]) => ({ id, ...k })),
    isAnyBusy: (state) => Object.values(state.kernels).some(k => k.status === 'busy'),
  },

  actions: {
    /**
     * Discover installed Jupyter kernelspecs.
     */
    async discover() {
      try {
        this.kernelspecs = await invoke('kernel_discover')
      } catch (e) {
        console.warn('Kernel discovery failed:', e)
        this.kernelspecs = []
      }
    },

    /**
     * Launch a kernel by spec name.
     * Returns the kernel ID.
     */
    async launch(specName) {
      const spec = this.kernelspecs.find(s => s.name === specName)
      if (!spec) throw new Error(`Kernelspec "${specName}" not found`)

      const kernelId = await invoke('kernel_launch', {
        specName: spec.name,
        specPath: spec.path,
      })

      this.kernels[kernelId] = {
        specName: spec.name,
        displayName: spec.display_name,
        language: spec.language,
        status: 'idle',
      }

      // Listen for kernel status events (busy/idle)
      const unlistenStatus = await listen(`kernel-status-${kernelId}`, (event) => {
        if (this.kernels[kernelId]) {
          this.kernels[kernelId].status = event.payload.status
        }
      })

      this._listeners[kernelId] = [unlistenStatus]
      return kernelId
    },

    /**
     * Execute code on a kernel.
     * Returns a Promise that resolves with { msgId, outputs } when execution completes.
     */
    async execute(kernelId, code) {
      if (!this.kernels[kernelId]) throw new Error('Kernel not found')

      // Send execute request — Rust has a 50ms delay before actually sending
      // to the kernel, giving us time to set up listeners below
      const msgId = await invoke('kernel_execute', { kernelId, code })
      const key = `${kernelId}::${msgId}`
      this.cellOutputs[key] = []
      this.cellStatus[key] = 'running'

      return new Promise(async (resolve, reject) => {
        // await listen() to ensure handlers are registered before events arrive
        const unlistenOutput = await listen(`kernel-output-${kernelId}-${msgId}`, (event) => {
          if (!this.cellOutputs[key]) this.cellOutputs[key] = []
          this.cellOutputs[key].push(event.payload)
        })

        const unlistenDone = await listen(`kernel-done-${kernelId}-${msgId}`, (event) => {
          const success = event.payload?.success !== false
          this.cellStatus[key] = success ? 'done' : 'error'
          unlistenOutput()
          unlistenDone()
          resolve({ msgId, outputs: this.cellOutputs[key] || [], success })
        })

        // Timeout after 5 minutes
        setTimeout(() => {
          if (this.cellStatus[key] === 'running') {
            this.cellStatus[key] = 'error'
            unlistenOutput()
            unlistenDone()
            reject(new Error('Execution timed out (5 min)'))
          }
        }, 300000)
      })
    },

    /**
     * Execute code fire-and-forget (don't await completion).
     * Returns msgId immediately. Use cellOutputs[key] reactively.
     */
    async executeAsync(kernelId, code) {
      if (!this.kernels[kernelId]) throw new Error('Kernel not found')

      const msgId = await invoke('kernel_execute', { kernelId, code })
      const key = `${kernelId}::${msgId}`
      this.cellOutputs[key] = []
      this.cellStatus[key] = 'running'

      // Listen for output events
      const unlistenOutput = await listen(`kernel-output-${kernelId}-${msgId}`, (event) => {
        if (!this.cellOutputs[key]) this.cellOutputs[key] = []
        this.cellOutputs[key].push(event.payload)
      })

      // Listen for done event
      const unlistenDone = await listen(`kernel-done-${kernelId}-${msgId}`, (event) => {
        const success = event.payload?.success !== false
        this.cellStatus[key] = success ? 'done' : 'error'
        unlistenOutput()
        unlistenDone()
      })

      return { msgId, key }
    },

    /**
     * Interrupt a running kernel.
     */
    async interrupt(kernelId) {
      await invoke('kernel_interrupt', { kernelId })
    },

    /**
     * Shut down a kernel and clean up.
     */
    async shutdown(kernelId) {
      // Cleanup listeners
      const listeners = this._listeners[kernelId] || []
      for (const unlisten of listeners) unlisten()
      delete this._listeners[kernelId]

      try {
        await invoke('kernel_shutdown', { kernelId })
      } catch (e) {
        console.warn('Kernel shutdown error:', e)
      }
      delete this.kernels[kernelId]
    },

    /**
     * Get code completions from a kernel.
     */
    async complete(kernelId, code, cursorPos) {
      return await invoke('kernel_complete', { kernelId, code, cursorPos })
    },

    /**
     * Shut down all kernels (called on app close).
     */
    async shutdownAll() {
      const ids = Object.keys(this.kernels)
      for (const id of ids) {
        await this.shutdown(id)
      }
    },

    /**
     * Get outputs for a cell execution.
     */
    getOutputs(kernelId, msgId) {
      return this.cellOutputs[`${kernelId}::${msgId}`] || []
    },

    /**
     * Get execution status for a cell.
     */
    getStatus(kernelId, msgId) {
      return this.cellStatus[`${kernelId}::${msgId}`] || null
    },

    /**
     * Clear stored outputs (e.g., when clearing notebook outputs).
     */
    clearOutputs(kernelId) {
      const prefix = `${kernelId}::`
      for (const key of Object.keys(this.cellOutputs)) {
        if (key.startsWith(prefix)) delete this.cellOutputs[key]
      }
      for (const key of Object.keys(this.cellStatus)) {
        if (key.startsWith(prefix)) delete this.cellStatus[key]
      }
    },
  },
})
