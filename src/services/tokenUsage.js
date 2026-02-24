// Token usage normalization, cost calculation, and pricing
// Handles Anthropic, OpenAI, and Google provider-specific usage formats

/**
 * Unified usage shape returned by normalizeUsage():
 * {
 *   input_cache_miss: number,   // input tokens billed at standard rate
 *   input_cache_hit: number,    // input tokens read from cache
 *   input_cache_write: number,  // input tokens written to cache (5m ephemeral)
 *   input_total: number,        // total input tokens
 *   output: number,             // total output tokens (includes thinking/reasoning)
 *   thinking: number,           // thinking/reasoning tokens (informational, subset of output)
 *   total: number,              // grand total all tokens
 *   cost: number,               // estimated USD cost (set by calculateCost)
 * }
 */

export function createEmptyUsage() {
  return {
    input_cache_miss: 0,
    input_cache_hit: 0,
    input_cache_write: 0,
    input_total: 0,
    output: 0,
    thinking: 0,
    total: 0,
    cost: 0,
  }
}

/**
 * Normalize raw provider usage into unified shape.
 * Does NOT calculate cost — call calculateCost() after.
 */
export function normalizeUsage(provider, rawUsage) {
  const usage = createEmptyUsage()
  if (!rawUsage) return usage

  if (provider === 'anthropic' || provider === 'shoulders') {
    usage.input_cache_miss = rawUsage.input_tokens || 0
    usage.input_cache_hit = rawUsage.cache_read_input_tokens || 0
    usage.input_cache_write = rawUsage.cache_creation_input_tokens || 0
    usage.input_total = usage.input_cache_miss + usage.input_cache_hit + usage.input_cache_write
    usage.output = rawUsage.output_tokens || 0
    usage.thinking = 0 // Anthropic bundles thinking into output_tokens
    usage.total = usage.input_total + usage.output
  } else if (provider === 'openai') {
    // Responses API uses input_tokens/output_tokens; Chat Completions uses prompt_tokens/completion_tokens
    const promptTokens = rawUsage.prompt_tokens || rawUsage.input_tokens || 0
    const cached = rawUsage.prompt_tokens_details?.cached_tokens
      || rawUsage.input_tokens_details?.cached_tokens || 0
    usage.input_cache_miss = promptTokens - cached
    usage.input_cache_hit = cached
    usage.input_total = promptTokens
    usage.output = rawUsage.completion_tokens || rawUsage.output_tokens || 0
    usage.thinking = rawUsage.completion_tokens_details?.reasoning_tokens
      || rawUsage.output_tokens_details?.reasoning_tokens || 0
    usage.total = rawUsage.total_tokens || (usage.input_total + usage.output)
  } else if (provider === 'google') {
    const cached = rawUsage.cachedContentTokenCount || 0
    usage.input_cache_miss = (rawUsage.promptTokenCount || 0) - cached
    usage.input_cache_hit = cached
    usage.input_total = rawUsage.promptTokenCount || 0
    const candidates = rawUsage.candidatesTokenCount || 0
    const thoughts = rawUsage.thoughtsTokenCount || 0
    usage.output = candidates + thoughts
    usage.thinking = thoughts
    usage.total = rawUsage.totalTokenCount || (usage.input_total + usage.output)
  }

  // Sanitize
  for (const key of Object.keys(usage)) {
    if (typeof usage[key] !== 'number' || !isFinite(usage[key]) || usage[key] < 0) {
      usage[key] = 0
    }
  }

  return usage
}

/**
 * Add two usage objects, summing all fields.
 * Used to accumulate totals across multiple API calls.
 */
export function addUsage(a, b) {
  if (!a) return b || createEmptyUsage()
  if (!b) return a
  const sum = createEmptyUsage()
  for (const key of Object.keys(sum)) {
    sum[key] = (a[key] || 0) + (b[key] || 0)
  }
  return sum
}

/**
 * Merge two usage objects, taking the larger value for each field.
 * Used for Anthropic where message_start has initial counts and message_delta has final.
 */
export function mergeUsage(a, b) {
  if (!a) return b || createEmptyUsage()
  if (!b) return a
  const merged = createEmptyUsage()
  for (const key of Object.keys(merged)) {
    merged[key] = Math.max(a[key] || 0, b[key] || 0)
  }
  return merged
}


// ─── Pricing ──────────────────────────────────────────────────────────
// Only models actually available in the app (see workspace.js default models config)
// All values in USD per token ($/MTok divided by 1,000,000)

const tokenPrices = {
  // Anthropic
  'claude-opus-4-6': {
    input: 5.00 / 1_000_000,
    output: 25.00 / 1_000_000,
    cacheWrite: 6.25 / 1_000_000,
    cacheRead: 0.50 / 1_000_000,
  },
  'claude-sonnet-4-6': {
    input: 3.00 / 1_000_000,
    input_200k_plus: 6.00 / 1_000_000,
    output: 15.00 / 1_000_000,
    output_200k_plus: 22.50 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
    cacheWrite_200k_plus: 7.50 / 1_000_000,
    cacheRead: 0.30 / 1_000_000,
    cacheRead_200k_plus: 0.60 / 1_000_000,
  },
  'claude-haiku-4-5': {
    input: 1.00 / 1_000_000,
    output: 5.00 / 1_000_000,
    cacheWrite: 1.25 / 1_000_000,
    cacheRead: 0.10 / 1_000_000,
  },

  // Google
  'gemini-2.5-flash-lite': {
    input: 0.10 / 1_000_000,
    output: 0.40 / 1_000_000,
    cacheRead: 0.001 / 1_000_000,
  },
  'gemini-3-flash': {
    input: 0.50 / 1_000_000,
    output: 3.00 / 1_000_000,
    cacheRead: 0.05 / 1_000_000,
  },
  'gemini-3.1-pro': {
    input: 2.00 / 1_000_000,
    input_200k_plus: 4.00 / 1_000_000,
    output: 12.00 / 1_000_000,
    output_200k_plus: 18.00 / 1_000_000,
    cacheRead: 0.20 / 1_000_000,
    cacheRead_200k_plus: 0.40 / 1_000_000,
  },

  // OpenAI
  'gpt-5.2': {
    input: 1.75 / 1_000_000,
    output: 14.00 / 1_000_000,
    cacheRead: 0.175 / 1_000_000,
  },
  'gpt-5-mini': {
    input: 0.25 / 1_000_000,
    output: 2.00 / 1_000_000,
    cacheRead: 0.025 / 1_000_000,
  },
  'gpt-5-nano': {
    input: 0.05 / 1_000_000,
    output: 0.40 / 1_000_000,
    cacheRead: 0.005 / 1_000_000,
  },
}

/**
 * Map a full API model ID to a pricing key.
 * Strips date suffixes to match our pricing table keys.
 *
 * 'claude-opus-4-6'              → 'claude-opus-4-6'
 * 'claude-sonnet-4-6'            → 'claude-sonnet-4-6'
 * 'claude-haiku-4-5-20251001'    → 'claude-haiku-4-5'
 * 'gemini-3-flash-preview'       → 'gemini-3-flash'
 * 'gemini-3.1-pro-preview'       → 'gemini-3.1-pro'
 * 'gpt-5.2-2025-12-11'          → 'gpt-5.2'
 * 'gpt-5-mini-2025-08-07'       → 'gpt-5-mini'
 */
export function resolveModelPriceKey(modelId) {
  if (!modelId) return null

  // Strip common suffixes: date stamps (-20250929, -2025-12-11) and -preview
  const key = modelId
    .replace(/-\d{8,}$/, '')       // -20250929, -20251001
    .replace(/-\d{4}-\d{2}-\d{2}$/, '') // -2025-12-11, -2025-08-07
    .replace(/-preview$/, '')       // -preview

  if (tokenPrices[key]) return key

  console.warn('[tokenUsage] No pricing key for model:', modelId, '(resolved:', key + ')')
  return null
}

/**
 * Calculate USD cost for a usage object.
 * Handles 200K+ large-prompt pricing tiers where applicable.
 */
export function calculateCost(usage, modelId) {
  const priceKey = resolveModelPriceKey(modelId)
  if (!priceKey) {
    console.warn('[tokenUsage] No pricing found for model:', modelId)
    return 0
  }
  const prices = tokenPrices[priceKey]
  if (!prices) {
    console.warn('[tokenUsage] No pricing table for key:', priceKey)
    return 0
  }

  const largePrompt = usage.input_total > 200_000
  const inputPrice = largePrompt ? (prices.input_200k_plus ?? prices.input) : prices.input
  const outputPrice = largePrompt ? (prices.output_200k_plus ?? prices.output) : prices.output
  const cacheWritePrice = largePrompt ? (prices.cacheWrite_200k_plus ?? prices.cacheWrite ?? 0) : (prices.cacheWrite ?? 0)
  const cacheReadPrice = largePrompt ? (prices.cacheRead_200k_plus ?? prices.cacheRead) : prices.cacheRead

  let cost = 0
  cost += usage.input_cache_miss * inputPrice
  cost += usage.input_cache_write * cacheWritePrice
  cost += usage.input_cache_hit * (cacheReadPrice || 0)
  cost += usage.output * outputPrice

  cost = Math.round(cost * 1_000_000) / 1_000_000
  if (typeof cost !== 'number' || !isFinite(cost)) return 0
  return cost
}

/**
 * Convenience: normalize + calculate cost in one call.
 */
export function getUsage(provider, rawUsage, modelId) {
  const usage = normalizeUsage(provider, rawUsage)
  usage.cost = calculateCost(usage, modelId)
  return usage
}

/**
 * Get the pricing table for a model (for display in UI).
 * Returns null if model not found.
 */
export function getModelPricing(modelId) {
  const key = resolveModelPriceKey(modelId)
  return key ? { key, ...tokenPrices[key] } : null
}

/**
 * Format a USD cost for display.
 * < $0.01 → "$0.0042", < $1 → "$0.123", >= $1 → "$1.23"
 */
export function formatCost(cost) {
  if (!cost || cost === 0) return '$0.00'
  if (cost < 0.01) return '$' + cost.toFixed(4)
  if (cost < 1) return '$' + cost.toFixed(3)
  return '$' + cost.toFixed(2)
}
