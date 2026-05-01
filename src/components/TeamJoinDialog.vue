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
            <span class="snapshot-title">Join a team workspace</span>
            <button class="snapshot-close" @click="cancel" aria-label="Close">&times;</button>
          </div>

          <label class="block text-xs text-content-muted mb-1.5">Paste invite link</label>
          <input
            ref="inputRef"
            v-model="token"
            class="snapshot-input font-mono text-xs mb-3"
            placeholder="shoulde.rs/join/..."
            spellcheck="false"
            autocomplete="off"
            @keydown.enter="doJoin"
          />

          <div v-if="error" class="mb-3 px-2.5 py-1.5 rounded-md text-xs text-error" style="background: rgba(247, 118, 142, 0.1);">
            {{ error }}
          </div>

          <div v-if="success" class="mb-3 px-2.5 py-1.5 rounded-md text-xs text-success" style="background: rgba(158, 206, 106, 0.1);">
            Workspace ready! Opening...
          </div>

          <div class="flex items-center gap-2 justify-end">
            <button
              class="px-3 py-1.5 text-xs text-content-muted bg-transparent border-none cursor-pointer hover:text-content-secondary"
              @click="cancel"
              :disabled="joining"
            >
              Cancel
            </button>
            <button
              class="px-4 py-1.5 text-xs font-medium rounded-md bg-accent text-surface cursor-pointer border-none transition-opacity hover:opacity-85 disabled:opacity-40 disabled:cursor-not-allowed"
              :disabled="!token.trim() || joining"
              @click="doJoin"
            >
              {{ joining ? 'Joining...' : 'Join' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { useWorkspaceStore } from '../stores/workspace'
import {
  joinTeamWorkspace as apiJoinTeamWorkspace,
  saveTeamMeta,
  configureTeamGitUser,
} from '../services/teamSync'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'open-workspace'])

const workspace = useWorkspaceStore()
const inputRef = ref(null)
const token = ref('')
const joining = ref(false)
const error = ref('')
const success = ref(false)

watch(() => props.visible, async (v) => {
  if (v) {
    token.value = ''
    error.value = ''
    success.value = false
    joining.value = false
    await nextTick()
    inputRef.value?.focus()
  }
})

function extractInviteToken(input) {
  const trimmed = input.trim()
  const match = trimmed.match(/\/join\/([a-zA-Z0-9_-]+)/)
  if (match) return match[1]
  return trimmed
}

async function doJoin() {
  const raw = token.value.trim()
  if (!raw || joining.value) return

  if (!workspace.shouldersAuth?.token) {
    error.value = 'Please log in to Shoulders first (Settings > Account).'
    return
  }

  joining.value = true
  error.value = ''

  try {
    const freshOk = await workspace.ensureFreshToken()
    if (freshOk !== true || !workspace.shouldersAuth?.token) {
      error.value = 'Authentication expired. Please log in again.'
      return
    }

    const authToken = workspace.shouldersAuth.token
    const invite = extractInviteToken(raw)
    const result = await apiJoinTeamWorkspace(invite, authToken)

    const { homeDir } = await import('@tauri-apps/api/path')
    const home = await homeDir()
    const parentDir = await open({
      directory: true,
      multiple: false,
      title: 'Clone team workspace into...',
      defaultPath: home,
    })
    if (!parentDir) { joining.value = false; return }

    const folderName = result.name || `team-${result.id}`
    const targetPath = `${parentDir}/${folderName}`

    await invoke('git_clone_authenticated', { url: result.gitUrl, targetPath, token: authToken })

    await saveTeamMeta(targetPath, {
      workspaceId: result.id,
      gitUrl: result.gitUrl,
      name: result.name,
    })

    await configureTeamGitUser(targetPath, workspace.shouldersAuth)

    success.value = true
    setTimeout(() => {
      emit('open-workspace', targetPath)
      emit('close')
    }, 600)
  } catch (e) {
    error.value = String(e).replace(/^Error:\s*/i, '')
  } finally {
    joining.value = false
  }
}

function cancel() {
  if (joining.value) return
  emit('close')
}
</script>
