// In-memory store for GitHub OAuth tokens awaiting desktop polling
// Tokens live for 2 minutes max — no DB needed

import { randomBytes } from 'crypto'

const store = new Map()
const processedCodes = new Set()
const oauthNonces = new Map() // nonce → { originalState, expiresAt }

export function setGitHubToken(stateHash, data) {
  store.set(stateHash, { data, expiresAt: Date.now() + 120_000 })
  setTimeout(() => store.delete(stateHash), 120_000)
}

export function getGitHubToken(stateHash) {
  const entry = store.get(stateHash)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    store.delete(stateHash)
    return null
  }
  // One-time read
  store.delete(stateHash)
  return entry.data
}

// Prevent double code exchange (browser can hit callback twice)
export function markCodeUsed(code) {
  processedCodes.add(code)
  setTimeout(() => processedCodes.delete(code), 120_000)
}

export function isCodeUsed(code) {
  return processedCodes.has(code)
}

// ── OAuth state nonce (CSRF protection) ──

/**
 * Generate a nonce bound to the original state, store it server-side.
 * Returns the nonce string to be appended to the GitHub state param.
 */
export function createOAuthNonce(originalState) {
  const nonce = randomBytes(16).toString('hex')
  const ttl = 10 * 60 * 1000 // 10 minutes
  oauthNonces.set(nonce, { originalState, expiresAt: Date.now() + ttl })
  setTimeout(() => oauthNonces.delete(nonce), ttl)
  return nonce
}

/**
 * Verify a nonce from the callback state. Returns the original state if valid,
 * or null if the nonce is invalid/expired/already used.
 */
export function verifyOAuthNonce(nonce) {
  const entry = oauthNonces.get(nonce)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    oauthNonces.delete(nonce)
    return null
  }
  // One-time use — delete after verification
  oauthNonces.delete(nonce)
  return entry.originalState
}
