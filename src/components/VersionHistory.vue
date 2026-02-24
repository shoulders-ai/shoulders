<template>
  <Teleport to="body">
    <div
      v-if="visible"
      ref="overlayEl"
      class="version-overlay"
      tabindex="-1"
      @click.self="$emit('close')"
      @keydown.esc="$emit('close')"
    >
      <div class="version-modal">
        <!-- Modal-level close button -->
        <button class="version-close-btn" @click="$emit('close')" title="Close (Esc)">
          <IconX :size="18" :stroke-width="1.5" />
        </button>

        <!-- Version list -->
        <div class="version-list">
          <div class="px-3 py-2 text-xs font-medium uppercase tracking-wider"
            style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
            History: {{ fileName }}
          </div>
          <div v-if="loading" class="px-3 py-4 text-xs" style="color: var(--fg-muted);">
            Loading...
          </div>
          <div v-else-if="commits.length === 0" class="px-3 py-4 text-xs" style="color: var(--fg-muted);">
            No history yet
          </div>
          <div
            v-for="(commit, idx) in commits"
            :key="commit.hash"
            class="version-item"
            :class="{ active: idx === selectedIndex, 'version-item-named': isNamedSnapshot(commit.message) }"
            @click="selectVersion(idx)"
          >
            <div class="timestamp">{{ formatDate(commit.date) }}</div>
            <div class="message" :class="{ 'version-named-message': isNamedSnapshot(commit.message) }">
              <svg v-if="isNamedSnapshot(commit.message)" class="version-bookmark-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.5A1.5 1.5 0 014.5 0h7A1.5 1.5 0 0113 1.5v14a.5.5 0 01-.77.42L8 13.06l-4.23 2.86A.5.5 0 013 15.5V1.5z"/></svg>
              {{ commit.message }}
            </div>
          </div>
        </div>

        <!-- Preview -->
        <div class="version-preview">
          <div v-if="selectedCommit" class="version-preview-header">
            <span class="text-xs" style="color: var(--fg-muted);">
              {{ formatDate(selectedCommit.date) }}
              <span v-if="selectedCommit.message" style="margin-left: 8px; color: var(--fg-muted); opacity: 0.7;">
                {{ selectedCommit.message }}
              </span>
            </span>
          </div>

          <!-- Loading state -->
          <div v-if="previewLoading" class="version-empty-state">
            <div class="text-xs" style="color: var(--fg-muted);">Loading preview...</div>
          </div>
          <!-- Empty state -->
          <div v-else-if="!selectedCommit" class="version-empty-state">
            <div style="color: var(--fg-muted); font-size: 13px;">Select a version to preview</div>
            <div style="color: var(--fg-muted); opacity: 0.5; font-size: 11px; margin-top: 6px;">
              Click a commit on the left
            </div>
          </div>
          <!-- Preview content -->
          <div v-show="selectedCommit && !previewLoading" ref="previewContainer" class="flex-1 overflow-hidden" :class="{ 'version-docx-container': isDocx }"></div>

          <!-- Action footer -->
          <div class="version-preview-footer">
            <button
              v-if="!isDocx"
              class="version-action-btn version-action-copy"
              :class="{ 'is-success': copyFeedback }"
              :disabled="!selectedCommit"
              @click="copyContent"
            >
              {{ copyFeedback ? 'Copied!' : 'Copy content' }}
            </button>
            <button
              class="version-action-btn version-action-restore"
              :disabled="!selectedCommit"
              @click="restoreVersion"
            >
              Restore this version
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, shallowRef, markRaw, onUnmounted, nextTick } from 'vue'
import { IconX } from '@tabler/icons-vue'
import { EditorView } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { shouldersTheme, shouldersHighlighting } from '../editor/theme'
import { useWorkspaceStore } from '../stores/workspace'
import { useEditorStore } from '../stores/editor'
import { useFilesStore } from '../stores/files'
import { gitLog, gitShow, gitShowBase64 } from '../services/git'
import { getViewerType } from '../utils/fileTypes'
import { base64ToFile } from '../utils/docxBridge'
import { invoke } from '@tauri-apps/api/core'
import { ask } from '@tauri-apps/plugin-dialog'

const props = defineProps({
  visible: { type: Boolean, default: false },
  filePath: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const workspace = useWorkspaceStore()
const editorStore = useEditorStore()
const filesStore = useFilesStore()
const previewContainer = ref(null)
const overlayEl = ref(null)

const loading = ref(false)
const previewLoading = ref(false)
const commits = ref([])
const selectedIndex = ref(-1)
const previewContent = ref('')
const copyFeedback = ref(false)

let previewView = null // CodeMirror instance
let superdocInstance = null // SuperDoc instance
let copyTimer = null

const fileName = computed(() => props.filePath.split('/').pop())
const isDocx = computed(() => getViewerType(props.filePath) === 'docx')
const selectedCommit = computed(() =>
  selectedIndex.value >= 0 ? commits.value[selectedIndex.value] : null
)

function destroyPreview() {
  if (previewView) {
    previewView.destroy()
    previewView = null
  }
  if (superdocInstance) {
    superdocInstance.destroy()
    superdocInstance = null
  }
  // Clear any SuperDoc DOM remnants from the container
  if (previewContainer.value) {
    previewContainer.value.innerHTML = ''
  }
}

watch(() => props.visible, async (v) => {
  if (v && props.filePath) {
    await loadHistory()
    await nextTick()
    overlayEl.value?.focus()
  } else {
    commits.value = []
    selectedIndex.value = -1
    previewLoading.value = false
    destroyPreview()
  }
})

async function loadHistory() {
  if (!workspace.path) return
  loading.value = true
  try {
    commits.value = await gitLog(workspace.path, props.filePath)
    selectedIndex.value = -1
  } catch (e) {
    console.error('Failed to load history:', e)
    commits.value = []
  }
  loading.value = false
}

async function selectVersion(idx) {
  selectedIndex.value = idx
  const commit = commits.value[idx]
  if (!commit || !workspace.path) return

  previewLoading.value = true
  try {
    if (isDocx.value) {
      await selectVersionDocx(commit)
    } else {
      await selectVersionText(commit)
    }
  } catch (e) {
    console.error('Failed to show version:', e)
    previewContent.value = 'Could not load this version.'
    previewLoading.value = false
  }
}

async function selectVersionText(commit) {
  const content = await gitShow(workspace.path, commit.hash, props.filePath)
  previewContent.value = content
  previewLoading.value = false

  await nextTick()
  if (previewContainer.value) {
    destroyPreview()

    const state = EditorState.create({
      doc: content,
      extensions: [
        EditorView.editable.of(false),
        markdown({ base: markdownLanguage }),
        shouldersTheme,
        shouldersHighlighting,
      ],
    })

    previewView = new EditorView({
      state,
      parent: previewContainer.value,
    })
  }
}

async function selectVersionDocx(commit) {
  const base64 = await gitShowBase64(workspace.path, commit.hash, props.filePath)
  previewContent.value = '' // no text content for docx
  previewLoading.value = false

  await nextTick()
  if (!previewContainer.value) return

  destroyPreview()

  // Create a unique container ID for SuperDoc
  const containerId = 'version-superdoc-preview'
  const div = document.createElement('div')
  div.id = containerId
  previewContainer.value.appendChild(div)

  const file = base64ToFile(base64, fileName.value)

  // Dynamic import to avoid loading SuperDoc for non-docx workflows
  const { SuperDoc } = await import('superdoc')
  await import('superdoc/style.css')

  const sd = new SuperDoc({
    selector: `#${containerId}`,
    document: file,
    documentMode: 'viewing',
  })

  superdocInstance = markRaw(sd)
}

async function copyContent() {
  if (previewContent.value) {
    await navigator.clipboard.writeText(previewContent.value)
    copyFeedback.value = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copyFeedback.value = false
    }, 1500)
  }
}

async function restoreVersion() {
  const commit = selectedCommit.value
  if (!commit || !workspace.path) return

  const yes = await ask(`Restore "${fileName.value}" to version from ${formatDate(commit.date)}?`, { title: 'Confirm Restore', kind: 'warning' })
  if (!yes) {
    return
  }

  try {
    if (isDocx.value) {
      const base64 = await gitShowBase64(workspace.path, commit.hash, props.filePath)
      await invoke('write_file_base64', { path: props.filePath, data: base64 })
      // Force DocxEditor to remount by closing and reopening the tab
      const paneId = editorStore.activePaneId
      editorStore.closeTab(paneId, props.filePath)
      await nextTick()
      editorStore.openFile(props.filePath)
    } else {
      const content = await gitShow(workspace.path, commit.hash, props.filePath)
      await invoke('write_file', { path: props.filePath, content })
      await filesStore.reloadFile(props.filePath)
    }
    emit('close')
  } catch (e) {
    console.error('Failed to restore:', e)
    const { useToastStore } = await import('../stores/toast')
    const { formatFileError } = await import('../utils/errorMessages')
    useToastStore().show(formatFileError('restore', props.filePath, e), { type: 'error', duration: 5000 })
  }
}

function isNamedSnapshot(message) {
  if (!message) return false
  return !message.startsWith('Auto:') && !message.startsWith('Save:')
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr // Fallback to raw string
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onUnmounted(() => {
  destroyPreview()
  clearTimeout(copyTimer)
})
</script>
