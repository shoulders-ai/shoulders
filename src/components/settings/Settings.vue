<template>
  <Teleport to="body">
    <div v-if="visible" class="settings-overlay" @click.self="$emit('close')">
      <div class="settings-modal">
        <!-- Left nav -->
        <div class="settings-nav">
          <div class="settings-nav-header">
            Settings
            <button class="settings-close" @click="$emit('close')">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l8 8M9 1L1 9"/></svg>
            </button>
          </div>
          <template v-for="(item, i) in sections" :key="item.id || `sep-${i}`">
            <div v-if="item.separator" class="settings-nav-separator"></div>
            <button
              v-else
              class="settings-nav-item"
              :class="{ active: activeSection === item.id }"
              @click="activeSection = item.id"
            >
              <component :is="item.icon" :size="16" :stroke-width="1.5" />
              {{ item.label }}
            </button>
          </template>
        </div>

        <!-- Main content -->
        <div class="settings-content">
          <SettingsTheme v-if="activeSection === 'theme'" />
          <SettingsEditor v-if="activeSection === 'editor'" />
          <SettingsModels v-if="activeSection === 'models'" />
          <SettingsTools v-if="activeSection === 'tools'" />
          <SettingsGitHub v-if="activeSection === 'github'" />
          <SettingsEnvironment v-if="activeSection === 'system'" />
          <SettingsAccount v-if="activeSection === 'account'" />
          <SettingsUsage v-if="activeSection === 'usage'" />
          <SettingsUpdates v-if="activeSection === 'updates'" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { IconPalette, IconEdit, IconKey, IconUser, IconTool, IconCpu, IconChartBar, IconBrandGithub, IconRefresh } from '@tabler/icons-vue'
import SettingsTheme from './SettingsTheme.vue'
import SettingsEditor from './SettingsEditor.vue'
import SettingsModels from './SettingsModels.vue'
import SettingsTools from './SettingsTools.vue'
import SettingsEnvironment from './SettingsEnvironment.vue'
import SettingsUsage from './SettingsUsage.vue'
import SettingsAccount from './SettingsAccount.vue'
import SettingsGitHub from './SettingsGitHub.vue'
import SettingsUpdates from './SettingsUpdates.vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  initialSection: { type: String, default: null },
})
defineEmits(['close'])

const activeSection = ref('theme')

watch(() => props.visible, (v) => {
  if (v && props.initialSection) {
    activeSection.value = props.initialSection
  }
})

const sections = [
  { id: 'theme', label: 'Theme', icon: IconPalette },
  { id: 'editor', label: 'Editor', icon: IconEdit },
  { separator: true },
  { id: 'models', label: 'Models', icon: IconKey },
  { id: 'tools', label: 'Tools', icon: IconTool },
  { id: 'github', label: 'GitHub', icon: IconBrandGithub },
  { id: 'system', label: 'System', icon: IconCpu },
  { separator: true },
  { id: 'account', label: 'Account', icon: IconUser },
  { id: 'usage', label: 'Usage', icon: IconChartBar },
  { id: 'updates', label: 'Updates', icon: IconRefresh },
]
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0, 0, 0, 0.6);
}

.settings-modal {
  width: 760px;
  max-width: 90vw;
  height: 640px;
  max-height: 90vh;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 10px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  overflow: hidden;
}

.settings-close {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  border: none;
  background: none;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 0;
}

.settings-close:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}

/* Left nav */
.settings-nav {
  width: 160px;
  border-right: 1px solid var(--border);
  padding: 12px 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-nav-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--fg-muted);
  padding: 2px 8px 8px;
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  font-size: 13px;
  color: var(--fg-secondary);
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  width: 100%;
}

.settings-nav-item:hover {
  background: var(--bg-hover);
}

.settings-nav-item.active {
  background: var(--bg-tertiary);
  color: var(--fg-primary);
}

.settings-nav-separator {
  height: 1px;
  background: var(--border);
  margin: 4px 8px;
}

/* Main content */
.settings-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}
</style>

<!-- Shared styles for all settings sections (scoped under .settings-modal to prevent leakage) -->
<style>
.settings-modal .settings-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--fg-primary);
  margin-bottom: 16px;
}

.settings-modal .settings-hint {
  font-size: 11px;
  color: var(--fg-muted);
  margin: -8px 0 16px;
}

.settings-modal .settings-hint code {
  background: var(--bg-tertiary);
  padding: 1px 4px;
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 10px;
}

/* Shared key/form styles */
.settings-modal .keys-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.settings-modal .key-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings-modal .key-label {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.settings-modal .key-provider {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-primary);
}

.settings-modal .key-env {
  font-size: 10px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

.settings-modal .key-input-row {
  display: flex;
  gap: 4px;
}

.settings-modal .key-input {
  flex: 1;
  padding: 6px 8px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 12px;
  font-family: var(--font-mono);
  outline: none;
  transition: border-color 0.15s;
}

.settings-modal .key-input:focus {
  border-color: var(--accent);
}

.settings-modal .key-input::placeholder {
  color: var(--fg-muted);
  opacity: 0.5;
}

.settings-modal .key-toggle {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-muted);
  cursor: pointer;
  flex-shrink: 0;
}

.settings-modal .key-toggle:hover {
  color: var(--fg-primary);
  border-color: var(--fg-muted);
}

.settings-modal .keys-actions {
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.settings-modal .key-save-btn {
  padding: 6px 16px;
  border-radius: 5px;
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.settings-modal .key-save-btn:hover {
  background: rgba(122, 162, 247, 0.2);
}

.settings-modal .key-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.settings-modal .key-save-btn.saved {
  border-color: var(--success);
  color: var(--success);
  background: rgba(158, 206, 106, 0.1);
}

.settings-modal .key-saved-hint {
  font-size: 11px;
  color: var(--fg-muted);
}

/* Shared toggle switch */
.settings-modal .tool-toggle-switch {
  width: 28px;
  height: 14px;
  border-radius: 7px;
  background: var(--bg-tertiary);
  border: none;
  cursor: pointer;
  position: relative;
  flex-shrink: 0;
  transition: background 0.15s;
  padding: 0;
}

.settings-modal .tool-toggle-switch.on {
  background: var(--accent);
}

.settings-modal .tool-toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: white;
  transition: transform 0.15s;
}

.settings-modal .tool-toggle-switch.on .tool-toggle-knob {
  transform: translateX(14px);
}

/* Shared card styles */
.settings-modal .env-lang-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  background: var(--bg-primary);
}

.settings-modal .env-lang-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-modal .env-lang-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.settings-modal .env-lang-dot.good { background: var(--success, #50fa7b); }
.settings-modal .env-lang-dot.warn { background: var(--warning, #e2b93d); }
.settings-modal .env-lang-dot.none { background: var(--fg-muted); opacity: 0.4; }

.settings-modal .env-lang-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--fg-primary);
}

.settings-modal .env-lang-version {
  font-size: 11px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

.settings-modal .env-lang-missing {
  font-size: 11px;
  color: var(--fg-muted);
  font-style: italic;
}

.settings-modal .env-lang-hint {
  margin-top: 4px;
  padding-left: 16px;
  font-size: 10px;
  color: var(--fg-muted);
}

.settings-modal .settings-link {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
}

.settings-modal .settings-link:hover {
  text-decoration: underline;
}
</style>
