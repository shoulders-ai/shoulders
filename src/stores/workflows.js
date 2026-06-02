import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { resolveAbsPath } from '../utils/paths'
import sdkSource from '../../workflow-sdk/@shoulders/workflow/index.mjs?raw'

// Module-level maps (outside Pinia, like chatInstances in chat.js)
const _workers = new Map()            // runId → Worker
const _customToolCallbacks = new Map() // callId → { resolve, reject }

// Map a position in whitespace-normalized text back to original text.
// Each whitespace run in the original counts as 1 char in normalized text.
function _normToOrigIndex(text, normIdx) {
  let ni = 0
  let oi = 0
  while (ni < normIdx && oi < text.length) {
    if (/\s/.test(text[oi])) {
      while (oi < text.length && /\s/.test(text[oi])) oi++
      ni++
    } else {
      oi++
      ni++
    }
  }
  return oi
}

export const useWorkflowsStore = defineStore('workflows', {
  state: () => ({
    // Discovery
    workflows: [],        // Array<WorkflowDefinition>
    extraWorkflowPaths: [], // Additional directories to scan (CRO repos, shared folders)

    // Runs (keyed by runId — multiple runs of same workflow can coexist)
    runs: {},             // { [runId]: RunState }

    // Persisted run metadata (for HISTORY listing)
    allRunsMeta: [],      // [{ id, workflowId, workflowName, status, startedAt, completedAt }]
  }),

  getters: {
    getRun: (state) => (runId) => state.runs[runId],

    workflowsByCategory: (state) => {
      const groups = {}
      for (const w of state.workflows) {
        const cat = w.category || 'Other'
        if (!groups[cat]) groups[cat] = []
        groups[cat].push(w)
      }
      return groups
    },

    availableWorkflows: (state) => state.workflows.filter(w => !w.draft),

    /** Running workflow runs — for sidebar overview */
    runningRuns: (state) => {
      return Object.values(state.runs).filter(r => r.status === 'running')
    },
  },

  actions: {
    // ─── Discovery ─────────────────────────────────────────────────

    async discoverWorkflows() {
      const workspace = useWorkspaceStore()
      if (!workspace.path) return

      // Load extra sources on first discovery
      if (!this._sourcesLoaded) {
        await this.loadWorkflowSources()
        this._sourcesLoaded = true
      }

      // Priority order: project > global > extraPaths > development > bundled
      // First occurrence of an ID wins (higher-priority sources listed first)
      const locations = [
        { dir: `${workspace.projectDir}/workflows`, source: 'project' },
        { dir: `${workspace.globalConfigDir}/workflows`, source: 'global' },
      ]

      // Extra workflow paths (CRO repos, shared folders)
      for (const dir of (this.extraWorkflowPaths || [])) {
        if (dir) locations.push({ dir, source: 'external' })
      }

      locations.push({ dir: `${workspace.path}/workflows`, source: 'development' })

      // Bundled workflows from Tauri app resources
      try {
        const { resolveResource } = await import('@tauri-apps/api/path')
        const bundledDir = await resolveResource('workflows')
        locations.push({ dir: bundledDir, source: 'bundled' })
      } catch { /* resolveResource unavailable outside Tauri */ }

      const workflows = []
      const seenIds = new Set()

      for (const { dir, source } of locations) {
        if (!dir) continue
        try {
          const exists = await invoke('path_exists', { path: dir })
          if (!exists) continue

          const entries = await invoke('read_dir_recursive', { path: dir })
          for (const entry of entries) {
            if (!entry.is_dir) continue
            if (seenIds.has(entry.name)) continue // higher-priority source already registered this ID

            const workflowDir = entry.path || `${dir}/${entry.name}`
            const jsonPath = `${workflowDir}/workflow.json`
            const hasJson = await invoke('path_exists', { path: jsonPath })
            if (!hasJson) continue

            try {
              const content = await invoke('read_file', { path: jsonPath })
              const config = JSON.parse(content)

              seenIds.add(entry.name)
              workflows.push({
                id: entry.name,
                name: config.name || entry.name,
                version: config.version || '0.0.0',
                description: config.description || '',
                category: config.category || 'Other',
                draft: config.draft || false,
                inputs: config.inputs || {},
                tools: config.tools || [],
                dir: workflowDir,
                source,
                hasCustomUI: await invoke('path_exists', { path: `${workflowDir}/ui.html` }),
                hasReadme: await invoke('path_exists', { path: `${workflowDir}/README.md` }),
                minAppVersion: config.minAppVersion || null,
              })
            } catch (e) {
              console.warn(`Invalid workflow.json in ${entry.name}:`, e)
            }
          }
        } catch {
          // Location doesn't exist or isn't readable
        }
      }

      this.workflows = workflows
    },

    // ─── Workflow Sources (extraWorkflowPaths) ────────────────────

    async loadWorkflowSources() {
      const workspace = useWorkspaceStore()
      if (!workspace.globalConfigDir) return
      try {
        const content = await invoke('read_file', { path: `${workspace.globalConfigDir}/workflow-sources.json` })
        const data = JSON.parse(content)
        this.extraWorkflowPaths = Array.isArray(data.paths) ? data.paths : []
      } catch { /* no file yet — that's fine */ }
    },

    async _saveWorkflowSources() {
      const workspace = useWorkspaceStore()
      if (!workspace.globalConfigDir) return
      await invoke('write_file', {
        path: `${workspace.globalConfigDir}/workflow-sources.json`,
        content: JSON.stringify({ paths: this.extraWorkflowPaths }, null, 2),
      })
    },

    async addWorkflowPath(dirPath) {
      if (!dirPath || this.extraWorkflowPaths.includes(dirPath)) return
      this.extraWorkflowPaths.push(dirPath)
      await this._saveWorkflowSources()
      await this.discoverWorkflows()
    },

    async removeWorkflowPath(dirPath) {
      this.extraWorkflowPaths = this.extraWorkflowPaths.filter(p => p !== dirPath)
      await this._saveWorkflowSources()
      await this.discoverWorkflows()
    },

    async importWorkflow(sourcePath) {
      const workspace = useWorkspaceStore()
      if (!workspace.globalConfigDir) throw new Error('Global config directory not available')

      // Validate: must contain workflow.json
      const hasJson = await invoke('path_exists', { path: `${sourcePath}/workflow.json` })
      if (!hasJson) throw new Error('Selected folder does not contain a workflow.json')

      // Copy to ~/.shoulders/workflows/{folder-name}/
      const folderName = sourcePath.split('/').pop()
      const destDir = `${workspace.globalConfigDir}/workflows`
      await invoke('create_dir', { path: destDir }).catch(() => {})
      await invoke('copy_dir', { src: sourcePath, dest: `${destDir}/${folderName}` })

      await this.discoverWorkflows()
      return folderName
    },

    // ─── Run Lifecycle ─────────────────────────────────────────────

    async startRun(workflowId, userInputs = {}) {
      const workflow = this.workflows.find(w => w.id === workflowId)
      if (!workflow) throw new Error(`Workflow not found: ${workflowId}`)

      const runId = nanoid(12)

      // Create run state
      this.runs[runId] = {
        id: runId,
        workflowId,
        workflow,
        status: 'running',
        inputs: userInputs,
        messages: [
          { type: 'receipt', workflowName: workflow.name, inputs: userInputs, description: workflow.description },
        ],
        currentStep: null,
        streamingText: '',
        startedAt: new Date(),
        completedAt: null,
        error: null,
        pendingInteraction: null,
      }

      try {
        // Read workflow script and create Worker
        const userCode = await invoke('read_file', { path: `${workflow.dir}/run.js` })

        // Strip the SDK import line — the SDK is already in the blob
        const stripped = userCode.replace(
          /import\s*\{[^}]*\}\s*from\s*['"]@shoulders\/workflow['"]\s*;?[ \t]*\n?/,
          ''
        )

        // Combine SDK + user code into a Worker blob
        // The SDK is an async IIFE: (async () => { ...sdk... \n ...user code... })()
        // User code is appended inside the IIFE closure, sharing ai/ui/workspace/inputs
        const combined = sdkSource + stripped + '\n})()'
        const blob = new Blob([combined], { type: 'text/javascript' })
        const worker = new Worker(URL.createObjectURL(blob))

        // Wire up message handling
        worker.onmessage = (event) => this._handleMessage(runId, event.data)
        worker.onerror = (event) => {
          const msg = event?.message || 'Worker error'
          console.error(`[workflow ${runId}] Worker error:`, msg, 'line:', event?.lineno)
          this._failRun(runId, msg)
        }

        _workers.set(runId, worker)

        // Send init message (JSON round-trip strips Vue reactive proxies)
        this._sendToWorker(runId, {
          type: 'init',
          inputs: userInputs,
          config: {
            tools: workflow.tools,
            workflowDir: workflow.dir,
            workflowName: workflow.name,
            runId,
          },
        })
      } catch (e) {
        console.error(`[workflow ${runId}] Failed to start:`, e)
        this._failRun(runId, e.message || 'Failed to start workflow')
      }

      return runId
    },

    cancelRun(runId) {
      const run = this.runs[runId]
      if (!run || run.status !== 'running') return

      const worker = _workers.get(runId)
      if (worker) {
        worker.terminate()
        _workers.delete(runId)
      }

      run.status = 'cancelled'
      run.completedAt = new Date()
      this.saveRun(runId)
    },

    // ─── Error Helper ───────────────────────────────────────────────

    _failRun(runId, message) {
      const run = this.runs[runId]
      if (!run || run.status !== 'running') return
      if (run.currentStep) this._handleStepComplete(run, { summary: '' })
      run.messages.push({ type: 'error', message })
      run.status = 'failed'
      run.error = message
      run.completedAt = new Date()
      this._cleanupWorker(runId)
      this.saveRun(runId)
    },

    // ─── Message Dispatch ──────────────────────────────────────────

    _sendToWorker(runId, msg) {
      const worker = _workers.get(runId)
      // JSON round-trip strips Vue reactive proxies (postMessage uses structured clone which can't handle Proxy objects)
      if (worker) worker.postMessage(JSON.parse(JSON.stringify(msg)))
    },

    async _handleMessage(runId, msg) {
      const run = this.runs[runId]
      if (!run) return

      switch (msg.type) {
        // === UI Progress ===
        case 'ui.step':
          this._handleStep(run, msg)
          break

        case 'ui.log':
          run.messages.push({ type: 'log', message: msg.message })
          break

        case 'ui.complete':
          this._handleStepComplete(run, msg)
          break

        case 'ui.finish':
          if (run.currentStep) {
            this._handleStepComplete(run, { summary: '' })
          }
          run.messages.push({ type: 'finish', output: msg.output })
          run.status = 'completed'
          run.completedAt = new Date()
          this._cleanupWorker(runId)
          this.saveRun(runId)
          break

        case 'ui.error':
          this._failRun(runId, msg.message)
          break

        // === AI Generate (tool loop runs here, not in Worker) ===
        case 'ai.generate':
          await this._handleAiGenerate(runId, msg)
          break

        // === Custom tool result (callback from Worker) ===
        case 'custom_tool.result': {
          const cb = _customToolCallbacks.get(msg.id)
          if (cb) {
            _customToolCallbacks.delete(msg.id)
            cb.resolve(typeof msg.output === 'string' ? msg.output : JSON.stringify(msg.output))
          }
          break
        }

        // === Workspace Operations ===
        case 'workspace.readFile':
        case 'workspace.writeFile':
        case 'workspace.listFiles':
        case 'workspace.searchContent':
        case 'workspace.readReferences':
        case 'workspace.openFile':
        case 'workspace.addComments':
        case 'workspace.insertText':
        case 'workspace.addReference':
        case 'workspace.exec':
        case 'workspace.parseExcel':
        case 'workspace.parseDocx':
          await this._handleWorkspaceOp(runId, msg)
          break

        // === UI Interactions ===
        case 'ui.chat':
        case 'ui.confirm':
        case 'ui.approve':
        case 'ui.form':
        case 'ui.pickModel':
          this._handleInteraction(runId, msg)
          break
      }
    },

    _handleStep(run, msg) {
      if (run.currentStep) {
        const stepMsg = run.messages.findLast(
          m => m.type === 'step' && m.name === run.currentStep.name && m.status === 'running'
        )
        if (stepMsg) {
          stepMsg.status = 'completed'
          stepMsg.completedAt = new Date()
        }
      }
      run.currentStep = { name: msg.name, startedAt: new Date() }
      run.streamingText = ''
      run.messages.push({
        type: 'step',
        name: msg.name,
        status: 'running',
        summary: '',
        startedAt: new Date(),
        completedAt: null,
      })
    },

    _handleStepComplete(run, msg) {
      if (run.currentStep) {
        const stepMsg = run.messages.findLast(
          m => m.type === 'step' && m.name === run.currentStep.name && m.status === 'running'
        )
        if (stepMsg) {
          stepMsg.status = 'completed'
          stepMsg.summary = msg.summary || ''
          stepMsg.completedAt = new Date()
        }
      }
      run.currentStep = null
    },

    // ─── AI Generate Handler (tool loop runs here) ─────────────────

    async _handleAiGenerate(runId, msg) {
      const run = this.runs[runId]
      if (!run) return

      try {
        const { createModel, buildProviderOptions, convertSdkUsage } = await import('../services/aiSdk.js')
        const { createTauriFetch } = await import('../services/tauriFetch.js')
        const { streamText, tool: defineTool, stepCountIs } = await import('ai')
        const { jsonSchema } = await import('ai')
        const { getAiTools } = await import('../services/chatTools.js')
        const { resolveApiAccess } = await import('../services/apiClient.js')
        const { getThinkingConfig } = await import('../services/chatModels.js')
        const { calculateCost } = await import('../services/tokenUsage.js')
        const workspace = useWorkspaceStore()

        // Resolve model
        const modelId = msg.model || workspace.selectedModelId || 'anthropic/claude-sonnet-4-5-20250514'
        const access = await resolveApiAccess({ modelId }, workspace)
        if (!access) throw new Error(`No API access for model: ${modelId}`)

        const provider = access.providerHint || access.provider
        const tauriFetch = createTauriFetch()
        const model = createModel(access, tauriFetch)

        // Provider options (thinking config, etc.) — same as chatTransport
        const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === modelId)
        const thinkingConfig = getThinkingConfig(access.model, provider, modelEntry?.thinking)
        const providerOptions = buildProviderOptions(thinkingConfig, provider)

        // Build tools — all with execute functions (same objects chat uses)
        const allTools = getAiTools(workspace)
        const tools = {}

        for (const name of (msg.tools || [])) {
          if (allTools[name]) tools[name] = allTools[name]
        }

        // Custom tools — execute via IPC callback to Worker
        for (const def of (msg.customToolDefs || [])) {
          tools[def.name] = defineTool({
            description: def.description,
            inputSchema: jsonSchema(def.parameters),
            execute: async (input) => {
              const callId = nanoid(8)
              return new Promise((resolve, reject) => {
                _customToolCallbacks.set(callId, { resolve, reject })
                this._sendToWorker(runId, { type: 'custom_tool.execute', id: callId, generateId: msg.id, name: def.name, input })
                setTimeout(() => {
                  if (_customToolCallbacks.has(callId)) {
                    _customToolCallbacks.delete(callId)
                    reject(new Error(`Custom tool ${def.name} timed out (5 min)`))
                  }
                }, 300000)
              })
            },
          })
        }

        // Build user message content — multipart if files attached, plain string otherwise
        let userContent = msg.prompt
        if (msg.files?.length) {
          const parts = [{ type: 'text', text: msg.prompt }]
          for (const filePath of msg.files) {
            const resolved = resolveAbsPath(filePath, workspace.path)
            const base64 = await invoke('read_file_base64', { path: resolved })
            const ext = resolved.split('.').pop().toLowerCase()
            if (ext === 'pdf') {
              parts.push({ type: 'file', data: base64, mediaType: 'application/pdf' })
            } else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
              parts.push({ type: 'image', data: base64, mediaType: `image/${ext === 'jpg' ? 'jpeg' : ext}` })
            }
          }
          userContent = parts
        }

        // Add ai-output message for streaming display
        const aiMsg = { type: 'ai-output', role: 'assistant', parts: [] }
        run.messages.push(aiMsg)

        // Stream with full tool loop — same pattern as chatTransport.js
        const result = streamText({
          model,
          messages: [{ role: 'user', content: userContent }],
          tools,
          system: msg.system || undefined,
          stopWhen: stepCountIs(15),
          providerOptions,
          prepareStep({ steps }) {
            // Inject native PDF/image data as user messages (same as chatTransport.js)
            const lastStep = steps[steps.length - 1]
            if (!lastStep) return undefined
            const fileParts = []
            for (const r of lastStep.toolResults) {
              if (r.output?._type === 'pdf' && r.output.base64) {
                fileParts.push({ type: 'file', data: r.output.base64, mediaType: 'application/pdf', filename: r.output.filename })
              } else if (r.output?._type === 'image' && r.output.base64) {
                fileParts.push({ type: 'image-data', data: r.output.base64, mediaType: r.output.mediaType })
              }
            }
            if (fileParts.length === 0) return undefined
            return { type: 'append', messages: [{ role: 'user', content: fileParts }] }
          },
          onStepFinish(event) {
            if (event.usage) {
              const normalized = convertSdkUsage(event.usage, event.providerMetadata, provider)
              normalized.cost = calculateCost(normalized, access.model, access.provider)
              import('./usage').then(({ useUsageStore }) => {
                useUsageStore().record({
                  usage: normalized,
                  feature: 'workflow',
                  provider: access.provider,
                  modelId: access.model,
                })
              })
            }
          },
        })

        // Stream to UI
        let textAccum = ''
        const allToolCalls = []

        for await (const part of result.fullStream) {
          if (part.type === 'text-delta') {
            textAccum += part.text
            run.streamingText += part.text
            const textPart = aiMsg.parts.find(p => p.type === 'text')
            if (textPart) textPart.text = textAccum
            else aiMsg.parts.push({ type: 'text', text: textAccum })
          } else if (part.type === 'tool-call') {
            aiMsg.parts.push({
              type: `tool-${part.toolName}`,
              toolCallId: part.toolCallId,
              toolName: part.toolName,
              state: 'input-available',
              input: part.args,
              output: null,
            })
            allToolCalls.push({ name: part.toolName, input: part.args })
          } else if (part.type === 'tool-result') {
            const toolPart = aiMsg.parts.find(p => p.toolCallId === part.toolCallId)
            if (toolPart) {
              toolPart.state = 'output-available'
              toolPart.output = part.result
            }
          }
        }

        const finalResult = await result
        const usage = finalResult.usage ? {
          inputTokens: finalResult.usage.promptTokens || 0,
          outputTokens: finalResult.usage.completionTokens || 0,
        } : {}

        // Send final result to Worker
        this._sendToWorker(runId, {
          type: 'ai.generate.done', id: msg.id,
          output: textAccum, toolCalls: allToolCalls, usage,
        })
        run.streamingText = ''
      } catch (e) {
        console.error(`[workflow ${runId}] ai.generate error:`, e)
        this._sendToWorker(runId, {
          type: 'ai.generate.error', id: msg.id, error: e.message,
        })
      }
    },

    // ─── Workspace Operation Handler ───────────────────────────────

    async _handleWorkspaceOp(runId, msg) {
      try {
        let result = {}
        const workspace = useWorkspaceStore()

        // Resolve relative paths against workspace root
        const resolvePath = (p) => resolveAbsPath(p, workspace.path)

        switch (msg.type) {
          case 'workspace.readFile':
            result = { content: await invoke('read_file', { path: resolvePath(msg.path) }) }
            break

          case 'workspace.writeFile':
            await invoke('write_file', { path: resolvePath(msg.path), content: msg.content })
            break

          case 'workspace.listFiles': {
            const tree = await invoke('read_dir_recursive', { path: resolvePath(msg.dir) || workspace.path })
            const files = []
            const walk = (entries) => {
              for (const e of entries) {
                if (!e.is_dir) files.push(e.path || e.name)
                if (e.children) walk(e.children)
              }
            }
            walk(tree)
            result = { files }
            break
          }

          case 'workspace.searchContent':
            result = { results: await invoke('search_content', { path: workspace.path, query: msg.query }) }
            break

          case 'workspace.readReferences': {
            const { useReferencesStore } = await import('./references.js')
            const refs = useReferencesStore()
            result = { references: refs.references || [] }
            break
          }

          case 'workspace.openFile': {
            const { useEditorStore } = await import('./editor.js')
            const editor = useEditorStore()
            editor.openFile(resolvePath(msg.path))
            break
          }

          case 'workspace.addComments': {
            const { useCommentsStore } = await import('./comments.js')
            const commentsStore = useCommentsStore()
            const commentPath = resolvePath(msg.path)
            const fileContent = await invoke('read_file', { path: commentPath })

            let inserted = 0
            const unanchored = []

            for (const ann of (msg.annotations || [])) {
              const anchor = ann.anchor_text || ann.text_snippet
              if (!anchor) { unanchored.push({ ...ann, reason: 'Missing anchor text' }); continue }

              let idx = fileContent.indexOf(anchor)
              let matchLen = anchor.length

              // Whitespace-normalized fallback
              if (idx === -1) {
                const normContent = fileContent.replace(/\s+/g, ' ')
                const normAnchor = anchor.replace(/\s+/g, ' ')
                const normIdx = normContent.indexOf(normAnchor)
                if (normIdx !== -1) {
                  // Map normalized position back to original
                  idx = _normToOrigIndex(fileContent, normIdx)
                  matchLen = _normToOrigIndex(fileContent, normIdx + normAnchor.length) - idx
                }
              }

              if (idx === -1) {
                unanchored.push({ ...ann, reason: 'Snippet not found in document' })
                continue
              }

              const range = { from: idx, to: idx + matchLen }
              commentsStore.createComment(
                commentPath, range, anchor,
                ann.content || ann.text || '',
                ann.author || 'ai',
                null, null,
                ann.severity || null
              )
              inserted++
            }

            result = { inserted, unanchored }
            break
          }

          case 'workspace.insertText': {
            const resolved = resolvePath(msg.path)
            const content = await invoke('read_file', { path: resolved })
            const lines = content.split('\n')
            const line = msg.position?.line || 0
            const ch = msg.position?.ch || 0
            if (line < lines.length) {
              lines[line] = lines[line].slice(0, ch) + msg.text + lines[line].slice(ch)
            }
            await invoke('write_file', { path: resolved, content: lines.join('\n') })
            break
          }

          case 'workspace.addReference': {
            const { useReferencesStore } = await import('./references.js')
            const refs = useReferencesStore()
            await refs.addReference(msg.entry)
            break
          }

          case 'workspace.exec': {
            const output = await invoke('run_shell_command', { cwd: workspace.path, command: msg.command })
            result = { output }
            break
          }

          case 'workspace.parseExcel': {
            const JSZip = (await import('jszip')).default
            const base64 = await invoke('read_file_base64', { path: resolvePath(msg.path) })
            const binary = atob(base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

            const zip = await JSZip.loadAsync(bytes)
            const parser = new DOMParser()
            const parseXml = async (p) => {
              const f = zip.file(p)
              return f ? parser.parseFromString(await f.async('text'), 'text/xml') : null
            }

            // Shared strings table
            const sharedStrings = []
            const ssDoc = await parseXml('xl/sharedStrings.xml')
            if (ssDoc) {
              for (const si of Array.from(ssDoc.getElementsByTagName('si'))) {
                const texts = []
                for (const t of Array.from(si.getElementsByTagName('t'))) texts.push(t.textContent)
                sharedStrings.push(texts.join(''))
              }
            }

            // Sheet names from workbook.xml
            const wbDoc = await parseXml('xl/workbook.xml')
            const sheetEntries = []
            if (wbDoc) {
              for (const el of Array.from(wbDoc.getElementsByTagName('sheet'))) {
                sheetEntries.push({ name: el.getAttribute('name'), rId: el.getAttribute('r:id') })
              }
            }

            // Relationship map (rId → worksheet file)
            const relsDoc = await parseXml('xl/_rels/workbook.xml.rels')
            const rIdToTarget = {}
            if (relsDoc) {
              for (const rel of Array.from(relsDoc.getElementsByTagName('Relationship'))) {
                rIdToTarget[rel.getAttribute('Id')] = rel.getAttribute('Target')
              }
            }

            // Column letter → 0-based index (A=0, Z=25, AA=26)
            const colToIdx = (col) => {
              let idx = 0
              for (let i = 0; i < col.length; i++) idx = idx * 26 + (col.charCodeAt(i) - 64)
              return idx - 1
            }

            const sheets = []
            for (let si = 0; si < sheetEntries.length; si++) {
              const entry = sheetEntries[si]
              let target = rIdToTarget[entry.rId]
              if (!target) target = `worksheets/sheet${si + 1}.xml` // fallback
              const sheetDoc = await parseXml(`xl/${target}`)
              if (!sheetDoc) continue

              const rows = []
              for (const rowEl of Array.from(sheetDoc.getElementsByTagName('row'))) {
                const rowData = []
                for (const cell of Array.from(rowEl.getElementsByTagName('c'))) {
                  const ref = cell.getAttribute('r') || ''
                  const colLetters = ref.replace(/\d/g, '')
                  if (colLetters) {
                    const colIdx = colToIdx(colLetters)
                    while (rowData.length < colIdx) rowData.push('')
                  }

                  const type = cell.getAttribute('t')
                  const vEls = cell.getElementsByTagName('v')
                  let value = vEls.length ? vEls[0].textContent : ''

                  if (type === 's') value = sharedStrings[parseInt(value)] || ''
                  else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE'
                  else if (type === 'inlineStr') {
                    const tEls = cell.getElementsByTagName('t')
                    value = tEls.length ? tEls[0].textContent : ''
                  }

                  rowData.push(value)
                }
                rows.push(rowData)
              }
              sheets.push({ name: entry.name, rows })
            }

            result = { sheets }
            break
          }

          case 'workspace.parseDocx': {
            const mammoth = (await import('mammoth')).default || (await import('mammoth'))
            const TurndownService = (await import('turndown')).default || (await import('turndown'))

            const base64 = await invoke('read_file_base64', { path: resolvePath(msg.path) })
            const binary = atob(base64)
            const bytes = new Uint8Array(binary.length)
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

            // Convert images to simple placeholders (skip base64 embedding)
            let imgCount = 0
            const { value: html } = await mammoth.convertToHtml(
              { arrayBuffer: bytes.buffer },
              {
                convertImage: mammoth.images.imgElement(async (image) => {
                  imgCount++
                  return { src: `#figure-${imgCount}`, alt: `Figure ${imgCount}` }
                }),
              }
            )

            // Parse HTML, extract tables + replace images with figure placeholders
            const htmlDoc = new DOMParser().parseFromString(html, 'text/html')

            // Tables → extract data, replace with placeholders
            const tables = []
            Array.from(htmlDoc.querySelectorAll('table')).forEach((tbl, idx) => {
              const rows = []
              for (const tr of Array.from(tbl.querySelectorAll('tr'))) {
                const cells = []
                for (const td of Array.from(tr.querySelectorAll('td, th'))) {
                  cells.push(td.textContent.trim())
                }
                rows.push(cells)
              }
              tables.push({ rows })
              const placeholder = htmlDoc.createElement('p')
              placeholder.textContent = `[TABLE ${idx + 1}]`
              tbl.replaceWith(placeholder)
            })

            // Images → replace with figure placeholders
            let figCount = 0
            Array.from(htmlDoc.querySelectorAll('img')).forEach((img) => {
              figCount++
              const alt = img.getAttribute('alt') || ''
              const placeholder = htmlDoc.createElement('p')
              placeholder.textContent = `[ FIGURE ${figCount}. ${alt} ]`
              img.replaceWith(placeholder)
            })

            const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
            const markdown = turndown.turndown(htmlDoc.body.innerHTML)

            result = { markdown, tables, figures: figCount }
            break
          }
        }

        this._sendToWorker(runId, { type: `${msg.type}.done`, id: msg.id, ...result })
      } catch (e) {
        console.error(`[workflow ${runId}] ${msg.type} error:`, e)
        this._sendToWorker(runId, { type: 'error', id: msg.id, error: e.message })
      }
    },

    // ─── User Interaction Handler ──────────────────────────────────

    _handleInteraction(runId, msg) {
      const run = this.runs[runId]
      if (!run) return

      run.pendingInteraction = {
        type: msg.type,
        id: msg.id,
        prompt: msg.prompt || msg.message || msg.title || '',
        details: msg.details || null,
        schema: msg.schema || null,
      }

      run.messages.push({
        type: 'interaction',
        kind: msg.type.replace('ui.', ''),
        prompt: msg.prompt || msg.message || msg.title || '',
        schema: msg.schema || null,
        details: msg.details || null,
        response: null,
      })
    },

    async respondToInteraction(runId, response) {
      const run = this.runs[runId]
      if (!run || !run.pendingInteraction) return

      const { type, id } = run.pendingInteraction
      let responseMsg = {}

      switch (type) {
        case 'ui.chat':
          responseMsg = { type: 'ui.chat.done', id, text: response }
          break
        case 'ui.confirm':
          responseMsg = { type: 'ui.confirm.done', id, confirmed: response }
          break
        case 'ui.approve':
          responseMsg = { type: 'ui.approve.done', id, result: response }
          break
        case 'ui.form':
          responseMsg = { type: 'ui.form.done', id, values: response }
          break
        case 'ui.pickModel':
          responseMsg = { type: 'ui.pickModel.done', id, modelId: response }
          break
      }

      this._sendToWorker(runId, responseMsg)

      const interactionMsg = [...run.messages].reverse().find(m => m.type === 'interaction' && m.response === null)
      if (interactionMsg) {
        interactionMsg.response = response
      }

      run.pendingInteraction = null
    },

    // ─── Worker Cleanup ───────────────────────────────────────────

    _cleanupWorker(runId) {
      const worker = _workers.get(runId)
      if (worker) {
        worker.terminate()
        _workers.delete(runId)
      }
    },

    // ─── Persistence ──────────────────────────────────────────────

    /** Save a run to .shoulders/workflow-runs/{runId}.json */
    async saveRun(runId) {
      const run = this.runs[runId]
      if (!run) return

      const workspace = useWorkspaceStore()
      const dir = `${workspace.shouldersDir}/workflow-runs`

      const data = {
        id: run.id,
        workflowId: run.workflowId,
        workflowName: run.workflow?.name || run.workflowId,
        workflow: { id: run.workflow?.id || run.workflowId, name: run.workflow?.name || run.workflowId },
        status: run.status,
        inputs: run.inputs,
        messages: run.messages,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        error: run.error,
      }

      try {
        await invoke('write_file', {
          path: `${dir}/${runId}.json`,
          content: JSON.stringify(data, null, 2),
        })

        // Update metadata index
        const existingIdx = this.allRunsMeta.findIndex(m => m.id === runId)
        const meta = {
          id: run.id,
          workflowId: run.workflowId,
          workflowName: run.workflow?.name || run.workflowId,
          status: run.status,
          startedAt: run.startedAt instanceof Date ? run.startedAt.toISOString() : run.startedAt,
          completedAt: run.completedAt instanceof Date ? run.completedAt.toISOString() : run.completedAt,
        }
        if (existingIdx >= 0) {
          this.allRunsMeta[existingIdx] = meta
        } else {
          this.allRunsMeta.push(meta)
        }
      } catch (e) {
        console.warn('Failed to save workflow run:', e)
      }
    },

    /** Load metadata for all saved runs (for HISTORY listing) */
    async loadAllRunsMeta() {
      const workspace = useWorkspaceStore()
      const dir = `${workspace.shouldersDir}/workflow-runs`

      try {
        const exists = await invoke('path_exists', { path: dir })
        if (!exists) { this.allRunsMeta = []; return }

        const entries = await invoke('read_dir_recursive', { path: dir, maxDepth: 1 })
        const meta = []

        for (const entry of entries) {
          if (!entry.path.endsWith('.json')) continue
          try {
            const content = await invoke('read_file', { path: entry.path })
            const data = JSON.parse(content)
            meta.push({
              id: data.id,
              workflowId: data.workflowId,
              workflowName: data.workflowName || data.workflowId,
              status: data.status,
              startedAt: data.startedAt,
              completedAt: data.completedAt,
            })
          } catch {}
        }

        meta.sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt))
        this.allRunsMeta = meta
      } catch (e) {
        console.warn('Failed to load workflow run meta:', e)
        this.allRunsMeta = []
      }
    },

    /** Load a full run from disk into memory */
    async reopenRun(runId) {
      // Already in memory?
      if (this.runs[runId]) return

      const workspace = useWorkspaceStore()
      const path = `${workspace.shouldersDir}/workflow-runs/${runId}.json`

      try {
        const content = await invoke('read_file', { path })
        const data = JSON.parse(content)
        this.runs[runId] = {
          id: data.id,
          workflowId: data.workflowId,
          workflow: data.workflow || { id: data.workflowId, name: data.workflowName },
          status: data.status,
          inputs: data.inputs || {},
          messages: data.messages || [],
          currentStep: null,
          streamingText: '',
          startedAt: data.startedAt,
          completedAt: data.completedAt,
          error: data.error,
          pendingInteraction: null,
        }
      } catch (e) {
        console.warn('Failed to reopen workflow run:', e)
      }
    },

    /** Remove a run from in-memory state (after archiving) */
    _removeRunFromMemory(runId) {
      this._cleanupWorker(runId)
      delete this.runs[runId]
    },

    cleanup() {
      for (const [runId, run] of Object.entries(this.runs)) {
        if (run.status === 'running') {
          this._cleanupWorker(runId)
        }
      }
      this.runs = {}
      this.workflows = []
      this.allRunsMeta = []
    },
  },
})
