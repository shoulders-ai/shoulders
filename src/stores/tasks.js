import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { useFilesStore } from './files'
import { useEditorStore } from './editor'
import { useReviewsStore } from './reviews'
import { formatRequest, parseSSEChunk, interpretEvent } from '../services/chatProvider'
import { resolveApiAccess } from '../services/apiClient'
import { getContextWindow, getThinkingConfig } from '../services/chatModels'
import { normalizeUsage, mergeUsage, calculateCost, createEmptyUsage } from '../services/tokenUsage'
import { estimateConversationTokens, truncateToFitBudget } from '../services/tokenEstimator'
import { noApiKeyMessage, formatChatApiError, formatInvokeError } from '../utils/errorMessages'
import { buildWorkspaceMeta } from '../services/workspaceMeta'
import { getToolDefinitions, executeSingleTool } from '../services/chatTools'
import { buildBaseSystemPrompt } from '../services/systemPrompt'

export const useTasksStore = defineStore('tasks', {
  state: () => ({
    threads: [],
    activeThreadId: null,
  }),

  getters: {
    threadsForFile: (state) => (filePath) => {
      return state.threads.filter((t) => t.fileId === filePath)
    },
    threadsForCell: (state) => (filePath, cellId) => {
      return state.threads.filter(
        (t) => t.fileId === filePath && t.cellId === cellId && t.status !== 'resolved'
      )
    },
    activeThread(state) {
      return state.threads.find((t) => t.id === state.activeThreadId) || null
    },
    streamingCount(state) {
      return state.threads.filter((t) => t.status === 'streaming').length
    },
  },

  actions: {
    createThread(fileId, range, selectedText, modelId, cellContext, surroundingContext) {
      const workspace = useWorkspaceStore()
      const defaultModel = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
      const id = `task-${nanoid()}`
      const thread = {
        id,
        fileId,
        range: { from: range.from, to: range.to },
        selectedText,
        messages: [],
        modelId: modelId || defaultModel,
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Surrounding context (5000 chars before, 1000 after)
        contextBefore: surroundingContext?.contextBefore || null,
        contextAfter: surroundingContext?.contextAfter || null,
        // Notebook cell context (null for non-notebook threads)
        cellId: cellContext?.cellId || null,
        cellIndex: cellContext?.cellIndex ?? null,
        cellType: cellContext?.cellType || null,
        cellOutputs: cellContext?.cellOutputs || null,
        cellLanguage: cellContext?.cellLanguage || null,
        // Runtime-only (not persisted)
        _sseBuffer: '',
        _currentToolInputJson: {},
        _unlistenChunk: null,
        _unlistenDone: null,
        _unlistenError: null,
      }
      this.threads.push(thread)
      this.activeThreadId = id
      return id
    },

    createThreadFromChat(fileId, range, selectedText, modelId, message, proposedEdit) {
      const workspace = useWorkspaceStore()
      const defaultModel = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
      const id = `task-${nanoid()}`

      // Build synthetic user message (hidden in UI, needed for API alternation)
      const syntheticUser = {
        id: `msg-${nanoid()}`,
        role: 'user',
        content: 'Review this text.',
        fileRefs: [],
        toolCalls: [],
        thinking: null,
        status: 'complete',
        createdAt: new Date().toISOString(),
        _synthetic: true,
      }

      // Build assistant message with the feedback
      const assistantMsg = {
        id: `msg-${nanoid()}`,
        role: 'assistant',
        content: message,
        fileRefs: [],
        toolCalls: [],
        thinking: null,
        status: 'complete',
        createdAt: new Date().toISOString(),
      }

      // If proposed edit provided, add as tool call
      if (proposedEdit && proposedEdit.old_string && proposedEdit.new_string) {
        assistantMsg.toolCalls.push({
          id: `tool-${nanoid()}`,
          name: 'propose_edit',
          input: { old_string: proposedEdit.old_string, new_string: proposedEdit.new_string },
          output: 'Proposal recorded.',
          status: 'done',
        })
      }

      const thread = {
        id,
        fileId,
        range: { from: range.from, to: range.to },
        selectedText,
        messages: [syntheticUser, assistantMsg],
        modelId: modelId || defaultModel,
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _sseBuffer: '',
        _currentToolInputJson: {},
        _unlistenChunk: null,
        _unlistenDone: null,
        _unlistenError: null,
      }
      this.threads.push(thread)
      // Do NOT set activeThreadId — user clicks gutter dot to view
      this.saveThreads()
      return id
    },

    async sendMessage(threadId, { text, fileRefs }) {
      const thread = this.threads.find(t => t.id === threadId)
      if (!thread || thread.status === 'streaming') return

      // Budget gate — block at 100%
      const { useUsageStore } = await import('./usage')
      if (useUsageStore().isOverBudget) {
        thread.messages.push({
          id: `msg-${nanoid()}`, role: 'assistant',
          content: 'Monthly budget reached. Change your budget in Settings > Models to continue.',
          fileRefs: [], toolCalls: [], thinking: null,
          status: 'error', createdAt: new Date().toISOString(),
        })
        return
      }

      const userMsg = {
        id: `msg-${nanoid()}`,
        role: 'user',
        content: text || '',
        fileRefs: fileRefs || [],
        toolCalls: [],
        thinking: null,
        status: 'complete',
        createdAt: new Date().toISOString(),
      }

      thread.messages.push(userMsg)
      thread.updatedAt = new Date().toISOString()

      const apiMessages = await this._buildApiMessages(thread)
      await this._streamResponse(thread, apiMessages)
    },

    async abortThread(threadId) {
      const thread = this.threads.find(t => t.id === threadId)
      if (!thread || thread.status !== 'streaming') return
      await invoke('chat_abort', { sessionId: threadId })
    },

    removeThread(threadId) {
      const thread = this.threads.find(t => t.id === threadId)
      if (!thread) return

      if (thread.status === 'streaming') {
        invoke('chat_abort', { sessionId: threadId }).catch(() => {})
      }
      this._cleanupListeners(thread)
      invoke('chat_cleanup', { sessionId: threadId }).catch(() => {})

      const idx = this.threads.indexOf(thread)
      this.threads.splice(idx, 1)

      if (this.activeThreadId === threadId) {
        this.activeThreadId = this.threads.length > 0 ? this.threads[this.threads.length - 1].id : null
      }

      this.saveThreads()
    },

    setActiveThread(threadId) {
      this.activeThreadId = threadId
    },

    resolveThread(threadId) {
      const thread = this.threads.find(t => t.id === threadId)
      if (!thread) return
      thread.status = 'resolved'
      if (this.activeThreadId === threadId) {
        this.activeThreadId = null
      }
      this.saveThreads()
    },

    updateRange(threadId, from, to) {
      const thread = this.threads.find(t => t.id === threadId)
      if (thread) {
        thread.range = { from, to }
      }
    },

    // --- Streaming orchestration (mirrors chat.js:_streamResponse) ---

    async _streamResponse(thread, apiMessages) {
      const workspace = useWorkspaceStore()
      const access = await resolveApiAccess({ modelId: thread.modelId }, workspace)
      if (!access) {
        const errMsg = {
          id: `msg-${nanoid()}`,
          role: 'assistant',
          content: noApiKeyMessage(thread.modelId),
          fileRefs: [],
          toolCalls: [],
          thinking: null,
          status: 'error',
          createdAt: new Date().toISOString(),
        }
        thread.messages.push(errMsg)
        return
      }

      // Create assistant message placeholder
      thread.messages.push({
        id: `msg-${nanoid()}`,
        role: 'assistant',
        content: '',
        fileRefs: [],
        toolCalls: [],
        thinking: null,
        _thinkingBlocks: [],
        status: 'streaming',
        createdAt: new Date().toISOString(),
      })
      // IMPORTANT: get reactive proxy reference
      const assistantMsg = thread.messages[thread.messages.length - 1]
      thread.status = 'streaming'
      thread._sseBuffer = ''
      thread._currentToolInputJson = {}

      // Build system prompt: shared base + task-specific section
      let system = buildBaseSystemPrompt(workspace)

      if (thread.cellId) {
        // Notebook cell task context
        system += `\n\n# Current Task\nReviewing a notebook cell.\n\nFile: ${thread.fileId}\nCell ${thread.cellIndex != null ? thread.cellIndex : '?'} (${thread.cellType || 'code'}, ${thread.cellLanguage || 'python'})\n\nCell source:\n\`\`\`${thread.cellLanguage || 'python'}\n${thread.selectedText}\n\`\`\``
        if (thread.cellOutputs) system += `\n\nCell output:\n---\n${thread.cellOutputs}\n---`
      } else {
        // Text selection task context
        system += `\n\n# Current Task\nReviewing selected text in a document.\n\nFile: ${thread.fileId}`
        if (thread.contextBefore) system += `\n\nContext before selection:\n---\n${thread.contextBefore}\n---`
        system += `\n\nSelected text:\n---\n${thread.selectedText}\n---`
        if (thread.contextAfter) system += `\n\nContext after selection:\n---\n${thread.contextAfter}\n---`
      }

      system += `\n\nYou have propose_edit to suggest text replacements. The user reviews before applying.`

      if (workspace.systemPrompt) system += '\n\n' + workspace.systemPrompt
      if (workspace.instructions) system += '\n\n' + workspace.instructions

      // Build tool set: propose_edit + filtered subset of chat tools
      const proposeEditTool = {
        name: 'propose_edit',
        description: 'Propose a text edit to replace the selected text or a portion of it. The user can review and apply the edit.',
        input_schema: {
          type: 'object',
          properties: {
            old_string: { type: 'string', description: 'The exact text to find and replace' },
            new_string: { type: 'string', description: 'The replacement text' },
          },
          required: ['old_string', 'new_string'],
        },
      }
      const tools = [proposeEditTool, ...getToolDefinitions(workspace)]

      // Token budget: estimate, truncate if needed
      const contextWindow = getContextWindow(thread.modelId, workspace)
      const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === thread.modelId)
      const thinkingConfig = getThinkingConfig(access.model, access.provider, modelEntry?.thinking)
      const outputReserve = thinkingConfig ? 32768 : 16384
      const maxBudget = contextWindow - outputReserve
      let estimated = estimateConversationTokens(system, apiMessages)
      if (estimated > maxBudget) {
        apiMessages = truncateToFitBudget(apiMessages, maxBudget, system)
        estimated = estimateConversationTokens(system, apiMessages)
      }
      thread._estimatedTokens = estimated

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
        this._cleanupListeners(thread)

        let currentBlockType = null
        let currentToolCall = null
        let currentThinkingBlock = null
        let usageAccumulator = createEmptyUsage()

        thread._unlistenChunk = await listen(`chat-chunk-${thread.id}`, (event) => {
          const raw = event.payload?.data
          if (!raw) return

          const { events, remainingBuffer } = parseSSEChunk(provider, raw, thread._sseBuffer)
          thread._sseBuffer = remainingBuffer

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
                  currentToolCall = assistantMsg.toolCalls[assistantMsg.toolCalls.length - 1]
                  thread._currentToolInputJson[currentToolCall.id] = ''
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
                // Auto-create thinking block for Google (no block_start/block_stop)
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
                  thread._currentToolInputJson[currentToolCall.id] =
                    (thread._currentToolInputJson[currentToolCall.id] || '') + interpreted.json
                }
                break

              case 'block_stop':
                if (currentBlockType === 'tool_use' && currentToolCall) {
                  try {
                    currentToolCall.input = JSON.parse(
                      thread._currentToolInputJson[currentToolCall.id] || '{}'
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
                  usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
                  assistantMsg.usage = { ...usageAccumulator }
                  import('./usage').then(({ useUsageStore }) => {
                    useUsageStore().record({ usage: assistantMsg.usage, feature: 'tasks', provider, modelId: access.model, sessionId: thread.id })
                  }).catch(e => console.warn('[tasks] usage record failed:', e))
                  assistantMsg.status = 'complete'
                  thread.status = 'idle'
                  this._cleanupListeners(thread)
                  this._executeToolCalls(thread).catch(e => {
                    console.error('[tasks] Tool execution failed:', e)
                    thread.status = 'idle'
                    if (assistantMsg) assistantMsg.status = 'error'
                    this.saveThreads()
                  })
                  return
                }
                if (interpreted.stopReason === 'end_turn') {
                  usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
                  assistantMsg.usage = { ...usageAccumulator }
                  import('./usage').then(({ useUsageStore }) => {
                    useUsageStore().record({ usage: assistantMsg.usage, feature: 'tasks', provider, modelId: access.model, sessionId: thread.id })
                  }).catch(e => console.warn('[tasks] usage record failed:', e))
                  assistantMsg.status = 'complete'
                  thread.status = 'idle'
                  thread.updatedAt = new Date().toISOString()
                  this._cleanupListeners(thread)
                  this.saveThreads()
                }
                break

              case 'message_stop':
                // Finalize any open Google thinking block
                if (currentThinkingBlock && provider === 'google') {
                  assistantMsg._thinkingBlocks.push({ ...currentThinkingBlock })
                  currentThinkingBlock = null
                }
                if (assistantMsg.status === 'streaming') {
                  if (usageAccumulator.total > 0) {
                    usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
                    assistantMsg.usage = { ...usageAccumulator }
                    import('./usage').then(({ useUsageStore }) => {
                      useUsageStore().record({ usage: assistantMsg.usage, feature: 'tasks', provider, modelId: access.model, sessionId: thread.id })
                    }).catch(e => console.warn('[tasks] usage record failed:', e))
                  }
                  assistantMsg.status = 'complete'
                  thread.status = 'idle'
                  thread.updatedAt = new Date().toISOString()
                  this._cleanupListeners(thread)
                  this.saveThreads()
                }
                break

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

        thread._unlistenDone = await listen(`chat-done-${thread.id}`, (event) => {
          // Finalize usage
          if (usageAccumulator.total > 0 && !assistantMsg.usage) {
            usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
            assistantMsg.usage = { ...usageAccumulator }
            import('./usage').then(({ useUsageStore }) => {
              useUsageStore().record({ usage: assistantMsg.usage, feature: 'tasks', provider, modelId: access.model, sessionId: thread.id })
            }).catch(e => console.warn('[tasks] usage record failed:', e))
          }
          if (event.payload?.aborted) {
            assistantMsg.status = 'aborted'
            assistantMsg.content += '\n\n*[Aborted]*'
          } else if (assistantMsg.status === 'streaming') {
            assistantMsg.status = 'complete'
          }
          thread.status = 'idle'
          thread.updatedAt = new Date().toISOString()
          this._cleanupListeners(thread)
          if (provider === 'shoulders') workspace.refreshShouldersBalance()
          this.saveThreads()
        })

        thread._unlistenError = await listen(`chat-error-${thread.id}`, (event) => {
          console.error('[task-error]', event.payload)
          assistantMsg.content += '\n\n' + formatChatApiError(event.payload?.error)
          assistantMsg.status = 'error'
          thread.status = 'idle'
          this._cleanupListeners(thread)
        })

        // Fire the request
        await invoke('chat_stream', {
          sessionId: thread.id,
          request: {
            url: request.url,
            headers: request.headers,
            body: request.body,
          },
        })
      } catch (e) {
        assistantMsg.content = formatInvokeError(e)
        assistantMsg.status = 'error'
        thread.status = 'idle'
        this._cleanupListeners(thread)
      }
    },

    _cleanupListeners(thread) {
      if (thread._unlistenChunk) { thread._unlistenChunk(); thread._unlistenChunk = null }
      if (thread._unlistenDone) { thread._unlistenDone(); thread._unlistenDone = null }
      if (thread._unlistenError) { thread._unlistenError(); thread._unlistenError = null }
    },

    async _executeToolCalls(thread) {
      const lastAssistant = [...thread.messages].reverse().find(m => m.role === 'assistant')
      if (!lastAssistant) return

      const workspace = useWorkspaceStore()
      const pendingTools = lastAssistant.toolCalls.filter(tc => tc.status === 'pending')

      for (const tc of pendingTools) {
        if (tc.name === 'propose_edit') {
          tc.output = 'Proposal recorded. User will review.'
          tc.status = 'done'
        } else {
          tc.status = 'running'
          try {
            const result = await executeSingleTool(tc.name, tc.input, workspace)
            tc.output = typeof result === 'string' ? result : String(result ?? '')
            tc.status = 'done'
          } catch (e) {
            tc.output = `Error: ${e.message || e}`
            tc.status = 'error'
          }
        }
      }

      // Build tool result message and continue
      const toolResultBlocks = lastAssistant.toolCalls.map(tc => ({
        type: 'tool_result',
        tool_use_id: tc.id,
        content: tc.output || '',
      }))

      const toolResultMsg = {
        id: `msg-${nanoid()}`,
        role: 'user',
        content: '',
        fileRefs: [],
        toolCalls: [],
        thinking: null,
        status: 'complete',
        createdAt: new Date().toISOString(),
        _isToolResult: true,
        _toolResults: toolResultBlocks,
      }
      thread.messages.push(toolResultMsg)

      // Re-build API messages and continue streaming
      const apiMessages = await this._buildApiMessagesWithToolResults(thread)
      await this._streamResponse(thread, apiMessages)
    },

    // --- Apply proposed edit → review system (Phase 5) ---

    async applyProposedEdit(threadId, toolCallId) {
      const thread = this.threads.find(t => t.id === threadId)
      if (!thread) return

      // Notebook files: edit cell source within .ipynb
      if (thread.fileId.endsWith('.ipynb') && thread.cellId) {
        return this._applyNotebookEdit(thread, threadId, toolCallId)
      }

      // DOCX files: delegate to task bridge
      if (thread.fileId.endsWith('.docx')) {
        const editorStore = useEditorStore()
        const bridge = editorStore.getDocxTaskBridge(thread.fileId)
        if (bridge) return bridge.applyProposedEdit(threadId, toolCallId, thread)
        // No bridge but file is open — apply via SuperDoc directly
        const sd = editorStore.getAnySuperdoc(thread.fileId)
        if (sd?.activeEditor) {
          return this._applyDocxEdit(thread, threadId, toolCallId, sd)
        }
        // Can't edit DOCX without an open editor
        const tc = thread.messages.flatMap(m => m.toolCalls || []).find(t => t.id === toolCallId)
        if (tc) { tc.output = 'Error: DOCX file must be open to apply edits.'; tc.status = 'error' }
        return
      }

      // Find the tool call
      let tc = null
      for (const msg of thread.messages) {
        if (msg.toolCalls) {
          tc = msg.toolCalls.find(t => t.id === toolCallId)
          if (tc) break
        }
      }
      if (!tc || tc.status === 'applied') return

      const { old_string, new_string } = tc.input
      if (!old_string || !new_string) return

      const filesStore = useFilesStore()
      const editorStore = useEditorStore()
      const reviews = useReviewsStore()

      try {
        const currentContent = await invoke('read_file', { path: thread.fileId })

        if (!currentContent.includes(old_string)) {
          tc.output = 'Error: old_string not found in file. The text may have changed.'
          tc.status = 'error'
          return
        }

        const newContent = currentContent.replace(old_string, new_string)
        await invoke('write_file', { path: thread.fileId, content: newContent })

        // Update files store BEFORE recording pending edit (race condition fix)
        filesStore.fileContents[thread.fileId] = newContent
        editorStore.openFile(thread.fileId)

        if (!reviews.directMode) {
          const editId = `task-${Date.now()}-${nanoid(6)}`
          reviews.pendingEdits.push({
            id: editId,
            timestamp: new Date().toISOString(),
            tool: 'Edit',
            file_path: thread.fileId,
            old_string,
            new_string,
            old_content: currentContent,
            status: 'pending',
          })
          await reviews.savePendingEdits()
        }

        tc.status = 'applied'
        this.saveThreads()
      } catch (e) {
        tc.output = `Error applying edit: ${e}`
        tc.status = 'error'
      }
    },

    // --- DOCX edit via SuperDoc (no bridge needed) ---

    async _applyDocxEdit(thread, threadId, toolCallId, sd) {
      let tc = null
      for (const msg of thread.messages) {
        if (msg.toolCalls) {
          tc = msg.toolCalls.find(t => t.id === toolCallId)
          if (tc) break
        }
      }
      if (!tc || tc.status === 'applied') return

      const { old_string, new_string } = tc.input
      if (!old_string || !new_string) return

      try {
        const editorStore = useEditorStore()
        const ai = editorStore.getAnyAiActions(thread.fileId)
        if (!ai) {
          tc.output = 'Error: DOCX AIActions not ready.'
          tc.status = 'error'
          return
        }

        // Use documented SuperDoc API: ai.action.literalReplace
        const result = await ai.action.literalReplace(old_string, new_string, {
          caseSensitive: true,
          trackChanges: true,
        })

        if (!result.success) {
          tc.output = 'Error: old_string not found in document.'
          tc.status = 'error'
          return
        }

        const filesStore = useFilesStore()
        filesStore.fileContents[thread.fileId] = sd.activeEditor.state.doc.textContent

        tc.status = 'applied'
        this.saveThreads()
      } catch (e) {
        tc.output = `Error applying edit: ${e}`
        tc.status = 'error'
      }
    },

    // --- Apply proposed edit to notebook cell ---

    async _applyNotebookEdit(thread, threadId, toolCallId) {
      let tc = null
      for (const msg of thread.messages) {
        if (msg.toolCalls) {
          tc = msg.toolCalls.find(t => t.id === toolCallId)
          if (tc) break
        }
      }
      if (!tc || tc.status === 'applied') return

      const { old_string, new_string } = tc.input
      if (!old_string || !new_string) return

      const filesStore = useFilesStore()

      try {
        const rawContent = await invoke('read_file', { path: thread.fileId })
        const nb = JSON.parse(rawContent)

        // Find cell by ID
        const cellIdx = (nb.cells || []).findIndex(c => c.id === thread.cellId)
        if (cellIdx === -1) {
          tc.output = 'Error: Cell not found in notebook (may have been deleted).'
          tc.status = 'error'
          return
        }

        const cell = nb.cells[cellIdx]
        const cellSource = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '')

        if (!cellSource.includes(old_string)) {
          tc.output = 'Error: old_string not found in cell source. The code may have changed.'
          tc.status = 'error'
          return
        }

        // Replace in cell source
        const newSource = cellSource.replace(old_string, new_string)
        // Serialize back to array-of-lines format (.ipynb convention)
        cell.source = newSource.split('\n').map((line, i, arr) =>
          i < arr.length - 1 ? line + '\n' : line
        ).filter((line, i, arr) => !(i === arr.length - 1 && line === ''))

        const newContent = JSON.stringify(nb, null, 1)
        await invoke('write_file', { path: thread.fileId, content: newContent })

        // Update filesStore — triggers NotebookEditor's watcher
        filesStore.fileContents[thread.fileId] = newContent

        tc.status = 'applied'
        this.saveThreads()
      } catch (e) {
        tc.output = `Error applying notebook edit: ${e}`
        tc.status = 'error'
      }
    },

    // --- Message building ---

    async _buildApiMessages(thread) {
      const workspace = useWorkspaceStore()
      const meta = await buildWorkspaceMeta(workspace.path)

      // Track last file-ref index for dedup
      const lastFileRefIndex = {}
      thread.messages.forEach((msg, idx) => {
        if (msg.role === 'user' && msg.fileRefs) {
          for (const ref of msg.fileRefs) {
            lastFileRefIndex[ref.path] = idx
          }
        }
      })

      const apiMessages = []
      let isFirstUserMsg = true

      thread.messages.forEach((msg, idx) => {
        if (msg.role === 'user') {
          let content = ''

          // Prepend workspace meta to the first user message
          if (isFirstUserMsg && meta) {
            content += meta + '\n\n'
          }
          isFirstUserMsg = false

          // First user message: prepend selection context
          if (idx === 0) {
            content += `<selection file="${thread.fileId}">\n${thread.selectedText}\n</selection>\n\n`
          }

          // Add file refs (clean dedup — skip stale entirely)
          if (msg.fileRefs && msg.fileRefs.length > 0) {
            for (const ref of msg.fileRefs) {
              if (lastFileRefIndex[ref.path] !== idx) continue
              content += `<file-ref path="${ref.path}">\n${ref.content}\n</file-ref>\n\n`
            }
          }

          if (msg.content) content += msg.content

          // Check if previous assistant had tool calls
          if (idx > 0) {
            const prevMsg = thread.messages[idx - 1]
            if (prevMsg.role === 'assistant' && prevMsg.toolCalls && prevMsg.toolCalls.length > 0) {
              const toolResults = prevMsg.toolCalls.map(tc => ({
                type: 'tool_result',
                tool_use_id: tc.id,
                content: tc.output || '',
              }))
              if (content.trim()) {
                apiMessages.push({
                  role: 'user',
                  content: [...toolResults, { type: 'text', text: content.trim() }],
                })
              } else {
                apiMessages.push({ role: 'user', content: toolResults })
              }
              return
            }
          }

          apiMessages.push({ role: 'user', content: content.trim() })
        } else if (msg.role === 'assistant') {
          const hasToolCalls = msg.toolCalls?.length > 0
          const hasThinking = msg._thinkingBlocks?.length > 0

          if (hasToolCalls || hasThinking) {
            const blocks = []
            if (hasThinking) {
              for (const tb of msg._thinkingBlocks) {
                blocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
              }
            }
            if (msg.content) blocks.push({ type: 'text', text: msg.content })
            if (hasToolCalls) {
              for (const tc of msg.toolCalls) {
                const block = { type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }
                if (tc._googleThoughtSignature) block._googleThoughtSignature = tc._googleThoughtSignature
                blocks.push(block)
              }
            }
            apiMessages.push({ role: 'assistant', content: blocks })
          } else {
            apiMessages.push({ role: 'assistant', content: msg.content || '' })
          }
        }
      })

      return apiMessages
    },

    async _buildApiMessagesWithToolResults(thread) {
      const workspace = useWorkspaceStore()
      const meta = await buildWorkspaceMeta(workspace.path)

      const lastFileRefIndex = {}
      thread.messages.forEach((msg, idx) => {
        if (msg.role === 'user' && msg.fileRefs) {
          for (const ref of msg.fileRefs) {
            lastFileRefIndex[ref.path] = idx
          }
        }
      })

      const apiMessages = []
      let isFirstUserMsg = true

      for (let idx = 0; idx < thread.messages.length; idx++) {
        const msg = thread.messages[idx]

        if (msg.role === 'user') {
          if (msg._isToolResult && msg._toolResults) {
            apiMessages.push({ role: 'user', content: msg._toolResults })
            continue
          }

          let content = ''

          // Prepend workspace meta to the first user message
          if (isFirstUserMsg && meta) {
            content += meta + '\n\n'
          }
          isFirstUserMsg = false

          if (idx === 0) {
            content += `<selection file="${thread.fileId}">\n${thread.selectedText}\n</selection>\n\n`
          }

          // Clean dedup — skip stale file refs entirely
          if (msg.fileRefs && msg.fileRefs.length > 0) {
            for (const ref of msg.fileRefs) {
              if (lastFileRefIndex[ref.path] !== idx) continue
              content += `<file-ref path="${ref.path}">\n${ref.content}\n</file-ref>\n\n`
            }
          }

          if (msg.content) content += msg.content
          apiMessages.push({ role: 'user', content: content.trim() })
        } else if (msg.role === 'assistant') {
          const hasToolCalls = msg.toolCalls?.length > 0
          const hasThinking = msg._thinkingBlocks?.length > 0

          if (hasToolCalls || hasThinking) {
            const blocks = []
            if (hasThinking) {
              for (const tb of msg._thinkingBlocks) {
                blocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
              }
            }
            if (msg.content) blocks.push({ type: 'text', text: msg.content })
            if (hasToolCalls) {
              for (const tc of msg.toolCalls) {
                const block = { type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }
                if (tc._googleThoughtSignature) block._googleThoughtSignature = tc._googleThoughtSignature
                blocks.push(block)
              }
            }
            apiMessages.push({ role: 'assistant', content: blocks })
          } else {
            apiMessages.push({ role: 'assistant', content: msg.content || '' })
          }
        }
      }

      return apiMessages
    },

    // --- Persistence ---

    async loadThreads() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      // Clean up streaming listeners from previous workspace threads
      for (const thread of this.threads) {
        this._cleanupListeners(thread)
        if (thread.status === 'streaming') {
          invoke('chat_abort', { sessionId: thread.id }).catch(() => {})
        }
        invoke('chat_cleanup', { sessionId: thread.id }).catch(() => {})
      }

      this.threads = []
      this.activeThreadId = null

      const filePath = `${workspace.shouldersDir}/tasks.json`
      try {
        const exists = await invoke('path_exists', { path: filePath })
        if (!exists) return

        const content = await invoke('read_file', { path: filePath })
        const data = JSON.parse(content)
        if (!Array.isArray(data)) return

        for (const t of data) {
          // Restore runtime fields
          t._sseBuffer = ''
          t._currentToolInputJson = {}
          t._unlistenChunk = null
          t._unlistenDone = null
          t._unlistenError = null
          t.status = 'idle'
          this.threads.push(t)
        }
      } catch (e) {
        console.warn('Failed to load task threads:', e)
      }
    },

    async saveThreads() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      // Strip runtime fields
      const data = this.threads.map(t => ({
        id: t.id,
        fileId: t.fileId,
        range: t.range,
        selectedText: t.selectedText,
        messages: t.messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          fileRefs: m.fileRefs,
          toolCalls: m.toolCalls,
          thinking: m.thinking,
          _thinkingBlocks: m._thinkingBlocks || [],
          usage: m.usage || null,
          status: m.status,
          createdAt: m.createdAt,
          _isToolResult: m._isToolResult,
          _toolResults: m._toolResults,
          _synthetic: m._synthetic,
        })),
        modelId: t.modelId,
        status: 'idle',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        // Surrounding context
        contextBefore: t.contextBefore || null,
        contextAfter: t.contextAfter || null,
        // Notebook cell context
        cellId: t.cellId || null,
        cellIndex: t.cellIndex ?? null,
        cellType: t.cellType || null,
        cellOutputs: t.cellOutputs || null,
        cellLanguage: t.cellLanguage || null,
      }))

      try {
        await invoke('write_file', {
          path: `${workspace.shouldersDir}/tasks.json`,
          content: JSON.stringify(data, null, 2),
        })
      } catch (e) {
        console.warn('Failed to save task threads:', e)
      }
    },
  },
})
