<template>
  <div>
    <h3 class="settings-section-title">Updates</h3>
    <p class="settings-hint">Keep Shoulders up to date for the latest features and security fixes.</p>

    <div class="env-lang-card">
      <div class="env-lang-header">
        <span class="env-lang-dot" :class="dotClass"></span>
        <span class="env-lang-name">Shoulders</span>
        <span class="env-lang-version">v{{ appVersion }}</span>
      </div>

      <!-- Status area -->
      <div class="update-status">
        <template v-if="state === 'checking'">
          <span class="update-hint">Checking for updates...</span>
        </template>

        <template v-else-if="state === 'available'">
          <div class="update-row">
            <span class="update-version-badge">v{{ updateVersion }} available</span>
            <button class="env-install-btn" @click="doDownload">Download</button>
          </div>
        </template>

        <template v-else-if="state === 'downloading'">
          <div class="update-progress-row">
            <div class="update-progress-bar">
              <div class="update-progress-fill" :style="{ width: downloadPct + '%' }"></div>
            </div>
            <span class="update-hint">{{ downloadPct }}%</span>
          </div>
        </template>

        <template v-else-if="state === 'ready'">
          <div class="update-row">
            <span class="env-kernel-badge env-kernel-yes">Ready to install</span>
            <button class="env-install-btn" @click="doRestart">Restart now</button>
          </div>
        </template>

        <template v-else-if="state === 'error'">
          <div class="update-error">{{ errorMsg }}</div>
        </template>

        <template v-else-if="state === 'uptodate'">
          <span class="update-hint">You're on the latest version.</span>
        </template>

        <template v-else>
          <span class="update-hint">Click below to check for updates.</span>
        </template>
      </div>
    </div>

    <div class="update-actions">
      <button class="env-redetect-btn" :disabled="state === 'checking'" @click="doCheck">
        {{ state === 'checking' ? 'Checking...' : 'Check for updates' }}
      </button>
    </div>

    <!-- Auto-check toggle -->
    <h3 class="settings-section-title" style="margin-top: 28px;">Preferences</h3>

    <div class="env-lang-card">
      <div class="env-lang-header">
        <span class="env-lang-name">Check for updates on launch</span>
        <div style="flex: 1;"></div>
        <button
          class="tool-toggle-switch"
          :class="{ on: autoCheck }"
          @click="toggleAutoCheck"
        >
          <span class="tool-toggle-knob"></span>
        </button>
      </div>
      <div class="env-lang-hint" style="margin-top: 4px; padding-left: 0;">
        When enabled, Shoulders silently checks for updates each time you open the app.
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import {
  checkForUpdate,
  downloadUpdate,
  installAndRestart,
  getAppVersion,
  isAutoCheckEnabled,
  setAutoCheckEnabled,
} from '../../services/appUpdater'

const appVersion = ref('...')
const autoCheck = ref(isAutoCheckEnabled())
const state = ref('idle') // idle | checking | available | downloading | ready | uptodate | error
const updateVersion = ref('')
const downloadPct = ref(0)
const errorMsg = ref('')
let _pendingUpdate = null

const dotClass = computed(() => {
  if (state.value === 'available') return 'warn'
  if (state.value === 'ready') return 'good'
  if (state.value === 'error') return 'none'
  return 'good'
})

function toggleAutoCheck() {
  autoCheck.value = !autoCheck.value
  setAutoCheckEnabled(autoCheck.value)
}

async function doCheck() {
  state.value = 'checking'
  errorMsg.value = ''
  const update = await checkForUpdate()
  if (update?.available) {
    _pendingUpdate = update
    updateVersion.value = update.version
    state.value = 'available'
  } else {
    state.value = 'uptodate'
  }
}

async function doDownload() {
  if (!_pendingUpdate) return
  state.value = 'downloading'
  downloadPct.value = 0
  const ok = await downloadUpdate(_pendingUpdate, (pct) => {
    downloadPct.value = pct
  })
  if (ok) {
    state.value = 'ready'
  } else {
    state.value = 'error'
    errorMsg.value = 'Download failed. Check your connection and try again.'
  }
}

async function doRestart() {
  await installAndRestart()
}

onMounted(async () => {
  appVersion.value = await getAppVersion()
})
</script>

<style scoped>
.update-status {
  margin-top: 10px;
  padding-left: 16px;
}

.update-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-version-badge {
  font-size: 11px;
  font-weight: 500;
  color: var(--accent);
}

.update-hint {
  font-size: 11px;
  color: var(--fg-muted);
}

.update-error {
  padding: 4px 8px;
  border-radius: 4px;
  background: rgba(247, 118, 142, 0.1);
  color: var(--error);
  font-size: 10px;
}

.update-progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.update-progress-bar {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--bg-primary);
  overflow: hidden;
}

.update-progress-fill {
  height: 100%;
  border-radius: 2px;
  background: var(--accent);
  transition: width 0.2s ease;
}

.update-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}
</style>
