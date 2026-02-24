export const useAuth = () => {
  const auth = useState('auth', () => null)

  if (import.meta.client && !auth.value) {
    try {
      const stored = localStorage.getItem('shouldersAuth')
      if (stored) auth.value = JSON.parse(stored)
    } catch {}
  }

  function setAuth(data) {
    auth.value = data
    if (import.meta.client) {
      localStorage.setItem('shouldersAuth', JSON.stringify(data))
    }
  }

  function clearAuth() {
    auth.value = null
    if (import.meta.client) {
      localStorage.removeItem('shouldersAuth')
    }
  }

  function isAccessTokenExpired() {
    if (!auth.value?.expiresAt) return true
    // Treat as expired if within 60 seconds of expiry
    return new Date(auth.value.expiresAt) < new Date(Date.now() + 60 * 1000)
  }

  async function refresh() {
    if (!auth.value) return false

    // If we have a refresh token and access token is expired, use refresh flow
    if (auth.value.refreshToken && isAccessTokenExpired()) {
      try {
        const data = await $fetch('/api/v1/auth/refresh', {
          method: 'POST',
          body: { refreshToken: auth.value.refreshToken },
        })
        setAuth({ ...auth.value, ...data })
        return true
      } catch {
        clearAuth()
        return false
      }
    }

    // Access token still valid — just sync user fields
    if (auth.value.token && !isAccessTokenExpired()) {
      try {
        const data = await $fetch('/api/v1/auth/status', {
          headers: { Authorization: `Bearer ${auth.value.token}` },
        })
        setAuth({ ...auth.value, ...data })
        return true
      } catch {
        // Access token might have just expired — try refresh
        if (auth.value.refreshToken) {
          try {
            const data = await $fetch('/api/v1/auth/refresh', {
              method: 'POST',
              body: { refreshToken: auth.value.refreshToken },
            })
            setAuth({ ...auth.value, ...data })
            return true
          } catch {
            clearAuth()
            return false
          }
        }
        clearAuth()
        return false
      }
    }

    // No refresh token and access token expired — legacy session, clear it
    clearAuth()
    return false
  }

  async function authedFetch(url, opts = {}) {
    // Refresh if needed before making the request
    if (isAccessTokenExpired() && auth.value?.refreshToken) {
      const ok = await refresh()
      if (!ok) throw new Error('Authentication expired')
    }

    if (!auth.value?.token) throw new Error('Not authenticated')

    const headers = { ...opts.headers, Authorization: `Bearer ${auth.value.token}` }

    try {
      return await $fetch(url, { ...opts, headers })
    } catch (e) {
      // On 401, try one refresh then retry
      if (e.status === 401 && auth.value?.refreshToken) {
        try {
          const data = await $fetch('/api/v1/auth/refresh', {
            method: 'POST',
            body: { refreshToken: auth.value.refreshToken },
          })
          setAuth({ ...auth.value, ...data })
          const retryHeaders = { ...opts.headers, Authorization: `Bearer ${auth.value.token}` }
          return await $fetch(url, { ...opts, headers: retryHeaders })
        } catch {
          clearAuth()
          throw new Error('Authentication expired')
        }
      }
      throw e
    }
  }

  async function fetchUsage() {
    if (!auth.value?.token) return null
    try {
      return await authedFetch('/api/v1/auth/usage')
    } catch {
      return null
    }
  }

  async function deleteAccount(confirmation) {
    if (!auth.value?.token) return false
    await authedFetch('/api/v1/auth/delete-account', {
      method: 'POST',
      body: { confirmation },
    })
    clearAuth()
    return true
  }

  async function handleLogout() {
    if (auth.value?.refreshToken) {
      try {
        await $fetch('/api/v1/auth/logout', {
          method: 'POST',
          body: { refreshToken: auth.value.refreshToken },
        })
      } catch { /* best effort */ }
    }
    clearAuth()
  }

  async function fetchSessions() {
    try {
      const data = await authedFetch('/api/v1/auth/sessions')
      return data.sessions || []
    } catch {
      return []
    }
  }

  async function revokeSession(id) {
    await authedFetch(`/api/v1/auth/sessions/${id}`, { method: 'DELETE' })
  }

  return {
    auth,
    setAuth,
    clearAuth,
    refresh,
    authedFetch,
    fetchUsage,
    deleteAccount,
    handleLogout,
    fetchSessions,
    revokeSession,
  }
}
