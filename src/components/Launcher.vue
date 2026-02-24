<template>
  <div class="launcher">
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
import { modKey } from '../platform'

const emit = defineEmits(['open-folder', 'open-workspace'])

const workspace = useWorkspaceStore()
const recents = computed(() => workspace.getRecentWorkspaces())

// Clone state
const showClone = ref(false)
const cloneUrl = ref('')
const cloning = ref(false)
const cloneError = ref('')
const urlInputRef = ref(null)

watch(showClone, (val) => {
  if (val) {
    cloneError.value = ''
    nextTick(() => urlInputRef.value?.focus())
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
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary);
  overflow: auto;
}

.launcher-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 360px;
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
  background: var(--accent);
  color: var(--bg-primary);
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
  color: var(--fg-primary);
  letter-spacing: -0.02em;
}

.launcher-tagline {
  font-size: 12px;
  color: var(--fg-muted);
  margin: 6px 0 0;
}

.launcher-hint {
  font-size: 12px;
  color: var(--fg-muted);
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
  gap: 10px;
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
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
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
  color: var(--fg-secondary);
  border-color: var(--border);
}

.launcher-btn.secondary:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}

.launcher-btn.small {
  padding: 5px 14px;
  font-size: 12px;
}

.launcher-btn-text {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 4px 8px;
}

.launcher-btn-text:hover {
  color: var(--fg-secondary);
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
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--fg-primary);
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.launcher-input:focus {
  border-color: var(--accent);
}

.launcher-input::placeholder {
  color: var(--fg-muted);
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
  color: var(--error);
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
  color: var(--fg-muted);
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
  background: var(--bg-hover);
}

.launcher-recent-icon {
  flex-shrink: 0;
  color: var(--fg-muted);
}

.launcher-recent-text {
  flex: 1;
  min-width: 0;
}

.launcher-recent-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.launcher-recent-path {
  font-size: 11px;
  color: var(--fg-muted);
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
  color: var(--fg-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.1s, background 0.1s;
}

.launcher-recent:hover .launcher-recent-remove {
  opacity: 1;
}

.launcher-recent-remove:hover {
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
}
</style>
