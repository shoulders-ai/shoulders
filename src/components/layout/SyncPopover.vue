<template>
  <div class="sync-popover">
    <div class="sync-header">GitHub Sync</div>
    <div class="sync-body">
      <!-- Status -->
      <div class="sync-row">
        <span class="sync-dot" :class="dotClass"></span>
        <span class="sync-status-text">{{ statusText }}</span>
      </div>

      <!-- Remote -->
      <div v-if="workspace.remoteUrl" class="sync-row">
        <span class="sync-label">Repository</span>
        <a class="sync-link" :href="repoHtmlUrl" @click.prevent="openInBrowser(repoHtmlUrl)">{{ repoName }}</a>
      </div>

      <!-- Last sync time -->
      <div v-if="workspace.lastSyncTime" class="sync-row">
        <span class="sync-label">Last sync</span>
        <span class="sync-value">{{ formatRelative(workspace.lastSyncTime) }}</span>
      </div>

      <!-- Error guidance (contextual, not raw) -->
      <div v-if="workspace.syncStatus === 'error'" class="sync-guidance" :class="guidanceClass">
        <div class="sync-guidance-text">{{ guidanceText }}</div>
        <div v-if="workspace.syncErrorType === 'auth'" class="sync-guidance-actions">
          <button class="sync-action-btn" @click="$emit('open-settings')">Reconnect</button>
        </div>
      </div>

      <!-- Conflict info -->
      <div v-if="workspace.syncConflictBranch" class="sync-conflict">
        <span>Your local changes and GitHub are out of sync. We've saved your version to <strong>{{ workspace.syncConflictBranch }}</strong>.</span>
        <div class="sync-conflict-hint">Resolve on GitHub, then click Refresh.</div>
        <div class="sync-conflict-actions">
          <button class="sync-action-btn primary" @click="openInBrowser(repoHtmlUrl)">Open GitHub</button>
          <button class="sync-action-btn" @click="$emit('refresh')">Refresh</button>
        </div>
      </div>

      <!-- Actions -->
      <div class="sync-actions">
        <button
          v-if="workspace.remoteUrl && workspace.syncStatus !== 'syncing'"
          class="sync-action-btn primary"
          @click="$emit('sync-now')"
        >
          Sync Now
        </button>
        <button
          v-if="!workspace.githubUser"
          class="sync-action-btn primary"
          @click="$emit('open-settings')"
        >
          Connect GitHub
        </button>
        <button
          v-else-if="!workspace.remoteUrl"
          class="sync-action-btn primary"
          @click="$emit('open-settings')"
        >
          Link Repository
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'

defineEmits(['sync-now', 'refresh', 'open-settings'])

const workspace = useWorkspaceStore()

const dotClass = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return 'good'
    case 'syncing': return 'syncing'
    case 'conflict': return 'warning'
    case 'error': return 'error'
    case 'idle': return 'idle'
    default: return 'none'
  }
})

const statusText = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return 'Up to date'
    case 'syncing': return 'Syncing...'
    case 'conflict': return 'Needs your input'
    case 'error': return 'Needs attention'
    case 'idle': return 'Connected'
    case 'disconnected': return workspace.githubUser ? 'No repository linked' : 'Not connected'
    default: return 'Not connected'
  }
})

const guidanceText = computed(() => {
  switch (workspace.syncErrorType) {
    case 'auth': return 'Your GitHub connection has expired.'
    case 'network': return "Can't reach GitHub right now. Will retry automatically."
    default: {
      const raw = workspace.syncError || ''
      // Strip "Push failed: " prefix for cleaner display
      const clean = raw.replace(/^(Push failed|Fetch failed): /i, '')
      return clean || 'Something went wrong. Sync will retry automatically.'
    }
  }
})

const guidanceClass = computed(() => {
  return workspace.syncErrorType === 'auth' ? 'auth' : ''
})

const repoName = computed(() => {
  const url = workspace.remoteUrl
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/)
  return match ? match[1] : url
})

const repoHtmlUrl = computed(() => {
  const name = repoName.value
  return name.startsWith('http') ? name : `https://github.com/${name}`
})

function formatRelative(date) {
  if (!date) return ''
  const d = date instanceof Date ? date : new Date(date)
  const secs = Math.floor((Date.now() - d.getTime()) / 1000)
  if (secs < 60) return 'just now'
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`
  return d.toLocaleDateString()
}

async function openInBrowser(url) {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(url)
  } catch {}
}
</script>

<style scoped>
.sync-popover {
  width: 260px;
}

.sync-header {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted);
  border-bottom: 1px solid var(--border);
}

.sync-body {
  padding: 8px 12px;
}

.sync-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 12px;
}

.sync-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.sync-dot.good { background: var(--fg-muted); }
.sync-dot.syncing { background: var(--fg-muted); animation: pulse 1.5s infinite; }
.sync-dot.warning { background: var(--warning); }
.sync-dot.error { background: var(--error); }
.sync-dot.idle { background: var(--accent); }
.sync-dot.none { background: var(--fg-muted); opacity: 0.4; }

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.sync-status-text {
  color: var(--fg-primary);
  font-weight: 500;
}

.sync-label {
  color: var(--fg-muted);
  min-width: 70px;
}

.sync-value {
  color: var(--fg-secondary);
}

.sync-link {
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sync-link:hover {
  text-decoration: underline;
}

.sync-guidance {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(247, 118, 142, 0.1);
  font-size: 11px;
  line-height: 1.4;
}

.sync-guidance-text {
  color: var(--fg-secondary);
}

.sync-guidance.auth .sync-guidance-text {
  color: var(--error);
}

.sync-guidance-actions {
  margin-top: 6px;
}

.sync-conflict {
  margin-top: 6px;
  padding: 6px 8px;
  border-radius: 4px;
  background: rgba(224, 175, 104, 0.1);
  color: var(--warning);
  font-size: 11px;
  line-height: 1.4;
}

.sync-conflict-hint {
  margin-top: 4px;
  font-size: 11px;
  color: var(--fg-muted);
}

.sync-conflict-actions {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

.sync-actions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
}

.sync-action-btn {
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: none;
  color: var(--fg-secondary);
  font-size: 11px;
  cursor: pointer;
}

.sync-action-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.sync-action-btn.primary {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(122, 162, 247, 0.1);
  width: 100%;
}

.sync-action-btn.primary:hover {
  background: rgba(122, 162, 247, 0.2);
}
</style>
