// Team workspace sync service
// Handles Shoulders server API calls and git sync cycle for team workspaces

import { invoke } from '@tauri-apps/api/core'
import {
  gitPush, gitFetch, gitAheadBehind, gitPullFf, gitMergeRemote,
  gitBranch, gitRemoteAdd, gitRemoteGetUrl, gitRemoteRemove, gitSetUser,
} from './git'

const SHOULDERS_BASE = import.meta.env.DEV ? 'http://localhost:3000' : 'https://shoulde.rs'
const API_BASE = `${SHOULDERS_BASE}/api/v1`

const SYNC_INTERVAL = 10_000 // 10 seconds

// ── Sync state (reactive, read by workspace store) ──

export const teamSyncState = {
  status: 'disconnected', // 'idle' | 'syncing' | 'synced' | 'error' | 'conflict' | 'disconnected'
  lastSyncTime: null,
  error: null,
  errorType: null, // 'auth' | 'network' | 'conflict' | 'generic'
}

let syncTimer = null

// ── API helpers ──

async function authedApiCall(endpoint, { method = 'GET', body = null, token } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const result = await invoke('proxy_api_call', {
    request: {
      url: `${API_BASE}${endpoint}`,
      method,
      headers,
      body: body ? JSON.stringify(body) : '',
    },
  })

  const parsed = JSON.parse(result)
  if (parsed.error || parsed.statusCode >= 400) {
    throw new Error(parsed.statusMessage || parsed.message || 'Request failed')
  }
  return parsed
}

// ── Workspace API ──

export async function createTeamWorkspace(name, token) {
  return authedApiCall('/workspaces', { method: 'POST', body: { name }, token })
}

export async function listTeamWorkspaces(token) {
  return authedApiCall('/workspaces', { method: 'GET', token })
}

export async function joinTeamWorkspace(inviteToken, token) {
  return authedApiCall('/workspaces/join', { method: 'POST', body: { token: inviteToken }, token })
}

export async function createInvite(workspaceId, token, expiresIn) {
  const body = expiresIn ? { expiresIn } : {}
  return authedApiCall(`/workspaces/${workspaceId}/invite`, { method: 'POST', body, token })
}

// ── Team workspace detection ──

export async function loadTeamMeta(workspacePath) {
  const metaPath = `${workspacePath}/.shoulders/team.json`
  try {
    const raw = await invoke('read_file', { path: metaPath })
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export async function saveTeamMeta(workspacePath, meta) {
  const shouldersDir = `${workspacePath}/.shoulders`
  const exists = await invoke('path_exists', { path: shouldersDir })
  if (!exists) await invoke('create_dir', { path: shouldersDir })
  await invoke('write_file', {
    path: `${shouldersDir}/team.json`,
    content: JSON.stringify(meta, null, 2),
  })
}

// ── User-friendly error messages ──

export function friendlyTeamError(raw) {
  const msg = String(raw).replace(/^Error:\s*/i, '')
  const lower = msg.toLowerCase()

  if (lower.includes('authentication') || lower.includes('401') || lower.includes('403') || lower.includes('credentials')) {
    return 'Authentication failed. Please log in again (Settings › Account).'
  }
  if (lower.includes('invalid invite') || (lower.includes('404') && lower.includes('invite'))) {
    return 'Invalid invite link. Check the link and try again.'
  }
  if (lower.includes('expired') || lower.includes('410')) {
    return 'This invite has expired. Ask the workspace admin for a new one.'
  }
  if (lower.includes('already a member') || lower.includes('409')) {
    return 'You are already a member of this workspace.'
  }
  if (lower.includes('not found') || lower.includes('404')) {
    return 'Workspace not found. The link may be invalid.'
  }
  if (lower.includes('network') || lower.includes('dns') || lower.includes('resolve') || lower.includes('could not connect')) {
    return 'Could not reach the server. Check your internet connection.'
  }
  if (lower.includes('already exists')) {
    return 'A folder with that name already exists. Choose a different location.'
  }
  if (lower.includes('clone failed')) {
    return 'Failed to download workspace files. Please try again.'
  }
  if (lower.includes('workspace name')) {
    return msg
  }
  if (msg.length > 120) {
    return 'Something went wrong. Please try again.'
  }
  return msg
}

// ── Error classification ──

function classifyError(msg) {
  const lower = msg.toLowerCase()
  if (lower.includes('authentication') || lower.includes('401') || lower.includes('403')) {
    return 'auth'
  }
  if (lower.includes('resolve') || lower.includes('dns') || lower.includes('network') || lower.includes('could not connect')) {
    return 'network'
  }
  if (lower.includes('conflict') || lower.includes('diverged')) {
    return 'conflict'
  }
  return 'generic'
}

// ── Sync cycle ──

export async function syncTeamWorkspace(workspacePath, token) {
  if (!workspacePath || !token) return

  const remote = await gitRemoteGetUrl(workspacePath)
  if (!remote) {
    teamSyncState.status = 'disconnected'
    return
  }

  const branch = await gitBranch(workspacePath)
  if (!branch) return

  teamSyncState.status = 'syncing'
  teamSyncState.error = null

  // Step 1: Fetch
  try {
    await gitFetch(workspacePath, 'origin', token)
  } catch (e) {
    const msg = String(e)
    const type = classifyError(msg)
    if (type === 'auth') {
      teamSyncState.status = 'error'
      teamSyncState.error = msg
      teamSyncState.errorType = 'auth'
    }
    // Network errors: stay quiet, retry next cycle
    return
  }

  // Step 2: Check divergence
  let status
  try {
    status = await gitAheadBehind(workspacePath)
  } catch {
    // No upstream yet — initial push
    try {
      await gitPush(workspacePath, 'origin', branch, token)
      markSynced()
    } catch (pushErr) {
      teamSyncState.status = 'error'
      teamSyncState.error = String(pushErr)
      teamSyncState.errorType = classifyError(String(pushErr))
    }
    return
  }

  // Step 3: Pull if behind
  if (status.behind > 0) {
    if (status.ahead === 0) {
      try {
        await gitPullFf(workspacePath, 'origin', branch, token)
      } catch (e) {
        teamSyncState.status = 'error'
        teamSyncState.error = String(e)
        teamSyncState.errorType = classifyError(String(e))
        return
      }
    } else {
      // Both ahead and behind — try auto-merge
      try {
        await gitMergeRemote(workspacePath, 'origin', branch)
      } catch (e) {
        const msg = String(e)
        if (msg.includes('CONFLICT')) {
          teamSyncState.status = 'conflict'
          teamSyncState.error = msg
          teamSyncState.errorType = 'conflict'
        } else {
          teamSyncState.status = 'error'
          teamSyncState.error = msg
          teamSyncState.errorType = classifyError(msg)
        }
        return
      }
    }
  }

  // Step 4: Push if ahead
  if (status.ahead > 0 || status.behind > 0) {
    try {
      await gitPush(workspacePath, 'origin', branch, token)
    } catch (e) {
      const msg = String(e)
      if (msg.includes('CONFLICT')) {
        teamSyncState.status = 'conflict'
        teamSyncState.error = msg
        teamSyncState.errorType = 'conflict'
      } else {
        teamSyncState.status = 'error'
        teamSyncState.error = msg
        teamSyncState.errorType = classifyError(msg)
      }
      return
    }
  }

  markSynced()
}

function markSynced() {
  teamSyncState.status = 'synced'
  teamSyncState.lastSyncTime = new Date()
  teamSyncState.error = null
  teamSyncState.errorType = null
}

// ── Timer management ──

export function startTeamSync(workspacePath, getToken) {
  stopTeamSync()
  teamSyncState.status = 'idle'

  syncTimer = setInterval(async () => {
    const token = await getToken()
    if (!token) return
    await syncTeamWorkspace(workspacePath, token)
  }, SYNC_INTERVAL)
}

export function stopTeamSync() {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

// ── Remote setup helpers ──

export async function setupTeamRemote(workspacePath, gitUrl) {
  const existing = await gitRemoteGetUrl(workspacePath)
  if (existing === gitUrl) return

  if (existing) {
    await gitRemoteRemove(workspacePath, 'origin')
  }
  await gitRemoteAdd(workspacePath, 'origin', gitUrl)
}

export async function configureTeamGitUser(workspacePath, auth) {
  const name = auth.name || auth.email?.split('@')[0] || 'Shoulders User'
  const email = auth.email || 'user@shoulde.rs'
  await gitSetUser(workspacePath, name, email)
}
