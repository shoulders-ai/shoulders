// POST /api/v1/auth/github/poll
// Desktop polls for GitHub token by state (requires Shoulders auth)

import { hashToken, verifyToken } from '../../../../utils/auth.js'
import { getGitHubToken } from '../../../../utils/githubTokenStore.js'

export default defineEventHandler(async (event) => {
  // Require Bearer token authentication
  const authHeader = getHeader(event, 'authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const token = authHeader.slice(7)
  const payload = await verifyToken(token)
  if (!payload) {
    setResponseStatus(event, 401)
    return { error: 'Invalid or expired token' }
  }

  const { state } = await readBody(event)

  if (!state) {
    setResponseStatus(event, 400)
    return { error: 'State is required' }
  }

  const stateHash = hashToken(state)
  const data = getGitHubToken(stateHash)

  if (!data) {
    return { pending: true }
  }

  return data
})
