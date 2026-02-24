import { defineStore } from 'pinia'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { gitInit, gitAdd, gitCommit, gitStatus, gitRemoteGetUrl } from '../services/git'
import DEFAULT_SKILL_CONTENT from './defaultSkillContent.js'

export const useWorkspaceStore = defineStore('workspace', {
  state: () => ({
    path: null,
    settings: {},
    systemPrompt: '',
    instructions: '',
    apiKey: '',
    apiKeys: {},
    modelsConfig: null,
    shouldersAuth: null,
    gitAutoCommitInterval: 5 * 60 * 1000, // 5 minutes
    gitAutoCommitTimer: null,
    settingsOpen: false,
    settingsSection: null,
    leftSidebarOpen: localStorage.getItem('leftSidebarOpen') !== 'false',
    rightSidebarOpen: localStorage.getItem('rightSidebarOpen') === 'true',
    leftSidebarWidth: parseInt(localStorage.getItem('leftSidebarWidth')) || 240,
    rightSidebarWidth: parseInt(localStorage.getItem('rightSidebarWidth')) || 360,
    disabledTools: [],
    selectedModelId: localStorage.getItem('lastModelId') || '',
    ghostModelId: localStorage.getItem('ghostModelId') || '',
    ghostEnabled: localStorage.getItem('ghostEnabled') !== 'false',
    livePreviewEnabled: localStorage.getItem('livePreviewEnabled') !== 'false',
    softWrap: localStorage.getItem('softWrap') !== 'false',
    wrapColumn: parseInt(localStorage.getItem('wrapColumn')) || 0,
    spellcheck: localStorage.getItem('spellcheck') !== 'false',
    editorFontSize: parseInt(localStorage.getItem('editorFontSize')) || 14,
    uiFontSize: parseInt(localStorage.getItem('uiFontSize')) || 13,
    docxZoomPercent: parseInt(localStorage.getItem('docxZoomPercent')) || 100,
    theme: localStorage.getItem('theme') || 'default',
    referencesPanelHeight: parseInt(localStorage.getItem('referencesPanelHeight')) || 250,
    globalConfigDir: '',
    // GitHub sync
    githubToken: null,   // { token, login, name, email, id, avatarUrl }
    githubUser: null,
    syncStatus: 'disconnected', // idle | syncing | synced | error | conflict | disconnected
    syncError: null,
    syncErrorType: null, // auth | network | conflict | generic
    syncConflictBranch: null,
    lastSyncTime: null,
    remoteUrl: '',
    syncTimer: null,
    // Skills
    skillsManifest: null,  // Array<{ name, description, path }> | null
  }),

  getters: {
    isOpen: (state) => !!state.path,
    shouldersDir: (state) => state.path ? `${state.path}/.shoulders` : null,
    projectDir: (state) => state.path ? `${state.path}/.project` : null,
    claudeDir: (state) => state.path ? `${state.path}/.claude` : null,
  },

  actions: {
    async openWorkspace(path) {
      this.path = path

      // Resolve global config directory (~/.shoulders/)
      try { this.globalConfigDir = await invoke('get_global_config_dir') }
      catch { this.globalConfigDir = '' }

      // Restore auth from localStorage
      this.initAuth()

      // Initialize .shoulders directory (private AI state)
      await this.initShouldersDir()

      // Initialize .project directory (public project data)
      await this.initProjectDir()

      // Install Claude Code edit interception hooks in this workspace
      await this.installEditHooks()

      // Load settings
      await this.loadSettings()

      // Start file watching
      await invoke('watch_directory', { path })

      // Hot-reload _instructions.md on change
      this._instructionsUnlisten = await listen('fs-change', (event) => {
        const paths = event.payload?.paths || []
        const instructionsPath = `${this.path}/_instructions.md`
        if (paths.some(p => p === instructionsPath)) {
          this.loadInstructions()
        }
      })

      // Load usage data
      import('./usage').then(({ useUsageStore }) => {
        const usageStore = useUsageStore()
        usageStore.loadSettings()
        usageStore.loadMonth()
        usageStore.loadTrend()
      })

      // Start git auto-commit
      this.startAutoCommit()

      // Initialize GitHub sync
      this.initGitHub()

      // Persist last workspace + add to recents
      try {
        localStorage.setItem('lastWorkspace', path)
        this.addRecent(path)
      } catch (e) { /* ignore */ }
    },

    // Recent workspaces (persisted in localStorage, max 10)
    getRecentWorkspaces() {
      try {
        return JSON.parse(localStorage.getItem('recentWorkspaces') || '[]')
      } catch { return [] }
    },

    addRecent(path) {
      const recents = this.getRecentWorkspaces().filter(r => r.path !== path)
      recents.unshift({ path, name: path.split('/').pop(), lastOpened: new Date().toISOString() })
      if (recents.length > 10) recents.length = 10
      localStorage.setItem('recentWorkspaces', JSON.stringify(recents))
    },

    removeRecent(path) {
      const recents = this.getRecentWorkspaces().filter(r => r.path !== path)
      localStorage.setItem('recentWorkspaces', JSON.stringify(recents))
    },

    async closeWorkspace() {
      await this.cleanup()
      this.path = null
      this.systemPrompt = ''
      this.instructions = ''
      this.apiKey = ''
      this.apiKeys = {}
      this.modelsConfig = null
      this.skillsManifest = null
      localStorage.removeItem('lastWorkspace')
    },

    async initShouldersDir() {
      const shouldersDir = this.shouldersDir
      if (!shouldersDir) return

      const exists = await invoke('path_exists', { path: shouldersDir })
      if (!exists) {
        await invoke('create_dir', { path: shouldersDir })

        // Create default system prompt
        await invoke('write_file', {
          path: `${shouldersDir}/system.md`,
          content: `You are a writing assistant integrated into Shoulders, a markdown editor.

When suggesting completions:
- Match the user's writing style and tone
- Continue naturally from the context
- Offer varied options (different lengths, approaches)

When reviewing text:
- Be concise and specific
- Focus on clarity and impact
- Suggest concrete improvements
`,
        })

        // Create pending-edits.json
        await invoke('write_file', {
          path: `${shouldersDir}/pending-edits.json`,
          content: '[]',
        })
      }

      // Ensure global models.json exists
      if (this.globalConfigDir) {
        const globalModelsPath = `${this.globalConfigDir}/models.json`
        const globalModelsExists = await invoke('path_exists', { path: globalModelsPath })
        if (!globalModelsExists) {
          // Try migrating from workspace-local models.json
          let migrated = false
          const localModelsPath = `${shouldersDir}/models.json`
          try {
            const localRaw = await invoke('read_file', { path: localModelsPath })
            JSON.parse(localRaw) // validate JSON
            await invoke('write_file', { path: globalModelsPath, content: localRaw })
            migrated = true
          } catch { /* no local config to migrate */ }

          if (!migrated) {
            await invoke('write_file', {
              path: globalModelsPath,
              content: JSON.stringify({
                models: [
                  { id: 'opus', name: 'Opus 4.6', provider: 'anthropic', model: 'claude-opus-4-6', default: false },
                  { id: 'sonnet', name: 'Sonnet 4.6', provider: 'anthropic', model: 'claude-sonnet-4-6', default: true },
                  { id: 'haiku', name: 'Haiku 4.5', provider: 'anthropic', model: 'claude-haiku-4-5-20251001' },
                  { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai', model: 'gpt-5.2-2025-12-11' },
                  { id: 'gpt-5-mini', name: 'GPT-5 Mini', provider: 'openai', model: 'gpt-5-mini-2025-08-07' },
                  { id: 'gemini-3.1-pro-fast', name: 'Gemini 3.1 Pro (Low)', provider: 'google', model: 'gemini-3.1-pro-preview', thinking: 'low' },
                  { id: 'gemini-3.1-pro-deep', name: 'Gemini 3.1 Pro (High)', provider: 'google', model: 'gemini-3.1-pro-preview', thinking: 'high' },
                  { id: 'gemini-flash', name: 'Gemini 3 Flash', provider: 'google', model: 'gemini-3-flash-preview', thinking: 'medium' },
                ],
                providers: {
                  anthropic: { url: 'https://api.anthropic.com/v1/messages', apiKeyEnv: 'ANTHROPIC_API_KEY' },
                  openai: { url: 'https://api.openai.com/v1/responses', apiKeyEnv: 'OPENAI_API_KEY' },
                  google: { url: 'https://generativelanguage.googleapis.com/v1beta/models', apiKeyEnv: 'GOOGLE_API_KEY' },
                },
              }, null, 2),
            })
          }
        }
      }

      // Ensure chats directory exists (migration for existing workspaces)
      const chatsExists = await invoke('path_exists', { path: `${shouldersDir}/chats` })
      if (!chatsExists) {
        await invoke('create_dir', { path: `${shouldersDir}/chats` })
      }

      // Ensure _instructions.md exists at workspace root
      await this._ensureInstructionsFile()
    },

    async initProjectDir() {
      const projectDir = this.projectDir
      const shouldersDir = this.shouldersDir
      if (!projectDir) return

      const exists = await invoke('path_exists', { path: projectDir })
      if (!exists) {
        await invoke('create_dir', { path: projectDir })

        // Migrate references from old .shoulders/ location
        const oldRefsDir = `${shouldersDir}/references`
        const oldRefsExists = await invoke('path_exists', { path: oldRefsDir })
        if (oldRefsExists) {
          try {
            await invoke('copy_dir', { src: oldRefsDir, dest: `${projectDir}/references` })
            await invoke('delete_path', { path: oldRefsDir })
          } catch (e) {
            console.warn('Failed to migrate references:', e)
          }
        }

        // Migrate styles from old .shoulders/ location
        const oldStylesDir = `${shouldersDir}/styles`
        const oldStylesExists = await invoke('path_exists', { path: oldStylesDir })
        if (oldStylesExists) {
          try {
            await invoke('copy_dir', { src: oldStylesDir, dest: `${projectDir}/styles` })
            await invoke('delete_path', { path: oldStylesDir })
          } catch (e) {
            console.warn('Failed to migrate styles:', e)
          }
        }

        // Migrate pdf-settings.json
        const oldPdfSettings = `${shouldersDir}/pdf-settings.json`
        try {
          const pdfContent = await invoke('read_file', { path: oldPdfSettings })
          await invoke('write_file', { path: `${projectDir}/pdf-settings.json`, content: pdfContent })
          await invoke('delete_path', { path: oldPdfSettings })
        } catch { /* no pdf-settings to migrate */ }

        // Migrate citation-style.json
        const oldCitationStyle = `${shouldersDir}/citation-style.json`
        try {
          const styleContent = await invoke('read_file', { path: oldCitationStyle })
          await invoke('write_file', { path: `${projectDir}/citation-style.json`, content: styleContent })
          await invoke('delete_path', { path: oldCitationStyle })
        } catch { /* no citation-style to migrate */ }
      }

      // Ensure references directories exist
      const refsDir = `${projectDir}/references`
      const refsExists = await invoke('path_exists', { path: refsDir })
      if (!refsExists) {
        await invoke('create_dir', { path: refsDir })
        await invoke('create_dir', { path: `${refsDir}/pdfs` })
        await invoke('create_dir', { path: `${refsDir}/fulltext` })
        await invoke('write_file', { path: `${refsDir}/library.json`, content: '[]' })
      }

      // Ensure styles directory exists
      await invoke('create_dir', { path: `${projectDir}/styles` }).catch(() => {})

      // Ensure skills directory and default skill exist
      const skillsDir = `${projectDir}/skills`
      const skillsExists = await invoke('path_exists', { path: skillsDir })
      if (!skillsExists) {
        await invoke('create_dir', { path: skillsDir })
        await invoke('create_dir', { path: `${skillsDir}/shoulders-meta` })
        await invoke('write_file', {
          path: `${skillsDir}/skills.json`,
          content: JSON.stringify({
            skills: [{
              name: 'shoulders-meta',
              description: 'Information about the Shoulders app. Trigger: user asks about app features, support, or has questions about how Shoulders works.',
              path: '.project/skills/shoulders-meta/SKILL.md',
            }],
          }, null, 2),
        })
        await invoke('write_file', {
          path: `${skillsDir}/shoulders-meta/SKILL.md`,
          content: DEFAULT_SKILL_CONTENT,
        })
      }
    },

    async installEditHooks() {
      if (!this.path) return
      const claudeDir = `${this.path}/.claude`
      const hooksDir = `${claudeDir}/hooks`

      // Create directories
      try {
        const claudeExists = await invoke('path_exists', { path: claudeDir })
        if (!claudeExists) await invoke('create_dir', { path: claudeDir })
        const hooksExists = await invoke('path_exists', { path: hooksDir })
        if (!hooksExists) await invoke('create_dir', { path: hooksDir })
      } catch (e) {
        console.warn('Failed to create .claude dirs:', e)
        return
      }

      // Write hook script (always overwrite - managed by Shoulders)
      const hookScript = `#!/bin/bash
# Managed by Shoulders - edit interception hook
# Records Claude Code Edit/Write tool calls for review (non-blocking)

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')

if [[ "$TOOL_NAME" != "Edit" && "$TOOL_NAME" != "Write" ]]; then
  exit 0
fi

WORKSPACE_DIR=$(cd "$(dirname "$0")/../.." && pwd)

# Direct mode: skip recording entirely
if [[ -f "$WORKSPACE_DIR/.shoulders/.direct-mode" ]]; then
  exit 0
fi

mkdir -p "$WORKSPACE_DIR/.shoulders"
PENDING_FILE="$WORKSPACE_DIR/.shoulders/pending-edits.json"
if [[ ! -f "$PENDING_FILE" ]]; then
  echo "[]" > "$PENDING_FILE"
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ID="edit-$(date +%s)-$$"
TOOL_INPUT=$(echo "$INPUT" | jq -r '.tool_input // empty')

if [[ "$TOOL_NAME" == "Edit" ]]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path')
  OLD_STRING=$(echo "$TOOL_INPUT" | jq -r '.old_string')
  NEW_STRING=$(echo "$TOOL_INPUT" | jq -r '.new_string')
  OLD_CONTENT=""
  if [[ -f "$FILE_PATH" ]]; then
    OLD_CONTENT=$(cat "$FILE_PATH")
  fi
  NEW_EDIT=$(jq -n \\
    --arg id "$ID" --arg ts "$TIMESTAMP" --arg tool "$TOOL_NAME" \\
    --arg fp "$FILE_PATH" --arg os "$OLD_STRING" --arg ns "$NEW_STRING" \\
    --arg old_content "$OLD_CONTENT" \\
    '{id:$id,timestamp:$ts,tool:$tool,file_path:$fp,old_string:$os,new_string:$ns,old_content:$old_content,status:"pending"}')
elif [[ "$TOOL_NAME" == "Write" ]]; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path')
  CONTENT=$(echo "$TOOL_INPUT" | jq -r '.content')
  OLD_CONTENT=""
  if [[ -f "$FILE_PATH" ]]; then
    OLD_CONTENT=$(cat "$FILE_PATH")
  fi
  NEW_EDIT=$(jq -n \\
    --arg id "$ID" --arg ts "$TIMESTAMP" --arg tool "$TOOL_NAME" \\
    --arg fp "$FILE_PATH" --arg content "$CONTENT" --arg old_content "$OLD_CONTENT" \\
    '{id:$id,timestamp:$ts,tool:$tool,file_path:$fp,content:$content,old_content:$old_content,status:"pending"}')
fi

CURRENT=$(cat "$PENDING_FILE")
echo "$CURRENT" | jq ". + [$NEW_EDIT]" > "$PENDING_FILE"
exit 0
`
      try {
        await invoke('write_file', { path: `${hooksDir}/intercept-edits.sh`, content: hookScript })
      } catch (e) {
        console.warn('Failed to write hook script:', e)
        return
      }

      // Merge settings.json (don't overwrite existing user hooks)
      let settings = {}
      try {
        const existing = await invoke('read_file', { path: `${claudeDir}/settings.json` })
        settings = JSON.parse(existing)
      } catch (e) {
        // File doesn't exist or invalid JSON - start fresh
      }

      if (!settings.hooks) settings.hooks = {}
      if (!Array.isArray(settings.hooks.PreToolUse)) settings.hooks.PreToolUse = []

      // Check if our hook is already installed
      const hasOurHook = settings.hooks.PreToolUse.some(h =>
        h.matcher === 'Edit|Write' &&
        h.hooks?.some(hh => hh.command?.includes('intercept-edits.sh'))
      )

      if (!hasOurHook) {
        settings.hooks.PreToolUse.push({
          matcher: 'Edit|Write',
          hooks: [{
            type: 'command',
            command: 'bash .claude/hooks/intercept-edits.sh',
          }],
        })

        try {
          await invoke('write_file', {
            path: `${claudeDir}/settings.json`,
            content: JSON.stringify(settings, null, 2),
          })
        } catch (e) {
          console.warn('Failed to write settings.json:', e)
        }
      }
    },

    async loadSettings() {
      const shouldersDir = this.shouldersDir
      if (!shouldersDir) return

      // Load system prompt
      try {
        this.systemPrompt = await invoke('read_file', {
          path: `${shouldersDir}/system.md`,
        })
      } catch (e) {
        this.systemPrompt = ''
      }

      // Load user instructions (_instructions.md at workspace root)
      await this.loadInstructions()

      // Load API keys from global ~/.shoulders/keys.env
      this.apiKeys = await this.loadGlobalKeys()

      // Migration: if global is empty, check workspace .env for real keys
      if (Object.keys(this.apiKeys).length === 0) {
        try {
          const envContent = await invoke('read_file', { path: `${shouldersDir}/.env` })
          const workspaceKeys = {}
          for (const line of envContent.split('\n')) {
            const trimmed = line.trim()
            if (!trimmed || trimmed.startsWith('#')) continue
            const eqIdx = trimmed.indexOf('=')
            if (eqIdx > 0) {
              const key = trimmed.substring(0, eqIdx).trim()
              const value = trimmed.substring(eqIdx + 1).trim()
              if (value && !value.includes('your-')) {
                workspaceKeys[key] = value
              }
            }
          }
          if (Object.keys(workspaceKeys).length > 0) {
            await this.saveGlobalKeys(workspaceKeys)
            this.apiKeys = workspaceKeys
          }
        } catch { /* no workspace .env — that's fine */ }
      }

      // Backwards-compat alias
      this.apiKey = this.apiKeys.ANTHROPIC_API_KEY || ''

      // Load models config from global directory
      try {
        const modelsPath = this.globalConfigDir
          ? `${this.globalConfigDir}/models.json`
          : `${shouldersDir}/models.json`
        const modelsContent = await invoke('read_file', { path: modelsPath })
        this.modelsConfig = JSON.parse(modelsContent)
      } catch (e) {
        this.modelsConfig = null
      }

      // Load tool permissions
      await this.loadToolPermissions()

      // Load skills manifest
      await this.loadSkillsManifest()
    },

    async loadSkillsManifest() {
      const projectDir = this.projectDir
      if (!projectDir) { this.skillsManifest = null; return }
      try {
        const skillsPath = `${projectDir}/skills/skills.json`
        const exists = await invoke('path_exists', { path: skillsPath })
        if (!exists) { this.skillsManifest = null; return }
        const content = await invoke('read_file', { path: skillsPath })
        const data = JSON.parse(content)
        this.skillsManifest = data.skills || null
      } catch {
        this.skillsManifest = null
      }
    },

    async loadGlobalKeys() {
      if (!this.globalConfigDir) return {}
      const keysPath = `${this.globalConfigDir}/keys.env`
      try {
        const exists = await invoke('path_exists', { path: keysPath })
        if (!exists) return {}
        const content = await invoke('read_file', { path: keysPath })
        const keys = {}
        for (const line of content.split('\n')) {
          const trimmed = line.trim()
          if (!trimmed || trimmed.startsWith('#')) continue
          const eqIdx = trimmed.indexOf('=')
          if (eqIdx > 0) {
            const key = trimmed.substring(0, eqIdx).trim()
            const value = trimmed.substring(eqIdx + 1).trim()
            if (value) keys[key] = value
          }
        }
        return keys
      } catch (e) {
        console.warn('Failed to load global keys:', e)
        return {}
      }
    },

    async saveGlobalKeys(keys) {
      if (!this.globalConfigDir) return
      const keysPath = `${this.globalConfigDir}/keys.env`
      const lines = []
      for (const [k, v] of Object.entries(keys)) {
        if (v) lines.push(`${k}=${v}`)
      }
      try {
        await invoke('write_file', {
          path: keysPath,
          content: lines.length > 0 ? lines.join('\n') + '\n' : '',
        })
      } catch (e) {
        console.warn('Failed to save global keys:', e)
      }
    },

    async _ensureInstructionsFile() {
      if (!this.path) return
      const filePath = `${this.path}/_instructions.md`
      const exists = await invoke('path_exists', { path: filePath })
      if (exists) return

      await invoke('write_file', {
        path: filePath,
        content: `<!-- Project Instructions -->
<!-- Everything here shapes how AI helps you in this project — -->
<!-- in chat, inline suggestions, and tasks.                -->
<!-- Edits take effect immediately. Delete these hints and     -->
<!-- write your own.                                           -->

<!-- Example: This is my PhD thesis on marine biodiversity.    -->

<!-- Example: Use formal academic English. Prefer active voice. -->

<!-- Example: "OTU" = Operational Taxonomic Unit               -->
`,
      })
    },

    async loadInstructions() {
      if (!this.path) return
      try {
        const raw = await invoke('read_file', { path: `${this.path}/_instructions.md` })
        // Strip HTML comment lines — they're template hints, not AI instructions
        this.instructions = raw.split('\n')
          .filter(l => !(l.trim().startsWith('<!--') && l.trim().endsWith('-->')))
          .join('\n').trim()
      } catch (e) {
        this.instructions = ''
      }
    },

    async openInstructionsFile() {
      if (!this.path) return
      const filePath = `${this.path}/_instructions.md`
      // Create if missing (user deleted it)
      const exists = await invoke('path_exists', { path: filePath })
      if (!exists) {
        await this._ensureInstructionsFile()
      }
      // Open in editor
      const { useEditorStore } = await import('./editor')
      const editorStore = useEditorStore()
      editorStore.openFile(filePath)
    },

    async loadToolPermissions() {
      if (!this.globalConfigDir) return
      const globalPath = `${this.globalConfigDir}/tools.json`
      try {
        const raw = await invoke('read_file', { path: globalPath })
        const data = JSON.parse(raw)
        this.disabledTools = Array.isArray(data.disabled) ? data.disabled : []
      } catch {
        // Global file doesn't exist — try migrating from workspace-local
        if (this.shouldersDir) {
          try {
            const localRaw = await invoke('read_file', { path: `${this.shouldersDir}/tools.json` })
            const localData = JSON.parse(localRaw)
            this.disabledTools = Array.isArray(localData.disabled) ? localData.disabled : []
            // Migrate to global
            await this.saveToolPermissions()
          } catch {
            this.disabledTools = []
          }
        } else {
          this.disabledTools = []
        }
      }
    },

    async saveToolPermissions() {
      if (!this.globalConfigDir) return
      try {
        await invoke('write_file', {
          path: `${this.globalConfigDir}/tools.json`,
          content: JSON.stringify({ version: 1, disabled: this.disabledTools }, null, 2),
        })
      } catch (e) {
        console.warn('Failed to save tool permissions:', e)
      }
    },

    toggleTool(name) {
      const idx = this.disabledTools.indexOf(name)
      if (idx >= 0) {
        this.disabledTools.splice(idx, 1)
      } else {
        this.disabledTools.push(name)
      }
      this.saveToolPermissions()
    },

    toggleLeftSidebar() {
      this.leftSidebarOpen = !this.leftSidebarOpen
      localStorage.setItem('leftSidebarOpen', String(this.leftSidebarOpen))
    },

    toggleRightSidebar() {
      this.rightSidebarOpen = !this.rightSidebarOpen
      localStorage.setItem('rightSidebarOpen', String(this.rightSidebarOpen))
    },

    openSettings(section = null) {
      this.settingsSection = section
      this.settingsOpen = true
    },

    closeSettings() {
      this.settingsOpen = false
      this.settingsSection = null
    },

    setSelectedModelId(id) {
      this.selectedModelId = id
      localStorage.setItem('lastModelId', id)
    },

    setGhostModelId(modelId) {
      this.ghostModelId = modelId
      localStorage.setItem('ghostModelId', modelId)
    },

    setGhostEnabled(val) {
      this.ghostEnabled = val
      localStorage.setItem('ghostEnabled', String(val))
    },

    toggleLivePreview() {
      this.livePreviewEnabled = !this.livePreviewEnabled
      localStorage.setItem('livePreviewEnabled', String(this.livePreviewEnabled))
    },

    toggleSoftWrap() {
      this.softWrap = !this.softWrap
      localStorage.setItem('softWrap', String(this.softWrap))
    },

    setWrapColumn(n) {
      this.wrapColumn = Math.max(0, parseInt(n) || 0)
      localStorage.setItem('wrapColumn', String(this.wrapColumn))
    },

    toggleSpellcheck() {
      this.spellcheck = !this.spellcheck
      localStorage.setItem('spellcheck', String(this.spellcheck))
    },

    zoomIn() {
      this.editorFontSize = Math.min(24, this.editorFontSize + 1)
      this.uiFontSize = Math.min(20, this.uiFontSize + 1)
      this.applyFontSizes()
    },

    zoomOut() {
      this.editorFontSize = Math.max(10, this.editorFontSize - 1)
      this.uiFontSize = Math.max(9, this.uiFontSize - 1)
      this.applyFontSizes()
    },

    resetZoom() {
      this.editorFontSize = 14
      this.uiFontSize = 13
      this.applyFontSizes()
    },

    setZoomPercent(pct) {
      this.editorFontSize = Math.round(14 * pct / 100)
      this.uiFontSize = Math.round(13 * pct / 100)
      this.editorFontSize = Math.max(10, Math.min(24, this.editorFontSize))
      this.uiFontSize = Math.max(9, Math.min(20, this.uiFontSize))
      this.applyFontSizes()
    },

    setDocxZoom(pct) {
      this.docxZoomPercent = Math.max(50, Math.min(200, Math.round(pct)))
      localStorage.setItem('docxZoomPercent', String(this.docxZoomPercent))
    },

    docxZoomIn() {
      this.setDocxZoom(this.docxZoomPercent + 10)
    },

    docxZoomOut() {
      this.setDocxZoom(this.docxZoomPercent - 10)
    },

    resetDocxZoom() {
      this.setDocxZoom(100)
    },

    applyFontSizes() {
      document.documentElement.style.setProperty('--editor-font-size', this.editorFontSize + 'px')
      document.documentElement.style.setProperty('--ui-font-size', this.uiFontSize + 'px')
      localStorage.setItem('editorFontSize', String(this.editorFontSize))
      localStorage.setItem('uiFontSize', String(this.uiFontSize))
    },

    setTheme(name) {
      this.theme = name
      localStorage.setItem('theme', name)
      // Remove any existing theme class, apply new one
      const el = document.documentElement
      el.classList.remove('theme-light', 'theme-monokai', 'theme-nord', 'theme-solarized', 'theme-humane', 'theme-one-light', 'theme-dracula')
      if (name !== 'default') {
        el.classList.add(`theme-${name}`)
      }
    },

    restoreTheme() {
      if (this.theme !== 'default') {
        document.documentElement.classList.add(`theme-${this.theme}`)
      }
    },

    startAutoCommit() {
      this.stopAutoCommit()
      if (!this.path) return

      this.gitAutoCommitTimer = setInterval(async () => {
        await this.autoCommit()
      }, this.gitAutoCommitInterval)
    },

    stopAutoCommit() {
      if (this.gitAutoCommitTimer) {
        clearInterval(this.gitAutoCommitTimer)
        this.gitAutoCommitTimer = null
      }
    },

    async autoCommit() {
      if (!this.path) return
      try {
        // Check if git is initialized
        const gitExists = await invoke('path_exists', { path: `${this.path}/.git` })
        if (!gitExists) {
          await gitInit(this.path)
        }

        // Stage all changes
        await gitAdd(this.path)

        // Check if there are changes to commit
        const status = await gitStatus(this.path)
        if (status.trim()) {
          const now = new Date()
          const timestamp = now.toISOString().replace('T', ' ').substring(0, 16)
          await gitCommit(this.path, `Auto: ${timestamp}`)

          // Auto-push if GitHub is connected
          await this.autoSync()
        }
      } catch (e) {
        console.warn('Auto-commit failed:', e)
      }
    },

    // ── GitHub Sync ──

    async initGitHub() {
      try {
        const { loadGitHubToken, getGitHubUser, syncState } = await import('../services/githubSync')
        const stored = await loadGitHubToken()
        if (!stored?.token) return

        this.githubToken = stored
        // Verify token is still valid by fetching user
        try {
          const user = await getGitHubUser(stored.token)
          this.githubUser = {
            login: user.login,
            name: user.name,
            email: user.email,
            id: user.id,
            avatarUrl: user.avatar_url,
          }
        } catch {
          // Token invalid — clear it
          this.githubToken = null
          this.githubUser = null
          return
        }

        // Check if workspace has a remote
        if (this.path) {
          this.remoteUrl = await gitRemoteGetUrl(this.path)
          if (this.remoteUrl) {
            this.syncStatus = 'idle'
            this.startSyncTimer()
          } else {
            this.syncStatus = 'disconnected'
          }
        }
      } catch (e) {
        console.warn('[github] Init failed:', e)
      }
    },

    startSyncTimer() {
      this.stopSyncTimer()
      if (!this.githubToken?.token || !this.remoteUrl) return

      // Fetch from remote every 5 minutes
      this.syncTimer = setInterval(async () => {
        await this.fetchRemoteChanges()
      }, 5 * 60 * 1000)
    },

    stopSyncTimer() {
      if (this.syncTimer) {
        clearInterval(this.syncTimer)
        this.syncTimer = null
      }
    },

    async autoSync() {
      if (!this.path || !this.githubToken?.token) return
      const remote = await gitRemoteGetUrl(this.path)
      if (!remote) return

      // Use the full sync cycle (fetch→check→pull/merge→push)
      const { syncNow, syncState } = await import('../services/githubSync')
      await syncNow(this.path, this.githubToken.token)
      this._applySyncState(syncState)
    },

    async fetchRemoteChanges() {
      if (!this.path || !this.githubToken?.token) return
      const remote = await gitRemoteGetUrl(this.path)
      if (!remote) return

      const { fetchAndPull, syncState } = await import('../services/githubSync')
      const result = await fetchAndPull(this.path, this.githubToken.token)
      this._applySyncState(syncState)

      // If files were pulled, reload open files
      if (result.pulled) {
        try {
          const { useFilesStore } = await import('./files')
          const { useEditorStore } = await import('./editor')
          const filesStore = useFilesStore()
          const editorStore = useEditorStore()
          // Reload content for any open tabs
          for (const tab of editorStore.tabs) {
            if (tab.path && filesStore.fileContents[tab.path] !== undefined) {
              try {
                const content = await invoke('read_file', { path: tab.path })
                filesStore.fileContents[tab.path] = content
              } catch {}
            }
          }
        } catch {}
      }

      return result
    },

    async syncNow() {
      if (!this.path || !this.githubToken?.token) return
      const { syncNow, syncState } = await import('../services/githubSync')
      await syncNow(this.path, this.githubToken.token)
      this._applySyncState(syncState)
    },

    _applySyncState(syncState) {
      this.syncStatus = syncState.status
      this.syncError = syncState.error
      this.syncErrorType = syncState.errorType || null
      this.syncConflictBranch = syncState.conflictBranch
      this.lastSyncTime = syncState.lastSyncTime
      this.remoteUrl = syncState.remoteUrl || this.remoteUrl
    },

    async connectGitHub(tokenData) {
      const { storeGitHubToken, getGitHubUser, configureGitUser, ensureGitignore } = await import('../services/githubSync')
      await storeGitHubToken(tokenData)
      this.githubToken = tokenData

      // Use user data from OAuth callback if available, otherwise fetch from GitHub
      let user
      if (tokenData.login) {
        user = tokenData
      } else {
        const ghUser = await getGitHubUser(tokenData.token)
        user = {
          login: ghUser.login,
          name: ghUser.name,
          email: ghUser.email,
          id: ghUser.id,
          avatarUrl: ghUser.avatar_url,
        }
      }

      this.githubUser = {
        login: user.login,
        name: user.name,
        email: user.email,
        id: user.id,
        avatarUrl: user.avatarUrl || user.avatar_url,
      }

      // Set git user identity from GitHub profile
      if (this.path) {
        await configureGitUser(this.path, this.githubUser)
        await ensureGitignore(this.path)
      }
    },

    async disconnectGitHub() {
      const { clearGitHubToken } = await import('../services/githubSync')
      await clearGitHubToken()
      this.stopSyncTimer()
      this.githubToken = null
      this.githubUser = null
      this.syncStatus = 'disconnected'
      this.syncError = null
      this.syncErrorType = null
      this.syncConflictBranch = null
    },

    async linkRepo(cloneUrl) {
      if (!this.path) return
      const { setupRemote, ensureGitignore, syncState } = await import('../services/githubSync')
      await setupRemote(this.path, cloneUrl)
      await ensureGitignore(this.path)
      this.remoteUrl = cloneUrl
      this.syncStatus = 'idle'
      this.startSyncTimer()

      // Initial push
      await this.autoSync()
    },

    async unlinkRepo() {
      if (!this.path) return
      const { removeRemote } = await import('../services/githubSync')
      await removeRemote(this.path)
      this.stopSyncTimer()
      this.remoteUrl = ''
      this.syncStatus = 'disconnected'
      this.syncConflictBranch = null
    },

    async initAuth() {
      try {
        const { loadStoredAuth, isAccessTokenExpired, refreshTokens, listenForAuthCallback } = await import('../services/shouldersAuth')

        // Start listening for deep link auth callbacks
        try { listenForAuthCallback() } catch {}

        const auth = await loadStoredAuth()
        if (!auth) return

        // If access token expired but refresh token valid, refresh
        if (isAccessTokenExpired(auth) && auth.refreshToken) {
          try {
            const refreshed = await refreshTokens(auth)
            this.shouldersAuth = refreshed
          } catch {
            // Refresh failed — user must re-login
            this.shouldersAuth = null
          }
        } else {
          this.shouldersAuth = auth
        }

        // Start background balance refresh every 5 minutes
        if (this.shouldersAuth?.token) {
          if (this._balanceInterval) clearInterval(this._balanceInterval)
          this._balanceInterval = setInterval(() => this.refreshShouldersBalance(), 5 * 60 * 1000)
        }
      } catch (e) {
        console.warn('[auth] initAuth failed:', e)
      }
    },

    async ensureFreshToken() {
      if (!this.shouldersAuth?.token) return false
      const { isAccessTokenExpired, refreshTokens } = await import('../services/shouldersAuth')
      if (!isAccessTokenExpired(this.shouldersAuth)) return true
      if (!this.shouldersAuth.refreshToken) {
        this.shouldersAuth = null
        return false
      }
      try {
        const refreshed = await refreshTokens(this.shouldersAuth)
        this.shouldersAuth = refreshed
        return true
      } catch (e) {
        // Network error (offline) — keep auth intact so it works when back online
        if (e?.message?.includes('fetch') || e?.message?.includes('network') || e?.name === 'TypeError') {
          return 'network_error'
        }
        // Auth actually invalid — clear it
        this.shouldersAuth = null
        return false
      }
    },

    async shouldersLoginViaBrowser(options) {
      const { loginViaBrowser } = await import('../services/shouldersAuth')
      const result = await loginViaBrowser(options)
      this.shouldersAuth = result
      return result
    },

    async refreshShouldersBalance() {
      if (!this.shouldersAuth?.token) return
      await this.ensureFreshToken()
      if (!this.shouldersAuth?.token) return
      const { getAccountStatus } = await import('../services/shouldersAuth')
      try {
        const status = await getAccountStatus(this.shouldersAuth.token)
        if (status.credits !== undefined) {
          this.shouldersAuth = { ...this.shouldersAuth, credits: status.credits, plan: status.plan || this.shouldersAuth.plan }
        }
      } catch (e) {
        console.warn('[auth] refreshShouldersBalance failed:', e)
      }
    },

    async shouldersLogout() {
      const { logout } = await import('../services/shouldersAuth')
      await logout(this.shouldersAuth)
      this.shouldersAuth = null
      // Stop background balance polling
      if (this._balanceInterval) {
        clearInterval(this._balanceInterval)
        this._balanceInterval = null
      }
    },

    async cleanup() {
      this.stopAutoCommit()
      this.stopSyncTimer()
      if (this._balanceInterval) {
        clearInterval(this._balanceInterval)
        this._balanceInterval = null
      }
      if (this._instructionsUnlisten) {
        this._instructionsUnlisten()
        this._instructionsUnlisten = null
      }
      if (this.path) {
        await this.autoCommit()
        await invoke('unwatch_directory')
      }
    },
  },
})
