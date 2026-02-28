/**
 * Pangram AI content detection (v3 API).
 * Docs: https://docs.pangram.com/api-reference/ai-detection
 * Returns { available, aiScore, humanScore, prediction, segments? } or graceful fallback.
 */
export async function detectAiContent(text) {
  const config = useRuntimeConfig()
  const apiKey = config.pangramApiKey
  if (!apiKey) {
    console.log('[pangramDetection] No API key configured (NUXT_PANGRAM_API_KEY), skipping')
    return { available: false, error: 'Pangram API key not configured' }
  }

  // Pangram v3 accepts up to ~25k characters
  const truncated = text.slice(0, 25000)
  const url = 'https://text.api.pangram.com/v3'

  console.log(`[pangramDetection] Calling ${url} with ${truncated.length} chars, key prefix: ${apiKey.slice(0, 8)}...`)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({ text: truncated }),
      signal: AbortSignal.timeout(30_000),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[pangramDetection] API error ${res.status}: ${err.slice(0, 300)}`)
      return { available: false, error: `Pangram API error ${res.status}: ${err.slice(0, 100)}` }
    }

    const data = await res.json()
    console.log(`[pangramDetection] Response: prediction=${data.prediction_short}, ai=${data.fraction_ai}, human=${data.fraction_human}, ai_assisted=${data.fraction_ai_assisted}`)

    // v3 response fields
    const aiScore = data.fraction_ai ?? data.ai_score ?? data.score ?? null
    const aiAssistedScore = data.fraction_ai_assisted ?? null
    const humanScore = data.fraction_human ?? data.human_score ?? (aiScore != null ? 1 - aiScore : null)

    return {
      available: true,
      aiScore,
      aiAssistedScore,
      humanScore,
      prediction: data.prediction_short || null,
      headline: data.headline || null,
      segments: data.windows || data.segments || data.sentences || [],
    }
  } catch (e) {
    const cause = e.cause ? ` (cause: ${e.cause.message || e.cause.code || e.cause})` : ''
    console.error(`[pangramDetection] Fetch failed: ${e.message}${cause}`)
    return { available: false, error: `Fetch failed: ${e.message}` }
  }
}
