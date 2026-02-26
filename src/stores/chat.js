import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { formatRequest, parseSSEChunk, interpretEvent } from '../services/chatProvider'
import { resolveApiAccess } from '../services/apiClient'
import { getToolDefinitions, executeSingleTool } from '../services/chatTools'
import { buildApiMessages, buildApiMessagesWithToolResults } from '../services/chatMessages'
import { getContextWindow, getThinkingConfig } from '../services/chatModels'
import { estimateConversationTokens, truncateToFitBudget } from '../services/tokenEstimator'
import { buildBaseSystemPrompt } from '../services/systemPrompt'
import { normalizeUsage, mergeUsage, calculateCost, createEmptyUsage } from '../services/tokenUsage'
import { noApiKeyMessage, formatChatApiError, formatInvokeError } from '../utils/errorMessages'

export const useChatStore = defineStore('chat', {
  state: () => ({
    sessions: [],
    activeSessionId: null,
    allSessionsMeta: [], // [{ id, label, updatedAt, messageCount }] — all persisted sessions
  }),

  getters: {
    activeSession(state) {
      return state.sessions.find(s => s.id === state.activeSessionId) || null
    },
    streamingCount(state) {
      return state.sessions.filter(s => s.status === 'streaming' && s._background).length
    },
  },

  actions: {
    createSession(modelId) {
      const workspace = useWorkspaceStore()
      const configDefault = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
      const defaultModel = workspace.selectedModelId || configDefault
      const id = nanoid(12)
      const session = {
        id,
        label: `Chat ${this.sessions.length + 1}`,
        modelId: modelId || defaultModel,
        messages: [],
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Runtime-only
        _unlistenChunk: null,
        _unlistenDone: null,
        _unlistenError: null,
        _sseBuffer: '',
        _currentToolInputJson: {},
      }
      this.sessions.push(session)
      this.activeSessionId = id
      return id
    },

    deleteSession(id) {
      const session = this.sessions.find(s => s.id === id)
      if (!session) return

      // Abort if streaming
      if (session.status === 'streaming') {
        invoke('chat_abort', { sessionId: id }).catch(() => {})
      }
      this._cleanupListeners(session)
      invoke('chat_cleanup', { sessionId: id }).catch(() => {})

      const idx = this.sessions.indexOf(session)
      this.sessions.splice(idx, 1)

      // Delete persisted file
      const workspace = useWorkspaceStore()
      if (workspace.shouldersDir) {
        invoke('delete_path', { path: `${workspace.shouldersDir}/chats/${id}.json` }).catch(() => {})
      }

      // Update active
      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions.length > 0 ? this.sessions[this.sessions.length - 1].id : null
      }
    },

    async reopenSession(id) {
      // If this session is streaming in background, bring it back to foreground
      const existing = this.sessions.find(s => s.id === id)
      if (existing) {
        if (existing._background) {
          existing._background = false
        }
        this.activeSessionId = id
        return
      }

      // Archive current chat first (same logic as archiveAndNewChat)
      await this._archiveCurrent()

      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      try {
        const content = await invoke('read_file', { path: `${workspace.shouldersDir}/chats/${id}.json` })
        const data = JSON.parse(content)
        // Restore runtime fields
        data._unlistenChunk = null
        data._unlistenDone = null
        data._unlistenError = null
        data._sseBuffer = ''
        data._currentToolInputJson = {}
        data.status = 'idle'
        this.sessions.push(data)
        this.activeSessionId = id
      } catch (e) {
        console.warn('Failed to reopen session:', e)
      }
    },

    async loadAllSessionsMeta() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      const chatsDir = `${workspace.shouldersDir}/chats`
      try {
        const exists = await invoke('path_exists', { path: chatsDir })
        if (!exists) return

        const entries = await invoke('read_dir_recursive', { path: chatsDir })
        const jsonFiles = entries.filter(e => !e.is_dir && e.name.endsWith('.json'))

        const meta = []
        for (const file of jsonFiles) {
          try {
            const content = await invoke('read_file', { path: file.path })
            const data = JSON.parse(content)
            meta.push({
              id: data.id,
              label: data.label || 'Untitled',
              updatedAt: data.updatedAt || data.createdAt,
              messageCount: data.messages?.length || 0,
            })
          } catch (e) {
            // Skip corrupt files
          }
        }

        meta.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
        this.allSessionsMeta = meta
      } catch (e) {
        console.warn('Failed to load session meta:', e)
      }
    },

    setActiveSession(id) {
      this.activeSessionId = id
    },

    async archiveAndNewChat() {
      const active = this.activeSession
      // Empty chat → no-op
      if (!active || active.messages.length === 0) return

      await this._archiveCurrent()
      this.createSession()
    },

    async _archiveCurrent() {
      const active = this.activeSession
      if (!active || active.messages.length === 0) return

      if (active.status === 'streaming') {
        // Keep streaming in background — listeners stay alive
        active._background = true
      } else {
        // Save and remove from sessions array
        await this.saveSession(active.id)
        this._removeFromSessions(active.id)
      }
    },

    _removeFromSessions(id) {
      const session = this.sessions.find(s => s.id === id)
      if (!session) return
      this._cleanupListeners(session)
      invoke('chat_cleanup', { sessionId: id }).catch(() => {})
      const idx = this.sessions.indexOf(session)
      this.sessions.splice(idx, 1)
    },

    async sendMessage(sessionId, { text, fileRefs, context }) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (!session || session.status === 'streaming') return

      // Budget gate — block at 100%
      const { useUsageStore } = await import('./usage')
      if (useUsageStore().isOverBudget) {
        session.messages.push({
          id: `msg-${nanoid()}`, role: 'assistant',
          content: 'Monthly budget reached. Change your budget in Settings > Models to continue.',
          fileRefs: [], context: null, toolCalls: [], thinking: null,
          status: 'error', createdAt: new Date().toISOString(),
        })
        return
      }

      // Auto-label on first message
      if (session.messages.length === 0 && text) {
        session.label = text.slice(0, 40).replace(/\n/g, ' ').trim()
      }

      const userMsg = {
        id: `msg-${nanoid()}`,
        role: 'user',
        content: text || '',
        fileRefs: fileRefs || [],
        context: context || null,
        toolCalls: [],
        thinking: null,
        status: 'complete',
        createdAt: new Date().toISOString(),
      }

      session.messages.push(userMsg)
      session.updatedAt = new Date().toISOString()

      const workspace = useWorkspaceStore()
      const access = await resolveApiAccess({ modelId: session.modelId }, workspace)
      const provider = access?.provider || 'anthropic'
      const apiMessages = await buildApiMessages(session, provider)
      await this._streamResponse(session, apiMessages)
    },

    async abortSession(sessionId) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (!session || session.status !== 'streaming') return
      await invoke('chat_abort', { sessionId })
    },

    // --- Streaming orchestration ---

    async _streamResponse(session, apiMessages) {
      const workspace = useWorkspaceStore()
      const access = await resolveApiAccess({ modelId: session.modelId }, workspace)
      if (!access) {
        const errMsg = {
          id: `msg-${nanoid()}`,
          role: 'assistant',
          content: noApiKeyMessage(session.modelId),
          fileRefs: [],
          context: null,
          toolCalls: [],
          thinking: null,
          status: 'error',
          createdAt: new Date().toISOString(),
        }
        session.messages.push(errMsg)
        return
      }

      // Create assistant message placeholder
      session.messages.push({
        id: `msg-${nanoid()}`,
        role: 'assistant',
        content: '',
        fileRefs: [],
        context: null,
        toolCalls: [],
        thinking: null,
        _thinkingBlocks: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      })
      // IMPORTANT: get reactive proxy reference, not the raw object
      const assistantMsg = session.messages[session.messages.length - 1]
      session.status = 'streaming'
      session._sseBuffer = ''
      session._currentToolInputJson = {}

      // Build system prompt
      let system = buildBaseSystemPrompt(workspace)
      if (workspace.systemPrompt) system += '\n\n' + workspace.systemPrompt
      if (workspace.instructions) system += '\n\n' + workspace.instructions

      // Token budget: estimate, truncate if needed, store on session
      const contextWindow = getContextWindow(session.modelId, workspace)
      const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === session.modelId)
      const thinkingConfig = getThinkingConfig(access.model, access.provider, modelEntry?.thinking)
      const outputReserve = thinkingConfig ? 32768 : 16384
      const maxBudget = contextWindow - outputReserve
      let estimated = estimateConversationTokens(system, apiMessages)
      if (estimated > maxBudget) {
        apiMessages = truncateToFitBudget(apiMessages, maxBudget, system)
        estimated = estimateConversationTokens(system, apiMessages)
      }
      session._estimatedTokens = estimated

      const tools = getToolDefinitions(workspace)
      const { provider } = access

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

        // Setup listeners
        this._cleanupListeners(session)

        let currentBlockType = null
        let currentToolCall = null
        let currentThinkingBlock = null
        let usageAccumulator = createEmptyUsage()

        session._unlistenChunk = await listen(`chat-chunk-${session.id}`, (event) => {
          const raw = event.payload?.data
          if (!raw) return

          const { events, remainingBuffer } = parseSSEChunk(provider, raw, session._sseBuffer)
          session._sseBuffer = remainingBuffer

          for (const evt of events) {
            const rawInterpreted = interpretEvent(provider, evt)
            if (!rawInterpreted) continue
            // Google returns arrays (multiple parts per chunk), others return single events
            const interpretedList = Array.isArray(rawInterpreted) ? rawInterpreted : [rawInterpreted]

            for (const interpreted of interpretedList) {

            // Accumulate token usage from any event that carries it
            if (interpreted.usage) {
              const partial = normalizeUsage(provider, interpreted.usage)
              usageAccumulator = mergeUsage(usageAccumulator, partial)
            }

            switch (interpreted.type) {
              case 'usage':
                // Usage-only event (e.g. OpenAI final chunk) — already captured above
                break

              case 'block_start':
                currentBlockType = interpreted.blockType
                if (interpreted.blockType === 'tool_use') {
                  assistantMsg.toolCalls.push({
                    id: interpreted.toolId || `tool-${nanoid()}`,
                    name: interpreted.toolName,
                    input: {},
                    output: '',
                    status: 'pending',
                    _googleThoughtSignature: interpreted.thoughtSignature || null,
                  })
                  // Get reactive proxy reference
                  currentToolCall = assistantMsg.toolCalls[assistantMsg.toolCalls.length - 1]
                  session._currentToolInputJson[currentToolCall.id] = ''
                } else if (interpreted.blockType === 'thinking') {
                  currentThinkingBlock = { type: 'thinking', thinking: '', signature: null }
                }
                break

              case 'text_delta':
                assistantMsg.content += interpreted.text
                break

              case 'thinking_delta':
                if (!assistantMsg.thinking) assistantMsg.thinking = ''
                assistantMsg.thinking += interpreted.text
                // Auto-create thinking block for non-Anthropic (no block_start/block_stop)
                if (!currentThinkingBlock && (provider === 'google' || provider === 'openai')) {
                  currentThinkingBlock = { type: 'thinking', thinking: '', signature: null }
                }
                if (currentThinkingBlock) currentThinkingBlock.thinking += interpreted.text
                break

              case 'signature_delta':
                if (currentThinkingBlock) currentThinkingBlock.signature = interpreted.signature
                break

              case 'tool_input_delta':
                if (currentToolCall) {
                  session._currentToolInputJson[currentToolCall.id] =
                    (session._currentToolInputJson[currentToolCall.id] || '') + interpreted.json
                }
                break

              case 'block_stop':
                if (currentBlockType === 'tool_use' && currentToolCall) {
                  try {
                    currentToolCall.input = JSON.parse(
                      session._currentToolInputJson[currentToolCall.id] || '{}'
                    )
                  } catch (e) {
                    currentToolCall.input = {}
                  }
                } else if (currentBlockType === 'thinking' && currentThinkingBlock) {
                  assistantMsg._thinkingBlocks.push({ ...currentThinkingBlock })
                  currentThinkingBlock = null
                }
                currentBlockType = null
                currentToolCall = null
                break

              case 'message_delta':
                // Finalize any open non-Anthropic thinking block before processing stop
                if (currentThinkingBlock && provider !== 'anthropic' && provider !== 'shoulders') {
                  assistantMsg._thinkingBlocks.push({ ...currentThinkingBlock })
                  currentThinkingBlock = null
                }
                if (interpreted.stopReason === 'tool_use') {
                  // Tool use: must cleanup + execute immediately (can't wait for done event)
                  usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
                  assistantMsg.usage = { ...usageAccumulator }
                  // Record usage
                  import('./usage').then(({ useUsageStore }) => {
                    useUsageStore().record({ usage: assistantMsg.usage, feature: 'chat', provider, modelId: access.model, sessionId: session.id })
                  })
                  assistantMsg.status = 'complete'
                  // Keep session.status as 'streaming' — blocks sendMessage during tool execution.
                  // _executeToolCalls → _streamResponse will manage status from here.
                  this._cleanupListeners(session)
                  if (provider === 'shoulders') workspace.refreshShouldersBalance()
                  this._executeToolCalls(session).catch(e => {
                    console.error('[chat] Tool execution failed:', e)
                    session.status = 'idle'
                    const lastMsg = [...session.messages].reverse().find(m => m.role === 'assistant')
                    if (lastMsg) lastMsg.status = 'error'
                    this.saveSession(session.id)
                  })
                  return
                }
                if (interpreted.stopReason === 'end_turn') {
                  assistantMsg.status = 'complete'
                  session.status = 'idle'
                  // Refresh Shoulders balance on stream completion
                  if (provider === 'shoulders') workspace.refreshShouldersBalance()
                }
                break

              case 'message_stop':
                // Finalize any open Google thinking block
                if (currentThinkingBlock && provider === 'google') {
                  assistantMsg._thinkingBlocks.push({ ...currentThinkingBlock })
                  currentThinkingBlock = null
                }
                if (assistantMsg.status === 'streaming') {
                  assistantMsg.status = 'complete'
                  session.status = 'idle'
                  // Refresh Shoulders balance on stream completion
                  if (provider === 'shoulders') workspace.refreshShouldersBalance()
                }
                break

              case 'shoulders_balance': {
                const ws = useWorkspaceStore()
                if (ws.shouldersAuth && interpreted.credits !== undefined) {
                  ws.shouldersAuth.credits = interpreted.credits
                }
                break
              }

              case 'google_tool_call':
                // Google sends tool calls as complete objects with thought signatures
                assistantMsg.toolCalls.push({
                  id: `tool-${nanoid()}`,
                  name: interpreted.toolName,
                  input: interpreted.toolInput || {},
                  output: '',
                  status: 'pending',
                  _googleThoughtSignature: interpreted.thoughtSignature || null,
                })
                break
            }

            } // end interpretedList loop
          }
        })

        session._unlistenDone = await listen(`chat-done-${session.id}`, (event) => {
          // Finalize usage — this is the single place where usage is stored
          // (except tool_use which needs immediate cleanup for tool execution)
          if (usageAccumulator.total > 0) {
            usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
            assistantMsg.usage = { ...usageAccumulator }
            // Record usage
            import('./usage').then(({ useUsageStore }) => {
              useUsageStore().record({ usage: assistantMsg.usage, feature: 'chat', provider, modelId: access.model, sessionId: session.id })
            })
          }
          if (event.payload?.aborted) {
            assistantMsg.status = 'aborted'
            assistantMsg.content += '\n\n*[Aborted]*'
          } else if (assistantMsg.status === 'streaming') {
            assistantMsg.status = 'complete'
          }
          // Don't set session.status = 'idle' yet — check for pending tools first
          session.updatedAt = new Date().toISOString()
          this._cleanupListeners(session)

          // Refresh Shoulders balance after proxy call
          if (provider === 'shoulders') workspace.refreshShouldersBalance()

          // If tool calls are pending, execute them (race: done event can beat message_delta)
          // Keep session.status as 'streaming' to block sendMessage during tool execution.
          const hasPending = assistantMsg.toolCalls?.some(tc => tc.status === 'pending')
          if (hasPending) {
            this._executeToolCalls(session).catch(e => {
              console.error('[chat] Tool execution failed:', e)
              session.status = 'idle'
              if (assistantMsg) assistantMsg.status = 'error'
              this.saveSession(session.id)
            })
          } else {
            session.status = 'idle'
            this.saveSession(session.id)
            // Auto-cleanup background sessions
            if (session._background) {
              this._removeFromSessions(session.id)
            }
          }
        })

        session._unlistenError = await listen(`chat-error-${session.id}`, (event) => {
          console.error('[chat-error]', event.payload)
          assistantMsg.content += '\n\n' + formatChatApiError(event.payload?.error)
          assistantMsg.status = 'error'
          session.status = 'idle'
          this._cleanupListeners(session)
          // Auto-cleanup background sessions on error
          if (session._background) {
            this.saveSession(session.id).then(() => {
              this._removeFromSessions(session.id)
            })
          }
        })

        // Fire the request
        await invoke('chat_stream', {
          sessionId: session.id,
          request: {
            url: request.url,
            headers: request.headers,
            body: request.body,
          },
        })
      } catch (e) {
        // assistantMsg is already a reactive ref, safe to mutate
        assistantMsg.content = formatInvokeError(e)
        assistantMsg.status = 'error'
        session.status = 'idle'
        this._cleanupListeners(session)
      }
    },

    _cleanupListeners(session) {
      if (session._unlistenChunk) { session._unlistenChunk(); session._unlistenChunk = null }
      if (session._unlistenDone) { session._unlistenDone(); session._unlistenDone = null }
      if (session._unlistenError) { session._unlistenError(); session._unlistenError = null }
    },

    async _executeToolCalls(session) {
      const workspace = useWorkspaceStore()
      const lastAssistant = [...session.messages].reverse().find(m => m.role === 'assistant')
      if (!lastAssistant) return

      const pendingTools = lastAssistant.toolCalls.filter(tc => tc.status === 'pending')

      for (const tc of pendingTools) {
        tc.status = 'running'
        try {
          const result = await executeSingleTool(tc.name, tc.input, workspace)
          // Structured PDF result: extract path for native handling, text for display
          if (result && typeof result === 'object' && result._pdfPath) {
            tc._pdfPath = result._pdfPath
            tc.output = result.text
          } else {
            tc.output = typeof result === 'string' ? result : String(result ?? '')
          }
          tc.status = 'done'
        } catch (e) {
          tc.output = String(e)
          tc.status = 'error'
        }
      }

      // Build tool result user message and continue
      const toolResultBlocks = lastAssistant.toolCalls.map(tc => ({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: tc.output || '',
        ...(tc._pdfPath ? { _pdfPath: tc._pdfPath } : {}),
        ...(tc.status === 'error' ? { is_error: true } : {}),
      }))

      // Add a synthetic user message with tool results
      const toolResultMsg = {
        id: `msg-${nanoid()}`,
        role: 'user',
        content: '',
        fileRefs: [],
        context: null,
        toolCalls: [],
        thinking: null,
        status: 'complete',
        createdAt: new Date().toISOString(),
        _isToolResult: true,
        _toolResults: toolResultBlocks,
      }
      session.messages.push(toolResultMsg)

      // Re-build API messages and continue streaming
      const access = await resolveApiAccess({ modelId: session.modelId }, workspace)
      const provider = access?.provider || 'anthropic'
      const apiMessages = await buildApiMessagesWithToolResults(session, provider)
      await this._streamResponse(session, apiMessages)
    },

    // --- Persistence (Phase 6) ---

    async loadSessions() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      // Clean up streaming listeners and Rust sessions from previous workspace
      for (const session of this.sessions) {
        this._cleanupListeners(session)
        if (session.status === 'streaming') {
          invoke('chat_abort', { sessionId: session.id }).catch(() => {})
        }
        invoke('chat_cleanup', { sessionId: session.id }).catch(() => {})
      }

      // Clear existing sessions to prevent duplicates on re-load (e.g. HMR)
      this.sessions = []
      this.activeSessionId = null
      this.allSessionsMeta = []

      // Ensure chats dir exists
      const chatsDir = `${workspace.shouldersDir}/chats`
      const exists = await invoke('path_exists', { path: chatsDir })
      if (!exists) {
        await invoke('create_dir', { path: chatsDir })
      }

      // Always start fresh — no session restoration
      this.createSession()

      // Build meta index for history dropdown
      await this.loadAllSessionsMeta()
    },

    async saveSession(id) {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      const session = this.sessions.find(s => s.id === id)
      if (!session) return

      const chatsDir = `${workspace.shouldersDir}/chats`
      const exists = await invoke('path_exists', { path: chatsDir })
      if (!exists) {
        await invoke('create_dir', { path: chatsDir })
      }

      // Strip runtime-only fields
      const data = {
        id: session.id,
        label: session.label,
        modelId: session.modelId,
        messages: session.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          fileRefs: m.fileRefs,
          context: m.context,
          toolCalls: m.toolCalls,
          thinking: m.thinking,
          _thinkingBlocks: m._thinkingBlocks || [],
          usage: m.usage || null,
          status: m.status,
          createdAt: m.createdAt,
          _isToolResult: m._isToolResult,
          _toolResults: m._toolResults,
        })),
        status: 'idle',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      }

      try {
        await invoke('write_file', {
          path: `${chatsDir}/${id}.json`,
          content: JSON.stringify(data, null, 2),
        })

        // Update meta index inline (avoid full disk scan)
        const existingIdx = this.allSessionsMeta.findIndex(m => m.id === id)
        const meta = {
          id: session.id,
          label: session.label,
          updatedAt: session.updatedAt || session.createdAt,
          messageCount: session.messages.length,
        }
        if (existingIdx >= 0) {
          this.allSessionsMeta[existingIdx] = meta
        } else {
          this.allSessionsMeta.push(meta)
        }
      } catch (e) {
        console.warn('Failed to save chat session:', e)
      }
    },
  },
})
