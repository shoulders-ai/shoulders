import { defineStore } from 'pinia'
import { ref, computed, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { Chat } from '@ai-sdk/vue'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { resolveApiAccess } from '../services/apiClient'
import { createModel } from '../services/aiSdk'
import { generateText } from 'ai'
import { getContextWindow, getThinkingConfig } from '../services/chatModels'
import { buildBaseSystemPrompt } from '../services/systemPrompt'
import { calculateCost } from '../services/tokenUsage'
import { cleanPartsForStorage } from '../services/aiSdk'
import { createChatTransport } from '../services/chatTransport'
import { buildWorkspaceMeta } from '../services/workspaceMeta'
import { noApiKeyMessage, formatChatApiError } from '../utils/errorMessages'

// Chat instances live OUTSIDE Pinia (non-reactive container).
// Each Chat's internal messages/status use Vue ref() — reactive when accessed.
const chatInstances = new Map() // sessionId → Chat

// ─── Title Helpers ──────────────────────────────────────────────────

/**
 * Extract plain text from UIMessage parts, stripping file-ref and context XML.
 */
function extractTextFromParts(parts) {
  return parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join(' ')
    .replace(/<file-ref[^>]*>[\s\S]*?<\/file-ref>/g, '')
    .replace(/<context[^>]*>[\s\S]*?<\/context>/g, '')
    .replace(/\n/g, ' ')
    .trim()
}

/**
 * Build a smart truncated label from the first user message.
 * - Strips file-ref / context XML tags
 * - Truncates at word boundary (max 40 chars)
 * - Adds "..." only if truncated
 */
function smartLabel(text) {
  const clean = text
    .replace(/<file-ref[^>]*>[\s\S]*?<\/file-ref>/g, '')
    .replace(/<context[^>]*>[\s\S]*?<\/context>/g, '')
    .replace(/\n/g, ' ')
    .trim()

  if (!clean) return 'New chat'
  if (clean.length <= 40) return clean

  const slice = clean.slice(0, 40)
  const lastSpace = slice.lastIndexOf(' ')
  if (lastSpace > 10) {
    return slice.slice(0, lastSpace) + '...'
  }
  return slice + '...'
}

export const useChatStore = defineStore('chat', () => {
  // ─── State ────────────────────────────────────────────────────────
  const sessions = ref([])
  const activeSessionId = ref(null)
  const allSessionsMeta = ref([]) // [{ id, label, updatedAt, messageCount }]
  const _chatVersion = ref(0) // Reactive trigger — increment when Chat instances are created/destroyed
  // Prefill/selection queued for the next ChatInput to mount (handles async component timing)
  const pendingPrefill = ref(null)
  const pendingSelection = ref(null)
  // Reactive map of messageId → richHtml (stored separately from AI SDK-owned message objects)
  const _richHtmlMap = ref(Object.create(null))

  // ─── Getters ──────────────────────────────────────────────────────
  const activeSession = computed(() =>
    sessions.value.find(s => s.id === activeSessionId.value) || null
  )

  const streamingCount = computed(() => {
    let count = 0
    for (const [id, chat] of chatInstances) {
      const session = sessions.value.find(s => s.id === id)
      if (session?._background) {
        const status = chat.state.statusRef.value
        if (status === 'submitted' || status === 'streaming') count++
      }
    }
    return count
  })

  // ─── Chat Instance Management ───────────────────────────────────

  function getOrCreateChat(session) {
    if (chatInstances.has(session.id)) return chatInstances.get(session.id)

    const chat = new Chat({
      id: session.id,
      messages: session._savedMessages || [],
      transport: createChatTransport(() => _buildConfig(session)),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

      onToolCall: async ({ toolCall }) => {
        // Client-side tool handling if needed
        // The ToolLoopAgent in the transport handles server-side tools
      },

      onError: (err) => {
        console.error('[chat] onError:', err?.message || err)
        session.updatedAt = new Date().toISOString()

        // Two failure modes from invalid tool call JSON (e.g. model mixes XML
        // into JSON arguments):
        //
        // 1. STUCK PART (immediate): SDK adds assistant message with tool part
        //    stuck at input-available (no paired result). Next send fails with
        //    HTTP 400 / MissingToolResultsError. Fix: pop message, push
        //    synthetic output-error part.
        //
        // 2. POISONED INPUT (delayed): SDK handles the error gracefully —
        //    emits output-error part with raw string as `input` (not a dict).
        //    Stream completes successfully, onError does NOT fire. The poisoned
        //    part gets persisted. On the NEXT send, provider rejects the
        //    entire conversation: "tool_use.input: Input should be a valid
        //    dictionary". onError fires now, but the broken part is in an
        //    EARLIER message (not the last one).
        //
        // Fix for both: scan ALL messages for non-dict input values, then
        // check the last message for stuck parts.
        try {
          let recovered = false
          const msgs = chat.state.messagesRef.value

          // Pass 1: fix poisoned input in ANY message.
          // Part type is "tool-{name}" (e.g. "tool-reply_to_comment"), not "dynamic-tool".
          // Input can be undefined (not just a string) when JSON parsing fails.
          for (const msg of msgs) {
            if (msg.role !== 'assistant' || !msg.parts) continue
            for (const p of msg.parts) {
              if (p.state !== 'output-error') continue
              // SDK skips input validation for output-error when input is undefined
              // (validate-ui-messages.ts line 424). convert-to-model-messages falls
              // back: part.input ?? part.rawInput — both must be removed.
              if (p.input !== undefined || p.rawInput !== undefined) {
                delete p.input
                delete p.rawInput
                recovered = true
              }
            }
          }

          // Pass 2: fix stuck parts in the last message (no paired result)
          if (msgs.length > 0) {
            const last = msgs[msgs.length - 1]
            if (last.role === 'assistant') {
              const brokenPart = last.parts?.find(p => {
                if (p.state !== 'input-available' && p.state !== 'input-streaming') return false
                return true
              })
              if (brokenPart) {
                const { toolCallId, toolName, type } = brokenPart
                const errMsg = err?.message || String(err)
                chat.state.popMessage()
                chat.state.pushMessage({
                  id: `msg-${nanoid()}`,
                  role: 'assistant',
                  parts: [{
                    type: type || 'dynamic-tool',
                    toolCallId,
                    toolName,
                    state: 'output-error',
                    errorText: `Tool call failed: ${errMsg}. Ensure all arguments use valid JSON — do not use XML or <tag> syntax inside JSON string values.`,
                  }],
                  createdAt: new Date().toISOString(),
                })
                recovered = true
              }
            }
          }
        } catch (cleanupErr) {
          console.warn('[chat] Failed to recover from broken tool call:', cleanupErr)
        }
      },
    })

    chatInstances.set(session.id, chat)
    _chatVersion.value++ // Trigger reactivity for getChatInstance consumers

    // Watch for status transitions to save on completion
    watch(
      () => chat.state.statusRef.value,
      (newStatus, oldStatus) => {
        if (newStatus === 'ready' && (oldStatus === 'streaming' || oldStatus === 'submitted')) {
          session.updatedAt = new Date().toISOString()
          saveSession(session.id)

          // Generate AI title after first exchange completes
          _maybeGenerateTitle(session)

          // Auto-cleanup background sessions
          if (session._background) {
            _removeFromSessions(session.id)
          }
        }
      },
    )

    return chat
  }

  function getChatInstance(sessionId) {
    void _chatVersion.value // reactive dependency — re-evaluate when Chat instances change
    return chatInstances.get(sessionId) || null
  }

  async function _buildConfig(session) {
    const workspace = useWorkspaceStore()
    const access = await resolveApiAccess({ modelId: session.modelId }, workspace)

    if (!access) throw new Error(noApiKeyMessage(session.modelId))

    const provider = access.providerHint || access.provider
    const modelEntry = workspace.modelsConfig?.models?.find(m => m.id === session.modelId)
    const thinkingConfig = getThinkingConfig(access.model, provider, modelEntry?.thinking)

    // Build system prompt (includes workspace meta for context)
    let systemPrompt = buildBaseSystemPrompt(workspace)
    if (workspace.systemPrompt) systemPrompt += '\n\n' + workspace.systemPrompt
    if (workspace.instructions) systemPrompt += '\n\n' + workspace.instructions

    // Add workspace meta to system prompt (not user message — keeps UI clean)
    try {
      const meta = await buildWorkspaceMeta(workspace.path)
      if (meta) systemPrompt += '\n\n' + meta
    } catch {}

    return {
      access,
      workspace,
      systemPrompt,
      thinkingConfig,
      provider,
      onUsage: (normalized, modelId) => {
        normalized.cost = calculateCost(normalized, modelId, access.provider)
        // Store real provider-reported input tokens for the context window donut.
        // input_total covers system prompt + all messages + tool definitions.
        // Must write via sessions.value.find() (reactive proxy), NOT the closure's raw session
        // object — direct writes bypass Vue's Proxy and don't trigger computed re-runs.
        if (normalized.input_total > 0) {
          const liveSession = sessions.value.find(s => s.id === session.id)
          if (liveSession && normalized.input_total > (liveSession._lastInputTokens || 0)) {
            liveSession._lastInputTokens = normalized.input_total
          }
        }
        import('./usage').then(({ useUsageStore }) => {
          useUsageStore().record({
            usage: normalized,
            feature: 'chat',
            provider: access.provider,
            modelId,
            sessionId: session.id,
          })
        })
        // Refresh Shoulders balance
        if (access.provider === 'shoulders') {
          workspace.refreshShouldersBalance()
        }
      },
    }
  }

  // ─── Session Management ─────────────────────────────────────────

  function createSession(modelId) {
    const workspace = useWorkspaceStore()
    const configDefault = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
    const defaultModel = workspace.selectedModelId || configDefault
    const id = nanoid(12)
    const session = {
      id,
      label: `Chat ${sessions.value.length + 1}`,
      modelId: modelId || defaultModel,
      messages: [], // For UI display — overridden by Chat instance once created
      status: 'idle',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    sessions.value.push(session)
    activeSessionId.value = id

    // Pre-create Chat instance so messages are immediately reactive
    getOrCreateChat(session)

    return id
  }

  function deleteSession(id) {
    const session = sessions.value.find(s => s.id === id)
    if (!session) return

    // Stop Chat instance
    const chat = chatInstances.get(id)
    if (chat) {
      try { chat.stop() } catch {}
      chatInstances.delete(id)
      _chatVersion.value++
    }

    const idx = sessions.value.indexOf(session)
    sessions.value.splice(idx, 1)

    // Delete persisted file
    const workspace = useWorkspaceStore()
    if (workspace.shouldersDir) {
      invoke('delete_path', { path: `${workspace.shouldersDir}/chats/${id}.json` }).catch(() => {})
    }

    if (activeSessionId.value === id) {
      activeSessionId.value = sessions.value.length > 0 ? sessions.value[sessions.value.length - 1].id : null
    }
  }

  async function reopenSession(id, opts = {}) {
    const existing = sessions.value.find(s => s.id === id)
    if (existing) {
      if (existing._background) existing._background = false
      activeSessionId.value = id
      return
    }

    // Archive current chat first (unless skipArchive — for tab coexistence)
    if (!opts.skipArchive) {
      await _archiveCurrent()
    }

    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    try {
      const content = await invoke('read_file', { path: `${workspace.shouldersDir}/chats/${id}.json` })
      const data = JSON.parse(content)

      const messages = data.messages || []

      const session = {
        id: data.id,
        label: data.label,
        modelId: data.modelId,
        messages: [], // Will be populated by Chat instance
        status: 'idle',
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        _savedMessages: messages, // Passed to Chat constructor
      }

      sessions.value.push(session)
      activeSessionId.value = id

      // Pre-create Chat so messages are immediately available
      getOrCreateChat(session)
    } catch (e) {
      console.warn('Failed to reopen session:', e)
    }
  }

  async function loadAllSessionsMeta() {
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
            _aiTitle: data._aiTitle || false,
            _keywords: data._keywords || [],
          })
        } catch {}
      }

      meta.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      allSessionsMeta.value = meta
    } catch (e) {
      console.warn('Failed to load session meta:', e)
    }
  }

  function setActiveSession(id) {
    activeSessionId.value = id
  }

  async function archiveAndNewChat() {
    if (!activeSession.value) return

    // Check if Chat has any messages
    const chat = chatInstances.get(activeSession.value.id)
    const hasMessages = chat
      ? chat.state.messagesRef.value.length > 0
      : activeSession.value.messages.length > 0

    if (!hasMessages) return

    await _archiveCurrent()
    createSession()
  }

  async function _archiveCurrent() {
    if (!activeSession.value) return

    const chat = chatInstances.get(activeSession.value.id)
    const hasMessages = chat
      ? chat.state.messagesRef.value.length > 0
      : activeSession.value.messages.length > 0

    if (!hasMessages) return

    const isStreaming = chat && ['submitted', 'streaming'].includes(chat.state.statusRef.value)

    if (isStreaming) {
      activeSession.value._background = true
    } else {
      await saveSession(activeSession.value.id)
      _removeFromSessions(activeSession.value.id)
    }
  }

  function _removeFromSessions(id) {
    const session = sessions.value.find(s => s.id === id)
    if (!session) return

    const chat = chatInstances.get(id)
    if (chat) {
      try { chat.stop() } catch {}
      chatInstances.delete(id)
      _chatVersion.value++
    }

    const idx = sessions.value.indexOf(session)
    sessions.value.splice(idx, 1)
  }

  // ─── Messaging ──────────────────────────────────────────────────

  async function sendMessage(sessionId, { text, fileRefs, context, richHtml }) {
    const session = sessions.value.find(s => s.id === sessionId)
    if (!session) {
      console.warn('[chat] sendMessage: session not found:', sessionId)
      return
    }

    const chat = getOrCreateChat(session)

    // Check streaming state
    const status = chat.state.statusRef.value
    if (status === 'submitted' || status === 'streaming') {
      console.warn('[chat] sendMessage: already streaming, ignoring')
      return
    }

    // Budget gate
    const { useUsageStore } = await import('./usage')
    if (useUsageStore().isOverBudget) {
      console.warn('[chat] Budget exceeded')
      return
    }

    // Auto-label on first message
    const isFirst = chat.state.messagesRef.value.length === 0
    if (isFirst && text) {
      session.label = smartLabel(text)
    }

    // Build message text + multimodal files
    const { text: messageText, files } = await _buildMessageTextAndFiles({ text, fileRefs, context })

    import('../services/telemetry').then(({ events }) => events.chatSend(session.modelId || 'unknown'))
    // Capture count before send so we can identify the new user message afterward
    const userCountBefore = chat.state.messagesRef.value.filter(m => m.role === 'user').length
    if (files.length > 0) {
      chat.sendMessage({ text: messageText, files })
    } else {
      chat.sendMessage({ text: messageText })
    }

    // Store rich HTML once the new user message appears in messagesRef.
    // chat.sendMessage() may defer the message addition (first-call transport init),
    // so we retry up to 5 ticks to find the newly added message.
    if (richHtml) {
      let newUserMsg = null
      for (let i = 0; i < 5 && !newUserMsg; i++) {
        await nextTick()
        const msgs = chat.state.messagesRef.value
        const users = msgs.filter(m => m.role === 'user')
        if (users.length > userCountBefore) newUserMsg = users[users.length - 1]
      }
      if (newUserMsg) {
        _richHtmlMap.value = { ..._richHtmlMap.value, [newUserMsg.id]: richHtml }
      }
    }
  }

  async function abortSession(sessionId) {
    const chat = chatInstances.get(sessionId)
    if (!chat) return
    chat.stop()
  }

  async function _buildMessageTextAndFiles({ text, fileRefs, context }) {
    const textParts = []
    const files = [] // FileUIPart[]

    // File references: split multimodal vs text
    if (fileRefs?.length) {
      for (const ref of fileRefs) {
        if (ref._multimodal && ref._dataUrl) {
          // Multimodal: pass as FileUIPart for native image/PDF understanding
          files.push({
            type: 'file',
            mediaType: ref._mediaType,
            url: ref._dataUrl,
            filename: ref.path.split('/').pop(),
          })
        } else if (ref.content) {
          // Text: embed as XML ref
          let content = ref.content
          // Auto-append comments if the file has active comments and they're not already included
          if (!content.includes('<document-comments>')) {
            try {
              const { useCommentsStore } = await import('./comments')
              const commentsStore = useCommentsStore()
              const unresolved = commentsStore.unresolvedForFile(ref.path)
              if (unresolved.length) {
                let block = '\n\n<document-comments>\n'
                for (const c of unresolved) {
                  const lineNum = content.substring(0, c.range.from).split('\n').length
                  block += `  <comment id="${c.id}" line="${lineNum}" author="${c.author}">${c.text}</comment>\n`
                }
                block += '</document-comments>'
                content += block
              }
            } catch {}
          }
          textParts.push(`<file-ref path="${ref.path}">\n${content}\n</file-ref>`)
        }
      }
    }

    // Context (selection, active file)
    if (context?.text) {
      let ctx = `<context file="${context.file || ''}">`
      if (context.contextBefore) ctx += `\n...${context.contextBefore}`
      ctx += `\n<selection>\n${context.text}\n</selection>`
      if (context.contextAfter) ctx += `\n${context.contextAfter}...`
      ctx += '\n</context>'
      textParts.push(ctx)
    }

    // User text
    if (text) textParts.push(text)

    return { text: textParts.join('\n\n'), files }
  }

  // ─── Persistence ────────────────────────────────────────────────

  async function loadSessions() {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    // Cleanup existing Chat instances
    for (const [id, chat] of chatInstances) {
      try { chat.stop() } catch {}
    }
    chatInstances.clear()
    _chatVersion.value++

    sessions.value = []
    activeSessionId.value = null
    allSessionsMeta.value = []

    const chatsDir = `${workspace.shouldersDir}/chats`
    const exists = await invoke('path_exists', { path: chatsDir })
    if (!exists) {
      await invoke('create_dir', { path: chatsDir })
    }

    createSession()
    await loadAllSessionsMeta()
  }

  async function saveSession(id) {
    const workspace = useWorkspaceStore()
    if (!workspace.shouldersDir) return

    const session = sessions.value.find(s => s.id === id)
    if (!session) return

    // Get messages from Chat instance
    const chat = chatInstances.get(id)
    const messages = chat
      ? chat.state.messagesRef.value.map(m => ({
          ...m,
          parts: cleanPartsForStorage(m.parts),
        }))
      : session.messages || []

    const chatsDir = `${workspace.shouldersDir}/chats`
    const exists = await invoke('path_exists', { path: chatsDir })
    if (!exists) {
      await invoke('create_dir', { path: chatsDir })
    }

    const data = {
      id: session.id,
      label: session.label,
      _aiTitle: session._aiTitle || false,
      _keywords: session._keywords || [],
      modelId: session.modelId,
      messages,
      status: 'idle',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    }

    try {
      await invoke('write_file', {
        path: `${chatsDir}/${id}.json`,
        content: JSON.stringify(data, null, 2),
      })

      const existingIdx = allSessionsMeta.value.findIndex(m => m.id === id)
      const meta = {
        id: session.id,
        label: session.label,
        updatedAt: session.updatedAt || session.createdAt,
        messageCount: messages.length,
        _aiTitle: session._aiTitle || false,
        _keywords: session._keywords || [],
      }
      if (existingIdx >= 0) {
        allSessionsMeta.value[existingIdx] = meta
      } else {
        allSessionsMeta.value.push(meta)
      }
    } catch (e) {
      console.warn('Failed to save chat session:', e)
    }
  }

  // ─── Title Generation ──────────────────────────────────────────

  function _maybeGenerateTitle(session) {
    if (session._aiTitle) return

    const chat = chatInstances.get(session.id)
    if (!chat) return

    const messages = chat.state.messagesRef.value
    const userMsgs = messages.filter(m => m.role === 'user')
    const assistantMsgs = messages.filter(m => m.role === 'assistant')
    if (userMsgs.length < 1 || assistantMsgs.length < 1) return
    // Only generate on the first exchange
    if (userMsgs.length > 1) return

    _generateTitle(session).catch(e => {
      console.warn('[chat] Title generation failed:', e)
    })
  }

  async function _generateTitle(session) {
    const workspace = useWorkspaceStore()
    const access = await resolveApiAccess({ strategy: 'ghost' }, workspace)
    if (!access) return

    const chat = chatInstances.get(session.id)
    if (!chat) return

    const messages = chat.state.messagesRef.value
    const firstUser = messages.find(m => m.role === 'user')
    const firstAssistant = messages.find(m => m.role === 'assistant')
    if (!firstUser || !firstAssistant) return

    const userText = extractTextFromParts(firstUser.parts || []).slice(0, 300)
    const assistantText = extractTextFromParts(firstAssistant.parts || []).slice(0, 300)
    if (!userText) return

    try {
      const tauriFetch = (await import('../services/tauriFetch')).tauriFetch
      const model = createModel(access, tauriFetch)

      const result = await generateText({
        model,
        system: 'Generate a concise title (3-8 words) and 3-5 search keywords for this conversation. Return as JSON: {"title": "...", "keywords": ["...", "..."]}. No quotes or punctuation at the end of the title.',
        prompt: `User: ${userText}\n\nAssistant: ${assistantText}`,
        maxTokens: 256,
      })

      if (!result.text) return

      let title = null
      let keywords = []
      try {
        const parsed = JSON.parse(result.text.trim())
        title = parsed.title?.trim()
        keywords = Array.isArray(parsed.keywords) ? parsed.keywords : []
      } catch {
        title = result.text.trim()
      }

      if (!title) return
      title = title.slice(0, 60)

      // Verify session still exists
      const current = sessions.value.find(s => s.id === session.id)
      if (!current) return

      current.label = title
      current._aiTitle = true
      current._keywords = keywords
      saveSession(current.id)
    } catch (e) {
      console.warn('[chat] Title generation failed:', e)
    }
  }

  // ─── Public API ─────────────────────────────────────────────────

  return {
    // State
    sessions,
    activeSessionId,
    allSessionsMeta,
    pendingPrefill,
    pendingSelection,

    // Getters
    activeSession,
    streamingCount,

    // Chat instance management
    getOrCreateChat,
    getChatInstance,

    // Session management
    createSession,
    deleteSession,
    reopenSession,
    loadAllSessionsMeta,
    setActiveSession,
    archiveAndNewChat,

    // Rich HTML for sent messages (reactive, separate from AI SDK message objects)
    getMsgRichHtml: (msgId) => _richHtmlMap.value[msgId] || null,

    // Messaging
    sendMessage,
    abortSession,

    // Persistence
    loadSessions,
    saveSession,
  }
})


