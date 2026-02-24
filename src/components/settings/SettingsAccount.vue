<template>
  <div>
    <h3 class="settings-section-title">Shoulders Account</h3>

    <!-- Logged in state -->
    <template v-if="workspace.shouldersAuth?.token">
      <!-- 1. Identity card -->
      <div class="acct-card">
        <div class="acct-identity">
          <span class="acct-email">{{ workspace.shouldersAuth.user?.email || 'Unknown' }}</span>
          <span class="acct-plan-label">{{ planLabel }}</span>
        </div>

        <!-- 2. Balance -->
        <div v-if="workspace.shouldersAuth.credits != null" class="acct-balance-row">
          <div class="acct-balance-group">
            <span class="acct-balance-amount" :class="{ 'low': creditsLow }">{{ formatBalance(workspace.shouldersAuth.credits) }}</span>
            <span class="acct-balance-label">balance</span>
          </div>
          <button class="acct-refresh-btn" @click="handleRefreshBalance" :disabled="refreshing">
            <IconRefresh :size="12" :stroke-width="1.5" :class="{ 'spin': refreshing }" />
            {{ refreshing ? 'Refreshing...' : 'Refresh' }}
          </button>
        </div>

        <!-- 3. Primary CTA -->
        <button v-if="planLabel === 'Free' && creditsLow" class="key-save-btn acct-cta" @click="openSubscribe">
          Subscribe to Continue
          <IconExternalLink :size="12" :stroke-width="1.5" />
        </button>
        <button v-else-if="planLabel === 'Free'" class="key-save-btn acct-cta" @click="openSubscribe">
          Upgrade Plan
          <IconExternalLink :size="12" :stroke-width="1.5" />
        </button>

        <!-- Add credits link (Pro/Enterprise) -->
        <div v-if="planLabel !== 'Free' && workspace.shouldersAuth.credits != null"
             class="acct-add-row">
          <button class="acct-text-link" @click="openAddCredits">
            Add credits
            <IconExternalLink :size="11" :stroke-width="1.5" />
          </button>
        </div>

      </div>

      <!-- 4. Footer actions -->
      <div class="acct-footer-actions">
        <button class="acct-text-link" @click="openAccount">
          Manage Account
          <IconExternalLink :size="11" :stroke-width="1.5" />
        </button>
        <span class="acct-footer-sep">·</span>
        <button class="acct-text-link danger" @click="handleLogout" :disabled="logoutLoading">
          {{ logoutLoading ? 'Signing out...' : 'Sign Out' }}
        </button>
      </div>
    </template>

    <!-- Logged out state -->
    <template v-else>
      <p class="settings-hint">Sign in to use AI models without your own API keys.</p>

      <div v-if="authError" class="auth-error">{{ authError }}</div>

      <div class="keys-actions">
        <button class="key-save-btn browser-login-btn" :disabled="authLoading" @click="handleBrowserLogin">
          {{ authLoading ? 'Waiting for browser...' : 'Sign in with Shoulders' }}
        </button>
      </div>

      <p v-if="authLoading" class="auth-hint">
        A browser window will open. Sign in there, then you'll be redirected back to the app.
      </p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { IconExternalLink, IconRefresh } from '@tabler/icons-vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { SHOULDERS_WEB_URL } from '../../services/shouldersAuth'

const workspace = useWorkspaceStore()

const authError = ref('')
const authLoading = ref(false)
const logoutLoading = ref(false)
const refreshing = ref(false)

const planLabel = computed(() => {
  const p = workspace.shouldersAuth?.plan
  if (p === 'pro') return 'Shoulders AI'
  if (p === 'enterprise') return 'Enterprise'
  return 'Free'
})

const creditsLow = computed(() => (workspace.shouldersAuth?.credits ?? 0) < 100)

function formatBalance(cents) {
  if (cents == null) return '$0.00'
  return '$' + (cents / 100).toFixed(2)
}

async function handleBrowserLogin() {
  authError.value = ''
  authLoading.value = true
  try {
    await workspace.shouldersLoginViaBrowser()
  } catch (e) {
    authError.value = e.message || 'Login failed'
  }
  authLoading.value = false
}

async function handleLogout() {
  logoutLoading.value = true
  await workspace.shouldersLogout()
  logoutLoading.value = false
}

async function handleRefreshBalance() {
  refreshing.value = true
  await workspace.refreshShouldersBalance()
  refreshing.value = false
}

async function openAccount() {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(`${SHOULDERS_WEB_URL}/account`)
  } catch {
    window.open(`${SHOULDERS_WEB_URL}/account`, '_blank')
  }
}

async function openAddCredits() {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(`${SHOULDERS_WEB_URL}/account#add-funds`)
  } catch {
    window.open(`${SHOULDERS_WEB_URL}/account#add-funds`, '_blank')
  }
}

async function openSubscribe() {
  try {
    const { open } = await import('@tauri-apps/plugin-shell')
    await open(`${SHOULDERS_WEB_URL}/subscribe`)
  } catch {
    window.open(`${SHOULDERS_WEB_URL}/subscribe`, '_blank')
  }
}
</script>

<style scoped>
/* Identity card — uses shared env-lang-card pattern */
.acct-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 14px 14px 12px;
  background: var(--bg-primary);
}

.acct-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.acct-email {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-primary);
}

.acct-plan-label {
  font-size: 11px;
  color: var(--fg-muted);
}

/* Balance */
.acct-balance-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}

.acct-balance-group {
  display: flex;
  align-items: baseline;
  gap: 6px;
  flex: 1;
}

.acct-balance-amount {
  font-size: 18px;
  font-weight: 600;
  color: var(--fg-primary);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.acct-balance-amount.low {
  color: var(--warning);
}

.acct-balance-label {
  font-size: 11px;
  color: var(--fg-muted);
}

.acct-refresh-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 2px 0;
  font-size: 11px;
  transition: color 0.15s;
}

.acct-refresh-btn:hover {
  color: var(--fg-primary);
}

.acct-refresh-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Primary CTA */
.acct-cta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 12px;
  width: 100%;
  justify-content: center;
}

.acct-add-row {
  margin-top: 6px;
  padding-left: 2px;
}

/* Footer actions — subtle text links */
.acct-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  padding-left: 2px;
}

.acct-footer-sep {
  color: var(--fg-muted);
  opacity: 0.4;
  font-size: 12px;
}

.acct-text-link {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 12px;
  color: var(--fg-muted);
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: color 0.15s;
}

.acct-text-link:hover {
  color: var(--fg-primary);
}

.acct-text-link.danger {
  color: var(--error);
  opacity: 0.7;
}

.acct-text-link.danger:hover {
  opacity: 1;
}

.acct-text-link:disabled {
  opacity: 0.4;
  cursor: default;
}

/* Logged-out state */
.browser-login-btn {
  width: 100%;
}

.auth-error {
  margin-top: 8px;
  margin-bottom: 12px;
  padding: 6px 10px;
  border-radius: 5px;
  background: rgba(247, 118, 142, 0.1);
  color: var(--error);
  font-size: 11px;
}

.auth-hint {
  margin-top: 10px;
  font-size: 11px;
  color: var(--fg-muted);
  line-height: 1.5;
}

/* Shared */
.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
