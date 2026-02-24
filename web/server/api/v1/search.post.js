import { generateId } from '../../utils/id.js'
import { deductCredits } from '../../utils/credits.js'
import { triggerRecharge } from '../../utils/recharge.js'
import { eq } from 'drizzle-orm'
import { useDb } from '../../db/index.js'
import { apiCalls, users } from '../../db/schema.js'

const EXA_BASE = 'https://api.exa.ai'
const OPENALEX_BASE = 'https://api.openalex.org'

// Per-action credit cost (cents). Exa search includes summaries (~$0.015 Exa cost → 3¢ with margin).
const ACTION_COST = { search: 3, contents: 1, openalex_search: 1 }
const VALID_ACTIONS = ['search', 'contents', 'openalex_search']

// OpenAlex: fields to request via select param
const OPENALEX_SELECT = [
  'id', 'doi', 'title', 'display_name', 'publication_date', 'publication_year',
  'abstract_inverted_index', 'authorships', 'cited_by_count', 'fwci',
  'open_access', 'primary_topic', 'type', 'primary_location', 'biblio',
].join(',')

export default defineEventHandler(async (event) => {
  let user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const db = useDb()

  const body = await readBody(event)
  const { action, ...actionBody } = body

  if (!VALID_ACTIONS.includes(action)) {
    setResponseStatus(event, 400)
    return { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(', ')}` }
  }

  const creditCost = ACTION_COST[action] || 3

  // Credit check + auto-recharge
  if (user.credits < creditCost) {
    if (user.plan === 'pro' && user.autoRechargeEnabled) {
      const result = await triggerRecharge(user)
      if (!result.success) {
        setResponseStatus(event, 402)
        return { error: 'Insufficient balance. Auto-recharge failed. Add funds at shoulde.rs/account.' }
      }
      user = db.select().from(users).where(eq(users.id, user.id)).get()
    } else {
      setResponseStatus(event, 402)
      if (user.plan === 'pro') {
        return { error: 'Insufficient balance. Add funds at shoulde.rs/account.' }
      }
      return { error: 'Free trial balance depleted. Subscribe at shoulde.rs/subscribe to continue.' }
    }
  }

  const config = useRuntimeConfig()
  const startTime = Date.now()

  try {
    if (action === 'openalex_search') {
      return await handleOpenAlex(event, user, actionBody, creditCost, startTime, config)
    } else {
      return await handleExa(event, user, action, actionBody, creditCost, startTime, config)
    }
  } catch (err) {
    const provider = action === 'openalex_search' ? 'openalex' : 'exa'
    console.error(`[search] Upstream error (${provider}):`, err)
    logApiCall(user.id, provider, action, 0, 0, 0, Date.now() - startTime, 'error', err.message)
    setResponseStatus(event, 502)
    return { error: 'Upstream provider error' }
  }
})

async function handleExa(event, user, action, exaBody, creditCost, startTime, config) {
  const exaApiKey = config.exaApiKey
  if (!exaApiKey) {
    setResponseStatus(event, 502)
    return { error: 'Exa API not configured on this server' }
  }

  const exaRes = await fetch(`${EXA_BASE}/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': exaApiKey,
    },
    body: JSON.stringify(exaBody),
  })

  if (!exaRes.ok) {
    const errorText = await exaRes.text()
    console.error(`[search] Exa error (${exaRes.status}):`, errorText.slice(0, 500))
    logApiCall(user.id, 'exa', action, 0, 0, 0, Date.now() - startTime, 'error', errorText.slice(0, 500))
    setResponseStatus(event, exaRes.status)
    return { error: 'Exa API request failed' }
  }

  const json = await exaRes.json()
  return finalize(event, user, 'exa', action, creditCost, startTime, json)
}

async function handleOpenAlex(event, user, body, creditCost, startTime, config) {
  const openalexApiKey = config.openalexApiKey
  if (!openalexApiKey) {
    setResponseStatus(event, 502)
    return { error: 'OpenAlex API not configured on this server' }
  }

  const params = new URLSearchParams()
  params.set('search', body.query || '')
  params.set('per_page', String(Math.min(body.per_page || 5, 25)))
  params.set('select', OPENALEX_SELECT)
  params.set('api_key', openalexApiKey)

  const res = await fetch(`${OPENALEX_BASE}/works?${params}`, {
    headers: { 'User-Agent': 'Shoulders/1.0 (mailto:contact@shoulde.rs)' },
  })

  if (!res.ok) {
    const errorText = await res.text()
    console.error(`[search] OpenAlex error (${res.status}):`, errorText.slice(0, 500))
    logApiCall(user.id, 'openalex', 'search', 0, 0, 0, Date.now() - startTime, 'error', errorText.slice(0, 500))
    setResponseStatus(event, res.status)
    return { error: 'OpenAlex API request failed' }
  }

  const json = await res.json()
  return finalize(event, user, 'openalex', 'search', creditCost, startTime, json)
}

async function finalize(event, user, provider, action, creditCost, startTime, json) {

  await deductCredits(user.id, creditCost)
  logApiCall(user.id, provider, action, 0, 0, creditCost, Date.now() - startTime, 'success', null)

  const freshDb = useDb()
  const updatedUser = freshDb.select().from(users).where(eq(users.id, user.id)).get()

  // Fire-and-forget auto-recharge if near threshold
  if (user.plan === 'pro' && user.autoRechargeEnabled) {
    const remaining = user.credits - creditCost
    if (remaining <= user.autoRechargeThreshold) {
      triggerRecharge(user).catch(() => {})
    }
  }

  return {
    ...json,
    _shoulders: { credits: updatedUser?.credits ?? 0, cost_cents: creditCost },
  }
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
    console.error('[search] Failed to log API call:', e)
  }
}
