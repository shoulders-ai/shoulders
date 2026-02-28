import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { watch } from 'vue'
import { Chat } from '@ai-sdk/vue'
import { lastAssistantMessageIsCompleteWithToolCalls } from 'ai'
import { nanoid } from './utils'
import { useWorkspaceStore } from './workspace'
import { resolveApiAccess } from '../services/apiClient'
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

export const useChatStore = defineStore('chat', {
  state: () => ({
    sessions: [],
    activeSessionId: null,
    allSessionsMeta: [], // [{ id, label, updatedAt, messageCount }]
    _chatVersion: 0, // Reactive trigger — increment when Chat instances are created/destroyed
  }),

  getters: {
    activeSession(state) {
      return state.sessions.find(s => s.id === state.activeSessionId) || null
    },
    streamingCount() {
      let count = 0
      for (const [id, chat] of chatInstances) {
        const session = this.sessions.find(s => s.id === id)
        if (session?._background) {
          const status = chat.state.statusRef.value
          if (status === 'submitted' || status === 'streaming') count++
        }
      }
      return count
    },
  },

  actions: {
    // ─── Chat Instance Management ────────────────────────────────

    /**
     * Get or create a Chat instance for a session.
     */
    getOrCreateChat(session) {
      if (chatInstances.has(session.id)) return chatInstances.get(session.id)

      console.log('[chat] Creating Chat instance for session:', session.id)

      const chat = new Chat({
        id: session.id,
        messages: session._savedMessages || [],
        transport: createChatTransport(() => this._buildConfig(session)),
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,

        onToolCall: async ({ toolCall }) => {
          // Client-side tool handling if needed
          // The ToolLoopAgent in the transport handles server-side tools
        },

        onError: (err) => {
          console.error(`[chat] Error in session ${session.id}:`, err)
          session.updatedAt = new Date().toISOString()
        },
      })

      chatInstances.set(session.id, chat)
      this._chatVersion++ // Trigger reactivity for getChatInstance consumers

      // Watch for status transitions to save on completion
      watch(
        () => chat.state.statusRef.value,
        (newStatus, oldStatus) => {
          console.log(`[chat] Session ${session.id} status: ${oldStatus} → ${newStatus}`)
          if (newStatus === 'ready' && (oldStatus === 'streaming' || oldStatus === 'submitted')) {
            session.updatedAt = new Date().toISOString()
            this.saveSession(session.id)

            // Auto-cleanup background sessions
            if (session._background) {
              this._removeFromSessions(session.id)
            }
          }
        },
      )

      return chat
    },

    /**
     * Get an existing Chat instance (without creating).
     * Accesses _chatVersion to establish reactive dependency for computed() consumers.
     */
    getChatInstance(sessionId) {
      void this._chatVersion // reactive dependency — re-evaluate when Chat instances change
      return chatInstances.get(sessionId) || null
    },

    /**
     * Build fresh config for the transport. Called per-request.
     */
    async _buildConfig(session) {
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

      console.log('[chat] _buildConfig:', { provider, model: access.model, isShoulders: access.provider === 'shoulders', systemLen: systemPrompt.length })

      return {
        access,
        workspace,
        systemPrompt,
        thinkingConfig,
        provider,
        onUsage: (normalized, modelId) => {
          normalized.cost = calculateCost(normalized, modelId)
          import('./usage').then(({ useUsageStore }) => {
            useUsageStore().record({
              usage: normalized,
              feature: 'chat',
              provider,
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
    },

    // ─── Session Management ──────────────────────────────────────

    createSession(modelId) {
      const workspace = useWorkspaceStore()
      const configDefault = workspace.modelsConfig?.models?.find(m => m.default)?.id || 'sonnet'
      const defaultModel = workspace.selectedModelId || configDefault
      const id = nanoid(12)
      const session = {
        id,
        label: `Chat ${this.sessions.length + 1}`,
        modelId: modelId || defaultModel,
        messages: [], // For UI display — overridden by Chat instance once created
        status: 'idle',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      this.sessions.push(session)
      this.activeSessionId = id

      // Pre-create Chat instance so messages are immediately reactive
      this.getOrCreateChat(session)

      return id
    },

    deleteSession(id) {
      const session = this.sessions.find(s => s.id === id)
      if (!session) return

      // Stop Chat instance
      const chat = chatInstances.get(id)
      if (chat) {
        try { chat.stop() } catch {}
        chatInstances.delete(id)
        this._chatVersion++
      }

      const idx = this.sessions.indexOf(session)
      this.sessions.splice(idx, 1)

      // Delete persisted file
      const workspace = useWorkspaceStore()
      if (workspace.shouldersDir) {
        invoke('delete_path', { path: `${workspace.shouldersDir}/chats/${id}.json` }).catch(() => {})
      }

      if (this.activeSessionId === id) {
        this.activeSessionId = this.sessions.length > 0 ? this.sessions[this.sessions.length - 1].id : null
      }
    },

    async reopenSession(id) {
      const existing = this.sessions.find(s => s.id === id)
      if (existing) {
        if (existing._background) existing._background = false
        this.activeSessionId = id
        return
      }

      await this._archiveCurrent()

      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      try {
        const content = await invoke('read_file', { path: `${workspace.shouldersDir}/chats/${id}.json` })
        const data = JSON.parse(content)

        // Migrate old messages to UIMessage parts[] format
        const messages = (data.messages || []).map(migrateOldMessage)

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

        this.sessions.push(session)
        this.activeSessionId = id

        // Pre-create Chat so messages are immediately available
        this.getOrCreateChat(session)
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
          } catch {}
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
      if (!active) return

      // Check if Chat has any messages
      const chat = chatInstances.get(active.id)
      const hasMessages = chat
        ? chat.state.messagesRef.value.length > 0
        : active.messages.length > 0

      if (!hasMessages) return

      await this._archiveCurrent()
      this.createSession()
    },

    async _archiveCurrent() {
      const active = this.activeSession
      if (!active) return

      const chat = chatInstances.get(active.id)
      const hasMessages = chat
        ? chat.state.messagesRef.value.length > 0
        : active.messages.length > 0

      if (!hasMessages) return

      const isStreaming = chat && ['submitted', 'streaming'].includes(chat.state.statusRef.value)

      if (isStreaming) {
        active._background = true
      } else {
        await this.saveSession(active.id)
        this._removeFromSessions(active.id)
      }
    },

    _removeFromSessions(id) {
      const session = this.sessions.find(s => s.id === id)
      if (!session) return

      const chat = chatInstances.get(id)
      if (chat) {
        try { chat.stop() } catch {}
        chatInstances.delete(id)
        this._chatVersion++
      }

      const idx = this.sessions.indexOf(session)
      this.sessions.splice(idx, 1)
    },

    // ─── Messaging ───────────────────────────────────────────────

    async sendMessage(sessionId, { text, fileRefs, context }) {
      const session = this.sessions.find(s => s.id === sessionId)
      if (!session) {
        console.warn('[chat] sendMessage: session not found:', sessionId)
        return
      }

      const chat = this.getOrCreateChat(session)

      // Check streaming state
      const status = chat.state.statusRef.value
      if (status === 'submitted' || status === 'streaming') {
        console.warn('[chat] sendMessage: already streaming, ignoring')
        return
      }

      // Budget gate
      const { useUsageStore } = await import('./usage')
      if (useUsageStore().isOverBudget) {
        // Can't inject error messages directly into Chat — the Chat manages its own messages.
        // We'll need to handle this differently, maybe by throwing in the transport.
        console.warn('[chat] Budget exceeded')
        return
      }

      // Auto-label on first message
      const isFirst = chat.state.messagesRef.value.length === 0
      if (isFirst && text) {
        session.label = text.slice(0, 40).replace(/\n/g, ' ').trim()
      }

      // Build message text with workspace meta + file refs + context
      const messageText = await this._buildMessageText({ text, fileRefs, context })

      console.log('[chat] Sending message:', { sessionId, textLen: messageText.length, msgCount: chat.state.messagesRef.value.length })
      chat.sendMessage({ text: messageText })
    },

    async abortSession(sessionId) {
      const chat = chatInstances.get(sessionId)
      if (!chat) return
      chat.stop()
    },

    /**
     * Build the full message text including workspace meta, file refs, and context.
     */
    async _buildMessageText({ text, fileRefs, context }) {
      const parts = []

      // Workspace meta is now in the system prompt (_buildConfig), not the user message.
      // This keeps the UI clean — the user only sees their own text.

      // File references
      if (fileRefs?.length) {
        for (const ref of fileRefs) {
          if (ref.content) {
            parts.push(`<file-ref path="${ref.path}">\n${ref.content}\n</file-ref>`)
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
        parts.push(ctx)
      }

      // User text
      if (text) parts.push(text)

      return parts.join('\n\n')
    },

    // ─── Persistence ─────────────────────────────────────────────

    async loadSessions() {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      // Cleanup existing Chat instances
      for (const [id, chat] of chatInstances) {
        try { chat.stop() } catch {}
      }
      chatInstances.clear()
      this._chatVersion++

      this.sessions = []
      this.activeSessionId = null
      this.allSessionsMeta = []

      const chatsDir = `${workspace.shouldersDir}/chats`
      const exists = await invoke('path_exists', { path: chatsDir })
      if (!exists) {
        await invoke('create_dir', { path: chatsDir })
      }

      this.createSession()
      await this.loadAllSessionsMeta()
    },

    async saveSession(id) {
      const workspace = useWorkspaceStore()
      if (!workspace.shouldersDir) return

      const session = this.sessions.find(s => s.id === id)
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

        const existingIdx = this.allSessionsMeta.findIndex(m => m.id === id)
        const meta = {
          id: session.id,
          label: session.label,
          updatedAt: session.updatedAt || session.createdAt,
          messageCount: messages.length,
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


// ─── Message Migration ────────────────────────────────────────────────

/**
 * Convert an old-format message to UIMessage format (parts[]).
 * Old format: { content, toolCalls, thinking, _thinkingBlocks }
 * New format: { parts: [{ type: 'reasoning', text }, { type: 'text', text }, { type: 'tool-name', ... }] }
 */
function migrateOldMessage(msg) {
  // Already in new format
  if (msg.parts && Array.isArray(msg.parts)) return msg

  // Skip tool result messages (they're handled by the SDK now)
  if (msg._isToolResult) return null

  const parts = []

  // Thinking → reasoning parts
  if (msg._thinkingBlocks?.length) {
    for (const block of msg._thinkingBlocks) {
      if (block.thinking) {
        parts.push({ type: 'reasoning', text: block.thinking })
      }
    }
  } else if (msg.thinking) {
    parts.push({ type: 'reasoning', text: msg.thinking })
  }

  // Content → text part
  if (msg.content) {
    parts.push({ type: 'text', text: msg.content })
  }

  // Tool calls → tool parts
  if (msg.toolCalls?.length) {
    for (const tc of msg.toolCalls) {
      parts.push({
        type: `tool-${tc.name}`,
        toolCallId: tc.id,
        toolName: tc.name,
        state: tc.status === 'done' ? 'output-available'
          : tc.status === 'error' ? 'output-error'
          : 'input-available',
        input: tc.input || {},
        output: tc.output || undefined,
        errorText: tc.status === 'error' ? tc.output : undefined,
      })
    }
  }

  // File refs → keep as metadata on user messages
  const result = {
    id: msg.id,
    role: msg.role,
    parts: parts.length > 0 ? parts : [{ type: 'text', text: '' }],
    createdAt: msg.createdAt ? new Date(msg.createdAt) : new Date(),
  }

  // Preserve file refs and context for user messages
  if (msg.role === 'user') {
    if (msg.fileRefs?.length) result.metadata = { ...result.metadata, fileRefs: msg.fileRefs }
    if (msg.context) result.metadata = { ...result.metadata, context: msg.context }
  }

  return result
}
