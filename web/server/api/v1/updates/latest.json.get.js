let _cache = null
let _cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export default defineEventHandler(async (event) => {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache
  }

  const config = useRuntimeConfig()
  const repo = config.githubRepo

  try {
    const res = await fetch(
      `https://github.com/${repo}/releases/latest/download/latest.json`
    )

    if (!res.ok) {
      // No updater JSON in latest release — return empty so the client sees "up to date"
      throw createError({ statusCode: 204, statusMessage: 'No update available' })
    }

    const data = await res.json()

    _cache = data
    _cacheTime = now
    return data
  } catch (e) {
    if (e.statusCode) throw e
    console.error('[updates] GitHub fetch error:', e.message)
    throw createError({ statusCode: 502, statusMessage: 'Failed to fetch update info' })
  }
})
