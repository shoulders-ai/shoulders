/**
 * Custom fetch() wrapper that routes HTTP requests through Rust's chat_stream.
 *
 * The AI SDK needs a standard fetch() interface for making API calls.
 * In Tauri, we can't call provider APIs directly from the webview (CORS).
 * This wraps the existing Rust chat_stream command in a fetch()-compatible
 * interface that returns a ReadableStream.
 *
 * The Rust side (chat.rs) emits three events per session:
 *   chat-chunk-{sessionId}  → { data: string }  (raw SSE bytes)
 *   chat-done-{sessionId}   → { session_id, aborted }
 *   chat-error-{sessionId}  → { error: string }
 *
 * IMPORTANT: Event listeners MUST be set up BEFORE invoke('chat_stream')
 * to avoid a race condition where fast responses (errors, localhost) emit
 * events before listeners exist.
 */

import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

let _counter = 0

function _injectAnthropicCacheControl(body) {
  // Cache the system prompt (string → array with cache_control; array → mark last block)
  if (typeof body.system === 'string') {
    body.system = [{ type: 'text', text: body.system, cache_control: { type: 'ephemeral' } }]
  } else if (Array.isArray(body.system) && body.system.length > 0) {
    const last = body.system[body.system.length - 1]
    if (last.type === 'text' && !last.cache_control) last.cache_control = { type: 'ephemeral' }
  }
  // Cache the full tools list (breakpoint on last tool — Anthropic caches everything up to it)
  if (Array.isArray(body.tools) && body.tools.length > 0) {
    const last = body.tools[body.tools.length - 1]
    if (!last.cache_control) last.cache_control = { type: 'ephemeral' }
  }
}

/**
 * Create a fetch function that routes through Tauri's Rust HTTP proxy.
 * Use this as the `fetch` option for AI SDK provider constructors.
 *
 * @returns {Function} A fetch-compatible function
 */
export function createTauriFetch() {
  return async function tauriFetch(url, options = {}) {
    const sessionId = `sdk-${++_counter}-${Date.now()}`

    // Parse headers from options
    const headers = {}
    if (options.headers) {
      if (options.headers instanceof Headers) {
        options.headers.forEach((v, k) => { headers[k] = v })
      } else if (Array.isArray(options.headers)) {
        for (const [k, v] of options.headers) { headers[k] = v }
      } else {
        Object.assign(headers, options.headers)
      }
    }

    // Get body as string
    let body = ''
    if (options.body) {
      body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
    }

    // Fix poisoned tool_use.input in the final request body.
    // Invalid tool call JSON (XML in args) creates output-error parts where input
    // is undefined/missing. The SDK validator requires input to be undefined (skips
    // schema check), but Anthropic/OpenAI/Google require input to be a dict.
    // Fix here — after SDK validation, before the request leaves the app.
    if (body) {
      try {
        const parsed = JSON.parse(body)
        if (parsed.messages) {
          let fixed = false
          for (const msg of parsed.messages) {
            const content = msg.content
            if (!Array.isArray(content)) continue
            for (const part of content) {
              if (part.type === 'tool_use' && (typeof part.input !== 'object' || part.input === null || part.input === undefined)) {
                console.warn('[tauriFetch] Fixing tool_use.input:', part.name, 'was:', typeof part.input)
                part.input = {}
                fixed = true
              }
            }
          }
          if (fixed) body = JSON.stringify(parsed)
        }
      } catch { /* ignore */ }
    }

    // Inject Anthropic prompt caching for direct API calls (desktop with own API key)
    // Shoulders proxy users get this server-side; direct users need it here
    if (body && url.toString().includes('api.anthropic.com')) {
      try {
        const parsed = JSON.parse(body)
        _injectAnthropicCacheControl(parsed)
        body = JSON.stringify(parsed)
      } catch { /* ignore malformed body */ }
    }

    const encoder = new TextEncoder()
    const unlisteners = []
    let streamController

    function _cleanup() {
      for (const unlisten of unlisteners) {
        try { unlisten() } catch {}
      }
      unlisteners.length = 0
      invoke('chat_cleanup', { sessionId }).catch(() => {})
    }

    // 1. Set up event listeners FIRST (before invoke) to avoid race condition
    const unChunk = await listen(`chat-chunk-${sessionId}`, (event) => {
      try {
        const data = event.payload.data
        // Filter out Shoulders proxy custom events (e.g. shoulders_balance)
        // that would crash the AI SDK's stream validator
        if (data && data.includes('"type":"shoulders_balance"')) {
          try {
            // Extract balance from the SSE data line
            const match = data.match(/data:\s*(\{[^}]+\})/)
            if (match) {
              const balance = JSON.parse(match[1])
              window.dispatchEvent(new CustomEvent('shoulders-balance', { detail: balance }))
            }
          } catch {}
          return // Don't forward to SDK
        }
        streamController?.enqueue(encoder.encode(data))
      } catch {
        // Stream already closed
      }
    })
    unlisteners.push(unChunk)

    const unDone = await listen(`chat-done-${sessionId}`, () => {
      console.log('[tauriFetch] Stream done:', sessionId)
      try {
        streamController?.close()
      } catch {
        // Already closed
      }
      _cleanup()
    })
    unlisteners.push(unDone)

    const unError = await listen(`chat-error-${sessionId}`, (event) => {
      const errMsg = event.payload?.error || 'Unknown streaming error'
      console.error('[tauriFetch] Stream error:', sessionId, errMsg)
      try {
        streamController?.error(new Error(errMsg))
      } catch {
        // Already closed
      }
      _cleanup()
    })
    unlisteners.push(unError)

    // 2. Create ReadableStream (start is synchronous — controller available immediately)
    const readableStream = new ReadableStream({
      start(controller) {
        streamController = controller
      },

      cancel() {
        // Called when the consumer cancels the stream (e.g. abort)
        invoke('chat_abort', { sessionId }).catch(() => {})
        _cleanup()
      },
    })

    // 3. Handle abort signal
    if (options.signal) {
      if (options.signal.aborted) {
        _cleanup()
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      options.signal.addEventListener('abort', () => {
        invoke('chat_abort', { sessionId }).catch(() => {})
        try {
          streamController?.close()
        } catch {
          // Already closed
        }
        _cleanup()
      }, { once: true })
    }

    // 4. Start the stream via Rust (ALL listeners are ready now)
    try {
      console.log('[tauriFetch] Starting stream:', { sessionId, url: url.toString(), method: options.method || 'POST' })
      await invoke('chat_stream', {
        sessionId,
        request: { url: url.toString(), headers, body },
      })
    } catch (invokeErr) {
      console.error('[tauriFetch] invoke failed:', invokeErr)
      _cleanup()
      throw new Error(`Tauri invoke failed: ${invokeErr}`)
    }

    // Return a standard Response with streaming body
    return new Response(readableStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    })
  }
}
