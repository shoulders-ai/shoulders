/**
 * Centralized AI API client.
 *
 * Owns: key resolution, non-streaming transport, Shoulders proxy URL.
 * Delegates: request formatting to chatProvider.js, SSE parsing stays there too.
 *
 * Two main exports:
 *   resolveApiAccess(options, workspace) — "who do I call and with what key?"
 *   callModel(options)                  — non-streaming: format → invoke → parse
 */

import { invoke } from '@tauri-apps/api/core'
import { formatNonStreamingRequest } from './chatProvider'

// Single source of truth for Shoulders proxy URLs
const SHOULDERS_BASE = import.meta.env.DEV ? 'http://localhost:3000' : 'https://shoulde.rs'
export const SHOULDERS_PROXY_URL = `${SHOULDERS_BASE}/api/v1/proxy`
export const SHOULDERS_SEARCH_URL = `${SHOULDERS_BASE}/api/v1/search`

const PROVIDER_URLS = {
  anthropic: 'https://api.anthropic.com/v1/messages',
  openai: 'https://api.openai.com/v1/responses',
  google: 'https://generativelanguage.googleapis.com/v1beta/models',
}

// Fallback models for strategy-based resolution
export const GHOST_MODELS = [
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'google', model: 'gemini-2.5-flash-lite', keyEnv: 'GOOGLE_API_KEY' },
  { provider: 'openai', model: 'gpt-5-nano-2025-08-07', keyEnv: 'OPENAI_API_KEY' },
]

const CHEAP_MODELS = [
  { provider: 'google', model: 'gemini-2.5-flash-lite', keyEnv: 'GOOGLE_API_KEY' },
  { provider: 'anthropic', model: 'claude-haiku-4-5-20251001', keyEnv: 'ANTHROPIC_API_KEY' },
  { provider: 'openai', model: 'gpt-5-nano-2025-08-07', keyEnv: 'OPENAI_API_KEY' },
]

// ─── Billing Route (synchronous) ─────────────────────────────────────

/**
 * Synchronously determine the billing route for a given model.
 * Mirrors _resolveModelAccess priority (direct key > Shoulders) but
 * returns only the route type — no async token refresh.
 *
 * @param {string} modelId - Model ID from models.json
 * @param {object} workspace - Workspace store instance
 * @returns {{ route: 'direct', provider: string } | { route: 'shoulders' } | null}
 */
export function getBillingRoute(modelId, workspace) {
  const config = workspace.modelsConfig
  if (!config) {
    // Legacy: single Anthropic key
    if (workspace.apiKey && workspace.apiKey !== 'your-api-key-here') {
      return { route: 'direct', provider: 'anthropic' }
    }
    return workspace.shouldersAuth?.token ? { route: 'shoulders' } : null
  }

  const model = config.models?.find(m => m.id === modelId) || config.models?.[0]
  if (!model) return null

  const providerConfig = config.providers?.[model.provider]
  if (!providerConfig) return null

  const apiKey = workspace.apiKeys?.[providerConfig.apiKeyEnv]
  const hasDirectKey = apiKey && !apiKey.includes('your-')

  if (hasDirectKey) return { route: 'direct', provider: model.provider }
  if (workspace.shouldersAuth?.token) return { route: 'shoulders' }
  return null
}

// ─── Key Resolution ──────────────────────────────────────────────────

/**
 * Resolve API access for an AI call.
 * Auto-refreshes Shoulders token if expired.
 *
 * @param {object} options
 * @param {string} [options.modelId]   - Named model from models.json (chat/tasks/docx)
 * @param {'ghost'|'cheapest'} [options.strategy] - Auto-select by strategy
 * @param {object} workspace - Workspace store instance
 * @returns {Promise<{ model, provider, apiKey, url, providerHint? } | null>}
 */
export async function resolveApiAccess(options, workspace) {
  if (options.strategy === 'ghost') {
    // If user has a preferred ghost model, try it first
    if (workspace.ghostModelId) {
      const preferred = GHOST_MODELS.find(m => m.model === workspace.ghostModelId)
      if (preferred) {
        const keys = workspace.apiKeys || {}
        const key = keys[preferred.keyEnv]
        if (key && !key.includes('your-')) {
          return { model: preferred.model, provider: preferred.provider, apiKey: key, url: PROVIDER_URLS[preferred.provider] }
        }
        // Try via Shoulders
        if (workspace.shouldersAuth?.token) {
          const freshResult = await workspace.ensureFreshToken()
          if (freshResult === 'network_error') return { _networkError: true }
          if (workspace.shouldersAuth?.token) {
            return {
              model: preferred.model,
              provider: 'shoulders',
              providerHint: preferred.provider,
              apiKey: workspace.shouldersAuth.token,
              url: SHOULDERS_PROXY_URL,
            }
          }
        }
      }
    }
    return _resolveFromList(GHOST_MODELS, workspace)
  }
  if (options.strategy === 'cheapest') return _resolveFromList(CHEAP_MODELS, workspace)
  if (options.modelId) return _resolveModelAccess(options.modelId, workspace)
  return null
}

async function _resolveFromList(modelList, workspace) {
  const keys = workspace.apiKeys || {}
  for (const { provider, model, keyEnv } of modelList) {
    const key = keys[keyEnv]
    if (key && !key.includes('your-')) {
      return { model, provider, apiKey: key, url: PROVIDER_URLS[provider] }
    }
  }
  // Auto-refresh Shoulders token before using it
  if (workspace.shouldersAuth?.token) {
    const freshResult = await workspace.ensureFreshToken()
    if (freshResult === 'network_error') return { _networkError: true }
    if (!workspace.shouldersAuth?.token) return null
    const fallback = modelList[0]
    return {
      model: fallback.model,
      provider: 'shoulders',
      providerHint: fallback.provider,
      apiKey: workspace.shouldersAuth.token,
      url: SHOULDERS_PROXY_URL,
    }
  }
  return null
}

async function _resolveModelAccess(modelId, workspace) {
  const config = workspace.modelsConfig
  if (!config) {
    // Legacy fallback: single Anthropic key
    if (workspace.apiKey && workspace.apiKey !== 'your-api-key-here') {
      return {
        model: 'claude-sonnet-4-6',
        provider: 'anthropic',
        apiKey: workspace.apiKey,
        url: PROVIDER_URLS.anthropic,
      }
    }
    return null
  }

  const model = config.models?.find(m => m.id === modelId) || config.models?.[0]
  if (!model) return null

  const providerConfig = config.providers?.[model.provider]
  if (!providerConfig) return null

  const apiKey = workspace.apiKeys?.[providerConfig.apiKeyEnv]
  const hasDirectKey = apiKey && !apiKey.includes('your-')

  if (hasDirectKey) {
    let url = providerConfig.url || PROVIDER_URLS[model.provider]
    // Migrate stale OpenAI Chat Completions URL to Responses API
    if (model.provider === 'openai' && url?.includes('/v1/chat/completions')) {
      url = PROVIDER_URLS.openai
    }
    return {
      model: model.model,
      provider: model.provider,
      apiKey,
      url,
    }
  }

  // Auto-refresh Shoulders token before using it
  if (workspace.shouldersAuth?.token) {
    const freshResult = await workspace.ensureFreshToken()
    if (freshResult === 'network_error') return { _networkError: true }
    if (!workspace.shouldersAuth?.token) return null
    return {
      model: model.model,
      provider: 'shoulders',
      providerHint: model.provider,
      apiKey: workspace.shouldersAuth.token,
      url: SHOULDERS_PROXY_URL,
    }
  }

  return null
}

// ─── Non-Streaming Call ──────────────────────────────────────────────

/**
 * Make a non-streaming AI API call.
 *
 * @param {object} options
 * @param {object} options.access   - Result from resolveApiAccess()
 * @param {string} [options.system] - System prompt
 * @param {Array}  options.messages - Messages in Anthropic format
 * @param {Array}  [options.tools]  - Tools in Anthropic format
 * @param {object} [options.toolChoice] - Anthropic tool_choice format
 * @param {number} [options.maxTokens=4096]
 * @returns {{ text: string|null, rawResponse: object, rawUsage: object|null }}
 */
export async function callModel({ access, system, messages, tools, toolChoice, maxTokens = 4096 }) {
  const { provider, model, apiKey, url, providerHint } = access

  const request = formatNonStreamingRequest(provider, {
    url, apiKey, model, messages, system, tools, toolChoice, maxTokens, providerHint,
  })

  let response
  try {
    response = await invoke('proxy_api_call', {
      request: { url: request.url, method: 'POST', headers: request.headers, body: request.body },
    })
  } catch (invokeErr) {
    throw invokeErr
  }

  let data
  try {
    data = JSON.parse(response)
  } catch (parseErr) {
    throw parseErr
  }

  // Refresh Shoulders balance after proxy call
  if (provider === 'shoulders') {
    import('../stores/workspace').then(({ useWorkspaceStore }) => {
      useWorkspaceStore().refreshShouldersBalance()
    })
  }

  // Consume inline balance update if present (server-side support)
  if (data._shoulders) delete data._shoulders

  return {
    rawResponse: data,
    text: _extractText(provider, data),
    rawUsage: _extractRawUsage(provider, data),
  }
}

// ─── Response Helpers ────────────────────────────────────────────────

function _extractText(provider, data) {
  if (provider === 'anthropic' || provider === 'shoulders') {
    const block = data.content?.find(b => b.type === 'text')
    return block?.text || null
  }
  if (provider === 'openai') {
    // Responses API: output[] → message → content[] → output_text
    const msg = data.output?.find(i => i.type === 'message')
    return msg?.content?.find(c => c.type === 'output_text')?.text || null
  }
  if (provider === 'google') {
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null
  }
  return null
}

function _extractRawUsage(provider, data) {
  if (provider === 'google') return data.usageMetadata || null
  return data.usage || null
}

// ─── Convenience ─────────────────────────────────────────────────────

export function hasAnyAccess(workspace) {
  const keys = workspace.apiKeys || {}
  for (const { keyEnv } of CHEAP_MODELS) {
    const key = keys[keyEnv]
    if (key && !key.includes('your-')) return true
  }
  return !!workspace.shouldersAuth?.token
}
