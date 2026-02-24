<template>
  <Teleport to="body">
    <div v-if="visible" class="wizard-overlay">
      <div class="wizard-modal">
        <!-- Step 1: AI Setup -->
        <div v-if="step === 1" class="wizard-step">
          <!-- Brand header (centered) -->
          <div class="wizard-brand">
            <img src="/icon.png" alt="" class="wizard-icon" draggable="false" />
            <div class="wizard-wordmark">Shoulders</div>
          </div>

          <h2 class="wizard-step-title">Connect a provider to use AI features</h2>

          <div class="wizard-options">
            <button
              class="wizard-option"
              :class="{ selected: aiChoice === 'account', loading: authLoading }"
              :disabled="authLoading"
              @click="handleAccountAuth"
            >
              <div class="wizard-option-title">{{ authLoading ? 'Waiting for browser...' : 'Shoulders account' }}</div>
              <div class="wizard-option-desc">{{ authLoading ? 'Sign in or create an account to continue' : 'Free sign-up includes $5.00 balance' }}</div>
            </button>

            <button
              class="wizard-option"
              :class="{ selected: aiChoice === 'keys' }"
              @click="aiChoice = 'keys'"
            >
              <div class="wizard-option-title">I have API keys</div>
              <div class="wizard-option-desc">Anthropic, OpenAI, or Google</div>
            </button>

            <button
              class="wizard-option"
              :class="{ selected: aiChoice === 'skip' }"
              @click="aiChoice = 'skip'"
            >
              <div class="wizard-option-title">Set up later</div>
              <div class="wizard-option-desc">You can configure this any time in Settings</div>
            </button>
          </div>

          <!-- Expanded: API keys -->
          <div v-if="aiChoice === 'keys'" class="wizard-expand">
            <div class="wizard-key-field">
              <label>Anthropic</label>
              <input v-model="keyAnthropic" type="password" class="wizard-input" placeholder="sk-ant-..." spellcheck="false" />
            </div>
            <div class="wizard-key-field">
              <label>OpenAI</label>
              <input v-model="keyOpenAI" type="password" class="wizard-input" placeholder="sk-..." spellcheck="false" />
            </div>
            <div class="wizard-key-field">
              <label>Google</label>
              <input v-model="keyGoogle" type="password" class="wizard-input" placeholder="AIza..." spellcheck="false" />
            </div>
          </div>

          <div v-if="authError" class="wizard-error">{{ authError }}</div>
          <div v-if="authSuccess" class="wizard-success">{{ authSuccess }}</div>

          <div class="wizard-nav">
            <div class="wizard-dots">
              <button class="wizard-dot active" disabled></button>
              <button class="wizard-dot" @click="continueFromAI"></button>
            </div>
            <button class="wizard-btn primary" @click="continueFromAI" :disabled="authLoading">Continue</button>
          </div>
        </div>

        <!-- Step 2: Theme -->
        <div v-if="step === 2" class="wizard-step">
          <h2 class="wizard-step-title">Choose a theme</h2>
          <p class="wizard-step-hint">You can change this any time in Settings</p>

          <!-- Light themes -->
          <div class="wizard-theme-group-label">Light</div>
          <div class="wizard-theme-grid">
            <button
              v-for="theme in lightThemes"
              :key="theme.id"
              class="wizard-theme-card"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectTheme(theme.id)"
            >
              <div class="wizard-theme-preview" :style="{ background: theme.colors.bgPrimary }">
                <div class="wizard-theme-sidebar" :style="{ background: theme.colors.bgSecondary }"></div>
                <div class="wizard-theme-editor">
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '60%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accent, width: '45%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '70%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accentSecondary, width: '35%' }"></div>
                </div>
              </div>
              <div class="wizard-theme-label">{{ theme.label }}</div>
            </button>
          </div>

          <!-- Dark themes -->
          <div class="wizard-theme-group-label" style="margin-top: 12px;">Dark</div>
          <div class="wizard-theme-grid">
            <button
              v-for="theme in darkThemes"
              :key="theme.id"
              class="wizard-theme-card"
              :class="{ active: selectedTheme === theme.id }"
              @click="selectTheme(theme.id)"
            >
              <div class="wizard-theme-preview" :style="{ background: theme.colors.bgPrimary }">
                <div class="wizard-theme-sidebar" :style="{ background: theme.colors.bgSecondary }"></div>
                <div class="wizard-theme-editor">
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '60%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accent, width: '45%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.fgMuted, width: '70%' }"></div>
                  <div class="wizard-theme-line" :style="{ background: theme.colors.accentSecondary, width: '35%' }"></div>
                </div>
              </div>
              <div class="wizard-theme-label">{{ theme.label }}</div>
            </button>
          </div>

          <div v-if="authSuccess" class="wizard-success">{{ authSuccess }}</div>

          <div class="wizard-nav">
            <div class="wizard-dots">
              <button class="wizard-dot" @click="step = 1"></button>
              <button class="wizard-dot active" disabled></button>
            </div>
            <button class="wizard-btn primary" @click="finish">Start Writing</button>
          </div>
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

const step = ref(1)
const aiChoice = ref(null)

// API keys
const keyAnthropic = ref('')
const keyOpenAI = ref('')
const keyGoogle = ref('')

// Account auth
const authError = ref('')
const authSuccess = ref('')
const authLoading = ref(false)

// Theme
const selectedTheme = ref(workspace.theme || 'default')

const themes = [
  // Light
  { id: 'light', label: 'Light', group: 'light', colors: { bgPrimary: '#ffffff', bgSecondary: '#f5f6f8', fgMuted: '#999999', accent: '#5f9ea0', accentSecondary: '#4a7c7e' } },
  { id: 'solarized', label: 'Solarized', group: 'light', colors: { bgPrimary: '#fdf6e3', bgSecondary: '#eee8d5', fgMuted: '#93a1a1', accent: '#268bd2', accentSecondary: '#6c71c4' } },
  { id: 'one-light', label: 'One Light', group: 'light', colors: { bgPrimary: '#fafafa', bgSecondary: '#f0f0f1', fgMuted: '#a0a1a7', accent: '#4078f2', accentSecondary: '#a626a4' } },
  { id: 'humane', label: 'Humane', group: 'light', colors: { bgPrimary: '#faf9f5', bgSecondary: '#f2f0e7', fgMuted: '#9a9389', accent: '#b5623a', accentSecondary: '#6b8065' } },
  // Dark
  { id: 'default', label: 'Tokyo Night', group: 'dark', colors: { bgPrimary: '#1a1b26', bgSecondary: '#1f2335', fgMuted: '#565f89', accent: '#7aa2f7', accentSecondary: '#bb9af7' } },
  { id: 'dracula', label: 'Dracula', group: 'dark', colors: { bgPrimary: '#282a36', bgSecondary: '#21222c', fgMuted: '#6272a4', accent: '#bd93f9', accentSecondary: '#ff79c6' } },
  { id: 'monokai', label: 'Monokai', group: 'dark', colors: { bgPrimary: '#272822', bgSecondary: '#1e1f1c', fgMuted: '#75715e', accent: '#fd971f', accentSecondary: '#f92672' } },
  { id: 'nord', label: 'Nord', group: 'dark', colors: { bgPrimary: '#2e3440', bgSecondary: '#3b4252', fgMuted: '#616e88', accent: '#88c0d0', accentSecondary: '#81a1c1' } },
]

const lightThemes = computed(() => themes.filter(t => t.group === 'light'))
const darkThemes = computed(() => themes.filter(t => t.group === 'dark'))

async function handleAccountAuth() {
  aiChoice.value = 'account'
  authError.value = ''
  authSuccess.value = ''
  authLoading.value = true
  try {
    await workspace.shouldersLoginViaBrowser()
    authLoading.value = false
    authSuccess.value = 'Account connected'
    step.value = 2
    return
  } catch (e) {
    authError.value = e.message || 'Authentication failed'
  }
  authLoading.value = false
}

async function continueFromAI() {
  if (aiChoice.value === 'keys') {
    await saveKeys()
    if (authError.value) return
  }
  step.value = 2
}

async function saveKeys() {
  const keys = {}
  if (keyAnthropic.value) keys.ANTHROPIC_API_KEY = keyAnthropic.value
  if (keyOpenAI.value) keys.OPENAI_API_KEY = keyOpenAI.value
  if (keyGoogle.value) keys.GOOGLE_API_KEY = keyGoogle.value
  if (Object.keys(keys).length === 0) return

  try {
    const existing = await workspace.loadGlobalKeys()
    await workspace.saveGlobalKeys({ ...existing, ...keys })
    await workspace.loadSettings()
  } catch (e) {
    console.error('Failed to save keys:', e)
    authError.value = 'Failed to save API keys. You can add them later in Settings.'
  }
}

function selectTheme(id) {
  selectedTheme.value = id
  workspace.setTheme(id)
}

function finish() {
  localStorage.setItem('setupComplete', 'true')
  emit('close')
}
</script>

<style scoped>
.wizard-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
}

.wizard-modal {
  width: 520px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.wizard-step {
  padding: 28px 36px 32px;
}

/* Brand header (centered) */
.wizard-brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}

.wizard-icon {
  width: 96px;
  height: 96px;
  border-radius: 22px;
}

.wizard-wordmark {
  font-family: 'Crimson Text','Lora', 'Georgia', serif;
  font-size: 28px;
  font-weight: 500;
  color: var(--fg-primary);
  letter-spacing: -0.01em;
}

/* Step title + hint */
.wizard-step-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--fg-secondary);
  margin: 0 0 16px;
}

.wizard-step-hint {
  font-size: 12px;
  color: var(--fg-muted);
  margin: 0 0 16px;
}

/* AI options */
.wizard-options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wizard-option {
  text-align: left;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  cursor: pointer;
  transition: border-color 0.15s;
}

.wizard-option:hover {
  border-color: var(--fg-muted);
}

.wizard-option.selected {
  border-color: var(--accent);
}

.wizard-option.loading {
  opacity: 0.7;
  cursor: wait;
}

.wizard-option-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-primary);
}

.wizard-option-desc {
  font-size: 11px;
  color: var(--fg-secondary);
  margin-top: 1px;
}

/* Expanded sections */
.wizard-expand {
  margin-top: 14px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.wizard-key-field label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
  margin-bottom: 3px;
}

.wizard-input {
  width: 100%;
  padding: 6px 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color 0.15s;
  box-sizing: border-box;
}

.wizard-input:focus {
  border-color: var(--accent);
}

.wizard-auth-hint {
  font-size: 11px;
  color: var(--fg-muted);
  margin: 0;
}

/* Feedback */
.wizard-error {
  margin-top: 10px;
  padding: 6px 10px;
  border-radius: 5px;
  background: rgba(247, 118, 142, 0.1);
  color: var(--error);
  font-size: 11px;
}

.wizard-success {
  margin-top: 10px;
  padding: 6px 10px;
  border-radius: 5px;
  background: rgba(158, 206, 106, 0.1);
  color: var(--success);
  font-size: 11px;
}

/* Buttons */
.wizard-btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}

.wizard-btn.primary {
  background: var(--accent);
  color: var(--bg-primary);
  border-color: var(--accent);
}

.wizard-btn.primary:hover {
  opacity: 0.9;
}

.wizard-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wizard-btn.secondary {
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  border-color: var(--border);
}

.wizard-btn.secondary:hover {
  border-color: var(--fg-muted);
}

.wizard-btn.secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Navigation */
.wizard-nav {
  margin-top: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

/* Progress dots (clickable) */
.wizard-dots {
  display: flex;
  gap: 6px;
}

.wizard-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--border);
  border: none;
  padding: 0;
  cursor: pointer;
  transition: background 0.15s;
}

.wizard-dot:hover:not(.active) {
  background: var(--fg-muted);
}

.wizard-dot.active {
  background: var(--accent);
  cursor: default;
}

/* Theme grid */
.wizard-theme-group-label {
  font-size: 11px;
  font-weight: 500;
  color: var(--fg-muted);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.wizard-theme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.wizard-theme-card {
  background: var(--bg-primary);
  border: 2px solid var(--border);
  border-radius: 8px;
  padding: 6px;
  cursor: pointer;
  transition: border-color 0.15s;
  text-align: left;
}

.wizard-theme-card:hover {
  border-color: var(--fg-muted);
}

.wizard-theme-card.active {
  border-color: var(--accent);
}

.wizard-theme-preview {
  height: 48px;
  border-radius: 4px;
  display: flex;
  overflow: hidden;
  margin-bottom: 4px;
}

.wizard-theme-sidebar {
  width: 22%;
}

.wizard-theme-editor {
  flex: 1;
  padding: 5px 6px;
  display: flex;
  flex-direction: column;
  gap: 3px;
  justify-content: center;
}

.wizard-theme-line {
  height: 2.5px;
  border-radius: 1px;
  opacity: 0.7;
}

.wizard-theme-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--fg-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
