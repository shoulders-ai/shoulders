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
        streamController?.enqueue(encoder.encode(event.payload.data))
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
