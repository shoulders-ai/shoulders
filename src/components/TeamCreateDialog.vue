<template>
  <Teleport to="body">
    <Transition name="snapshot-dialog">
      <div
        v-if="visible"
        class="snapshot-overlay"
        @click.self="cancel"
        @keydown.esc="cancel"
      >
        <div class="snapshot-dialog" style="width: 380px;">
          <div class="snapshot-header">
            <span class="snapshot-title">Create team workspace</span>
            <button class="snapshot-close" @click="cancel" aria-label="Close">&times;</button>
          </div>

          <div v-if="!creating && !done">
            <p class="text-xs text-content-muted mb-3">Choose an empty folder for your new team workspace.</p>
            <button
              class="w-full px-4 py-2 text-xs font-medium rounded-md bg-accent text-surface cursor-pointer border-none transition-opacity hover:opacity-85"
              @click="pickAndCreate"
            >
              Choose Folder...
            </button>
          </div>

          <div v-if="creating" class="flex items-center gap-2 py-2">
            <svg class="sync-pulse" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
            </svg>
            <span class="text-xs text-content-muted">Creating workspace...</span>
          </div>

          <div v-if="error" class="mt-3 px-2.5 py-1.5 rounded-md text-xs text-error" style="background: rgba(247, 118, 142, 0.1);">
            {{ error }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from '../stores/workspace'
import { useToastStore } from '../stores/toast'
import { gitInit, gitAdd, gitCommit } from '../services/git'
import {
  createTeamWorkspace as apiCreateTeamWorkspace,
  setupTeamRemote,
  configureTeamGitUser,
  saveTeamMeta,
  friendlyTeamError,
} from '../services/teamSync'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'open-workspace', 'team-created'])

const workspace = useWorkspaceStore()
const toastStore = useToastStore()

const creating = ref(false)
const done = ref(false)
const error = ref('')

watch(() => props.visible, (v) => {
  if (v) {
    creating.value = false
    done.value = false
    error.value = ''
  }
})

async function pickAndCreate() {
  const { homeDir } = await import('@tauri-apps/api/path')
  const home = await homeDir()
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Choose location for team workspace',
    defaultPath: home,
  })
  if (!selected) return

  creating.value = true
  error.value = ''

  try {
    const exists = await invoke('path_exists', { path: selected })
    if (!exists) await invoke('create_dir', { path: selected })

    const gitExists = await invoke('path_exists', { path: `${selected}/.git` })
    if (!gitExists) await gitInit(selected)

    const privateDir = `${selected}/_private`
    const privateExists = await invoke('path_exists', { path: privateDir })
    if (!privateExists) await invoke('create_dir', { path: privateDir })

    const gitignorePath = `${selected}/.gitignore`
    let gitignoreContent = ''
    try { gitignoreContent = await invoke('read_file', { path: gitignorePath }) } catch {}

    let changed = false
    if (!gitignoreContent.includes('_private/')) {
      gitignoreContent = gitignoreContent.trimEnd() + '\n_private/\n'
      changed = true
    }
    if (!gitignoreContent.includes('.shoulders/')) {
      gitignoreContent = gitignoreContent.trimEnd() + '\n.shoulders/\n'
      changed = true
    }
    gitignoreContent = gitignoreContent.replace(/^\n+/, '')
    if (changed || !await invoke('path_exists', { path: gitignorePath })) {
      await invoke('write_file', { path: gitignorePath, content: gitignoreContent })
    }

    let serverOk = false
    let inviteToken = null

    if (!workspace.shouldersAuth?.token) {
      toastStore.show('Workspace created locally. Log in to enable team sync.', { type: 'warning' })
    } else {
      const freshOk = await workspace.ensureFreshToken()
      if (!freshOk || !workspace.shouldersAuth?.token) {
        throw new Error('Authentication expired. Please log in again.')
      }

      const token = workspace.shouldersAuth.token
      const name = selected.split('/').pop() || 'workspace'
      const result = await apiCreateTeamWorkspace(name, token)

      await setupTeamRemote(selected, result.gitUrl)
      await configureTeamGitUser(selected, workspace.shouldersAuth)

      await saveTeamMeta(selected, {
        workspaceId: result.id,
        gitUrl: result.gitUrl,
        inviteToken: result.inviteToken,
        name: result.name,
      })
      serverOk = true
      inviteToken = result.inviteToken

      await gitAdd(selected)
      try { await gitCommit(selected, 'Initial commit') } catch {}
      try {
        const { gitPush, gitBranch } = await import('../services/git')
        const branch = await gitBranch(selected)
        if (branch) await gitPush(selected, 'origin', branch, token)
      } catch (e) {
        console.warn('[team] Initial push failed, sync will retry:', e)
      }
    }

    done.value = true
    emit('open-workspace', selected)
    if (serverOk && inviteToken) {
      emit('team-created', { inviteToken })
    }
    emit('close')
  } catch (e) {
    console.error('[team] Create failed:', e)
    error.value = friendlyTeamError(e)
  } finally {
    creating.value = false
  }
}

function cancel() {
  if (creating.value) return
  emit('close')
}
</script>
