let _cache = null
let _cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 minutes

export default defineEventHandler(async () => {
  const now = Date.now()
  if (_cache && now - _cacheTime < CACHE_TTL) {
    return _cache
  }

  const config = useRuntimeConfig()
  const repo = config.githubRepo

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    })

    if (!res.ok) {
      return { error: 'No releases found', assets: [] }
    }

    const release = await res.json()

    const assets = (release.assets || []).map(a => ({
      name: a.name,
      url: a.browser_download_url,
      size: a.size,
    }))

    const result = {
      version: release.tag_name,
      name: release.name,
      published: release.published_at,
      assets,
    }

    _cache = result
    _cacheTime = now
    return result
  } catch (e) {
    console.error('[releases] GitHub API error:', e.message)
    return { error: 'Failed to fetch releases', assets: [] }
  }
})
