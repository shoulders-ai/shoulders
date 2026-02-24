// GET /api/v1/auth/github/callback?code=xxx&state=xxx
// GitHub redirects here after user authorizes the OAuth app
// Exchanges the code for a GitHub access token, stores it for desktop polling

import { hashToken } from '../../../../utils/auth.js'
import { setGitHubToken, markCodeUsed, isCodeUsed, verifyOAuthNonce } from '../../../../utils/githubTokenStore.js'

const SUCCESS_HTML = `<!DOCTYPE html>
<html>
<head><title>GitHub Connected</title></head>
<body style="font-family: -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1b26; color: #c0caf5;">
  <div style="text-align: center;">
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ece6a" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    <h2>GitHub Connected</h2>
    <p>You can close this window and return to Shoulders.</p>
  </div>
  <script>setTimeout(() => window.close(), 3000)</script>
</body>
</html>`

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const { code, state: combinedState } = query

  if (!code || !combinedState) {
    setResponseStatus(event, 400)
    return { error: 'Missing code or state' }
  }

  // Guard against double-hit (browser can fire callback twice)
  // Check this before nonce verification since nonce is one-time-use
  if (isCodeUsed(code)) {
    setHeader(event, 'Content-Type', 'text/html')
    return SUCCESS_HTML
  }

  // Parse combined state: "originalState:nonce"
  const colonIdx = combinedState.lastIndexOf(':')
  if (colonIdx === -1) {
    setResponseStatus(event, 400)
    return { error: 'Invalid state parameter' }
  }

  const originalState = combinedState.slice(0, colonIdx)
  const nonce = combinedState.slice(colonIdx + 1)

  // Verify the server-side nonce (CSRF protection)
  const verifiedState = verifyOAuthNonce(nonce)
  if (!verifiedState || verifiedState !== originalState) {
    setResponseStatus(event, 403)
    return { error: 'Invalid or expired OAuth state. Please try connecting again.' }
  }

  markCodeUsed(code)

  const config = useRuntimeConfig()

  // Exchange code for GitHub access token
  let ghToken
  try {
    const response = await $fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: {
        client_id: config.githubClientId,
        client_secret: config.githubClientSecret,
        code,
      },
    })

    if (response.error) {
      setResponseStatus(event, 400)
      return { error: response.error_description || response.error }
    }

    ghToken = response.access_token
  } catch (e) {
    setResponseStatus(event, 500)
    return { error: 'Failed to exchange code with GitHub' }
  }

  if (!ghToken) {
    setResponseStatus(event, 400)
    return { error: 'No access token received from GitHub' }
  }

  // Fetch GitHub user info
  let ghUser
  try {
    ghUser = await $fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${ghToken}`,
        'Accept': 'application/vnd.github+json',
      },
    })
  } catch {
    ghUser = {}
  }

  // Store in memory for desktop polling (2 min TTL, one-time read)
  // Use the original state (what the desktop client knows) for the hash
  const stateHash = hashToken(originalState)
  setGitHubToken(stateHash, {
    token: ghToken,
    login: ghUser.login,
    name: ghUser.name,
    email: ghUser.email,
    id: ghUser.id,
    avatarUrl: ghUser.avatar_url,
  })

  // Return a success page that auto-closes
  setHeader(event, 'Content-Type', 'text/html')
  return SUCCESS_HTML
})
