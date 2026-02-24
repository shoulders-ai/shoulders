// Only track public marketing pages — skip admin, auth, deck viewer
const EXCLUDED_PREFIXES = ['/admin', '/login', '/signup', '/account', '/verify-email', '/reset-password', '/d/']

function shouldTrack(path) {
  return !EXCLUDED_PREFIXES.some(p => path === p || path.startsWith(p + '/'))
}

export function usePageAnalytics() {
  if (import.meta.server) return

  const router = useRouter()
  let startTime = Date.now()
  let currentPath = window.location.pathname

  function getReferrerDomain() {
    try {
      if (!document.referrer) return null
      const url = new URL(document.referrer)
      // Skip self-referrals
      if (url.hostname === window.location.hostname) return null
      return document.referrer
    } catch {
      return null
    }
  }

  function sendEvent(data) {
    const payload = JSON.stringify(data)
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/v1/analytics/event', new Blob([payload], { type: 'application/json' }))
    }
  }

  function sendPageView() {
    if (!shouldTrack(currentPath)) return
    const duration = Math.round((Date.now() - startTime) / 1000)
    if (duration < 1) return
    sendEvent({
      path: currentPath,
      eventType: 'page_view',
      durationSeconds: duration,
      referrer: getReferrerDomain(),
    })
  }

  // Track SPA navigations
  router.afterEach((to) => {
    sendPageView()
    startTime = Date.now()
    currentPath = to.path
  })

  // Track page unload
  window.addEventListener('beforeunload', sendPageView)

  // Send download click events
  function trackDownload(platform) {
    sendEvent({
      path: currentPath,
      eventType: 'download_click',
      eventMeta: { platform },
    })
  }

  return { trackDownload }
}
