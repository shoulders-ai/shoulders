<template>
  <div>
    <h3 class="settings-section-title">AI Tools</h3>
    <p class="settings-hint" style="margin-bottom: 12px;">
      Control which tools the AI can use in chat. Disabled tools are hidden from the AI entirely.
    </p>

    <!-- Disable all external button -->
    <button
      class="external-toggle-btn"
      :class="{ 'all-disabled': allExternalDisabled }"
      @click="disableAllExternal"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      {{ allExternalDisabled ? 'All external tools disabled' : 'Disable all external tools' }}
    </button>

    <!-- Tool categories -->
    <div class="tool-categories">
      <div v-for="cat in toolCategories" :key="cat.id" class="tool-category">
        <!-- Category header -->
        <div class="tool-category-header" @click="toggleCategoryExpand(cat.id)">
          <div class="tool-category-left">
            <svg :class="{ rotated: expandedCategories[cat.id] }" width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
              <path d="M3 1l4 4-4 4z"/>
            </svg>
            <span class="tool-category-name">{{ cat.label }}</span>
            <span class="tool-category-count">{{ categoryEnabledCount(cat) }}/{{ categoryToolCount(cat) }}</span>
          </div>
          <div class="tool-category-right">
            <span v-if="categoryAllLocal(cat)" class="tool-privacy-summary local">All local</span>
            <span v-else-if="categoryHasExternal(cat)" class="tool-privacy-summary external">External</span>
          </div>
        </div>

        <!-- Category body -->
        <div v-if="expandedCategories[cat.id]" class="tool-category-body">
          <!-- Flat tools (no subgroups) -->
          <template v-if="cat.tools">
            <div v-for="tool in cat.tools" :key="tool.name" class="tool-row">
              <button
                class="tool-toggle-switch"
                :class="{ on: !isToolDisabled(tool.name) }"
                @click.stop="toggleTool(tool.name)"
              >
                <span class="tool-toggle-knob"></span>
              </button>
              <span class="tool-name">{{ tool.name }}</span>
              <span class="tool-desc">{{ tool.description }}</span>
              <span v-if="tool.external" class="privacy-badge">{{ tool.external }}</span>
            </div>
          </template>

          <!-- Subgroups -->
          <template v-if="cat.subgroups">
            <div v-for="sg in cat.subgroups" :key="sg.label" class="tool-subgroup">
              <div class="tool-subgroup-label">{{ sg.label }}</div>
              <div v-for="tool in sg.tools" :key="tool.name" class="tool-row">
                <button
                  class="tool-toggle-switch"
                  :class="{ on: !isToolDisabled(tool.name) }"
                  @click.stop="toggleTool(tool.name)"
                >
                  <span class="tool-toggle-knob"></span>
                </button>
                <span class="tool-name">{{ tool.name }}</span>
                <span class="tool-desc">{{ tool.description }}</span>
                <span v-if="tool.external" class="privacy-badge">{{ tool.external }}</span>
                <span v-if="tool.name === 'run_command'" class="privacy-badge shell-warning">unsandboxed</span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Search API Keys -->
    <div class="tools-key-section">
      <h3 class="settings-section-title" style="margin-top: 20px;">Search API Keys</h3>
      <template v-if="workspace.shouldersAuth?.token">
        <div class="tool-status tool-status-active">
          <span class="tool-status-dot active"></span>
          Academic &amp; web search enabled via Shoulders account
        </div>
      </template>
      <template v-else>
        <div class="keys-list">
          <div class="key-field">
            <label class="key-label">
              <span class="key-provider">OpenAlex API Key</span>
              <span class="key-env">OPENALEX_API_KEY</span>
            </label>
            <div class="key-input-row">
              <input
                :type="openalexKeyVisible ? 'text' : 'password'"
                :value="editOpenAlexKey"
                @input="editOpenAlexKey = $event.target.value"
                class="key-input"
                placeholder="openalex-..."
                spellcheck="false"
                autocomplete="off"
              />
              <button class="key-toggle" @click="openalexKeyVisible = !openalexKeyVisible" :title="openalexKeyVisible ? 'Hide' : 'Show'">
                <svg v-if="!openalexKeyVisible" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="key-field" style="margin-top: 10px;">
            <label class="key-label">
              <span class="key-provider">Exa API Key</span>
              <span class="key-env">EXA_API_KEY</span>
            </label>
            <div class="key-input-row">
              <input
                :type="exaKeyVisible ? 'text' : 'password'"
                :value="editSearchKey"
                @input="editSearchKey = $event.target.value"
                class="key-input"
                placeholder="exa-..."
                spellcheck="false"
                autocomplete="off"
              />
              <button class="key-toggle" @click="exaKeyVisible = !exaKeyVisible" :title="exaKeyVisible ? 'Hide' : 'Show'">
                <svg v-if="!exaKeyVisible" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
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
        <p class="settings-hint" style="margin-top: 8px;">
          Academic search uses <span class="settings-link" @click="openExternal('https://openalex.org/settings/api')">OpenAlex</span> (free key: ~1000 searches/day).
          Web search uses <span class="settings-link" @click="openExternal('https://dashboard.exa.ai')">Exa</span>.
          Or sign in to your Shoulders account for included access to both.
        </p>
        <div class="keys-actions">
          <button class="key-save-btn" :class="{ saved: toolKeySaved }" @click="saveToolKeys">
            {{ toolKeySaved ? 'Saved' : 'Save Keys' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../../stores/workspace'
import { TOOL_CATEGORIES, EXTERNAL_TOOLS } from '../../services/chatTools'

const workspace = useWorkspaceStore()

const toolKeySaved = ref(false)
const exaKeyVisible = ref(false)
const openalexKeyVisible = ref(false)
const editSearchKey = ref(workspace.apiKeys?.EXA_API_KEY || '')
const editOpenAlexKey = ref(workspace.apiKeys?.OPENALEX_API_KEY || '')

const toolCategories = TOOL_CATEGORIES

const expandedCategories = reactive(
  Object.fromEntries(TOOL_CATEGORIES.map(cat => {
    const stored = localStorage.getItem(`tools-expanded-${cat.id}`)
    return [cat.id, stored !== null ? stored === 'true' : !cat.defaultCollapsed]
  }))
)

function toggleCategoryExpand(catId) {
  expandedCategories[catId] = !expandedCategories[catId]
  localStorage.setItem(`tools-expanded-${catId}`, String(expandedCategories[catId]))
}

function isToolDisabled(name) {
  return workspace.disabledTools?.includes(name)
}

function toggleTool(name) {
  workspace.toggleTool(name)
}

function _getCategoryTools(cat) {
  if (cat.tools) return cat.tools
  if (cat.subgroups) return cat.subgroups.flatMap(sg => sg.tools)
  return []
}

function categoryToolCount(cat) {
  return _getCategoryTools(cat).length
}

function categoryEnabledCount(cat) {
  const tools = _getCategoryTools(cat)
  return tools.filter(t => !isToolDisabled(t.name)).length
}

function categoryAllLocal(cat) {
  return _getCategoryTools(cat).every(t => !t.external)
}

function categoryHasExternal(cat) {
  return _getCategoryTools(cat).some(t => t.external)
}

const allExternalDisabled = computed(() => {
  return EXTERNAL_TOOLS.every(name => workspace.disabledTools?.includes(name))
})

function disableAllExternal() {
  if (allExternalDisabled.value) {
    for (const name of EXTERNAL_TOOLS) {
      const idx = workspace.disabledTools.indexOf(name)
      if (idx >= 0) workspace.disabledTools.splice(idx, 1)
    }
  } else {
    for (const name of EXTERNAL_TOOLS) {
      if (!workspace.disabledTools.includes(name)) {
        workspace.disabledTools.push(name)
      }
    }
  }
  workspace.saveToolPermissions()
}

async function openExternal(url) {
  const { open } = await import('@tauri-apps/plugin-shell')
  open(url).catch(() => {})
}

async function saveToolKeys() {
  try {
    const existing = await workspace.loadGlobalKeys()
    const merged = { ...existing }
    if (editOpenAlexKey.value) merged.OPENALEX_API_KEY = editOpenAlexKey.value
    else delete merged.OPENALEX_API_KEY
    if (editSearchKey.value) merged.EXA_API_KEY = editSearchKey.value
    else delete merged.EXA_API_KEY
    await workspace.saveGlobalKeys(merged)
    await workspace.loadSettings()
    toolKeySaved.value = true
    setTimeout(() => toolKeySaved.value = false, 3000)
  } catch (e) {
    console.error('Failed to save tool keys:', e)
  }
}
</script>

<style scoped>
/* External toggle button */
.external-toggle-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 5px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-secondary);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  margin-bottom: 14px;
}

.external-toggle-btn:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}

.external-toggle-btn.all-disabled {
  border-color: var(--success);
  color: var(--success);
  background: rgba(158, 206, 106, 0.08);
}

/* Tool categories */
.tool-categories {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tool-category {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}

.tool-category-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  cursor: pointer;
  user-select: none;
  background: var(--bg-primary);
  transition: background 0.1s;
}

.tool-category-header:hover {
  background: var(--bg-hover);
}

.tool-category-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.tool-category-left svg {
  transition: transform 0.15s;
  color: var(--fg-muted);
  flex-shrink: 0;
}

.tool-category-left svg.rotated {
  transform: rotate(90deg);
}

.tool-category-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--fg-primary);
}

.tool-category-count {
  font-size: 10px;
  color: var(--fg-muted);
  font-family: var(--font-mono);
}

.tool-category-right {
  display: flex;
  align-items: center;
}

.tool-privacy-summary {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  font-weight: 500;
}

.tool-privacy-summary.local {
  color: var(--fg-muted);
  background: var(--bg-tertiary);
}

.tool-privacy-summary.external {
  color: var(--warning, #e0af68);
  background: rgba(224, 175, 104, 0.1);
}

.tool-category-body {
  border-top: 1px solid var(--border);
  padding: 4px 0;
}

/* Tool subgroups */
.tool-subgroup {
  padding: 0;
}

.tool-subgroup-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--fg-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  padding: 6px 10px 2px 36px;
}

/* Tool row */
.tool-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 10px;
  transition: background 0.1s;
}

.tool-row:hover {
  background: var(--bg-hover);
}

.tool-name {
  font-size: 11px;
  font-family: var(--font-mono);
  color: var(--fg-primary);
  white-space: nowrap;
  min-width: 100px;
}

.tool-desc {
  font-size: 11px;
  color: var(--fg-muted);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.privacy-badge {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 8px;
  color: var(--warning, #e0af68);
  background: rgba(224, 175, 104, 0.1);
  white-space: nowrap;
  flex-shrink: 0;
  font-weight: 500;
}

.shell-warning {
  color: var(--error, #f7768e);
  background: rgba(247, 118, 142, 0.1);
}

.tools-key-section {
  border-top: 1px solid var(--border);
  margin-top: 16px;
  padding-top: 4px;
}

/* Tool status */
.tool-status {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  padding: 6px 10px;
  border-radius: 5px;
}

.tool-status-active {
  background: rgba(158, 206, 106, 0.08);
  color: var(--success);
}

.tool-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--fg-muted);
  flex-shrink: 0;
}

.tool-status-dot.active {
  background: var(--success);
}
</style>
