<template>
  <div class="launcher">
    <!-- Drag region for window movement (no header in this layout) -->
    <div data-tauri-drag-region :style="{ height: isMac ? '44px' : '8px' }" class="shrink-0 w-full" />
    <div class="launcher-content">
      <!-- Logo + Title -->
      <div class="launcher-hero">
        <div class="launcher-logo">S</div>
        <div class="launcher-title">Shoulders</div>
        <p class="launcher-tagline">Writing, references, and AI — designed as one system.</p>
      </div>

      <!-- Action buttons -->
      <div class="launcher-actions">
        <button class="launcher-btn primary" @click="$emit('open-folder')">
          Open Folder
          <kbd class="launcher-btn-hint">{{ modKey }}+O</kbd>
        </button>
        <button class="launcher-btn secondary" @click="showClone = true">
          Clone Repository
        </button>
        <button
          class="launcher-btn secondary"
          :disabled="!isLoggedIn"
          :title="!isLoggedIn ? 'Log in to create team workspaces' : undefined"
          @click="createTeamWorkspace"
        >
          <IconUsers :size="16" :stroke-width="1.5" />
          Create Team Workspace
        </button>
        <button
          class="launcher-btn secondary"
          :disabled="!isLoggedIn"
          :title="!isLoggedIn ? 'Log in to join team workspaces' : undefined"
          @click="showJoin = true"
        >
          <IconUserPlus :size="16" :stroke-width="1.5" />
          Join Team Workspace
        </button>
      </div>

      <!-- No-recents hint -->
      <p v-if="!recents.length && !showClone" class="launcher-hint">
        Open a folder to get started, or clone an existing project.
      </p>

      <!-- Clone inline form -->
      <div v-if="showClone" class="launcher-clone-form">
        <input
          ref="urlInputRef"
          v-model="cloneUrl"
          class="launcher-input"
          placeholder="https://github.com/user/repo.git"
          spellcheck="false"
          @keydown.enter="doClone"
          @keydown.escape="cancelClone"
        />
        <div class="launcher-clone-actions">
          <button
            class="launcher-btn primary small"
            :disabled="!cloneUrl.trim() || cloning"
            @click="doClone"
          >
            {{ cloning ? 'Cloning...' : 'Clone' }}
          </button>
          <button class="launcher-btn-text" @click="cancelClone" :disabled="cloning">Cancel</button>
        </div>
        <div v-if="cloneError" class="launcher-error">{{ cloneError }}</div>
      </div>

      <!-- Join team inline form -->
      <div v-if="showJoin" class="launcher-clone-form">
        <input
          ref="joinInputRef"
          v-model="joinToken"
          class="launcher-input"
          placeholder="Paste invite token or link"
          spellcheck="false"
          @keydown.enter="doJoin"
          @keydown.escape="cancelJoin"
        />
        <div class="launcher-clone-actions">
          <button
            class="launcher-btn primary small"
            :disabled="!joinToken.trim() || joining"
            @click="doJoin"
          >
            {{ joining ? 'Joining...' : 'Join' }}
          </button>
          <button class="launcher-btn-text" @click="cancelJoin" :disabled="joining">Cancel</button>
        </div>
        <div v-if="joinError" class="launcher-error">{{ joinError }}</div>
      </div>

      <!-- Recent Workspaces -->
      <div v-if="recents.length" class="launcher-recents">
        <div class="launcher-recents-heading">Recent</div>
        <div
          v-for="r in recents"
          :key="r.path"
          class="launcher-recent"
          @click="$emit('open-workspace', r.path)"
        >
          <svg class="launcher-recent-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 4h4l3 3h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/>
          </svg>
          <div class="launcher-recent-text">
            <div class="launcher-recent-name">{{ r.name }}</div>
            <div class="launcher-recent-path">{{ shortenPath(r.path) }}</div>
          </div>
          <button
            class="launcher-recent-remove"
            title="Remove from recent"
            @click.stop="removeRecent(r.path)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from '../stores/workspace'
import { modKey, isMac } from '../platform'
import { IconUsers, IconUserPlus } from '@tabler/icons-vue'
import { useToastStore } from '../stores/toast'
import { gitInit, gitAdd, gitCommit } from '../services/git'
import {
  createTeamWorkspace as apiCreateTeamWorkspace,
  joinTeamWorkspace as apiJoinTeamWorkspace,
  setupTeamRemote,
  configureTeamGitUser,
  saveTeamMeta,
} from '../services/teamSync'

const props = defineProps({
  autoClone: { type: Boolean, default: false },
  autoTeamAction: { type: String, default: null },
})

const emit = defineEmits(['open-folder', 'open-workspace', 'team-created'])

watch(() => props.autoClone, (val) => {
  if (val) showClone.value = true
})

watch(() => props.autoTeamAction, (val) => {
  if (val === 'create') createTeamWorkspace()
  else if (val === 'join') showJoin.value = true
})

const workspace = useWorkspaceStore()
const toastStore = useToastStore()
const isLoggedIn = computed(() => !!workspace.shouldersAuth?.token)
const recents = computed(() => workspace.getRecentWorkspaces())

// Clone state
const showClone = ref(false)
const cloneUrl = ref('')
const cloning = ref(false)
const cloneError = ref('')
const urlInputRef = ref(null)

// Join team state
const showJoin = ref(false)
const joinToken = ref('')
const joining = ref(false)
const joinError = ref('')
const joinInputRef = ref(null)

watch(showClone, (val) => {
  if (val) {
    cloneError.value = ''
    nextTick(() => urlInputRef.value?.focus())
  }
})

watch(showJoin, (val) => {
  if (val) {
    joinError.value = ''
    nextTick(() => joinInputRef.value?.focus())
  }
})

function cancelClone() {
  showClone.value = false
  cloneUrl.value = ''
  cloneError.value = ''
}

function repoNameFromUrl(url) {
  // Extract repo name: "https://github.com/user/repo.git" → "repo"
  const cleaned = url.trim().replace(/\/+$/, '').replace(/\.git$/, '')
  return cleaned.split('/').pop() || 'project'
}

async function doClone() {
  const url = cloneUrl.value.trim()
  if (!url || cloning.value) return

  cloneError.value = ''

  // Pick parent directory
  const { homeDir } = await import('@tauri-apps/api/path')
  const home = await homeDir()
  const parentDir = await open({
    directory: true,
    multiple: false,
    title: 'Clone into...',
    defaultPath: home,
  })
  if (!parentDir) return

  const repoName = repoNameFromUrl(url)
  const targetPath = `${parentDir}/${repoName}`

  cloning.value = true
  try {
    // Use authenticated clone if GitHub token is available (enables private repos)
    if (workspace.githubToken?.token && url.includes('github.com')) {
      await invoke('git_clone_authenticated', { url, targetPath, token: workspace.githubToken.token })
    } else {
      await invoke('git_clone', { url, targetPath })
    }
    cancelClone()
    emit('open-workspace', targetPath)
  } catch (e) {
    cloneError.value = String(e).replace(/^Error:\s*/i, '')
  } finally {
    cloning.value = false
  }
}

async function createTeamWorkspace() {
  const { homeDir } = await import('@tauri-apps/api/path')
  const home = await homeDir()
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose location for team workspace',
    defaultPath: home,
  })
  if (!selected) return

  try {
    // Create the folder if it doesn't exist
    const exists = await invoke('path_exists', { path: selected })
    if (!exists) {
      await invoke('create_dir', { path: selected })
    }

    // Initialize git repo
    const gitExists = await invoke('path_exists', { path: `${selected}/.git` })
    if (!gitExists) {
      await gitInit(selected)
    }

    // Create _private/ folder
    const privateDir = `${selected}/_private`
    const privateExists = await invoke('path_exists', { path: privateDir })
    if (!privateExists) {
      await invoke('create_dir', { path: privateDir })
    }

    // Create .gitignore with _private/ and .shoulders/
    const gitignorePath = `${selected}/.gitignore`
    let gitignoreContent = ''
    try {
      gitignoreContent = await invoke('read_file', { path: gitignorePath })
    } catch { /* file doesn't exist yet */ }

    let changed = false
    if (!gitignoreContent.includes('_private/')) {
      gitignoreContent = gitignoreContent.trimEnd() + '\n_private/\n'
      changed = true
    }
    if (!gitignoreContent.includes('.shoulders/')) {
      gitignoreContent = gitignoreContent.trimEnd() + '\n.shoulders/\n'
      changed = true
    }
    gitignoreContent = gitignoreContent.replace(/^\n+/, '')
    if (changed || !await invoke('path_exists', { path: gitignorePath })) {
      await invoke('write_file', { path: gitignorePath, content: gitignoreContent })
    }

    // Register on server + set up sync
    let serverOk = false
    let inviteToken = null

    if (!workspace.shouldersAuth?.token) {
      toastStore.show('Workspace created locally. Log in to enable team sync.', { type: 'warning' })
    } else {
      try {
        const freshOk = await workspace.ensureFreshToken()
        if (!freshOk || !workspace.shouldersAuth?.token) {
          throw new Error('Authentication expired. Please log in again.')
        }

        const token = workspace.shouldersAuth.token
        const name = selected.split('/').pop() || 'workspace'
        const result = await apiCreateTeamWorkspace(name, token)

        await setupTeamRemote(selected, result.gitUrl)
        await configureTeamGitUser(selected, workspace.shouldersAuth)

        await gitAdd(selected)
        try { await gitCommit(selected, 'Initial commit') } catch {}

        const { gitPush, gitBranch } = await import('../services/git')
        const branch = await gitBranch(selected)
        if (branch) {
          await gitPush(selected, 'origin', branch, token)
        }

        await saveTeamMeta(selected, {
          workspaceId: result.id,
          gitUrl: result.gitUrl,
          inviteToken: result.inviteToken,
          name: result.name,
        })
        serverOk = true
        inviteToken = result.inviteToken
      } catch (e) {
        console.error('[team] Server registration failed:', e)
        toastStore.show(
          `Team workspace setup failed: ${String(e).replace(/^Error:\s*/i, '')}`,
          { type: 'error' }
        )
      }
    }

    emit('open-workspace', selected)
    if (serverOk && inviteToken) {
      emit('team-created', { inviteToken })
    }
  } catch (e) {
    console.error('Failed to create team workspace:', e)
    toastStore.show(`Failed to create workspace: ${e.message || e}`, { type: 'error' })
  }
}

function cancelJoin() {
  showJoin.value = false
  joinToken.value = ''
  joinError.value = ''
}

function extractInviteToken(input) {
  const trimmed = input.trim()
  // Handle full URL: shoulde.rs/join/abc123 or https://shoulde.rs/join/abc123
  const match = trimmed.match(/\/join\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  // Bare token
  return trimmed
}

async function doJoin() {
  const raw = joinToken.value.trim()
  if (!raw || joining.value) return

  if (!workspace.shouldersAuth?.token) {
    joinError.value = 'Please log in to Shoulders first (Settings > Account).'
    return
  }

  joining.value = true
  joinError.value = ''

  try {
    const freshOk = await workspace.ensureFreshToken()
    if (freshOk !== true || !workspace.shouldersAuth?.token) {
      joinError.value = 'Authentication expired. Please log in again.'
      return
    }

    const token = workspace.shouldersAuth.token
    const invite = extractInviteToken(raw)
    const result = await apiJoinTeamWorkspace(invite, token)

    // Pick clone destination
    const { homeDir } = await import('@tauri-apps/api/path')
    const home = await homeDir()
    const parentDir = await open({
      directory: true,
      multiple: false,
      title: 'Clone team workspace into...',
      defaultPath: home,
    })
    if (!parentDir) { joining.value = false; return }

    const folderName = result.name || `team-${result.id}`
    const targetPath = `${parentDir}/${folderName}`

    // Clone using Shoulders JWT
    await invoke('git_clone_authenticated', { url: result.gitUrl, targetPath, token })

    // Save team metadata
    await saveTeamMeta(targetPath, {
      workspaceId: result.id,
      gitUrl: result.gitUrl,
      name: result.name,
    })

    // Configure git user
    await configureTeamGitUser(targetPath, workspace.shouldersAuth)

    cancelJoin()
    emit('open-workspace', targetPath)
  } catch (e) {
    joinError.value = String(e).replace(/^Error:\s*/i, '')
  } finally {
    joining.value = false
  }
}

function shortenPath(fullPath) {
  const home = fullPath.match(/^\/Users\/[^/]+/)
  if (home) return fullPath.replace(home[0], '~')
  return fullPath
}

function removeRecent(path) {
  workspace.removeRecent(path)
}
</script>

<style scoped>
.launcher {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  overflow-y: auto;
}

.launcher-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 360px;
  flex: 1;
  justify-content: center;
  padding: 32px 0;
}

/* Hero */
.launcher-hero {
  text-align: center;
  margin-bottom: 28px;
}

.launcher-logo {
  width: 48px;
  height: 48px;
  margin: 0 auto 14px;
  border-radius: 12px;
  background: rgb(var(--accent));
  color: rgb(var(--bg-primary));
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.launcher-title {
  font-family: 'Lora', ui-serif, Georgia, serif;
  font-style: italic;
  font-weight: 400;
  font-size: 20px;
  color: rgb(var(--fg-primary));
  letter-spacing: -0.02em;
}

.launcher-tagline {
  font-size: 12px;
  color: rgb(var(--fg-muted));
  margin: 6px 0 0;
}

.launcher-hint {
  font-size: 12px;
  color: rgb(var(--fg-muted));
  margin-top: 12px;
  text-align: center;
  opacity: 0.7;
}

.launcher-btn-hint {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10px;
  opacity: 0.5;
  margin-left: 4px;
}

/* Action buttons */
.launcher-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.launcher-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
}

.launcher-btn.primary {
  background: rgb(var(--accent));
  color: rgb(var(--bg-primary));
  border-color: rgb(var(--accent));
}

.launcher-btn.primary:hover {
  opacity: 0.9;
}

.launcher-btn.primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.launcher-btn.secondary {
  background: transparent;
  color: rgb(var(--fg-secondary));
  border-color: rgb(var(--border));
}

.launcher-btn.secondary:hover:not(:disabled) {
  border-color: rgb(var(--fg-muted));
  color: rgb(var(--fg-primary));
}

.launcher-btn.secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.launcher-btn.small {
  padding: 5px 14px;
  font-size: 12px;
}

.launcher-btn-text {
  background: none;
  border: none;
  color: rgb(var(--fg-muted));
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
}

.launcher-btn-text:hover {
  color: rgb(var(--fg-secondary));
}

.launcher-btn-text:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Clone form */
.launcher-clone-form {
  margin-top: 16px;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.launcher-input {
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid rgb(var(--border));
  background: rgb(var(--bg-secondary));
  color: rgb(var(--fg-primary));
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.launcher-input:focus {
  border-color: rgb(var(--accent));
}

.launcher-input::placeholder {
  color: rgb(var(--fg-muted));
}

.launcher-clone-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.launcher-error {
  padding: 6px 10px;
  border-radius: 5px;
  background: rgba(247, 118, 142, 0.1);
  color: rgb(var(--error));
  font-size: 11px;
  line-height: 1.4;
}

/* Recents */
.launcher-recents {
  width: 100%;
  margin-top: 28px;
}

.launcher-recents-heading {
  font-size: 11px;
  font-weight: 600;
  color: rgb(var(--fg-muted));
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 4px;
  margin-bottom: 6px;
}

.launcher-recent {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 8px;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  text-align: left;
  transition: background 0.1s;
}

.launcher-recent:hover {
  background: rgb(var(--bg-hover));
}

.launcher-recent-icon {
  flex-shrink: 0;
  color: rgb(var(--fg-muted));
}

.launcher-recent-text {
  flex: 1;
  min-width: 0;
}

.launcher-recent-name {
  font-size: 13px;
  font-weight: 500;
  color: rgb(var(--fg-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-recent-path {
  font-size: 11px;
  color: rgb(var(--fg-muted));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-recent-remove {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: rgb(var(--fg-muted));
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
}

.launcher-recent:hover .launcher-recent-remove {
  opacity: 1;
}

.launcher-recent-remove:hover {
  background: rgb(var(--bg-tertiary));
  color: rgb(var(--fg-secondary));
}
</style>
