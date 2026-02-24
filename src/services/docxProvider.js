import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useWorkspaceStore } from '../stores/workspace'
import { resolveApiAccess, callModel } from './apiClient'
import { formatRequest, parseSSEChunk, interpretEvent } from './chatProvider'
import { nanoid } from '../stores/utils'
import { getUsage, normalizeUsage, mergeUsage, calculateCost, createEmptyUsage } from './tokenUsage'

/**
 * Creates a provider for @superdoc-dev/ai AIActions.
 * Wraps our Rust proxy (callModel for non-streaming, chat_stream for streaming).
 */
export function createDocxAIProvider(modelId) {
  return {
    streamResults: false,

    async getCompletion(messages, options) {
      const workspace = useWorkspaceStore()
      // Budget gate
      const { useUsageStore } = await import('../stores/usage')
      if (useUsageStore().isOverBudget) throw new Error('Monthly budget exceeded.')

      const access = await resolveApiAccess({ modelId }, workspace)
      if (!access) throw new Error('No API key configured for this model.')

      const result = await callModel({
        access,
        system: options?.system,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
        maxTokens: options?.maxTokens || 4096,
      })

      // Record usage
      if (result.rawUsage) {
        const usage = getUsage(access.provider, result.rawUsage, access.model)
        import('../stores/usage').then(({ useUsageStore }) => {
          useUsageStore().record({ usage, feature: 'docx', provider: access.provider, modelId: access.model })
        })
      }

      return result.text || ''
    },

    async *streamCompletion(messages, options) {
      const workspace = useWorkspaceStore()
      // Budget gate
      const { useUsageStore } = await import('../stores/usage')
      if (useUsageStore().isOverBudget) throw new Error('Monthly budget exceeded.')

      const access = await resolveApiAccess({ modelId }, workspace)
      if (!access) throw new Error('No API key configured for this model.')

      const { provider } = access
      const sessionId = `docx-ai-${nanoid()}`

      const apiMessages = messages.map(m => ({
        role: m.role,
        content: m.content,
      }))

      const request = formatRequest(provider, {
        url: access.url,
        apiKey: access.apiKey,
        model: access.model,
        messages: apiMessages,
        system: options?.system,
        maxTokens: options?.maxTokens || 4096,
        providerHint: access.providerHint,
      })

      let buffer = ''
      let resolve = null
      let done = false
      const queue = []
      let usageAccumulator = createEmptyUsage()

      const unlistenChunk = await listen(`chat-chunk-${sessionId}`, (event) => {
        const raw = event.payload?.data
        if (!raw) return

        const { events, remainingBuffer } = parseSSEChunk(provider, raw, buffer)
        buffer = remainingBuffer

        for (const evt of events) {
          const interpreted = interpretEvent(provider, evt)
          if (!interpreted) continue
          if (interpreted.usage) {
            const partial = normalizeUsage(provider, interpreted.usage)
            usageAccumulator = mergeUsage(usageAccumulator, partial)
          }
          if (interpreted.type === 'text_delta') {
            queue.push(interpreted.text)
            if (resolve) { resolve(); resolve = null }
          }
        }
      })

      const unlistenDone = await listen(`chat-done-${sessionId}`, () => {
        // Record accumulated usage
        if (usageAccumulator.total > 0) {
          usageAccumulator.cost = calculateCost(usageAccumulator, access.model)
          import('../stores/usage').then(({ useUsageStore }) => {
            useUsageStore().record({ usage: usageAccumulator, feature: 'docx', provider, modelId: access.model })
          })
        }
        done = true
        if (resolve) { resolve(); resolve = null }
      })

      const unlistenError = await listen(`chat-error-${sessionId}`, () => {
        done = true
        if (resolve) { resolve(); resolve = null }
      })

      await invoke('chat_stream', {
        sessionId,
        request: {
          url: request.url,
          headers: request.headers,
          body: request.body,
        },
      })

      try {
        while (!done || queue.length > 0) {
          if (queue.length > 0) {
            yield queue.shift()
          } else if (!done) {
            await new Promise(r => { resolve = r })
          }
        }
      } finally {
        unlistenChunk()
        unlistenDone()
        unlistenError()
        invoke('chat_cleanup', { sessionId }).catch(() => {})
      }
    },
  }
}
