// GET /api/v1/auth/github/connect?state=xxx
// Redirects to GitHub OAuth consent screen
// Generates a server-side nonce bound to the state for CSRF protection

import { createOAuthNonce } from '../../../../utils/githubTokenStore.js'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const state = query.state

  if (!state) {
    setResponseStatus(event, 400)
    return { error: 'State parameter is required' }
  }

  const config = useRuntimeConfig()
  const clientId = config.githubClientId

  if (!clientId) {
    setResponseStatus(event, 500)
    return { error: 'GitHub OAuth not configured' }
  }

  // Generate a server-side nonce and bind it to the original state
  const nonce = createOAuthNonce(state)
  // Combine original state + nonce so GitHub returns both in the callback
  const combinedState = `${state}:${nonce}`

  const redirectUri = `${config.baseUrl}/api/v1/auth/github/callback`
  const scope = 'repo read:user user:email'

  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(combinedState)}`

  return sendRedirect(event, url)
})
