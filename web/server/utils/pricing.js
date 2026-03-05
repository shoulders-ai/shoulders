// Per-model pricing — keep in sync with src/services/tokenUsage.js
// All values in USD per token ($/MTok divided by 1,000,000)

const tokenPrices = {
  // Anthropic
  'claude-opus-4-6': {
    input: 5.00 / 1e6,
    output: 25.00 / 1e6,
    cacheWrite: 6.25 / 1e6,
    cacheRead: 0.50 / 1e6,
  },
  'claude-sonnet-4-6': {
    input: 3.00 / 1e6,
    input_200k_plus: 6.00 / 1e6,
    output: 15.00 / 1e6,
    output_200k_plus: 22.50 / 1e6,
    cacheWrite: 3.75 / 1e6,
    cacheWrite_200k_plus: 7.50 / 1e6,
    cacheRead: 0.30 / 1e6,
    cacheRead_200k_plus: 0.60 / 1e6,
  },
  'claude-haiku-4-5': {
    input: 1.00 / 1e6,
    output: 5.00 / 1e6,
    cacheWrite: 1.25 / 1e6,
    cacheRead: 0.10 / 1e6,
  },

  // Google
  'gemini-3.1-flash-lite-preview': {
    input: 0.10 / 1e6,
    output: 0.40 / 1e6,
    cacheRead: 0.001 / 1e6,
  },
  'gemini-3-flash': {
    input: 0.50 / 1e6,
    output: 3.00 / 1e6,
    cacheRead: 0.05 / 1e6,
  },
  'gemini-3.1-pro': {
    input: 2.00 / 1e6,
    input_200k_plus: 4.00 / 1e6,
    output: 12.00 / 1e6,
    output_200k_plus: 18.00 / 1e6,
    cacheRead: 0.20 / 1e6,
    cacheRead_200k_plus: 0.40 / 1e6,
  },

  // OpenAI
  'gpt-5.2': {
    input: 1.75 / 1e6,
    output: 14.00 / 1e6,
    cacheRead: 0.175 / 1e6,
  },
  'gpt-5-mini': {
    input: 0.25 / 1e6,
    output: 2.00 / 1e6,
    cacheRead: 0.025 / 1e6,
  },
  'gpt-5-nano': {
    input: 0.05 / 1e6,
    output: 0.40 / 1e6,
    cacheRead: 0.005 / 1e6,
  },

  // Z (GLM-OCR)
  'glm-ocr': {
    input: 0.03 / 1e6,
    output: 0.03 / 1e6,
  },
}

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
export function calculateCostCents(inputTokens, outputTokens, model, { cacheRead = 0, cacheCreation = 0 } = {}) {
  const key = resolveModelPriceKey(model)
  if (!key) {
    const fallbackUsd = (inputTokens * 3 + outputTokens * 15) / 1_000_000
    return Math.round(fallbackUsd * 10000) / 100
  }

  const prices = tokenPrices[key]
  const totalInput = inputTokens + cacheRead + cacheCreation
  const large = totalInput > 200_000
  const inputPrice     = large ? (prices.input_200k_plus    ?? prices.input)    : prices.input
  const outputPrice    = large ? (prices.output_200k_plus   ?? prices.output)   : prices.output
  const cacheReadPrice  = large ? (prices.cacheRead_200k_plus  ?? prices.cacheRead  ?? 0) : (prices.cacheRead  ?? 0)
  const cacheWritePrice = large ? (prices.cacheWrite_200k_plus ?? prices.cacheWrite ?? 0) : (prices.cacheWrite ?? 0)

  let usd = inputTokens * inputPrice + outputTokens * outputPrice
  if (cacheRead)     usd += cacheRead     * cacheReadPrice
  if (cacheCreation) usd += cacheCreation * cacheWritePrice
  return Math.round(usd * 10000) / 100
}

/**
 * Calculate cost with surcharge for Shoulders proxy calls.
 * Returns cents rounded to 2 decimal places (hundredths of a cent).
 *
 * @param {number} inputTokens - Cache-miss input tokens only
 * @param {number} outputTokens
 * @param {string} model
 * @param {{ cacheRead?: number, cacheCreation?: number }} [cache]
 */
const SURCHARGE_MULTIPLIER = parseFloat(useRuntimeConfig().shouldersSurchargeMultiplier || '1.20')

export function calculateCostCentsWithSurcharge(inputTokens, outputTokens, model, { cacheRead = 0, cacheCreation = 0 } = {}) {
  const key = resolveModelPriceKey(model)
  let usd
  if (!key) {
    usd = (inputTokens * 3 + outputTokens * 15) / 1_000_000
  } else {
    const prices = tokenPrices[key]
    const totalInput = inputTokens + cacheRead + cacheCreation
    const large = totalInput > 200_000
    const inputPrice     = large ? (prices.input_200k_plus    ?? prices.input)    : prices.input
    const outputPrice    = large ? (prices.output_200k_plus   ?? prices.output)   : prices.output
    const cacheReadPrice  = large ? (prices.cacheRead_200k_plus  ?? prices.cacheRead  ?? 0) : (prices.cacheRead  ?? 0)
    const cacheWritePrice = large ? (prices.cacheWrite_200k_plus ?? prices.cacheWrite ?? 0) : (prices.cacheWrite ?? 0)
    usd = inputTokens  * inputPrice
        + outputTokens * outputPrice
        + cacheRead     * cacheReadPrice
        + cacheCreation * cacheWritePrice
  }
  return Math.round(usd * 100 * SURCHARGE_MULTIPLIER * 100) / 100
}
