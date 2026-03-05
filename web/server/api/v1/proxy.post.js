import { generateId } from '../../utils/id.js'
import { calculateCredits, deductCredits } from '../../utils/credits.js'
import { triggerRecharge } from '../../utils/recharge.js'
import {
  extractUsage,
  getProviderUrl,
  getProviderHeaders,
  appendGoogleKey,
} from '../../utils/providerProxy.js'
import { eq } from 'drizzle-orm'
import { useDb } from '../../db/index.js'
import { apiCalls, users } from '../../db/schema.js'

export default defineEventHandler(async (event) => {
  let user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const db = useDb()

  if (user.credits <= 0) {
    if (user.plan === 'pro' && user.autoRechargeEnabled) {
      const result = await triggerRecharge(user)
      if (!result.success) {
        setResponseStatus(event, 402)
        return { error: 'Insufficient balance. Auto-recharge failed. Add funds at shoulde.rs/account.' }
      }
      // Re-read user to get updated credits
      user = db.select().from(users).where(eq(users.id, user.id)).get()
    } else {
      setResponseStatus(event, 402)
      if (user.plan === 'pro') {
        return { error: 'Insufficient balance. Add funds at shoulde.rs/account.' }
      }
      return { error: 'Free trial balance depleted. Subscribe at shoulde.rs/subscribe to continue.' }
    }
  }

  const body = await readBody(event)
  const provider = getHeader(event, 'x-shoulders-provider') || 'anthropic'
  const model = getHeader(event, 'x-shoulders-model') || body.model || 'unknown'
  const isStreaming = getHeader(event, 'x-shoulders-stream') === '1'
  const config = useRuntimeConfig()

  // Resolve API key
  const apiKeyMap = {
    anthropic: config.anthropicApiKey,
    openai: config.openaiApiKey,
    google: config.googleApiKey,
  }
  const apiKey = apiKeyMap[provider]
  if (!apiKey) {
    setResponseStatus(event, 502)
    return { error: `Provider ${provider} is not configured on this server` }
  }

  // Inject Anthropic prompt caching — system prompt + tools are repeated every turn
  // and can be cached after the first call (system: 0.1× reads, tools: 0.1× reads)
  if (provider === 'anthropic') {
    injectAnthropicCacheControl(body)
  }

  const startTime = Date.now()

  // Build upstream URL and headers (server-side API keys)
  let url = getProviderUrl(provider, model, isStreaming)
  const headers = getProviderHeaders(provider, apiKey)

  // Google uses API key in URL
  if (provider === 'google') {
    url = appendGoogleKey(url, apiKey)
  }

  // Forward anthropic-beta header (needed for thinking/extended output)
  if (provider === 'anthropic') {
    const anthropicBeta = getHeader(event, 'anthropic-beta')
    if (anthropicBeta) {
      headers['anthropic-beta'] = anthropicBeta
    }
  }

  try {
    if (isStreaming) {
      return await handleStreaming(event, { url, headers, body, provider, model, user, startTime })
    } else {
      return await handleNonStreaming(event, { url, headers, body, provider, model, user, startTime })
    }
  } catch (err) {
    logApiCall(user.id, provider, model, 0, 0, 0, 0, 0, Date.now() - startTime, 'error', err.message)
    setResponseStatus(event, 502)
    return { error: 'Upstream provider error' }
  }
})

function injectAnthropicCacheControl(body) {
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

async function handleStreaming(event, { url, headers, body, provider, model, user, startTime }) {
  const upstreamRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!upstreamRes.ok) {
    const errorText = await upstreamRes.text()
    logApiCall(user.id, provider, model, 0, 0, 0, 0, 0, Date.now() - startTime, 'error', errorText.slice(0, 500))
    setResponseStatus(event, upstreamRes.status)
    return { error: 'API request failed' }
  }

  // Set SSE headers
  setResponseHeaders(event, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  const reader = upstreamRes.body.getReader()
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()

  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalCacheReadTokens = 0
  let totalCacheCreationTokens = 0
  let sseBuffer = '' // Buffer for incomplete SSE lines split across TCP chunks

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any remaining buffered data
          if (sseBuffer) {
            const line = sseBuffer
            sseBuffer = ''
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data && data !== '[DONE]') {
                try {
                  const parsed = JSON.parse(data)
                  const usage = extractUsage(provider, parsed)
                  if (usage.inputTokens)         totalInputTokens = usage.inputTokens
                  if (usage.outputTokens)        totalOutputTokens = usage.outputTokens
                  if (usage.cacheReadTokens)     totalCacheReadTokens = usage.cacheReadTokens
                  if (usage.cacheCreationTokens) totalCacheCreationTokens = usage.cacheCreationTokens
                } catch { /* ignore */ }
              }
            }
            // Flush the raw buffered line to the client
            controller.enqueue(encoder.encode(line + '\n'))
          }

          // Deduct actual cost now that we know the real token counts
          try {
            const creditsUsed = calculateCredits(totalInputTokens, totalOutputTokens, model, {
              cacheRead: totalCacheReadTokens,
              cacheCreation: totalCacheCreationTokens,
            })
            if (creditsUsed > 0) {
              await deductCredits(user.id, creditsUsed)
            }
            logApiCall(user.id, provider, model, totalInputTokens, totalOutputTokens, totalCacheReadTokens, totalCacheCreationTokens, creditsUsed, Date.now() - startTime, 'success', null)

            // Send updated balance to client as SSE trailer
            const freshDb = useDb()
            const updatedUser = freshDb.select().from(users).where(eq(users.id, user.id)).get()
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: "shoulders_balance", credits: updatedUser?.credits ?? 0, cost_cents: creditsUsed })}\n\n`
            ))

            // Fire-and-forget recharge if near threshold
            if (user.plan === 'pro' && user.autoRechargeEnabled) {
              const remaining = user.credits - creditsUsed
              if (remaining <= user.autoRechargeThreshold) {
                triggerRecharge(user).catch(() => {})
              }
            }
          } catch (e) {
            console.error('[proxy] Post-stream credit/logging error:', e)
          }

          controller.close()
          return
        }

        const text = decoder.decode(value, { stream: true })

        // Buffer incomplete SSE lines, parse JSON to extract usage for billing,
        // but pass through ALL raw bytes unchanged to the client
        const fullText = sseBuffer + text
        sseBuffer = ''
        const lines = fullText.split('\n')

        // If last line is incomplete (chunk didn't end with \n), buffer it
        if (!fullText.endsWith('\n')) {
          sseBuffer = lines.pop()
        }

        // Extract usage from complete data lines (for billing only)
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (!data || data === '[DONE]') continue
          try {
            const parsed = JSON.parse(data)
            const usage = extractUsage(provider, parsed)
            if (usage.inputTokens)         totalInputTokens = usage.inputTokens
            if (usage.outputTokens)        totalOutputTokens = usage.outputTokens
            if (usage.cacheReadTokens)     totalCacheReadTokens = usage.cacheReadTokens
            if (usage.cacheCreationTokens) totalCacheCreationTokens = usage.cacheCreationTokens
          } catch { /* incomplete JSON — ignore */ }
        }

        // Pass through raw bytes unchanged
        controller.enqueue(value)
      } catch (err) {
        controller.error(err)
      }
    },
    cancel() {
      reader.cancel()
    },
  })

  return sendStream(event, stream)
}

async function handleNonStreaming(event, { url, headers, body, provider, model, user, startTime }) {
  const upstreamRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  const elapsed = Date.now() - startTime
  if (!upstreamRes.ok) {
    const errorText = await upstreamRes.text()
    logApiCall(user.id, provider, model, 0, 0, 0, 0, 0, elapsed, 'error', errorText.slice(0, 500))
    setResponseStatus(event, upstreamRes.status)
    return { error: 'API request failed' }
  }

  const json = await upstreamRes.json()
  const usage = extractUsage(provider, json)

  const creditsUsed = calculateCredits(usage.inputTokens, usage.outputTokens, model, {
    cacheRead: usage.cacheReadTokens,
    cacheCreation: usage.cacheCreationTokens,
  })
  await deductCredits(user.id, creditsUsed)
  logApiCall(user.id, provider, model, usage.inputTokens, usage.outputTokens, usage.cacheReadTokens, usage.cacheCreationTokens, creditsUsed, Date.now() - startTime, 'success', null)

  // Fire-and-forget recharge if near threshold
  if (user.plan === 'pro' && user.autoRechargeEnabled) {
    const remaining = user.credits - creditsUsed
    if (remaining <= user.autoRechargeThreshold) {
      triggerRecharge(user).catch(() => {})
    }
  }

  // Return upstream JSON as-is (native SDK on client parses its own format)
  return json
}

function logApiCall(userId, provider, model, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, creditsUsed, durationMs, status, errorMessage) {
  try {
    const db = useDb()
    db.insert(apiCalls).values({
      id: generateId(),
      userId,
      provider,
      model,
      inputTokens,
      outputTokens,
      cacheReadTokens,
      cacheCreationTokens,
      creditsUsed,
      durationMs,
      status,
      errorMessage,
      createdAt: new Date().toISOString(),
    }).run()
  } catch (e) {
    console.error('[proxy] Failed to log API call:', e)
  }
}
