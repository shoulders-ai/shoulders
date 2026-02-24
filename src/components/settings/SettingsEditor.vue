<template>
  <div>
    <h3 class="settings-section-title">Editor</h3>
    <p class="settings-hint">Behavior and display preferences for the text editor.</p>

    <div class="editor-toggles">
      <!-- Soft Wrap -->
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.softWrap ? 'good' : 'none'"></span>
          <span class="env-lang-name">Soft Wrap</span>
          <span v-if="workspace.softWrap" class="env-lang-version">Enabled</span>
          <span v-else class="env-lang-missing">Disabled</span>
          <div style="flex: 1;"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: workspace.softWrap }"
            @click="workspace.toggleSoftWrap()"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
        <div class="env-lang-hint" style="margin-top: 4px; padding-left: 16px;">
          Wrap long lines to fit the editor width. Also available via the footer toggle.
        </div>
        <div v-if="workspace.softWrap" class="wrap-column-row" style="margin-top: 8px; padding-left: 16px;">
          <label class="ghost-model-label">Line width:</label>
          <div class="wrap-preset-group">
            <button
              v-for="p in WRAP_PRESETS"
              :key="p.value"
              class="wrap-preset-btn"
              :class="{ active: workspace.wrapColumn === p.value }"
              @click="workspace.setWrapColumn(p.value)"
            >{{ p.label }}</button>
          </div>
        </div>
      </div>

      <!-- Spell Check -->
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.spellcheck ? 'good' : 'none'"></span>
          <span class="env-lang-name">Spell Check</span>
          <span v-if="workspace.spellcheck" class="env-lang-version">Enabled</span>
          <span v-else class="env-lang-missing">Disabled</span>
          <div style="flex: 1;"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: workspace.spellcheck }"
            @click="workspace.toggleSpellcheck()"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
        <div class="env-lang-hint" style="margin-top: 4px; padding-left: 16px;">
          Underlines misspelled words. Right-click and choose "Spelling..." for corrections. Markdown files only.
        </div>
      </div>

      <!-- Hide Markup -->
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.livePreviewEnabled ? 'good' : 'none'"></span>
          <span class="env-lang-name">Hide Markup</span>
          <span v-if="workspace.livePreviewEnabled" class="env-lang-version">Enabled</span>
          <span v-else class="env-lang-missing">Disabled</span>
          <div style="flex: 1;"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: workspace.livePreviewEnabled }"
            @click="workspace.toggleLivePreview()"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
        <div class="env-lang-hint" style="margin-top: 4px; padding-left: 16px;">
          Links show as underlined text, bold/italic render inline, heading marks dim. Markdown files only.
        </div>
      </div>

      <!-- Ghost Suggestions -->
      <div class="env-lang-card">
        <div class="env-lang-header">
          <span class="env-lang-dot" :class="workspace.ghostEnabled ? 'good' : 'none'"></span>
          <span class="env-lang-name">Ghost Suggestions</span>
          <span v-if="workspace.ghostEnabled" class="env-lang-version">Enabled</span>
          <span v-else class="env-lang-missing">Disabled</span>
          <div style="flex: 1;"></div>
          <button
            class="tool-toggle-switch"
            :class="{ on: workspace.ghostEnabled }"
            @click="workspace.setGhostEnabled(!workspace.ghostEnabled)"
          >
            <span class="tool-toggle-knob"></span>
          </button>
        </div>
        <div class="env-lang-hint" style="margin-top: 4px; padding-left: 16px;">
          Type <code>++</code> in any editor to get AI completions.
          Uses {{ ghostModelLabel }}.
        </div>
        <div v-if="workspace.ghostEnabled && availableGhostModels.length > 1" class="ghost-model-picker" style="margin-top: 8px; padding-left: 16px;">
          <label class="ghost-model-label">Ghost model:</label>
          <div class="ghost-dropdown-wrap">
            <button
              ref="ghostBtnRef"
              class="ghost-dropdown-btn"
              @click.stop="ghostDropdownOpen = !ghostDropdownOpen"
            >
              {{ ghostModelLabel }}
              <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><path d="M1 3l4 4 4-4z"/></svg>
            </button>
            <Teleport to="body">
              <template v-if="ghostDropdownOpen">
                <div class="fixed inset-0 z-[10001]" @click="ghostDropdownOpen = false"></div>
                <div class="ghost-dropdown-menu" :style="ghostDropdownPos">
                  <div
                    v-for="m in availableGhostModels"
                    :key="m.model"
                    class="ghost-dropdown-item"
                    @click="selectGhostModel(m.model)"
                  >
                    <span v-if="isSelectedGhost(m.model)" class="ghost-dropdown-check">&#x2713;</span>
                    <span v-else class="ghost-dropdown-check"></span>
                    {{ m.label }}
                  </div>
                </div>
              </template>
            </Teleport>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { GHOST_MODELS, getBillingRoute } from '../../services/apiClient'

const workspace = useWorkspaceStore()

const WRAP_PRESETS = [
  { label: 'Narrow', value: 60 },
  { label: 'Medium', value: 80 },
  { label: 'Wide', value: 100 },
  { label: 'Full width', value: 0 },
]

const GHOST_MODEL_LABELS = {
  'claude-haiku-4-5-20251001': 'Haiku 4.5',
  'gemini-2.5-flash-lite': 'Flash Lite',
  'gpt-5-nano-2025-08-07': 'GPT-5 Nano',
}

// Ghost models the user has access to
const availableGhostModels = computed(() => {
  return GHOST_MODELS.filter(m => {
    const keys = workspace.apiKeys || {}
    const hasKey = keys[m.keyEnv] && !keys[m.keyEnv].includes('your-')
    return hasKey || !!workspace.shouldersAuth?.token
  }).map(m => ({
    ...m,
    label: GHOST_MODEL_LABELS[m.model] || m.model,
  }))
})

const ghostModelLabel = computed(() => {
  const selectedId = workspace.ghostModelId
  if (selectedId && GHOST_MODEL_LABELS[selectedId]) return GHOST_MODEL_LABELS[selectedId]
  return availableGhostModels.value[0]?.label || 'Haiku 4.5'
})

// Ghost model dropdown
const ghostBtnRef = ref(null)
const ghostDropdownOpen = ref(false)

const ghostDropdownPos = computed(() => {
  if (!ghostBtnRef.value) return {}
  const rect = ghostBtnRef.value.getBoundingClientRect()
  return {
    top: rect.bottom + 4 + 'px',
    left: rect.left + 'px',
  }
})

const selectedGhostId = computed(() => workspace.ghostModelId || availableGhostModels.value[0]?.model)

function isSelectedGhost(model) {
  return model === selectedGhostId.value
}

function selectGhostModel(model) {
  workspace.setGhostModelId(model)
  ghostDropdownOpen.value = false
}

</script>

<style scoped>
.editor-toggles {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ghost-model-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ghost-model-label {
  font-size: 11px;
  color: var(--fg-muted);
}

.ghost-dropdown-wrap {
  position: relative;
}

.ghost-dropdown-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 11px;
  font-family: inherit;
  cursor: pointer;
  transition: border-color 150ms;
}

.ghost-dropdown-btn:hover {
  border-color: var(--fg-muted);
}

.ghost-dropdown-menu {
  position: fixed;
  z-index: 10002;
  min-width: 140px;
  padding: 4px 0;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.ghost-dropdown-item {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  font-size: 12px;
  color: var(--fg-secondary);
  cursor: pointer;
}

.ghost-dropdown-item:hover {
  background: var(--bg-hover);
}

.ghost-dropdown-check {
  width: 16px;
  display: inline-block;
  color: var(--accent);
  font-size: 11px;
}

.wrap-column-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wrap-preset-group {
  display: flex;
  gap: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 1px solid var(--border);
}

.wrap-preset-btn {
  padding: 2px 10px;
  font-size: 11px;
  font-family: inherit;
  color: var(--fg-secondary);
  background: var(--bg-primary);
  border: none;
  border-right: 1px solid var(--border);
  cursor: pointer;
  transition: background 150ms, color 150ms;
}

.wrap-preset-btn:last-child {
  border-right: none;
}

.wrap-preset-btn:hover {
  background: var(--bg-hover);
}

.wrap-preset-btn.active {
  background: var(--accent);
  color: #fff;
}
</style>
