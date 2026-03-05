import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Chat } from '@ai-sdk/vue'
import { lastAssistantMessageIsCompleteWithToolCalls, tool } from 'ai'
import { z } from 'zod'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { useFilesStore } from './files'
import { useEditorStore } from './editor'
import { useReviewsStore } from './reviews'
import { resolveApiAccess } from '../services/apiClient'
import { getThinkingConfig } from '../services/chatModels'
import { calculateCost } from '../services/tokenUsage'
import { noApiKeyMessage } from '../utils/errorMessages'
import { buildWorkspaceMeta } from '../services/workspaceMeta'
import { buildBaseSystemPrompt } from '../services/systemPrompt'
import { cleanPartsForStorage } from '../services/aiSdk'
import { createChatTransport } from '../services/chatTransport'

// Chat instances live OUTSIDE Pinia (non-reactive container).
// Each Chat's internal messages/status use Vue ref() — reactive when accessed.
const taskChatInstances = new Map() // threadId → Chat

export const useTasksStore = defineStore('tasks', () => {
  // ─── State ────────────────────────────────────────────────────────
  const threads = ref([])
  const activeThreadId = ref(null)
  const _chatVersion = ref(0) // Reactive trigger for Chat instance changes
  const editStatuses = ref({}) // toolCallId → { status: 'applied'|'error', error?: string }

  // ─── Getters ──────────────────────────────────────────────────────
  const threadsForFile = (filePath) => {
    return threads.value.filter(t => t.fileId === filePath)
  }

  const threadsForCell = (filePath, cellId) => {
    return threads.value.filter(
      t => t.fileId === filePath && t.cellId === cellId && t.status !== 'resolved'
    )
  }

  const activeThread = computed(() =>
    threads.value.find(t => t.id === activeThreadId.value) || null
  )

  const streamingCount = computed(() => {
    return threads.value.filter(t => t.status === 'streaming').length
  })

  // ─── Chat Instance Management ───────────────────────────────────

  function getOrCreateTaskChat(thread) {
    if (taskChatInstances.has(thread.id)) return taskChatInstances.get(thread.id)

    console.log('[tasks] Creating Chat instance for thread:', thread.id)

    const chat = new Chat({
      id: thread.id,
      messages: thread._savedMessages || [],
      transport: createChatTransport(() => _buildTaskConfig(thread)),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

      onError: (err) => {
        console.error(`[tasks] Error in thread ${thread.id}:`, err)
        thread.updatedAt = new Date().toISOString()

        // Same recovery as chat.js: pop broken tool call + push output-error
        // so subsequent sends aren't rejected. See chat.js onError for full notes.
        try {
          const msgs = chat.state.messagesRef.value
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1]
            if (last.role === 'assistant') {
              const brokenPart = last.parts?.find(p => {
                if (p.type !== 'dynamic-tool') return false
                // Stuck without execution (original case)
                if (p.state === 'input-available' || p.state === 'input-streaming') return true
                // SDK handled the error but input is not a valid dict — will poison API calls
                if (p.input !== undefined && (typeof p.input !== 'object' || p.input === null || Array.isArray(p.input))) return true
                return false
              })
              if (brokenPart) {
                const { toolCallId, toolName } = brokenPart
                const errMsg = err?.message || String(err)
                chat.state.popMessage()
                chat.state.pushMessage({
                  id: `msg-${nanoid()}`,
                  role: 'assistant',
                  parts: [{
                    type: 'dynamic-tool',
                    toolCallId,
                    toolName,
                    state: 'output-error',
                    input: {},
                    errorText: `Tool call failed: ${errMsg}. Ensure all arguments use valid JSON — do not use XML or <tag> syntax inside JSON string values.`,
                  }],
                  createdAt: new Date().toISOString(),
                })
              }
            }
          }
        } catch (cleanupErr) {
          console.warn('[tasks] Failed to recover from broken tool call:', cleanupErr)
        }
      },
    })

    taskChatInstances.set(thread.id, chat)
    _chatVersion.value++

    // Watch for status transitions to update thread.status for gutter dot reactivity
    watch(
      () => chat.state.statusRef.value,
      (newStatus, oldStatus) => {
        console.log(`[tasks] Thread ${thread.id} status: ${oldStatus} → ${newStatus}`)
        if (newStatus === 'submitted' || newStatus === 'streaming') {
          thread.status = 'streaming'
        } else if (newStatus === 'ready') {
          if (oldStatus === 'streaming' || oldStatus === 'submitted') {
            thread.status = 'idle'
            thread.updatedAt = new Date().toISOString()
            saveThreads()
          }
        }
      },
    )

    return chat
  }

  function getTaskChatInstance(threadId) {
    void _chatVersion.value // reactive dependency
    return taskChatInstances.get(threadId) || null
  }

  /**
   * Get messages for a thread (from Chat instance or empty).
   * Used by read_tasks tool and docxTasks bridge.
   */
  function getThreadMessages(threadId) {
    const chat = taskChatInstances.get(threadId)
    if (chat) return chat.state.messagesRef.value
    // If no Chat instance, try to find saved messages on the thread
    const thread = threads.value.find(t => t.id === threadId)
    return thread?._savedMessages || []
  }

  // ─── Config Builder ───────────────────────────────────────────────

  async function _buildTaskConfig(thread) {
    const workspace = useWorkspaceStore()
    const access = await resolveApiAccess({ modelId: thread.modelId }, workspace)

    if (!access) throw new Error(noApiKeyMessage(thread.modelId))

    const provider = access.providerHint || access.provider
    const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === thread.modelId)
    const thinkingConfig = getThinkingConfig(access.model, provider, modelEntry?.thinking)

    // Build system prompt with task context
    let systemPrompt = buildBaseSystemPrompt(workspace)

    if (thread.cellId) {
      systemPrompt += `\n\n# Current Task\nReviewing a notebook cell.\n\nFile: ${thread.fileId}\nCell ${thread.cellIndex != null ? thread.cellIndex : '?'} (${thread.cellType || 'code'}, ${thread.cellLanguage || 'python'})\n\nCell source:\n\`\`\`${thread.cellLanguage || 'python'}\n${thread.selectedText}\n\`\`\``
      if (thread.cellOutputs) systemPrompt += `\n\nCell output:\n---\n${thread.cellOutputs}\n---`
    } else {
      systemPrompt += `\n\n# Current Task\nReviewing selected text in a document.\n\nFile: ${thread.fileId}`
      if (thread.contextBefore) systemPrompt += `\n\nContext before selection:\n---\n${thread.contextBefore}\n---`
      systemPrompt += `\n\nSelected text:\n---\n${thread.selectedText}\n---`
      if (thread.contextAfter) systemPrompt += `\n\nContext after selection:\n---\n${thread.contextAfter}\n---`
    }

    systemPrompt += `\n\nYou have propose_edit to suggest text replacements. The user reviews before applying.`
    if (workspace.systemPrompt) systemPrompt += '\n\n' + workspace.systemPrompt
    if (workspace.instructions) systemPrompt += '\n\n' + workspace.instructions

    // Add workspace meta to system prompt
    try {
      const meta = await buildWorkspaceMeta(workspace.path)
      if (meta) systemPrompt += '\n\n' + meta
    } catch {}

    // propose_edit tool — tool result is dummy; user applies via UI
    const extraTools = {
      propose_edit: tool({
        description: 'Propose a text edit to replace the selected text or a portion of it. The user can review and apply the edit.',
        inputSchema: z.object({
          old_string: z.string().describe('The exact text to find and replace'),
          new_string: z.string().describe('The replacement text'),
        }),
        execute: async () => 'Proposal recorded. User will review.',
      }),
    }

    return {
      access,
      workspace,
      systemPrompt,
      thinkingConfig,
      provider,
      maxSteps: 10,
      extraTools,
      onUsage: (normalized, modelId) => {
        normalized.cost = calculateCost(normalized, modelId, access.provider)
        import('./usage').then(({ useUsageStore }) => {
          useUsageStore().record({
            usage: normalized,
            feature: 'tasks',
            provider: access.provider,
            modelId,
            sessionId: thread.id,
          })
        }).catch(() => {})
        if (access.provider === 'shoulders') {
          workspace.refreshShouldersBalance()
        }
      },
    }
  }

  // ─── Thread Lifecycle ─────────────────────────────────────────────

  function createThread(fileId, range, selectedText, modelId, cellContext, surroundingContext) {
    const workspace = useWorkspaceStore()
    const defaultModel = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
    const id = `task-${nanoid()}`
    const thread = {
      id,
      fileId,
      range: { from: range.from, to: range.to },
      selectedText,
      modelId: modelId || defaultModel,
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstMessagePreview: null,
      // Surrounding context (5000 chars before, 1000 after)
      contextBefore: surroundingContext?.contextBefore || null,
      contextAfter: surroundingContext?.contextAfter || null,
      // Notebook cell context (null for non-notebook threads)
      cellId: cellContext?.cellId || null,
      cellIndex: cellContext?.cellIndex ?? null,
      cellType: cellContext?.cellType || null,
      cellOutputs: cellContext?.cellOutputs || null,
      cellLanguage: cellContext?.cellLanguage || null,
    }
    threads.value.push(thread)
    activeThreadId.value = id
    return id
  }

  function createThreadFromChat(fileId, range, selectedText, modelId, message, proposedEdit) {
    const workspace = useWorkspaceStore()
    const defaultModel = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
    const id = `task-${nanoid()}`

    // Build synthetic messages in UIMessage format
    const syntheticUser = {
      id: `msg-${nanoid()}`,
      role: 'user',
      parts: [{ type: 'text', text: 'Review this text.' }],
      createdAt: new Date().toISOString(),
    }

    const assistantParts = []
    if (message) {
      assistantParts.push({ type: 'text', text: message })
    }
    if (proposedEdit && proposedEdit.old_string && proposedEdit.new_string) {
      const toolCallId = `tool-${nanoid()}`
      assistantParts.push({
        type: 'dynamic-tool',
        toolCallId,
        toolName: 'propose_edit',
        state: 'output-available',
        input: { old_string: proposedEdit.old_string, new_string: proposedEdit.new_string },
        output: 'Proposal recorded.',
      })
    }

    const assistantMsg = {
      id: `msg-${nanoid()}`,
      role: 'assistant',
      parts: assistantParts,
      createdAt: new Date().toISOString(),
    }

    const thread = {
      id,
      fileId,
      range: { from: range.from, to: range.to },
      selectedText,
      modelId: modelId || defaultModel,
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstMessagePreview: message ? (message.length > 50 ? message.slice(0, 50) + '...' : message) : 'Review this text.',
      _savedMessages: [syntheticUser, assistantMsg],
    }
    threads.value.push(thread)
    // Do NOT set activeThreadId — user clicks gutter dot to view
    saveThreads()
    return id
  }

  // ─── Messaging ────────────────────────────────────────────────────

  async function sendMessage(threadId, { text, fileRefs }) {
    const thread = threads.value.find(t => t.id === threadId)
    if (!thread || thread.status === 'streaming') return

    // Budget gate — block at 100%
    const { useUsageStore } = await import('./usage')
    if (useUsageStore().isOverBudget) {
      console.warn('[tasks] Budget exceeded')
      return
    }

    const chat = getOrCreateTaskChat(thread)

    // Check streaming state
    const status = chat.state.statusRef.value
    if (status === 'submitted' || status === 'streaming') {
      console.warn('[tasks] sendMessage: already streaming, ignoring')
      return
    }

    // Build message text
    const parts = []

    // File references
    if (fileRefs?.length) {
      for (const ref of fileRefs) {
        if (ref.content) {
          parts.push(`<file-ref path="${ref.path}">\n${ref.content}\n</file-ref>`)
        }
      }
    }

    // First message: prepend selection context
    const isFirst = chat.state.messagesRef.value.length === 0
    if (isFirst) {
      parts.push(`<selection file="${thread.fileId}">\n${thread.selectedText}\n</selection>`)
    }

    if (text) parts.push(text)

    const messageText = parts.join('\n\n')

    // Set firstMessagePreview on first message (for gutter tooltip + list view)
    if (isFirst && text) {
      thread.firstMessagePreview = text.length > 50 ? text.slice(0, 50) + '...' : text
    }

    console.log('[tasks] Sending message:', { threadId, textLen: messageText.length })
    chat.sendMessage({ text: messageText })
  }

  function abortThread(threadId) {
    const chat = taskChatInstances.get(threadId)
    if (chat) chat.stop()
  }

  function removeThread(threadId) {
    const thread = threads.value.find(t => t.id === threadId)
    if (!thread) return

    // Stop and cleanup Chat instance
    const chat = taskChatInstances.get(threadId)
    if (chat) {
      try { chat.stop() } catch {}
      taskChatInstances.delete(threadId)
      _chatVersion.value++
    }

    const idx = threads.value.indexOf(thread)
    threads.value.splice(idx, 1)

    // Return to list view after deletion
    if (activeThreadId.value === threadId) {
      activeThreadId.value = null
    }

    saveThreads()
  }

  function setActiveThread(threadId) {
    activeThreadId.value = threadId
    // Lazily create Chat instance when viewing a thread with saved messages
    if (threadId) {
      const thread = threads.value.find(t => t.id === threadId)
      if (thread && thread._savedMessages?.length && !taskChatInstances.has(threadId)) {
        getOrCreateTaskChat(thread)
      }
    }
  }

  function resolveThread(threadId) {
    const thread = threads.value.find(t => t.id === threadId)
    if (!thread) return
    thread.status = 'resolved'
    if (activeThreadId.value === threadId) {
      activeThreadId.value = null
    }
    saveThreads()
  }

  function updateRange(threadId, from, to) {
    const thread = threads.value.find(t => t.id === threadId)
    if (thread) {
      thread.range = { from, to }
    }
  }

  // ─── Apply Proposed Edit → Review System ──────────────────────────

  async function applyProposedEdit(threadId, toolCallId) {
    const thread = threads.value.find(t => t.id === threadId)
    if (!thread) return

    // Check if already applied
    if (editStatuses.value[toolCallId]?.status === 'applied') return

    // Notebook files: edit cell source within .ipynb
    if (thread.fileId.endsWith('.ipynb') && thread.cellId) {
      return _applyNotebookEdit(thread, toolCallId)
    }

    // DOCX files: delegate to task bridge
    if (thread.fileId.endsWith('.docx')) {
      return _applyDocxEdit(thread, toolCallId)
    }

    // Find the propose_edit part in Chat instance messages
    const { old_string, new_string } = _findEditInput(threadId, toolCallId)
    if (!old_string || !new_string) return

    const filesStore = useFilesStore()
    const editorStore = useEditorStore()
    const reviews = useReviewsStore()

    try {
      const currentContent = await invoke('read_file', { path: thread.fileId })

      if (!currentContent.includes(old_string)) {
        editStatuses.value[toolCallId] = { status: 'error', error: 'old_string not found in file. The text may have changed.' }
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

      editStatuses.value[toolCallId] = { status: 'applied' }
      saveThreads()
    } catch (e) {
      editStatuses.value[toolCallId] = { status: 'error', error: `Error applying edit: ${e}` }
    }
  }

  async function _applyDocxEdit(thread, toolCallId) {
    const editorStore = useEditorStore()
    const bridge = editorStore.getDocxTaskBridge(thread.fileId)
    if (bridge) {
      // Bridge needs the old/new strings — pass via editInput
      const { old_string, new_string } = _findEditInput(thread.id, toolCallId)
      if (!old_string || !new_string) return
      try {
        await bridge.applyProposedEditFromInput(toolCallId, old_string, new_string)
        editStatuses.value[toolCallId] = { status: 'applied' }
        saveThreads()
      } catch (e) {
        editStatuses.value[toolCallId] = { status: 'error', error: `Error: ${e}` }
      }
      return
    }

    // No bridge but file is open — apply via SuperDoc directly
    const sd = editorStore.getAnySuperdoc(thread.fileId)
    if (sd?.activeEditor) {
      const { old_string, new_string } = _findEditInput(thread.id, toolCallId)
      if (!old_string || !new_string) return

      try {
        const ai = editorStore.getAnyAiActions(thread.fileId)
        if (!ai) {
          editStatuses.value[toolCallId] = { status: 'error', error: 'DOCX AIActions not ready.' }
          return
        }

        const result = await ai.action.literalReplace(old_string, new_string, {
          caseSensitive: true,
          trackChanges: true,
        })

        if (!result.success) {
          editStatuses.value[toolCallId] = { status: 'error', error: 'old_string not found in document.' }
          return
        }

        const filesStore = useFilesStore()
        filesStore.fileContents[thread.fileId] = sd.activeEditor.state.doc.textContent

        editStatuses.value[toolCallId] = { status: 'applied' }
        saveThreads()
      } catch (e) {
        editStatuses.value[toolCallId] = { status: 'error', error: `Error applying edit: ${e}` }
      }
      return
    }

    editStatuses.value[toolCallId] = { status: 'error', error: 'DOCX file must be open to apply edits.' }
  }

  async function _applyNotebookEdit(thread, toolCallId) {
    const { old_string, new_string } = _findEditInput(thread.id, toolCallId)
    if (!old_string || !new_string) return

    const filesStore = useFilesStore()

    try {
      const rawContent = await invoke('read_file', { path: thread.fileId })
      const nb = JSON.parse(rawContent)

      const cellIdx = (nb.cells || []).findIndex(c => c.id === thread.cellId)
      if (cellIdx === -1) {
        editStatuses.value[toolCallId] = { status: 'error', error: 'Cell not found in notebook (may have been deleted).' }
        return
      }

      const cell = nb.cells[cellIdx]
      const cellSource = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '')

      if (!cellSource.includes(old_string)) {
        editStatuses.value[toolCallId] = { status: 'error', error: 'old_string not found in cell source. The code may have changed.' }
        return
      }

      const newSource = cellSource.replace(old_string, new_string)
      cell.source = newSource.split('\n').map((line, i, arr) =>
        i < arr.length - 1 ? line + '\n' : line
      ).filter((line, i, arr) => !(i === arr.length - 1 && line === ''))

      const newContent = JSON.stringify(nb, null, 1)
      await invoke('write_file', { path: thread.fileId, content: newContent })

      filesStore.fileContents[thread.fileId] = newContent

      editStatuses.value[toolCallId] = { status: 'applied' }
      saveThreads()
    } catch (e) {
      editStatuses.value[toolCallId] = { status: 'error', error: `Error applying notebook edit: ${e}` }
    }
  }

  /**
   * Find old_string/new_string from a propose_edit tool part in Chat messages.
   */
  function _findEditInput(threadId, toolCallId) {
    const messages = getThreadMessages(threadId)
    for (const msg of messages) {
      if (msg.role !== 'assistant' || !msg.parts) continue
      for (const part of msg.parts) {
        if ((part.toolCallId === toolCallId) && part.input) {
          return { old_string: part.input.old_string, new_string: part.input.new_string }
        }
      }
    }
    return {}
  }

  function getEditStatus(toolCallId) {
    return editStatuses.value[toolCallId] || null
  }

  // ─── Persistence ──────────────────────────────────────────────────

  async function loadThreads() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    // Cleanup existing Chat instances
    for (const [, chat] of taskChatInstances) {
      try { chat.stop() } catch {}
    }
    taskChatInstances.clear()
    _chatVersion.value++

    threads.value = []
    activeThreadId.value = null
    editStatuses.value = {}

    const filePath = `${workspace.shouldersDir}/tasks.json`
    try {
      const exists = await invoke('path_exists', { path: filePath })
      if (!exists) return

      const content = await invoke('read_file', { path: filePath })
      const data = JSON.parse(content)
      if (!Array.isArray(data)) return

      for (const t of data) {
        // Migrate legacy messages to UIMessage format
        const messages = t.messages || []
        const savedMessages = messages[0]?.parts
          ? messages // Already in UIMessage format
          : migrateTaskMessages(messages)

        // Migrate any applied edits to editStatuses
        if (t._editStatuses) {
          Object.assign(editStatuses.value, t._editStatuses)
        } else {
          // Legacy: check toolCalls for applied status
          for (const msg of messages) {
            if (msg.toolCalls) {
              for (const tc of msg.toolCalls) {
                if (tc.status === 'applied') {
                  editStatuses.value[tc.id] = { status: 'applied' }
                } else if (tc.status === 'error') {
                  editStatuses.value[tc.id] = { status: 'error', error: tc.output || '' }
                }
              }
            }
          }
        }

        threads.value.push({
          id: t.id,
          fileId: t.fileId,
          range: t.range,
          selectedText: t.selectedText,
          modelId: t.modelId,
          status: t.status === 'resolved' ? 'resolved' : 'idle',
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          firstMessagePreview: t.firstMessagePreview || _extractFirstPreview(messages),
          contextBefore: t.contextBefore || null,
          contextAfter: t.contextAfter || null,
          cellId: t.cellId || null,
          cellIndex: t.cellIndex ?? null,
          cellType: t.cellType || null,
          cellOutputs: t.cellOutputs || null,
          cellLanguage: t.cellLanguage || null,
          _savedMessages: savedMessages,
        })
      }
    } catch (e) {
      console.warn('Failed to load task threads:', e)
    }
  }

  async function saveThreads() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    const data = threads.value.map(t => {
      // Get messages from Chat instance if available, otherwise from saved
      const chat = taskChatInstances.get(t.id)
      const messages = chat
        ? chat.state.messagesRef.value.map(m => ({
            ...m,
            parts: cleanPartsForStorage(m.parts),
          }))
        : t._savedMessages || []

      return {
        id: t.id,
        fileId: t.fileId,
        range: t.range,
        selectedText: t.selectedText,
        messages,
        modelId: t.modelId,
        status: t.status === 'resolved' ? 'resolved' : 'idle',
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        firstMessagePreview: t.firstMessagePreview || null,
        contextBefore: t.contextBefore || null,
        contextAfter: t.contextAfter || null,
        cellId: t.cellId || null,
        cellIndex: t.cellIndex ?? null,
        cellType: t.cellType || null,
        cellOutputs: t.cellOutputs || null,
        cellLanguage: t.cellLanguage || null,
        _editStatuses: editStatuses.value,
      }
    })

    try {
      await invoke('write_file', {
        path: `${workspace.shouldersDir}/tasks.json`,
        content: JSON.stringify(data, null, 2),
      })
    } catch (e) {
      console.warn('Failed to save task threads:', e)
    }
  }

  // ─── Migration Helpers ────────────────────────────────────────────

  /**
   * Convert legacy task messages { content, thinking, _thinkingBlocks, toolCalls }
   * to UIMessage format { parts: [...] }.
   */
  function migrateTaskMessages(messages) {
    return messages
      .filter(m => !m._isToolResult && !m._synthetic)
      .map(m => {
        if (m.parts && Array.isArray(m.parts) && m.parts.length > 0) return m

        const parts = []

        if (m.role === 'user') {
          parts.push({ type: 'text', text: m.content || '' })
        } else {
          // Assistant message
          if (m.thinking || m._thinkingBlocks?.length) {
            const thinkingText = m._thinkingBlocks?.map(b => b.thinking).join('\n\n') || m.thinking
            if (thinkingText) parts.push({ type: 'reasoning', text: thinkingText })
          }

          if (m.content) {
            parts.push({ type: 'text', text: m.content })
          }

          if (m.toolCalls?.length) {
            for (const tc of m.toolCalls) {
              parts.push({
                type: 'dynamic-tool',
                toolCallId: tc.id,
                toolName: tc.name,
                state: tc.status === 'done' ? 'output-available'
                  : tc.status === 'error' ? 'output-available'
                  : tc.status === 'applied' ? 'output-available'
                  : tc.status === 'running' ? 'input-available'
                  : 'input-streaming',
                input: tc.input || {},
                output: tc.output || '',
              })
            }
          }
        }

        return {
          id: m.id || `msg-${nanoid()}`,
          role: m.role,
          parts,
          createdAt: m.createdAt,
        }
      })
  }

  /**
   * Extract first user message preview from legacy messages.
   */
  function _extractFirstPreview(messages) {
    const first = messages.find(m => m.role === 'user' && !m._synthetic && !m._isToolResult)
    if (!first) return null
    const text = first.content || first.parts?.find(p => p.type === 'text')?.text || ''
    return text.length > 50 ? text.slice(0, 50) + '...' : text
  }

  // ─── Public API ─────────────────────────────────────────────────

  return {
    // State
    threads,
    activeThreadId,
    editStatuses,

    // Getters
    threadsForFile,
    threadsForCell,
    activeThread,
    streamingCount,

    // Chat instance management
    getOrCreateTaskChat,
    getTaskChatInstance,
    getThreadMessages,

    // Thread lifecycle
    createThread,
    createThreadFromChat,
    sendMessage,
    abortThread,
    removeThread,
    setActiveThread,
    resolveThread,
    updateRange,

    // Edit application
    applyProposedEdit,
    getEditStatus,

    // Persistence
    loadThreads,
    saveThreads,
  }
})
