// Per-model pricing — mirrors src/services/tokenUsage.js
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
    output: 15.00 / 1_000_000,
    cacheWrite: 3.75 / 1_000_000,
    cacheRead: 0.30 / 1_000_000,
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
  },
  'gemini-3-flash': {
    input: 0.50 / 1_000_000,
    output: 3.00 / 1_000_000,
  },
  'gemini-3.1-pro': {
    input: 2.00 / 1_000_000,
    output: 12.00 / 1_000_000,
  },

  // OpenAI
  'gpt-5.2': {
    input: 1.75 / 1_000_000,
    output: 14.00 / 1_000_000,
  },
  'gpt-5-mini': {
    input: 0.25 / 1_000_000,
    output: 2.00 / 1_000_000,
  },
  'gpt-5-nano': {
    input: 0.05 / 1_000_000,
    output: 0.40 / 1_000_000,
  },
}

/**
 * Strip date suffixes and -preview to match pricing table keys.
 */
function resolveModelPriceKey(modelId) {
  if (!modelId) return null
  const key = modelId
    .replace(/-\d{8,}$/, '')
    .replace(/-\d{4}-\d{2}-\d{2}$/, '')
    .replace(/-preview$/, '')
  return tokenPrices[key] ? key : null
}

/**
 * Calculate cost in cents for a given model + token counts.
 * Returns cents rounded to 2 decimal places (hundredths of a cent).
 */
export function calculateCostCents(inputTokens, outputTokens, model) {
  const key = resolveModelPriceKey(model)
  if (!key) {
    // Fallback: ~$3/MTok input, ~$15/MTok output (Sonnet-tier)
    const fallbackUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000
    return Math.round(fallbackUsd * 10000) / 100
  }

  const prices = tokenPrices[key]
  const usd = (inputTokens * prices.input) + (outputTokens * prices.output)
  return Math.round(usd * 10000) / 100
}

/**
 * Calculate cost with surcharge for Shoulders proxy calls.
 * Returns cents rounded to 2 decimal places (hundredths of a cent).
 */
const SURCHARGE_MULTIPLIER = parseFloat(useRuntimeConfig().shouldersSurchargeMultiplier || '1.20')

export function calculateCostCentsWithSurcharge(inputTokens, outputTokens, model) {
  const key = resolveModelPriceKey(model)
  let usd
  if (!key) {
    usd = (inputTokens * 3 + outputTokens * 15) / 1_000_000
  } else {
    const prices = tokenPrices[key]
    usd = (inputTokens * prices.input) + (outputTokens * prices.output)
  }
  return Math.round(usd * 100 * SURCHARGE_MULTIPLIER * 100) / 100
}
