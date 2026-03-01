// Token pricing, cost calculation, and formatting
// Usage normalization is handled by convertSdkUsage() in aiSdk.js

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
function resolveModelPriceKey(modelId) {
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
 * Format a USD cost for display.
 * < $0.01 → "$0.0042", < $1 → "$0.123", >= $1 → "$1.23"
 */
export function formatCost(cost) {
  if (!cost || cost === 0) return '$0.00'
  if (cost < 0.01) return '$' + cost.toFixed(4)
  if (cost < 1) return '$' + cost.toFixed(3)
  return '$' + cost.toFixed(2)
}
