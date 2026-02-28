import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { streamText, stepCountIs, convertToModelMessages, tool } from 'ai'
import { z } from 'zod'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { useFilesStore } from './files'
import { useEditorStore } from './editor'
import { useReviewsStore } from './reviews'
import { resolveApiAccess } from '../services/apiClient'
import { getContextWindow, getThinkingConfig } from '../services/chatModels'
import { calculateCost } from '../services/tokenUsage'
import { noApiKeyMessage, formatChatApiError, formatInvokeError } from '../utils/errorMessages'
import { buildWorkspaceMeta } from '../services/workspaceMeta'
import { getAiTools } from '../services/chatTools'
import { buildBaseSystemPrompt } from '../services/systemPrompt'
import { createModel, buildProviderOptions, convertSdkUsage } from '../services/aiSdk'
import { createTauriFetch } from '../services/tauriFetch'

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
        // Runtime-only
        _abortController: null,
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
        _abortController: null,
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
      if (thread._abortController) thread._abortController.abort()
    },

    removeThread(threadId) {
      const thread = this.threads.find(t => t.id === threadId)
      if (!thread) return

      if (thread.status === 'streaming' && thread._abortController) {
        thread._abortController.abort()
      }

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

    // --- Streaming via AI SDK streamText() ---

    async _streamResponse(thread, apiMessages) {
      console.log('[tasks] _streamResponse starting for thread:', thread.id, 'messages:', apiMessages.length)
      const workspace = useWorkspaceStore()
      const access = await resolveApiAccess({ modelId: thread.modelId }, workspace)
      if (!access) {
        thread.messages.push({
          id: `msg-${nanoid()}`, role: 'assistant',
          content: noApiKeyMessage(thread.modelId),
          fileRefs: [], toolCalls: [], thinking: null,
          status: 'error', createdAt: new Date().toISOString(),
        })
        return
      }

      // Create assistant message placeholder
      thread.messages.push({
        id: `msg-${nanoid()}`, role: 'assistant',
        content: '', fileRefs: [], toolCalls: [],
        thinking: null, _thinkingBlocks: [],
        status: 'streaming', createdAt: new Date().toISOString(),
      })
      const assistantMsg = thread.messages[thread.messages.length - 1]
      thread.status = 'streaming'

      // Build system prompt
      let system = buildBaseSystemPrompt(workspace)
      if (thread.cellId) {
        system += `\n\n# Current Task\nReviewing a notebook cell.\n\nFile: ${thread.fileId}\nCell ${thread.cellIndex != null ? thread.cellIndex : '?'} (${thread.cellType || 'code'}, ${thread.cellLanguage || 'python'})\n\nCell source:\n\`\`\`${thread.cellLanguage || 'python'}\n${thread.selectedText}\n\`\`\``
        if (thread.cellOutputs) system += `\n\nCell output:\n---\n${thread.cellOutputs}\n---`
      } else {
        system += `\n\n# Current Task\nReviewing selected text in a document.\n\nFile: ${thread.fileId}`
        if (thread.contextBefore) system += `\n\nContext before selection:\n---\n${thread.contextBefore}\n---`
        system += `\n\nSelected text:\n---\n${thread.selectedText}\n---`
        if (thread.contextAfter) system += `\n\nContext after selection:\n---\n${thread.contextAfter}\n---`
      }
      system += `\n\nYou have propose_edit to suggest text replacements. The user reviews before applying.`
      if (workspace.systemPrompt) system += '\n\n' + workspace.systemPrompt
      if (workspace.instructions) system += '\n\n' + workspace.instructions

      // Build tool set
      const tauriFetch = createTauriFetch()
      const model = createModel(access, tauriFetch)
      const provider = access.providerHint || access.provider
      const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === thread.modelId)
      const thinkingConfig = getThinkingConfig(access.model, provider, modelEntry?.thinking)
      const providerOptions = buildProviderOptions(thinkingConfig, provider)

      const tools = {
        propose_edit: tool({
          description: 'Propose a text edit to replace the selected text or a portion of it. The user can review and apply the edit.',
          inputSchema: z.object({
            old_string: z.string().describe('The exact text to find and replace'),
            new_string: z.string().describe('The replacement text'),
          }),
          execute: async ({ old_string, new_string }) => {
            return 'Proposal recorded. User will review.'
          },
        }),
        ...getAiTools(workspace),
      }

      // AbortController for this stream
      const abortController = new AbortController()
      thread._abortController = abortController

      try {
        console.log('[tasks] Starting streamText:', { model: access.model, provider, toolCount: Object.keys(tools).length })
        const result = streamText({
          model,
          system,
          messages: apiMessages,
          tools,
          stopWhen: stepCountIs(10),
          providerOptions,
          abortSignal: abortController.signal,
          onStepFinish({ usage, providerMetadata }) {
            if (usage) {
              const normalized = convertSdkUsage(usage, providerMetadata, provider)
              normalized.cost = calculateCost(normalized, access.model)
              assistantMsg.usage = normalized
              import('./usage').then(({ useUsageStore }) => {
                useUsageStore().record({
                  usage: normalized, feature: 'tasks',
                  provider, modelId: access.model, sessionId: thread.id,
                })
              }).catch(() => {})
              if (access.provider === 'shoulders') workspace.refreshShouldersBalance()
            }
          },
        })

        // Consume the stream → update assistantMsg reactively
        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              assistantMsg.content += part.textDelta
              break
            case 'reasoning':
              if (!assistantMsg.thinking) assistantMsg.thinking = ''
              assistantMsg.thinking += part.text
              if (!assistantMsg._thinkingBlocks.length || assistantMsg._thinkingBlocks[assistantMsg._thinkingBlocks.length - 1]._done) {
                assistantMsg._thinkingBlocks.push({ type: 'thinking', thinking: '', signature: null })
              }
              assistantMsg._thinkingBlocks[assistantMsg._thinkingBlocks.length - 1].thinking += part.text
              break
            case 'tool-call':
              assistantMsg.toolCalls.push({
                id: part.toolCallId,
                name: part.toolName,
                input: part.args,
                output: '',
                status: 'running',
              })
              break
            case 'tool-result':
              // Update matching tool call with result
              for (const tc of assistantMsg.toolCalls) {
                if (tc.id === part.toolCallId) {
                  const output = part.result
                  tc.output = typeof output === 'string' ? output : JSON.stringify(output)
                  tc.status = 'done'
                  break
                }
              }
              break
            case 'step-finish':
              // Mark thinking block as done so next reasoning creates a new one
              if (assistantMsg._thinkingBlocks.length) {
                assistantMsg._thinkingBlocks[assistantMsg._thinkingBlocks.length - 1]._done = true
              }
              break
            case 'error':
              assistantMsg.content += `\n\n${formatChatApiError(part.error?.message || String(part.error))}`
              assistantMsg.status = 'error'
              break
          }
        }

        // Stream finished
        assistantMsg.status = 'complete'
        thread.status = 'idle'
        thread.updatedAt = new Date().toISOString()
        this.saveThreads()
      } catch (e) {
        if (e.name === 'AbortError' || abortController.signal.aborted) {
          assistantMsg.content += '\n\n*[Aborted]*'
          assistantMsg.status = 'aborted'
        } else {
          assistantMsg.content += '\n\n' + formatChatApiError(e.message || String(e))
          assistantMsg.status = 'error'
        }
        thread.status = 'idle'
        thread.updatedAt = new Date().toISOString()
        this.saveThreads()
      } finally {
        thread._abortController = null
      }
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

          const trimmed = content.trim()

          // If previous assistant had tool calls, include tool_results
          // (handles corrupted sessions where a user message was interleaved during tool execution)
          if (idx > 0) {
            const prevMsg = thread.messages[idx - 1]
            if (prevMsg.role === 'assistant' && prevMsg.toolCalls && prevMsg.toolCalls.length > 0) {
              const toolResults = prevMsg.toolCalls.map(tc => ({
                type: 'tool_result',
                tool_use_id: tc.id,
                content: tc.output || '',
              }))
              if (trimmed) {
                apiMessages.push({ role: 'user', content: [...toolResults, { type: 'text', text: trimmed }] })
              } else {
                apiMessages.push({ role: 'user', content: toolResults })
              }
              continue
            }
          }

          apiMessages.push({ role: 'user', content: trimmed })
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

      // Abort any streaming threads
      for (const thread of this.threads) {
        if (thread._abortController) thread._abortController.abort()
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
          t._abortController = null
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
