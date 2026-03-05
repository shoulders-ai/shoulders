/**
 * Provider proxy utilities: URL construction, auth headers, and usage extraction.
 *
 * The proxy is transparent — native provider format flows through unchanged.
 * These utilities handle server-side concerns: routing to the correct upstream,
 * setting API keys, and parsing usage for billing.
 */

// --- Usage extraction ---

export function extractUsage(provider, data) {
  if (provider === 'anthropic') {
    // Streaming: message_start has usage nested at data.message.usage
    //            message_delta has usage at data.usage (top-level)
    // Non-streaming: all at data.usage
    const u = data.usage || data.message?.usage || {}
    return {
      inputTokens:         u.input_tokens || 0,
      outputTokens:        u.output_tokens || 0,
      cacheReadTokens:     u.cache_read_input_tokens || 0,
      cacheCreationTokens: u.cache_creation_input_tokens || 0,
    }
  }
  if (provider === 'openai') {
    // Responses API: usage at top level or nested in response.completed events
    // input_tokens includes cached tokens — decompose into cache-miss + cache-read
    const u = data.usage || data.response?.usage || {}
    const total     = u.input_tokens || 0
    const cacheRead = u.input_tokens_details?.cached_tokens || 0
    return {
      inputTokens:         total - cacheRead,
      outputTokens:        u.output_tokens || 0,
      cacheReadTokens:     cacheRead,
      cacheCreationTokens: 0,
    }
  }
  if (provider === 'google') {
    // promptTokenCount includes cached tokens — decompose into cache-miss + cache-read
    const meta      = data.usageMetadata || {}
    const total     = meta.promptTokenCount || 0
    const cacheRead = meta.cachedContentTokenCount || 0
    return {
      inputTokens:         total - cacheRead,
      outputTokens:        meta.candidatesTokenCount || 0,
      cacheReadTokens:     cacheRead,
      cacheCreationTokens: 0,
    }
  }
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
}

// --- Provider URL + headers ---

export function getProviderUrl(provider, model, streaming) {
  if (provider === 'anthropic') {
    return 'https://api.anthropic.com/v1/messages'
  }
  if (provider === 'openai') {
    return 'https://api.openai.com/v1/responses'
  }
  if (provider === 'google') {
    const method = streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`
  }
  throw new Error(`Unknown provider: ${provider}`)
}

export function getProviderHeaders(provider, apiKey) {
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  }
  if (provider === 'openai') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
  }
  if (provider === 'google') {
    return {
      'Content-Type': 'application/json',
    }
  }
  return { 'Content-Type': 'application/json' }
}

export function appendGoogleKey(url, apiKey) {
  if (url.includes('?')) return `${url}&key=${apiKey}`
  return `${url}?key=${apiKey}`
}
