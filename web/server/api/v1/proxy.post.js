import { generateId } from '../../utils/id.js'
import { calculateCredits, deductCredits } from '../../utils/credits.js'
import { triggerRecharge } from '../../utils/recharge.js'
import {
  translateRequest,
  translateResponse,
  translateStreamChunk,
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

  const startTime = Date.now()
  const isStreaming = body.stream === true
  const model = body.model || 'unknown'

  // Translate request to provider format
  const translatedBody = translateRequest(body, provider)
  let url = getProviderUrl(provider, model, isStreaming)
  const headers = getProviderHeaders(provider, apiKey)

  // Google uses API key in URL
  if (provider === 'google') {
    url = appendGoogleKey(url, apiKey)
  }

  try {
    if (isStreaming) {
      return await handleStreaming(event, { url, headers, translatedBody, provider, model, user, startTime })
    } else {
      return await handleNonStreaming(event, { url, headers, translatedBody, provider, model, user, startTime })
    }
  } catch (err) {
    logApiCall(user.id, provider, model, 0, 0, 0, Date.now() - startTime, 'error', err.message)
    setResponseStatus(event, 502)
    return { error: 'Upstream provider error' }
  }
})

async function handleStreaming(event, { url, headers, translatedBody, provider, model, user, startTime }) {
  const upstreamRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(translatedBody),
  })

  if (!upstreamRes.ok) {
    const errorText = await upstreamRes.text()
    logApiCall(user.id, provider, model, 0, 0, 0, Date.now() - startTime, 'error', errorText.slice(0, 500))
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
  let sseBuffer = '' // Buffer for incomplete SSE lines split across TCP chunks
  let anthropicSseBuffer = '' // Buffer for incomplete SSE lines in Anthropic streaming

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read()
        if (done) {
          // Flush any remaining buffered SSE data for non-Anthropic providers
          if (sseBuffer) {
            const line = sseBuffer
            sseBuffer = ''
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim()
              if (data === '[DONE]') {
                controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'))
              } else if (data) {
                try {
                  const parsed = JSON.parse(data)
                  const usage = extractUsage(provider, parsed)
                  if (usage.inputTokens) totalInputTokens = usage.inputTokens
                  if (usage.outputTokens) totalOutputTokens = usage.outputTokens
                  const events = translateStreamChunk(provider, parsed)
                  for (const evt of events) {
                    const eventType = evt.type || 'content_block_delta'
                    controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(evt)}\n\n`))
                  }
                } catch { /* ignore */ }
              }
            }
          }

          // Emit message_stop for providers that don't send [DONE] (e.g. OpenAI Responses API)
          // The buffer flush above handles [DONE] for providers that do send it (Google)
          if (provider !== 'anthropic') {
            controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'))
          }

          // Deduct actual cost now that we know the real token counts
          try {
            const creditsUsed = calculateCredits(totalInputTokens, totalOutputTokens, model)
            if (creditsUsed > 0) {
              await deductCredits(user.id, creditsUsed)
            }
            logApiCall(user.id, provider, model, totalInputTokens, totalOutputTokens, creditsUsed, Date.now() - startTime, 'success', null)

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

        if (provider === 'anthropic') {
          // Buffer incomplete SSE lines to avoid regex failing on split TCP chunks
          const fullText = anthropicSseBuffer + text
          anthropicSseBuffer = ''
          const lines = fullText.split('\n')

          // If last line is incomplete (chunk didn't end with \n), buffer it
          if (!fullText.endsWith('\n')) {
            anthropicSseBuffer = lines.pop()
          }

          // Track usage from complete SSE data lines
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            const usageMatch = data.match(/"usage"\s*:\s*\{[^}]+\}/)
            if (usageMatch) {
              try {
                const usageData = JSON.parse(`{${usageMatch[0]}}`)
                if (usageData.usage?.input_tokens) totalInputTokens = usageData.usage.input_tokens
                if (usageData.usage?.output_tokens) totalOutputTokens = usageData.usage.output_tokens
              } catch { /* ignore parse errors */ }
            }
          }

          // Pass through raw text as-is (Anthropic SSE format is already correct)
          controller.enqueue(encoder.encode(text))
        } else {
          // Translate chunks to Anthropic SSE format
          // Prepend any leftover from previous chunk (handles split lines)
          const fullText = sseBuffer + text
          sseBuffer = ''
          const lines = fullText.split('\n')

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i]

            // Last line might be incomplete if the chunk was split mid-line
            if (i === lines.length - 1 && !fullText.endsWith('\n')) {
              sseBuffer = line
              break
            }

            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (!data) continue
            if (data === '[DONE]') {
              controller.enqueue(encoder.encode('event: message_stop\ndata: {"type":"message_stop"}\n\n'))
              continue
            }
            try {
              const parsed = JSON.parse(data)

              // Track usage
              const usage = extractUsage(provider, parsed)
              if (usage.inputTokens) totalInputTokens = usage.inputTokens
              if (usage.outputTokens) totalOutputTokens = usage.outputTokens

              const events = translateStreamChunk(provider, parsed)
              for (const evt of events) {
                const eventType = evt.type || 'content_block_delta'
                controller.enqueue(encoder.encode(`event: ${eventType}\ndata: ${JSON.stringify(evt)}\n\n`))
              }
            } catch { /* incomplete JSON — will be caught by buffer on next chunk */ }
          }
        }
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

async function handleNonStreaming(event, { url, headers, translatedBody, provider, model, user, startTime }) {
  // Ensure stream is false (but not for Google — Google controls streaming via URL, not body field)
  if (provider !== 'google') {
    translatedBody.stream = false
  }
  if (provider === 'google' && url.includes('streamGenerateContent')) {
    url = url.replace('streamGenerateContent?alt=sse', 'generateContent')
  }

  // OpenAI reasoning models: minimize reasoning for non-streaming calls (ghost, quick tasks)
  // Reasoning tokens eat into max_output_tokens — without this, models like gpt-5-mini
  // spend the entire budget on reasoning and return status: 'incomplete' with zero output
  if (provider === 'openai' && !translatedBody.reasoning) {
    translatedBody.reasoning = { effort: 'low' }
  }

  const upstreamRes = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(translatedBody),
  })

  const elapsed = Date.now() - startTime
  if (!upstreamRes.ok) {
    const errorText = await upstreamRes.text()
    logApiCall(user.id, provider, model, 0, 0, 0, elapsed, 'error', errorText.slice(0, 500))
    setResponseStatus(event, upstreamRes.status)
    return { error: 'API request failed' }
  }

  const json = await upstreamRes.json()
  const translated = translateResponse(provider, json)
  const usage = extractUsage(provider, json)

  const creditsUsed = calculateCredits(usage.inputTokens, usage.outputTokens, model)
  await deductCredits(user.id, creditsUsed)
  logApiCall(user.id, provider, model, usage.inputTokens, usage.outputTokens, creditsUsed, Date.now() - startTime, 'success', null)

  // Attach updated balance for client
  const freshDb = useDb()
  const updatedUser = freshDb.select().from(users).where(eq(users.id, user.id)).get()
  translated._shoulders = { credits: updatedUser?.credits ?? 0, cost_cents: creditsUsed }

  // Fire-and-forget recharge if near threshold
  if (user.plan === 'pro' && user.autoRechargeEnabled) {
    const remaining = user.credits - creditsUsed
    if (remaining <= user.autoRechargeThreshold) {
      triggerRecharge(user).catch(() => {})
    }
  }

  return translated
}

function logApiCall(userId, provider, model, inputTokens, outputTokens, creditsUsed, durationMs, status, errorMessage) {
  try {
    const db = useDb()
    db.insert(apiCalls).values({
      id: generateId(),
      userId,
      provider,
      model,
      inputTokens,
      outputTokens,
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
