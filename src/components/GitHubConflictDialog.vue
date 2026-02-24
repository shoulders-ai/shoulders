<template>
  <Teleport to="body">
    <div v-if="visible" class="conflict-overlay" @click.self="$emit('close')">
      <div class="conflict-modal">
        <div class="conflict-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color: var(--warning);">
            <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          </svg>
        </div>

        <h3 class="conflict-title">Your changes conflict with updates on GitHub</h3>

        <p class="conflict-body">
          Your version has been safely saved to
          <strong v-if="workspace.syncConflictBranch">{{ workspace.syncConflictBranch }}</strong><span v-else>a separate branch</span> — nothing is lost.
          Open GitHub to compare and merge, then click Refresh.
        </p>

        <details class="conflict-details">
          <summary>What happened?</summary>
          <p>Someone else (or you, on another device) pushed changes while you were editing.
          Git can't automatically combine both versions, so we pushed your work to a safe branch.
          You can compare both versions on GitHub and choose what to keep.</p>
        </details>

        <div class="conflict-actions">
          <button class="conflict-btn primary-large" @click="openGitHub">
            Open GitHub
          </button>
          <button class="conflict-btn" @click="handleRefresh" :disabled="refreshing">
            {{ refreshing ? 'Checking...' : 'Refresh' }}
          </button>
          <button class="conflict-btn dismiss" @click="$emit('close')">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useWorkspaceStore } from '../stores/workspace'

const props = defineProps({
  visible: { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const workspace = useWorkspaceStore()
const refreshing = ref(false)

const repoHtmlUrl = computed(() => {
  const url = workspace.remoteUrl
  const match = url.match(/github\.com[/:]([^/]+\/[^/.]+)/)
  const name = match ? match[1] : ''
  return name ? `https://github.com/${name}` : ''
})

async function openGitHub() {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(repoHtmlUrl.value)
  } catch {}
}

async function handleRefresh() {
  refreshing.value = true
  const result = await workspace.fetchRemoteChanges()
  refreshing.value = false

  // If conflict is resolved (we pulled successfully), close dialog
  if (result?.pulled || workspace.syncStatus !== 'conflict') {
    emit('close')
  }
}
</script>

<style scoped>
.conflict-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
}

.conflict-modal {
  width: 440px;
  max-width: 90vw;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  padding: 24px;
  text-align: center;
}

.conflict-icon {
  margin-bottom: 12px;
}

.conflict-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--fg-primary);
  margin-bottom: 12px;
}

.conflict-body {
  font-size: 13px;
  color: var(--fg-secondary);
  line-height: 1.5;
  margin-bottom: 10px;
  text-align: left;
}

.conflict-body strong {
  color: var(--accent);
  font-family: var(--font-mono);
  font-size: 12px;
}

.conflict-details {
  margin-bottom: 10px;
  text-align: left;
}

.conflict-details summary {
  font-size: 12px;
  color: var(--fg-muted);
  cursor: pointer;
  user-select: none;
}

.conflict-details summary:hover {
  color: var(--fg-secondary);
}

.conflict-details p {
  font-size: 12px;
  color: var(--fg-muted);
  line-height: 1.5;
  margin-top: 6px;
}

.conflict-actions {
  display: flex;
  gap: 8px;
  margin-top: 20px;
  justify-content: center;
}

.conflict-btn {
  padding: 7px 16px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: none;
  color: var(--fg-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.conflict-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.conflict-btn.primary-large {
  border-color: var(--accent);
  color: #fff;
  background: var(--accent);
  padding: 9px 24px;
  font-size: 14px;
  font-weight: 500;
}

.conflict-btn.primary-large:hover {
  filter: brightness(1.1);
}

.conflict-btn.dismiss {
  color: var(--fg-muted);
}

.conflict-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
