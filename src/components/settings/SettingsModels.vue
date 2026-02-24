<template>
  <div>
    <h3 class="settings-section-title">API Keys</h3>
    <p class="settings-hint">You only need a key for the provider you want to use. Keys are shared across all workspaces.</p>

    <div class="keys-list">
      <div v-for="k in keyFields" :key="k.env" class="key-field">
        <label class="key-label">
          <span class="key-provider">{{ k.label }}</span>
          <span class="key-env">{{ k.env }}</span>
        </label>
        <div class="key-input-row">
          <input
            :type="k.visible ? 'text' : 'password'"
            :value="editKeys[k.env]"
            @input="editKeys[k.env] = $event.target.value"
            class="key-input"
            :placeholder="k.placeholder"
            spellcheck="false"
            autocomplete="off"
          />
          <button class="key-toggle" @click="k.visible = !k.visible" :title="k.visible ? 'Hide' : 'Show'">
            <svg v-if="!k.visible" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <div class="keys-actions">
      <button class="key-save-btn" :class="{ saved: keySaved }" @click="saveKeys">
        {{ keySaved ? 'Saved' : 'Save Keys' }}
      </button>
      <span v-if="keySaved" class="key-saved-hint">Restart chat to use new keys</span>
    </div>

    <!-- Monthly Budget (conditional on having direct keys) -->
    <template v-if="hasDirectKeys && (usageStore.showCostEstimates || usageStore.monthlyLimit > 0)">
      <h3 class="settings-section-title" style="margin-top: 24px;">Monthly Budget</h3>
      <p class="settings-hint">Soft limit on estimated API key spending. Does not affect your Shoulders balance.</p>
      <div class="usage-limit-row">
        <span class="usage-limit-dollar">$</span>
        <input
          type="number"
          step="1"
          min="0"
          v-model="editMonthlyLimit"
          class="key-input usage-limit-input"
          placeholder="0 (no limit)"
          @keydown.enter="saveMonthlyLimit"
        />
        <button class="key-save-btn" :class="{ saved: limitSaved }" @click="saveMonthlyLimit">
          {{ limitSaved ? 'Saved' : 'Set Limit' }}
        </button>
      </div>

      <!-- Budget progress bar -->
      <div v-if="showBudgetBar" class="budget-progress" style="margin-top: 10px;">
        <div class="budget-progress-track">
          <div class="budget-progress-fill" :style="{ width: budgetPercent + '%', background: budgetBarColor }"></div>
        </div>
        <div class="budget-progress-label">
          <span :style="{ color: budgetBarColor }">~{{ formatCost(usageStore.directCost) }} / ${{ usageStore.monthlyLimit.toFixed(0) }}</span>
          <span v-if="usageStore.isOverBudget" style="color: var(--error);"> — budget reached</span>
        </div>
      </div>
    </template>

    <!-- Advanced: Custom API URLs -->
    <div class="advanced-toggle" @click="showAdvanced = !showAdvanced">
      <svg :class="{ rotated: showAdvanced }" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
        <path d="M3 1l4 4-4 4z"/>
      </svg>
      Advanced
    </div>

    <div v-if="showAdvanced" class="advanced-section">
      <p class="settings-hint">Custom API endpoints for enterprise/private deployments</p>
      <div class="keys-list">
        <div v-for="p in urlFields" :key="p.provider" class="key-field">
          <label class="key-label">
            <span class="key-provider">{{ p.label }} URL</span>
          </label>
          <input
            type="text"
            v-model="editUrls[p.provider]"
            class="key-input"
            :placeholder="p.placeholder"
            spellcheck="false"
          />
        </div>
      </div>
      <div class="keys-actions">
        <button class="key-save-btn" :class="{ saved: urlSaved }" @click="saveUrls">
          {{ urlSaved ? 'Saved' : 'Save URLs' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../../stores/workspace'
import { useUsageStore } from '../../stores/usage'
import { formatCost } from '../../services/tokenUsage'

const workspace = useWorkspaceStore()
const usageStore = useUsageStore()
const keySaved = ref(false)
const showAdvanced = ref(false)
const urlSaved = ref(false)
const editMonthlyLimit = ref('')
const limitSaved = ref(false)

const hasDirectKeys = computed(() => {
  const keys = workspace.apiKeys || {}
  return !!(keys.ANTHROPIC_API_KEY || keys.OPENAI_API_KEY || keys.GOOGLE_API_KEY)
})

const showBudgetBar = computed(() => {
  return usageStore.monthlyLimit > 0 && usageStore.directCost > 0
})

const budgetPercent = computed(() => {
  if (usageStore.monthlyLimit <= 0) return 0
  return Math.min(100, (usageStore.directCost / usageStore.monthlyLimit) * 100)
})

const budgetBarColor = computed(() => {
  const pct = budgetPercent.value
  if (pct >= 100) return 'var(--error)'
  if (pct >= 80) return 'var(--warning, #e0af68)'
  return 'var(--accent)'
})

async function saveMonthlyLimit() {
  const val = parseFloat(editMonthlyLimit.value) || 0
  await usageStore.setMonthlyLimit(val)
  limitSaved.value = true
  setTimeout(() => limitSaved.value = false, 2000)
}

onMounted(() => {
  editMonthlyLimit.value = usageStore.monthlyLimit > 0 ? String(usageStore.monthlyLimit) : ''
})

const editKeys = reactive({
  ANTHROPIC_API_KEY: workspace.apiKeys?.ANTHROPIC_API_KEY || '',
  OPENAI_API_KEY: workspace.apiKeys?.OPENAI_API_KEY || '',
  GOOGLE_API_KEY: workspace.apiKeys?.GOOGLE_API_KEY || '',
})

const keyFields = reactive([
  { env: 'ANTHROPIC_API_KEY', label: 'Anthropic', placeholder: 'sk-ant-...', visible: false },
  { env: 'OPENAI_API_KEY', label: 'OpenAI', placeholder: 'sk-...', visible: false },
  { env: 'GOOGLE_API_KEY', label: 'Google', placeholder: 'AIza...', visible: false },
])

const editUrls = reactive({
  anthropic: workspace.modelsConfig?.providers?.anthropic?.customUrl || '',
  openai: workspace.modelsConfig?.providers?.openai?.customUrl || '',
  google: workspace.modelsConfig?.providers?.google?.customUrl || '',
})

const urlFields = [
  { provider: 'anthropic', label: 'Anthropic', placeholder: 'https://api.anthropic.com/v1/messages' },
  { provider: 'openai', label: 'OpenAI', placeholder: 'https://api.openai.com/v1/responses' },
  { provider: 'google', label: 'Google', placeholder: 'https://generativelanguage.googleapis.com/v1beta/models' },
]

async function saveKeys() {
  try {
    // Merge with existing global keys (preserve keys not shown in this UI, e.g. EXA_API_KEY)
    const existing = await workspace.loadGlobalKeys()
    const merged = { ...existing }
    for (const [k, v] of Object.entries(editKeys)) {
      if (v) merged[k] = v
      else delete merged[k]
    }
    await workspace.saveGlobalKeys(merged)
    await workspace.loadSettings()
    keySaved.value = true
    setTimeout(() => keySaved.value = false, 3000)
  } catch (e) {
    console.error('Failed to save keys:', e)
  }
}

async function saveUrls() {
  const configDir = workspace.globalConfigDir || workspace.shouldersDir
  if (!configDir) return

  try {
    const modelsPath = `${configDir}/models.json`
    const raw = await invoke('read_file', { path: modelsPath })
    const config = JSON.parse(raw)

    for (const p of urlFields) {
      if (config.providers?.[p.provider]) {
        const url = editUrls[p.provider]?.trim()
        if (url) {
          config.providers[p.provider].customUrl = url
          config.providers[p.provider].url = url
        } else {
          delete config.providers[p.provider].customUrl
          const defaults = {
            anthropic: 'https://api.anthropic.com/v1/messages',
            openai: 'https://api.openai.com/v1/responses',
            google: 'https://generativelanguage.googleapis.com/v1beta/models',
          }
          config.providers[p.provider].url = defaults[p.provider]
        }
      }
    }

    await invoke('write_file', { path: modelsPath, content: JSON.stringify(config, null, 2) })
    await workspace.loadSettings()
    urlSaved.value = true
    setTimeout(() => urlSaved.value = false, 3000)
  } catch (e) {
    console.error('Failed to save URLs:', e)
  }
}
</script>

<style scoped>
/* Monthly limit */
.usage-limit-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.usage-limit-dollar {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-muted);
}

.usage-limit-input {
  width: 120px;
  flex: none;
}

/* Budget progress bar */
.budget-progress-track {
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  overflow: hidden;
}

.budget-progress-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s ease, background 0.3s ease;
}

.budget-progress-label {
  margin-top: 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.advanced-toggle {
  margin-top: 20px;
  padding: 6px 0;
  font-size: 12px;
  color: var(--fg-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  user-select: none;
}

.advanced-toggle:hover {
  color: var(--fg-secondary);
}

.advanced-toggle svg {
  transition: transform 0.15s;
}

.advanced-toggle svg.rotated {
  transform: rotate(90deg);
}

.advanced-section {
  margin-top: 12px;
}

.advanced-section .settings-hint {
  margin: 0 0 12px;
}
</style>
