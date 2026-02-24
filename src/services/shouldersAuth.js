// Shoulders authentication service for desktop app
// Deep link auth via browser + OS keychain for token storage

import { invoke } from '@tauri-apps/api/core'
import { onOpenUrl } from '@tauri-apps/plugin-deep-link'

export const SHOULDERS_WEB_URL = import.meta.env.DEV ? 'http://localhost:3000' : 'https://shoulde.rs'
const BASE_URL = `${SHOULDERS_WEB_URL}/api/v1/auth`
const KEYCHAIN_KEY = 'auth-data'

// ── Keychain helpers (OS keychain via Rust keyring crate) ──

async function storeInKeychain(data) {
  try {
    await invoke('keychain_set', { key: KEYCHAIN_KEY, value: JSON.stringify(data) })
  } catch {
    console.warn('[security] OS keychain unavailable — auth tokens stored in plaintext localStorage')
    localStorage.setItem('shouldersAuth', JSON.stringify(data))
  }
}

async function loadFromKeychain() {
  try {
    const raw = await invoke('keychain_get', { key: KEYCHAIN_KEY })
    if (raw) return JSON.parse(raw)
  } catch {}
  // Fallback: try localStorage (migration from old storage)
  try {
    const raw = localStorage.getItem('shouldersAuth')
    if (raw) {
      const data = JSON.parse(raw)
      await storeInKeychain(data)
      localStorage.removeItem('shouldersAuth')
      return data
    }
  } catch {}
  return null
}

async function clearKeychain() {
  try { await invoke('keychain_delete', { key: KEYCHAIN_KEY }) } catch {}
  try { localStorage.removeItem('shouldersAuth') } catch {}
}

// ── API helpers ──

async function apiCall(endpoint, { method = 'POST', body = null, token = null } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const result = await invoke('proxy_api_call', {
    request: {
      url: `${BASE_URL}${endpoint}`,
      method: body ? 'POST' : 'GET',
      headers,
      body: body ? JSON.stringify(body) : '',
    },
  })

  const parsed = JSON.parse(result)
  if (parsed.error) throw new Error(parsed.error)
  return parsed
}

// ── Login flow ──

function generateState() {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('')
}

async function pollForTokens(state, signal) {
  while (!signal.aborted) {
    await new Promise(r => setTimeout(r, 2000))
    if (signal.aborted) break
    try {
      const res = await apiCall('/desktop-poll', { body: { state } })
      if (res.pending) continue
      if (res.token) return res
    } catch {}
  }
  return null
}

let deepLinkResolver = null

export function listenForAuthCallback() {
  onOpenUrl(urls => {
    if (!urls || !urls.length) return
    try {
      const url = new URL(urls[0])
      const code = url.searchParams.get('code')
      if (code && deepLinkResolver) {
        deepLinkResolver(code)
        deepLinkResolver = null
      }
    } catch {}
  })
}

export async function loginViaBrowser({ mode } = {}) {
  // Smart default: check if user has ever logged in before
  if (!mode) {
    try {
      const globalDir = await invoke('get_global_config_dir')
      await invoke('read_file', { path: `${globalDir}/account.json` })
      mode = 'signin'
    } catch {
      mode = 'signup'
    }
  }

  const state = generateState()
  const { open } = await import('@tauri-apps/plugin-shell')
  await open(`${SHOULDERS_WEB_URL}/auth/desktop-onboard?state=${state}&mode=${mode}`)

  const abortController = new AbortController()
  let settled = false

  return new Promise((resolve, reject) => {
    function finish(data) {
      if (settled) return
      settled = true
      abortController.abort()
      deepLinkResolver = null
      storeInKeychain(data)
        .then(async () => {
          // Persist account marker so future logins default to signin
          try {
            const globalDir = await invoke('get_global_config_dir')
            await invoke('write_file', {
              path: `${globalDir}/account.json`,
              content: JSON.stringify({ email: data.email || '' }),
            })
          } catch {}
          resolve(data)
        }, reject)
    }

    // Path 1: deep link (prod — exchange code for tokens)
    deepLinkResolver = async (code) => {
      try {
        const data = await apiCall('/exchange', { body: { code } })
        finish(data)
      } catch (e) {
        if (!settled) reject(e)
      }
    }

    // Path 2: polling (dev fallback — tokens come directly)
    pollForTokens(state, abortController.signal).then(data => {
      if (data) finish(data)
    })

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!settled) {
        settled = true
        abortController.abort()
        deepLinkResolver = null
        reject(new Error('Login timed out. Please try again.'))
      }
    }, 5 * 60 * 1000)
  })
}

// ── Token management ──

export async function refreshTokens(currentAuth) {
  if (!currentAuth?.refreshToken) throw new Error('No refresh token')
  const data = await apiCall('/refresh', { body: { refreshToken: currentAuth.refreshToken } })
  const merged = { ...currentAuth, ...data }
  await storeInKeychain(merged)
  return merged
}

export async function getAccountStatus(token) {
  return apiCall('/status', { method: 'GET', token })
}

export async function logout(currentAuth) {
  if (currentAuth?.refreshToken) {
    try {
      await apiCall('/logout', { body: { refreshToken: currentAuth.refreshToken } })
    } catch {}
  }
  await clearKeychain()
}

export async function loadStoredAuth() {
  const auth = await loadFromKeychain()
  if (!auth) return null
  if (auth.refreshExpiresAt && new Date(auth.refreshExpiresAt) < new Date()) {
    await clearKeychain()
    return null
  }
  return auth
}

export function storeAuth(auth) {
  return storeInKeychain(auth)
}

export function isAccessTokenExpired(auth) {
  if (!auth?.expiresAt) return true
  return new Date(auth.expiresAt) < new Date(Date.now() + 60 * 1000)
}
