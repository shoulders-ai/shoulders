import { invoke } from '@tauri-apps/api/core'

export async function gitInit(path) {
  return invoke('git_init', { path })
}

export async function gitAdd(repoPath) {
  return invoke('git_add_all', { repoPath })
}

export async function gitCommit(repoPath, message) {
  return invoke('git_commit', { repoPath, message })
}

export async function gitStatus(repoPath) {
  return invoke('git_status', { repoPath })
}

export async function gitBranch(repoPath) {
  try {
    return await invoke('git_branch', { repoPath })
  } catch {
    return ''
  }
}

/**
 * Get commit log, optionally filtered by file.
 * @returns {Promise<Array<{hash: string, date: string, message: string}>>}
 */
export async function gitLog(repoPath, filePath = null, limit = 50) {
  try {
    return await invoke('git_log', { repoPath, filePath, limit })
  } catch {
    return []
  }
}

/**
 * Get file content at a specific commit.
 */
export async function gitShow(repoPath, commitHash, filePath) {
  return invoke('git_show_file', { repoPath, commitHash, filePath })
}

/**
 * Get file content at a specific commit as base64 (for binary files like .docx).
 */
export async function gitShowBase64(repoPath, commitHash, filePath) {
  return invoke('git_show_file_base64', { repoPath, commitHash, filePath })
}

/**
 * Get a diff between working copy and last commit.
 */
export async function gitDiff(repoPath) {
  return invoke('git_diff', { repoPath })
}

/**
 * Get abbreviated diff summary for workspace context.
 * Returns { stat: string, diffs: [{file, diff}] }
 */
export async function gitDiffSummary(repoPath, maxFiles = 5, maxLinesPerFile = 20) {
  try {
    return await invoke('git_diff_summary', { repoPath, maxFiles, maxLines: maxLinesPerFile })
  } catch {
    return { stat: '', diffs: [] }
  }
}

// ── Remote operations ──

export async function gitRemoteAdd(repoPath, name, url) {
  return invoke('git_remote_add', { repoPath, name, url })
}

export async function gitRemoteGetUrl(repoPath) {
  try {
    return await invoke('git_remote_get_url', { repoPath })
  } catch {
    return ''
  }
}

export async function gitRemoteRemove(repoPath, name) {
  return invoke('git_remote_remove', { repoPath, name })
}

export async function gitPush(repoPath, remote, branch, token) {
  return invoke('git_push', { repoPath, remote, branch, token })
}

export async function gitPushBranch(repoPath, remote, localBranch, remoteBranch, token) {
  return invoke('git_push_branch', { repoPath, remote, localBranch, remoteBranch, token })
}

export async function gitFetch(repoPath, remote, token) {
  return invoke('git_fetch', { repoPath, remote, token })
}

/**
 * Returns { ahead: number, behind: number }
 */
export async function gitAheadBehind(repoPath) {
  return invoke('git_ahead_behind', { repoPath })
}

export async function gitPullFf(repoPath, remote, branch, token) {
  return invoke('git_pull_ff', { repoPath, remote, branch, token })
}

export async function gitMergeRemote(repoPath, remote, branch) {
  return invoke('git_merge_remote', { repoPath, remote, branch })
}

export async function gitSetUser(repoPath, name, email) {
  return invoke('git_set_user', { repoPath, name, email })
}

export async function gitCloneAuthenticated(url, targetPath, token) {
  return invoke('git_clone_authenticated', { url, targetPath, token })
}
