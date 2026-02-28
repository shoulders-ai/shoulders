/**
 * Pangram AI content detection.
 * Docs: https://pangram.so/docs
 * Returns { available, aiScore, humanScore, segments? } or graceful fallback.
 */
export async function detectAiContent(text) {
  const config = useRuntimeConfig()
  const apiKey = config.pangramApiKey
  if (!apiKey) {
    console.log('[pangramDetection] No API key configured (NUXT_PANGRAM_API_KEY), skipping')
    return { available: false, error: 'Pangram API key not configured' }
  }

  // Pangram accepts up to ~25k characters
  const truncated = text.slice(0, 25000)
  const url = 'https://api.pangram.so/v1/detect'

  console.log(`[pangramDetection] Calling ${url} with ${truncated.length} chars, key prefix: ${apiKey.slice(0, 8)}...`)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
    console.log(`[pangramDetection] Response keys: ${Object.keys(data).join(', ')}`)

    // Pangram response format varies by version — handle both
    const aiScore = data.ai_score ?? data.score ?? null
    const humanScore = data.human_score ?? (aiScore != null ? 1 - aiScore : null)

    return {
      available: true,
      score: data.score,
      aiScore,
      humanScore,
      segments: data.segments || data.sentences || [],
    }
  } catch (e) {
    console.error(`[pangramDetection] Fetch failed: ${e.message}${e.cause ? ` (cause: ${e.cause.message || e.cause.code || e.cause})` : ''}`)
    return { available: false, error: `Fetch failed: ${e.message}` }
  }
}
