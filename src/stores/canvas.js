import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { formatRequest, parseSSEChunk, interpretEvent } from '../services/chatProvider'
import { resolveApiAccess } from '../services/apiClient'
import { getToolDefinitions, executeSingleTool } from '../services/chatTools'
import { getContextWindow, getThinkingConfig } from '../services/chatModels'
import { buildBaseSystemPrompt } from '../services/systemPrompt'
import { normalizeUsage, mergeUsage, calculateCost, createEmptyUsage } from '../services/tokenUsage'
import { noApiKeyMessage, formatChatApiError, formatInvokeError } from '../utils/errorMessages'

const MAX_UNDO = 50
const PASSTHROUGH_THRESHOLD = 200 // chars before falling back to passthrough

/**
 * Creates a stateful content filter that parses <node-content> and <node-title> tags.
 * Returns { push(text), getDisplay(), getRaw(), getTitle() }
 */
function createContentFilter() {
  let raw = ''
  let display = ''
  let title = null
  let insideContent = false
  let passthrough = false // fallback: no tags found within threshold

  function push(text) {
    raw += text
    if (passthrough) {
      display += text
      return
    }

    // Check for passthrough fallback
    if (!insideContent && !passthrough && raw.length > PASSTHROUGH_THRESHOLD && !raw.includes('<node-content>')) {
      passthrough = true
      display = raw
      return
    }

    // Scan for tags in the full raw buffer each time
    // This handles partial tag delivery across chunks
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
          // Still inside, take rest
          display += buf.slice(pos)
          break
        }
        display += buf.slice(pos, closeIdx)
        inContent = false
        pos = closeIdx + '</node-content>'.length
      }
    }

    insideContent = inContent

    // Extract <node-title> from display
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
    // Editor methods — set by CanvasEditor.vue
    _editor: null,
    // Streaming state
    _unlistenChunk: null,
    _unlistenDone: null,
    _unlistenError: null,
    _sseBuffer: '',
    _currentToolInputJson: {},
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
      this._cleanupListeners()
      this.filePath = null
      this.aiState = { messages: {} }
      this.undoStack = []
      this.redoStack = []
      this.streamingNodeId = null
      this.contextHighlightIds = []
      this._editor = null
    },

    setEditorMethods(methods) {
      this._editor = methods
    },

    syncFromEditor(nodes, edges, viewport) {
      // Called after save — keep store in sync
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
      // The snapshot we popped is the state BEFORE the last action,
      // so we need to save current state to redo stack first
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
      // Save current state to undo stack
      if (this._editor) {
        const currentState = {
          nodes: JSON.parse(JSON.stringify(this._editor.getNodes())),
          edges: JSON.parse(JSON.stringify(this._editor.getEdges())),
        }
        this.undoStack.push(currentState)
      }
      return snapshot
    },

    // --- AI Streaming ---

    async sendPrompt(promptNodeId) {
      if (!this._editor || this.streamingNodeId) return

      const nodes = this._editor.getNodes()
      const edges = this._editor.getEdges()
      const promptNode = nodes.find(n => n.id === promptNodeId)
      if (!promptNode || promptNode.type !== 'prompt') return

      const workspace = useWorkspaceStore()

      // Resolve API access
      const modelId = promptNode.data.modelId || workspace.selectedModelId || 'sonnet'
      const access = await resolveApiAccess({ modelId }, workspace)
      if (!access) {
        // Create error text node
        this._editor.addTextNode(
          { x: promptNode.position.x, y: promptNode.position.y + 160 },
          { content: noApiKeyMessage(modelId), aiGenerated: true }
        )
        return
      }

      // Collect DAG path (walk edges backward from prompt to root)
      const { collectDagPath, buildApiMessagesFromDag, buildGraphSummary } = await import('../services/canvasMessages')
      const path = collectDagPath(promptNodeId, nodes, edges)

      // Increment run count
      promptNode.data.runCount = (promptNode.data.runCount || 0) + 1
      const versionLabel = promptNode.data.runCount > 1 ? `v${promptNode.data.runCount}` : null

      // Create response text node
      const childY = promptNode.position.y + 160
      // Offset children horizontally if multiple runs
      const childX = promptNode.position.x + (promptNode.data.runCount > 1 ? (promptNode.data.runCount - 1) * 60 : 0)

      const childId = this._editor.addTextNode(
        { x: childX, y: childY },
        {
          content: '',
          aiGenerated: true,
          versionLabel,
          _streaming: true,
          width: 320,
        }
      )

      // Connect prompt → child
      edges.push({
        id: `e_${nanoid(8)}`,
        source: promptNodeId,
        target: childId,
        type: 'smoothstep',
      })

      this.streamingNodeId = childId

      // Build messages from DAG path
      const apiMessages = buildApiMessagesFromDag(path, nodes, this.aiState)

      // Build system prompt with graph summary
      let system = buildBaseSystemPrompt(workspace)
      if (workspace.systemPrompt) system += '\n\n' + workspace.systemPrompt
      if (workspace.instructions) system += '\n\n' + workspace.instructions
      const graphSummary = buildGraphSummary(nodes, edges)
      if (graphSummary) system += '\n\n# Canvas Context\n' + graphSummary

      // Canvas output formatting instruction
      system += '\n\n# Canvas Output Format\nWhen responding on the canvas, wrap your visible response in <node-content> tags. Think and plan outside the tags — only content inside <node-content>...</node-content> appears in the node. Optionally start with <node-title>Your Title</node-title> inside the content block to set the node title.'

      const { provider } = access
      const tools = getToolDefinitions(workspace)
      const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === modelId)
      const thinkingConfig = getThinkingConfig(access.model, access.provider, modelEntry?.thinking)

      try {
        const request = formatRequest(provider, {
          url: access.url,
          apiKey: access.apiKey,
          model: access.model,
          messages: apiMessages,
          system,
          tools,
          maxTokens: thinkingConfig ? 32768 : 16384,
          providerHint: access.providerHint,
          thinking: thinkingConfig,
        })

        this._cleanupListeners()
        this._sseBuffer = ''
        this._currentToolInputJson = {}

        let assistantContent = ''
        const contentFilter = createContentFilter()
        let currentToolCall = null
        let toolCalls = []
        let usageAccumulator = createEmptyUsage()

        const sessionId = childId

        this._unlistenChunk = await listen(`chat-chunk-${sessionId}`, (event) => {
          const raw = event.payload?.data
          if (!raw) return

          const { events, remainingBuffer } = parseSSEChunk(provider, raw, this._sseBuffer)
          this._sseBuffer = remainingBuffer

          for (const evt of events) {
            const rawInterpreted = interpretEvent(provider, evt)
            if (!rawInterpreted) continue
            const interpretedList = Array.isArray(rawInterpreted) ? rawInterpreted : [rawInterpreted]

            for (const interpreted of interpretedList) {
              if (interpreted.usage) {
                const partial = normalizeUsage(provider, interpreted.usage)
                usageAccumulator = mergeUsage(usageAccumulator, partial)
              }

              switch (interpreted.type) {
                case 'text_delta':
                  assistantContent += interpreted.text
                  contentFilter.push(interpreted.text)
                  // Update node with filtered content
                  const updateData = { content: contentFilter.getDisplay() }
                  const autoTitle = contentFilter.getTitle()
                  if (autoTitle) updateData.title = autoTitle
                  this._editor.updateNodeData(childId, updateData)
                  break

                case 'block_start':
                  if (interpreted.blockType === 'tool_use') {
                    const tc = {
                      id: interpreted.toolId || `tool-${nanoid()}`,
                      name: interpreted.toolName,
                      input: {},
                      output: '',
                      status: 'pending',
                    }
                    toolCalls.push(tc)
                    currentToolCall = tc
                    this._currentToolInputJson[tc.id] = ''
                  }
                  break

                case 'tool_input_delta':
                  if (currentToolCall) {
                    this._currentToolInputJson[currentToolCall.id] =
                      (this._currentToolInputJson[currentToolCall.id] || '') + interpreted.json
                  }
                  break

                case 'block_stop':
                  if (currentToolCall) {
                    try {
                      currentToolCall.input = JSON.parse(this._currentToolInputJson[currentToolCall.id] || '{}')
                    } catch { currentToolCall.input = {} }
                    currentToolCall = null
                  }
                  break

                case 'message_delta':
                  if (interpreted.stopReason === 'tool_use') {
                    // Record usage
                    usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
                    import('./usage').then(({ useUsageStore }) => {
                      useUsageStore().record({ usage: usageAccumulator, feature: 'canvas', provider, modelId: access.model })
                    })
                    this._cleanupListeners()
                    // Execute tools then continue
                    this._executeToolCalls(toolCalls, sessionId, apiMessages, assistantContent, access, system, tools, workspace).catch(e => {
                      console.error('[canvas] Tool execution failed:', e)
                      this._editor.updateNodeData(childId, { content: assistantContent + '\n\n*Tool execution failed*', _streaming: false })
                      this.streamingNodeId = null
                    })
                    return
                  }
                  if (interpreted.stopReason === 'end_turn') {
                    this._finishStreaming(childId, assistantContent, usageAccumulator, access, provider)
                  }
                  break

                case 'message_stop':
                  this._finishStreaming(childId, assistantContent, usageAccumulator, access, provider)
                  break

                case 'google_tool_call':
                  toolCalls.push({
                    id: `tool-${nanoid()}`,
                    name: interpreted.toolName,
                    input: interpreted.toolInput || {},
                    output: '',
                    status: 'pending',
                  })
                  break
              }
            }
          }
        })

        this._unlistenDone = await listen(`chat-done-${sessionId}`, () => {
          if (usageAccumulator.total > 0) {
            usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
            import('./usage').then(({ useUsageStore }) => {
              useUsageStore().record({ usage: usageAccumulator, feature: 'canvas', provider, modelId: access.model })
            })
          }

          // Check for pending tool calls
          const hasPending = toolCalls.some(tc => tc.status === 'pending')
          if (hasPending) {
            this._cleanupListeners()
            this._executeToolCalls(toolCalls, sessionId, apiMessages, assistantContent, access, system, tools, workspace).catch(e => {
              console.error('[canvas] Tool execution failed:', e)
              this._finishStreaming(childId, assistantContent, usageAccumulator, access, provider)
            })
          } else {
            this._finishStreaming(childId, assistantContent, usageAccumulator, access, provider)
          }
        })

        this._unlistenError = await listen(`chat-error-${sessionId}`, (event) => {
          const errText = formatChatApiError(event.payload?.error)
          this._editor.updateNodeData(childId, {
            content: assistantContent + '\n\n' + errText,
            _streaming: false,
          })
          this.streamingNodeId = null
          this._cleanupListeners()
          this._editor.scheduleSave()
        })

        // Fire the request
        await invoke('chat_stream', {
          sessionId,
          request: {
            url: request.url,
            headers: request.headers,
            body: request.body,
          },
        })
      } catch (e) {
        this._editor.updateNodeData(childId, {
          content: formatInvokeError(e),
          _streaming: false,
        })
        this.streamingNodeId = null
        this._cleanupListeners()
      }
    },

    _finishStreaming(childId, content, usageAccumulator, access, provider) {
      this._editor.updateNodeData(childId, { _streaming: false })

      // Save AI state
      this.aiState.messages[childId] = { role: 'assistant', content }

      this.streamingNodeId = null
      this._cleanupListeners()
      this._editor.scheduleSave()
    },

    async _executeToolCalls(toolCalls, sessionId, apiMessages, assistantContent, access, system, tools, workspace) {
      for (const tc of toolCalls) {
        if (tc.status !== 'pending') continue
        tc.status = 'running'
        try {
          const result = await executeSingleTool(tc.name, tc.input, workspace)
          tc.output = typeof result === 'string' ? result : String(result ?? '')
          tc.status = 'done'
        } catch (e) {
          tc.output = String(e)
          tc.status = 'error'
        }
      }

      // Build tool result messages and continue streaming
      const toolResultBlocks = toolCalls.map(tc => ({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: tc.output || '',
        ...(tc.status === 'error' ? { is_error: true } : {}),
      }))

      // Build new messages array with assistant response + tool results
      const newMessages = [
        ...apiMessages,
        {
          role: 'assistant',
          content: [
            ...(assistantContent ? [{ type: 'text', text: assistantContent }] : []),
            ...toolCalls.map(tc => ({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: tc.input,
            })),
          ],
        },
        {
          role: 'user',
          content: toolResultBlocks,
        },
      ]

      // Re-stream
      const { provider } = access
      const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === access.model)
      const thinkingConfig = getThinkingConfig(access.model, access.provider, modelEntry?.thinking)

      const request = formatRequest(provider, {
        url: access.url,
        apiKey: access.apiKey,
        model: access.model,
        messages: newMessages,
        system,
        tools,
        maxTokens: thinkingConfig ? 32768 : 16384,
        providerHint: access.providerHint,
        thinking: thinkingConfig,
      })

      this._cleanupListeners()
      this._sseBuffer = ''
      this._currentToolInputJson = {}

      let newContent = assistantContent
      const newFilter = createContentFilter()
      // Seed filter with any prior content
      if (assistantContent) newFilter.push(assistantContent)
      let newToolCalls = []
      let currentToolCall = null
      let usageAccumulator = createEmptyUsage()
      const childId = this.streamingNodeId

      this._unlistenChunk = await listen(`chat-chunk-${sessionId}`, (event) => {
        const raw = event.payload?.data
        if (!raw) return

        const { events, remainingBuffer } = parseSSEChunk(provider, raw, this._sseBuffer)
        this._sseBuffer = remainingBuffer

        for (const evt of events) {
          const rawInterpreted = interpretEvent(provider, evt)
          if (!rawInterpreted) continue
          const interpretedList = Array.isArray(rawInterpreted) ? rawInterpreted : [rawInterpreted]

          for (const interpreted of interpretedList) {
            if (interpreted.usage) {
              const partial = normalizeUsage(provider, interpreted.usage)
              usageAccumulator = mergeUsage(usageAccumulator, partial)
            }

            switch (interpreted.type) {
              case 'text_delta':
                newContent += interpreted.text
                newFilter.push(interpreted.text)
                const updateData2 = { content: newFilter.getDisplay() }
                const autoTitle2 = newFilter.getTitle()
                if (autoTitle2) updateData2.title = autoTitle2
                this._editor.updateNodeData(childId, updateData2)
                break

              case 'message_delta':
              case 'message_stop':
                if (interpreted.stopReason === 'end_turn' || interpreted.type === 'message_stop') {
                  this._finishStreaming(childId, newContent, usageAccumulator, access, provider)
                }
                break
            }
          }
        }
      })

      this._unlistenDone = await listen(`chat-done-${sessionId}`, () => {
        if (usageAccumulator.total > 0) {
          usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
          import('./usage').then(({ useUsageStore }) => {
            useUsageStore().record({ usage: usageAccumulator, feature: 'canvas', provider, modelId: access.model })
          })
        }
        this._finishStreaming(childId, newContent, usageAccumulator, access, provider)
      })

      this._unlistenError = await listen(`chat-error-${sessionId}`, (event) => {
        this._editor.updateNodeData(childId, {
          content: newContent + '\n\n' + formatChatApiError(event.payload?.error),
          _streaming: false,
        })
        this.streamingNodeId = null
        this._cleanupListeners()
        this._editor.scheduleSave()
      })

      await invoke('chat_stream', {
        sessionId,
        request: {
          url: request.url,
          headers: request.headers,
          body: request.body,
        },
      })
    },

    async abortStreaming() {
      if (!this.streamingNodeId) return
      const sessionId = this.streamingNodeId
      await invoke('chat_abort', { sessionId }).catch(() => {})
      this._editor.updateNodeData(sessionId, { _streaming: false })
      this.streamingNodeId = null
      this._cleanupListeners()
    },

    // --- Context highlighting ---

    async highlightContext(promptNodeId) {
      if (!this._editor) return
      const { collectDagPath } = await import('../services/canvasMessages')
      const nodes = this._editor.getNodes()
      const edges = this._editor.getEdges()
      const path = collectDagPath(promptNodeId, nodes, edges)
      this.contextHighlightIds = path.map(n => n.id)

      // Update node data to reflect highlighting
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

    _cleanupListeners() {
      if (this._unlistenChunk) { this._unlistenChunk(); this._unlistenChunk = null }
      if (this._unlistenDone) { this._unlistenDone(); this._unlistenDone = null }
      if (this._unlistenError) { this._unlistenError(); this._unlistenError = null }
    },
  },
})
