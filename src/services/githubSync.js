// GitHub sync orchestration service
// Handles auto-push, fetch/pull cycles, conflict detection + branch escalation

import { invoke } from '@tauri-apps/api/core'
import {
  gitPush, gitPushBranch, gitFetch, gitAheadBehind, gitPullFf, gitMergeRemote,
  gitRemoteAdd, gitRemoteGetUrl, gitRemoteRemove, gitBranch, gitSetUser,
} from './git'

const GITHUB_KEYCHAIN_KEY = 'github-token'

// ── Sync status (reactive, read by Footer) ──

// Status: 'idle' | 'syncing' | 'synced' | 'error' | 'conflict' | 'disconnected'
export const syncState = {
  status: 'disconnected',
  lastSyncTime: null,
  error: null,
  errorType: null, // 'auth' | 'network' | 'conflict' | 'generic'
  conflictBranch: null,
  remoteUrl: '',
}

// Classify sync errors for UI routing
function classifyError(msg) {
  const lower = msg.toLowerCase()
  if (lower.includes('authentication') || lower.includes('401') || lower.includes('403') || lower.includes('reconnect')) {
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

// ── GitHub token keychain helpers ──

export async function storeGitHubToken(data) {
  try {
    await invoke('keychain_set', { key: GITHUB_KEYCHAIN_KEY, value: JSON.stringify(data) })
  } catch {
    console.warn('[security] OS keychain unavailable — GitHub token stored in plaintext localStorage')
    localStorage.setItem('githubToken', JSON.stringify(data))
  }
}

export async function loadGitHubToken() {
  try {
    const raw = await invoke('keychain_get', { key: GITHUB_KEYCHAIN_KEY })
    if (raw) return JSON.parse(raw)
  } catch {}
  try {
    const raw = localStorage.getItem('githubToken')
    if (raw) {
      const data = JSON.parse(raw)
      await storeGitHubToken(data)
      localStorage.removeItem('githubToken')
      return data
    }
  } catch {}
  return null
}

export async function clearGitHubToken() {
  try { await invoke('keychain_delete', { key: GITHUB_KEYCHAIN_KEY }) } catch {}
  try { localStorage.removeItem('githubToken') } catch {}
}

// ── GitHub API helpers (via Shoulders proxy to avoid CORS) ──

async function githubApi(endpoint, { method = 'GET', body = null, token } = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Authorization': `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Shoulders-Desktop',
  }
  if (body) headers['Content-Type'] = 'application/json'

  const result = await invoke('proxy_api_call', {
    request: {
      url: `https://api.github.com${endpoint}`,
      method,
      headers,
      body: body ? JSON.stringify(body) : '',
    },
  })

  const parsed = JSON.parse(result)
  if (parsed.message) {
    throw new Error(parsed.message)
  }
  if (parsed.errors) {
    throw new Error(parsed.errors.map(e => e.message).join(', '))
  }
  return parsed
}

export async function getGitHubUser(token) {
  return githubApi('/user', { token })
}

export async function listGitHubRepos(token) {
  // Get repos the user can push to, sorted by most recently pushed
  const repos = await githubApi('/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator', { token })
  return repos.map(r => ({
    fullName: r.full_name,
    name: r.name,
    private: r.private,
    cloneUrl: r.clone_url,
    htmlUrl: r.html_url,
    description: r.description,
  }))
}

export async function createGitHubRepo(token, name, isPrivate = true, description = '') {
  const repo = await githubApi('/user/repos', {
    method: 'POST',
    token,
    body: { name, private: isPrivate, description, auto_init: false },
  })
  return {
    fullName: repo.full_name,
    name: repo.name,
    cloneUrl: repo.clone_url,
    htmlUrl: repo.html_url,
  }
}

// ── Remote setup ──

export async function setupRemote(repoPath, cloneUrl) {
  const existing = await gitRemoteGetUrl(repoPath)
  if (existing === cloneUrl) return

  // Remove old origin if it exists and differs
  if (existing) {
    await gitRemoteRemove(repoPath, 'origin')
  }

  await gitRemoteAdd(repoPath, 'origin', cloneUrl)
}

export async function removeRemote(repoPath) {
  const existing = await gitRemoteGetUrl(repoPath)
  if (existing) {
    await gitRemoteRemove(repoPath, 'origin')
  }
}

// ── Core sync operations ──

export async function fetchAndPull(repoPath, token) {
  const branch = await gitBranch(repoPath)
  if (!branch) return { pulled: false }

  try {
    await gitFetch(repoPath, 'origin', token)
  } catch (e) {
    // Fetch failure is not critical — may be offline
    const msg = String(e)
    const type = classifyError(msg)
    console.warn('[sync] Fetch failed:', e)
    if (type === 'auth') {
      syncState.status = 'error'
      syncState.error = msg
      syncState.errorType = 'auth'
    }
    // Network errors: stay quiet, auto-retry next cycle
    return { pulled: false }
  }

  try {
    const status = await gitAheadBehind(repoPath)

    if (status.behind === 0) {
      // No remote changes, just update sync status
      if (syncState.status !== 'conflict') {
        syncState.status = status.ahead > 0 ? 'synced' : 'synced'
        syncState.lastSyncTime = new Date()
      }
      return { pulled: false, ahead: status.ahead, behind: 0 }
    }

    if (status.ahead === 0) {
      // Fast-forward possible
      await gitPullFf(repoPath, 'origin', branch, token)
      syncState.status = 'synced'
      syncState.lastSyncTime = new Date()
      syncState.conflictBranch = null
      return { pulled: true, ahead: 0, behind: status.behind }
    }

    // Both ahead and behind — try auto-merge before escalating
    try {
      await gitMergeRemote(repoPath, 'origin', branch)
      markSynced()
      return { pulled: true, ahead: status.ahead, behind: status.behind }
    } catch (mergeErr) {
      if (String(mergeErr).includes('CONFLICT')) {
        await handleConflict(repoPath, branch, token)
        return { pulled: false, conflict: true }
      }
      syncState.status = 'error'
      syncState.error = String(mergeErr)
      syncState.errorType = classifyError(String(mergeErr))
      return { pulled: false }
    }
  } catch (e) {
    const msg = String(e)
    if (msg.includes('CONFLICT') || msg.includes('diverged')) {
      await handleConflict(repoPath, branch, token)
      return { pulled: false, conflict: true }
    }
    if (msg.includes('No upstream')) {
      // First push hasn't happened yet — that's okay
      return { pulled: false }
    }
    console.warn('[sync] Pull check failed:', e)
    return { pulled: false }
  }
}

async function handleConflict(repoPath, branch, token) {
  // Don't create duplicate conflict branches on repeated sync cycles
  if (syncState.status === 'conflict' && syncState.conflictBranch) {
    return
  }

  // Push local state to a timestamped branch
  const now = new Date()
  const ts = now.toISOString().replace(/[:.]/g, '-').substring(0, 16)
  const conflictBranch = `shoulders/sync-${ts}`

  try {
    await gitPushBranch(repoPath, 'origin', branch, conflictBranch, token)
  } catch (e) {
    console.warn('[sync] Failed to push conflict branch:', e)
  }

  syncState.status = 'conflict'
  syncState.conflictBranch = conflictBranch
  syncState.error = null
  syncState.errorType = null
}

// ── Full sync cycle (called after auto-commit and on Cmd+S) ──

export async function syncNow(repoPath, token) {
  if (!repoPath || !token) return
  const remote = await gitRemoteGetUrl(repoPath)
  if (!remote) {
    syncState.status = 'disconnected'
    return
  }

  syncState.remoteUrl = remote

  const branch = await gitBranch(repoPath)
  if (!branch) return

  syncState.status = 'syncing'
  syncState.error = null

  // Step 1: Fetch remote state
  try {
    await gitFetch(repoPath, 'origin', token)
  } catch (e) {
    const msg = String(e)
    const type = classifyError(msg)
    console.warn('[sync] Fetch failed:', e)
    if (type === 'auth') {
      syncState.status = 'error'
      syncState.error = msg
      syncState.errorType = 'auth'
    }
    // Network errors: stay quiet, keep previous status
    return
  }

  // Step 2: Check divergence
  let status
  try {
    status = await gitAheadBehind(repoPath)
  } catch {
    // No upstream yet — initial push
    try {
      await gitPush(repoPath, 'origin', branch, token)
      markSynced()
    } catch (pushErr) {
      syncState.status = 'error'
      syncState.error = String(pushErr)
      syncState.errorType = classifyError(String(pushErr))
    }
    return
  }

  // Step 3: Pull if behind
  if (status.behind > 0) {
    if (status.ahead === 0) {
      // Only behind — simple fast-forward
      try {
        await gitPullFf(repoPath, 'origin', branch, token)
      } catch (e) {
        syncState.status = 'error'
        syncState.error = String(e)
        syncState.errorType = classifyError(String(e))
        return
      }
    } else {
      // Both ahead and behind — try auto-merge
      try {
        await gitMergeRemote(repoPath, 'origin', branch)
        // Merge succeeded! Now push the merge commit
      } catch (e) {
        const msg = String(e)
        if (msg.includes('CONFLICT')) {
          await handleConflict(repoPath, branch, token)
        } else {
          syncState.status = 'error'
          syncState.error = msg
          syncState.errorType = classifyError(msg)
        }
        return
      }
    }
  }

  // Step 4: Push if we have local commits
  // (re-check: after pull/merge we may now be ahead)
  if (status.ahead > 0 || status.behind > 0) {
    try {
      await gitPush(repoPath, 'origin', branch, token)
    } catch (e) {
      const msg = String(e)
      if (msg.includes('CONFLICT')) {
        await handleConflict(repoPath, branch, token)
      } else {
        syncState.status = 'error'
        syncState.error = msg
        syncState.errorType = classifyError(msg)
      }
      return
    }
  }

  markSynced()
}

function markSynced() {
  syncState.status = 'synced'
  syncState.lastSyncTime = new Date()
  syncState.conflictBranch = null
  syncState.errorType = null
}

// ── Set git user from GitHub profile ──

export async function configureGitUser(repoPath, githubUser) {
  if (!githubUser?.login) return
  const name = githubUser.name || githubUser.login
  const email = githubUser.email || `${githubUser.id}+${githubUser.login}@users.noreply.github.com`
  await gitSetUser(repoPath, name, email)
}

// ── Ensure .shoulders/ and .project/references/fulltext/ are in .gitignore ──

export async function ensureGitignore(repoPath) {
  try {
    const gitignorePath = `${repoPath}/.gitignore`
    let content = await invoke('read_file', { path: gitignorePath }).catch(() => '')
    let changed = false

    if (!content.includes('.shoulders/')) {
      content = content.trimEnd() + '\n.shoulders/\n'
      changed = true
    }

    // Ensure fulltext/ is ignored (extracted PDF text, not useful in git)
    if (!content.includes('.project/references/fulltext/')) {
      content = content.trimEnd() + '\n.project/references/fulltext/\n'
      changed = true
    }

    if (changed) {
      await invoke('write_file', { path: gitignorePath, content })
    }
  } catch (e) {
    console.warn('[sync] Failed to update .gitignore:', e)
  }
}
