import { defineStore } from 'pinia'
import { streamText, stepCountIs } from 'ai'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { resolveApiAccess } from '../services/apiClient'
import { getAiTools } from '../services/chatTools'
import { getThinkingConfig } from '../services/chatModels'
import { buildBaseSystemPrompt } from '../services/systemPrompt'
import { calculateCost } from '../services/tokenUsage'
import { noApiKeyMessage, formatChatApiError } from '../utils/errorMessages'
import { createModel, buildProviderOptions, convertSdkUsage } from '../services/aiSdk'
import { createTauriFetch } from '../services/tauriFetch'

const MAX_UNDO = 50
const PASSTHROUGH_THRESHOLD = 200

/**
 * Stateful content filter that parses <node-content> and <node-title> tags.
 */
function createContentFilter() {
  let raw = ''
  let display = ''
  let title = null
  let insideContent = false
  let passthrough = false

  function push(text) {
    raw += text
    if (passthrough) {
      display += text
      return
    }
    if (!insideContent && !passthrough && raw.length > PASSTHROUGH_THRESHOLD && !raw.includes('<node-content>')) {
      passthrough = true
      display = raw
      return
    }
    reparse()
  }

  function reparse() {
    display = ''
    title = null
    let inContent = false
    let buf = raw
    let pos = 0

    while (pos < buf.length) {
      if (!inContent) {
        const openIdx = buf.indexOf('<node-content>', pos)
        if (openIdx === -1) break
        inContent = true
        pos = openIdx + '<node-content>'.length
      } else {
        const closeIdx = buf.indexOf('</node-content>', pos)
        if (closeIdx === -1) {
          display += buf.slice(pos)
          break
        }
        display += buf.slice(pos, closeIdx)
        inContent = false
        pos = closeIdx + '</node-content>'.length
      }
    }

    insideContent = inContent

    const titleMatch = display.match(/<node-title>([\s\S]*?)<\/node-title>/)
    if (titleMatch) {
      title = titleMatch[1].trim()
      display = display.replace(/<node-title>[\s\S]*?<\/node-title>/, '').trim()
    }
  }

  return {
    push,
    getDisplay() { return display },
    getRaw() { return raw },
    getTitle() { return title },
  }
}

export const useCanvasStore = defineStore('canvas', {
  state: () => ({
    filePath: null,
    aiState: { messages: {} },
    undoStack: [],
    redoStack: [],
    streamingNodeId: null,
    contextHighlightIds: [],
    _editor: null,
    _abortController: null,
  }),

  actions: {
    load(filePath, data) {
      this.filePath = filePath
      this.aiState = data.aiState || { messages: {} }
      this.undoStack = []
      this.redoStack = []
      this.streamingNodeId = null
      this.contextHighlightIds = []
    },

    unload() {
      if (this._abortController) this._abortController.abort()
      this.filePath = null
      this.aiState = { messages: {} }
      this.undoStack = []
      this.redoStack = []
      this.streamingNodeId = null
      this.contextHighlightIds = []
      this._editor = null
      this._abortController = null
    },

    setEditorMethods(methods) {
      this._editor = methods
    },

    syncFromEditor(nodes, edges, viewport) {
      // Called after save
    },

    // --- Undo / Redo ---

    pushSnapshot(nodes, edges) {
      const snapshot = {
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      }
      this.undoStack.push(snapshot)
      if (this.undoStack.length > MAX_UNDO) this.undoStack.shift()
      this.redoStack = []
    },

    undo() {
      if (this.undoStack.length === 0) return null
      const current = this.undoStack.pop()
      if (this._editor) {
        const currentState = {
          nodes: JSON.parse(JSON.stringify(this._editor.getNodes())),
          edges: JSON.parse(JSON.stringify(this._editor.getEdges())),
        }
        this.redoStack.push(currentState)
      }
      return current
    },

    redo() {
      if (this.redoStack.length === 0) return null
      const snapshot = this.redoStack.pop()
      if (this._editor) {
        const currentState = {
          nodes: JSON.parse(JSON.stringify(this._editor.getNodes())),
          edges: JSON.parse(JSON.stringify(this._editor.getEdges())),
        }
        this.undoStack.push(currentState)
      }
      return snapshot
    },

    // --- AI Streaming (AI SDK) ---

    async sendPrompt(promptNodeId) {
      if (!this._editor || this.streamingNodeId) return

      const nodes = this._editor.getNodes()
      const edges = this._editor.getEdges()
      const promptNode = nodes.find(n => n.id === promptNodeId)
      if (!promptNode || promptNode.type !== 'prompt') return

      const workspace = useWorkspaceStore()
      const modelId = promptNode.data.modelId || workspace.selectedModelId || 'sonnet'
      const access = await resolveApiAccess({ modelId }, workspace)
      if (!access) {
        this._editor.addTextNode(
          { x: promptNode.position.x, y: promptNode.position.y + 160 },
          { content: noApiKeyMessage(modelId), aiGenerated: true }
        )
        return
      }

      // Collect DAG path
      const { collectDagPath, buildApiMessagesFromDag, buildGraphSummary } = await import('../services/canvasMessages')
      const path = collectDagPath(promptNodeId, nodes, edges)

      // Increment run count
      promptNode.data.runCount = (promptNode.data.runCount || 0) + 1
      const versionLabel = promptNode.data.runCount > 1 ? `v${promptNode.data.runCount}` : null

      // Create response text node
      const childY = promptNode.position.y + 160
      const childX = promptNode.position.x + (promptNode.data.runCount > 1 ? (promptNode.data.runCount - 1) * 60 : 0)

      const childId = this._editor.addTextNode(
        { x: childX, y: childY },
        { content: '', aiGenerated: true, versionLabel, _streaming: true, width: 320 }
      )

      edges.push({
        id: `e_${nanoid(8)}`,
        source: promptNodeId,
        target: childId,
        type: 'smoothstep',
      })

      this.streamingNodeId = childId

      // Build messages from DAG path
      const apiMessages = buildApiMessagesFromDag(path, nodes, this.aiState)

      // Build system prompt
      let system = buildBaseSystemPrompt(workspace)
      if (workspace.systemPrompt) system += '\n\n' + workspace.systemPrompt
      if (workspace.instructions) system += '\n\n' + workspace.instructions
      const graphSummary = buildGraphSummary(nodes, edges)
      if (graphSummary) system += '\n\n# Canvas Context\n' + graphSummary
      system += '\n\n# Canvas Output Format\nWhen responding on the canvas, wrap your visible response in <node-content> tags. Think and plan outside the tags — only content inside <node-content>...</node-content> appears in the node. Optionally start with <node-title>Your Title</node-title> inside the content block to set the node title.'

      // Build model + tools
      const tauriFetch = createTauriFetch()
      const model = createModel(access, tauriFetch)
      const provider = access.providerHint || access.provider
      const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === modelId)
      const thinkingConfig = getThinkingConfig(access.model, provider, modelEntry?.thinking)
      const providerOptions = buildProviderOptions(thinkingConfig, provider)
      const tools = getAiTools(workspace)

      const abortController = new AbortController()
      this._abortController = abortController

      const contentFilter = createContentFilter()
      let fullContent = ''

      try {
        const result = streamText({
          model,
          system,
          messages: apiMessages,
          tools,
          stopWhen: stepCountIs(5),
          providerOptions,
          abortSignal: abortController.signal,
          onStepFinish({ usage, providerMetadata }) {
            if (usage) {
              const normalized = convertSdkUsage(usage, providerMetadata, provider)
              normalized.cost = calculateCost(normalized, access.model)
              import('./usage').then(({ useUsageStore }) => {
                useUsageStore().record({
                  usage: normalized, feature: 'canvas',
                  provider, modelId: access.model,
                })
              }).catch(() => {})
              if (access.provider === 'shoulders') workspace.refreshShouldersBalance()
            }
          },
        })

        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              fullContent += part.textDelta
              contentFilter.push(part.textDelta)
              // Update node with filtered content
              const updateData = { content: contentFilter.getDisplay() }
              const autoTitle = contentFilter.getTitle()
              if (autoTitle) updateData.title = autoTitle
              this._editor.updateNodeData(childId, updateData)
              break

            case 'error':
              this._editor.updateNodeData(childId, {
                content: contentFilter.getDisplay() + '\n\n' + formatChatApiError(part.error?.message || String(part.error)),
                _streaming: false,
              })
              break
          }
        }

        // Stream finished
        this._editor.updateNodeData(childId, { _streaming: false })
        this.aiState.messages[childId] = { role: 'assistant', content: fullContent }
        this.streamingNodeId = null
        this._editor.scheduleSave()
      } catch (e) {
        if (e.name === 'AbortError' || abortController.signal.aborted) {
          this._editor.updateNodeData(childId, { _streaming: false })
        } else {
          this._editor.updateNodeData(childId, {
            content: contentFilter.getDisplay() + '\n\n' + formatChatApiError(e.message || String(e)),
            _streaming: false,
          })
        }
        this.streamingNodeId = null
        this._editor.scheduleSave()
      } finally {
        this._abortController = null
      }
    },

    async abortStreaming() {
      if (!this.streamingNodeId) return
      if (this._abortController) this._abortController.abort()
      this._editor?.updateNodeData(this.streamingNodeId, { _streaming: false })
      this.streamingNodeId = null
    },

    // --- Context highlighting ---

    async highlightContext(promptNodeId) {
      if (!this._editor) return
      const { collectDagPath } = await import('../services/canvasMessages')
      const nodes = this._editor.getNodes()
      const edges = this._editor.getEdges()
      const path = collectDagPath(promptNodeId, nodes, edges)
      this.contextHighlightIds = path.map(n => n.id)

      for (const node of nodes) {
        const isHighlighted = this.contextHighlightIds.includes(node.id)
        if (node.data._contextHighlight !== isHighlighted) {
          this._editor.updateNodeData(node.id, { _contextHighlight: isHighlighted })
        }
      }
    },

    clearContextHighlight() {
      if (!this._editor) return
      const nodes = this._editor.getNodes()
      for (const node of nodes) {
        if (node.data._contextHighlight) {
          this._editor.updateNodeData(node.id, { _contextHighlight: false })
        }
      }
      this.contextHighlightIds = []
    },
  },
})
