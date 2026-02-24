<template>
  <footer class="grid items-center px-3 text-xs select-none shrink-0"
    style="grid-template-columns: 1fr auto 1fr; background: var(--bg-secondary); border-top: 1px solid var(--border); color: var(--fg-muted); height: 30px; font-variant-numeric: tabular-nums;">

    <!-- LEFT: source control + AI review -->
    <div class="flex items-center gap-4 justify-self-start whitespace-nowrap">
      <!-- Git branch -->
      <span v-if="gitBranchName" class="flex items-center gap-1">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z"/>
        </svg>
        {{ gitBranchName }}
      </span>

      <!-- Sync status -->
      <span
        v-if="workspace.githubUser"
        ref="syncTriggerRef"
        class="flex items-center gap-1 cursor-pointer hover:opacity-80"
        :style="{ color: syncColor }"
        @click="toggleSyncPopover"
        :title="syncTooltip"
      >
        <!-- Cloud icon variations -->
        <!-- Synced: plain cloud, muted -->
        <svg v-if="workspace.syncStatus === 'synced'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
        </svg>
        <!-- Syncing: cloud with arrows, subtle pulse -->
        <svg v-else-if="workspace.syncStatus === 'syncing'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="sync-pulse">
          <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
          <path d="M11 13l-2 2 2 2M13 11l2-2-2-2"/>
        </svg>
        <!-- Error/conflict: cloud with ! -->
        <svg v-else-if="workspace.syncStatus === 'error' || workspace.syncStatus === 'conflict'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
          <path d="M12 9v4M12 17h.01"/>
        </svg>
        <!-- Idle/disconnected: cloud with slash, dimmed -->
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4;">
          <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/>
          <path d="M4 20L20 4"/>
        </svg>
      </span>

      <!-- Separator -->
      <div v-if="gitBranchName" class="w-px h-3 shrink-0" style="background: var(--border);"></div>

      <!-- Review mode -->
       <div>
       <span>Mode: </span>
      <span
        class="cursor-pointer hover:opacity-80 font-medium tracking-wide"
        :style="{ color: reviews.directMode ? 'var(--warning)' : 'var(--fg-muted)' }"
        @click="reviews.toggleDirectMode()"
        :title="reviews.directMode ? 'Direct mode: Claude edits files directly' : 'Review mode: Claude edits are queued for review'">
        {{ reviews.directMode ? 'DIRECT' : 'REVIEW' }}
      </span>
    </div>

      <!-- Pending changes -->
      <span v-if="reviews.pendingCount > 0"
        ref="pendingTriggerRef"
        class="flex items-center gap-1 cursor-pointer hover:opacity-80 ml-1"
        style="color: var(--warning);"
        @click="togglePendingPopover">
        {{ reviews.pendingCount }} change{{ reviews.pendingCount !== 1 ? 's' : '' }}
      </span>
    </div>

    <!-- CENTER: zoom control OR save confirmation OR transient message (crossfade) -->
    <div class="footer-center justify-self-center">
      <!-- Zoom controls (default) -->
      <div class="footer-center-layer" :class="{ 'footer-center-hidden': saveConfirmationActive || centerMessage }">
        <button
          class="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors border-none bg-transparent"
          style="color: var(--fg-muted);"
          @click="workspace.zoomOut()"
          :title="`Zoom out (${modKey}+-)`"
          @mouseover="$event.target.style.color='var(--fg-primary)'"
          @mouseout="$event.target.style.color='var(--fg-muted)'"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M2 5h6"/></svg>
        </button>
        <button
          ref="zoomTriggerRef"
          class="min-w-[36px] text-center text-[11px] px-0.5 bg-transparent border-none cursor-pointer transition-colors"
          :style="{ color: zoomPercent !== 100 ? 'var(--accent)' : 'var(--fg-muted)' }"
          style="font-family: inherit;"
          @click="toggleZoomPopover"
          :title="`Zoom level (${modKey}+0 to reset)`"
          @mouseover="$event.target.style.color='var(--fg-primary)'"
          @mouseout="$event.target.style.color = zoomPercent !== 100 ? 'var(--accent)' : 'var(--fg-muted)'"
        >
          {{ zoomPercent }}%
        </button>
        <button
          class="w-5 h-5 flex items-center justify-center rounded cursor-pointer transition-colors border-none bg-transparent"
          style="color: var(--fg-muted);"
          @click="workspace.zoomIn()"
          :title="`Zoom in (${modKey}+=)`"
          @mouseover="$event.target.style.color='var(--fg-primary)'"
          @mouseout="$event.target.style.color='var(--fg-muted)'"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M5 2v6M2 5h6"/></svg>
        </button>
      </div>

      <!-- Save confirmation (shown during 8s window) -->
      <div class="footer-center-layer flex items-center gap-1" :class="{ 'footer-center-hidden': !saveConfirmationActive }">
      
        <IconCheck width="12" height="12" style="color: var(--success);" />
        <div class="font-medium text-sm pe-2" style="color: var(--success);">
          Saved
        </div>
        <div
          class="cursor-pointer underline hover:opacity-80 text-sm font-medium"
          style="color: var(--accent);"
          @click="openSnapshotDialog"
        >Name this version?</div>
      </div>

      <!-- Transient center message (e.g. "All saved (no changes)") -->
      <div class="footer-center-layer" :class="{ 'footer-center-hidden': !centerMessage }">
        <span class="flex items-center gap-1.5" style="color: var(--success);">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>
          {{ centerMessage }}
        </span>
      </div>
    </div>

    <!-- Snapshot naming dialog -->
    <SnapshotDialog
      :visible="snapshotDialogVisible"
      @resolve="onSnapshotResolve"
    />

    <!-- RIGHT: tools + editor info -->
    <div class="flex items-center gap-2 justify-self-end whitespace-nowrap">
      <!-- Tools -->
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:opacity-80 bg-transparent border-none cursor-pointer"
        style="color: var(--fg-muted);"
        @click="showShortcuts = !showShortcuts"
        title="Keyboard shortcuts"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="1" y="4" width="14" height="9" rx="1.5"/>
          <path d="M4 7h1M7 7h2M11 7h1M5 10h6"/>
        </svg>
      </button>
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:opacity-80 bg-transparent border-none cursor-pointer"
        :style="{ color: workspace.softWrap ? 'var(--accent)' : 'var(--fg-muted)' }"
        @click="workspace.toggleSoftWrap()"
        :title="workspace.softWrap ? 'Word wrap: on' : 'Word wrap: off'"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 3h12"/>
          <path d="M2 7h10a2 2 0 010 4H8"/>
          <path d="M10 13l-2-2 2-2"/>
          <path d="M2 11h3"/>
        </svg>
      </button>

      <!-- Separator -->
      <div class="w-px h-3 shrink-0" style="background: var(--border);"></div>

      <!-- Billing context display (follows selected model's route) -->
      <template v-if="usageStore.showInFooter && footerBillingVisible">
        <!-- Shoulders balance (when selected model routes through Shoulders) -->
        <span
          v-if="billingRoute?.route === 'shoulders' && shouldersBalance !== null"
          class="cursor-pointer hover:opacity-80"
          :style="{ color: shouldersBalanceColor }"
          title="Shoulders account balance"
          @click="$emit('open-settings', 'account')">
          <span class="font-mono font-bold tracking-tight pr-1">{{ formatCents(shouldersBalance) }}</span>
          <span class="tracking-tight">Credits remaining</span>
        </span>
        <!-- Direct key estimate (when selected model routes through API key) -->
        <span
          v-else-if="billingRoute?.route === 'direct'"
          class="cursor-pointer hover:opacity-80"
          :style="{ color: usageStore.isOverBudget ? 'var(--error)' : usageStore.isNearBudget ? 'var(--warning)' : 'var(--fg-muted)' }"
          title="Estimated API cost this month — check provider dashboards for actual charges"
          @click="$emit('open-settings', 'models')">
          ~{{ formatCost(usageStore.directCost) }} this month
        </span>
        <div class="w-px h-3 shrink-0" style="background: var(--border);"></div>
      </template>

      <!-- Editor stats -->
      <span v-if="saveMessage"
        class="transition-opacity"
        :style="{ color: 'var(--success)', opacity: saveMessageFading ? 0 : 1 }">
        {{ saveMessage }}
      </span>
      <template v-if="stats.words > 0">
        <span v-if="stats.selWords > 0" style="color: var(--accent);">
          {{ stats.selWords }} words
        </span>
        <span v-else style="color: var(--fg-muted);">{{ stats.words.toLocaleString() }} words</span>
        <span v-if="stats.selChars > 0" style="color: var(--accent);">
          {{ stats.selChars.toLocaleString() }} chars
        </span>
        <span v-else style="color: var(--fg-muted);">{{ stats.chars.toLocaleString() }} chars</span>
      </template>
      <span v-if="cursorPos.line" style="color: var(--fg-muted);">Ln {{ cursorPos.line }}, Col {{ cursorPos.col }}</span>
    </div>
  </footer>

  <!-- Shortcuts popover -->
  <Teleport to="body">
    <div v-if="showShortcuts" class="fixed inset-0 z-50" @click="showShortcuts = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 300px; bottom: 44px; right: 12px;"
        @click.stop>
        <div class="px-3 py-2 text-xs font-medium uppercase tracking-wider"
          style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
          Keyboard Shortcuts
        </div>
        <div class="px-3 py-2 space-y-1.5 text-xs" style="color: var(--fg-secondary);">
          <div class="flex justify-between"><span>Toggle left sidebar</span><kbd>{{ modKey }}+B</kbd></div>
          <div class="flex justify-between"><span>Toggle right sidebar</span><kbd>{{ modKey }}+J</kbd></div>
          <div class="flex justify-between"><span>Quick open</span><kbd>{{ modKey }}+P</kbd></div>
          <div class="flex justify-between"><span>Save &amp; commit</span><kbd>{{ modKey }}+S</kbd></div>
          <div class="flex justify-between"><span>Close tab</span><kbd>{{ modKey }}+W</kbd></div>
          <div class="flex justify-between"><span>Split vertical</span><kbd>{{ modKey }}+\</kbd></div>
          <div class="flex justify-between"><span>Split horizontal</span><kbd>{{ modKey }}+Shift+\</kbd></div>
          <div class="flex justify-between"><span>Add task</span><kbd>{{ modKey }}+Shift+C</kbd></div>
          <div class="flex justify-between"><span>AI Chat</span><kbd>{{ modKey }}+Shift+L</kbd></div>
          <div class="flex justify-between"><span>Zoom in</span><kbd>{{ modKey }}+=</kbd></div>
          <div class="flex justify-between"><span>Zoom out</span><kbd>{{ modKey }}+-</kbd></div>
          <div class="flex justify-between"><span>Reset zoom</span><kbd>{{ modKey }}+0</kbd></div>
          <div class="flex justify-between"><span>Toggle word wrap</span><kbd>{{ altKey }}+Z</kbd></div>
          <div class="mt-2 pt-2" style="border-top: 1px solid var(--border); color: var(--fg-muted);">File Explorer</div>
          <div class="flex justify-between"><span>Navigate</span><kbd>↑ / ↓</kbd></div>
          <div class="flex justify-between"><span>Expand folder</span><kbd>→</kbd></div>
          <div class="flex justify-between"><span>Collapse / parent</span><kbd>←</kbd></div>
          <div class="flex justify-between"><span>Open</span><kbd>Space</kbd></div>
          <div class="flex justify-between"><span>Rename</span><kbd>Enter</kbd></div>
          <div class="mt-2 pt-2" style="border-top: 1px solid var(--border); color: var(--fg-muted);">Ghost Suggestions</div>
          <div class="flex justify-between"><span>Trigger</span><kbd>++</kbd></div>
          <div class="flex justify-between"><span>Accept</span><kbd>Tab / Enter / Right</kbd></div>
          <div class="flex justify-between"><span>Cycle</span><kbd>Up / Down</kbd></div>
          <div class="flex justify-between"><span>Cancel</span><kbd>Esc / Left / click</kbd></div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Zoom level popover -->
  <Teleport to="body">
    <div v-if="showZoomPopover" class="fixed inset-0 z-50" @click="showZoomPopover = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        :style="zoomPopoverPos"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); width: 120px;"
        @click.stop>
        <div class="py-1">
          <div v-for="level in zoomPresets" :key="level"
            class="px-3 py-1.5 text-xs cursor-pointer flex items-center justify-between hover:bg-[var(--bg-hover)]"
            :style="{ color: level === zoomPercent ? 'var(--accent)' : 'var(--fg-secondary)' }"
            @click="selectZoom(level)">
            <span>{{ level }}%</span>
            <span v-if="level === 100" class="text-[10px]" style="color: var(--fg-muted);">default</span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Pending changes popover -->
  <Teleport to="body">
    <div v-if="showPendingPopover" class="fixed inset-0 z-50" @click="showPendingPopover = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        :style="pendingPopoverPos"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4); min-width: 200px; max-width: 360px;"
        @click.stop>
        <div class="px-3 py-2 text-xs font-medium uppercase tracking-wider"
          style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
          Pending Changes
        </div>
        <div class="py-1 max-h-48 overflow-y-auto">
          <div v-for="file in reviews.filesWithEdits" :key="file"
            class="px-3 py-1.5 text-xs cursor-pointer flex items-center gap-2 hover:bg-[var(--bg-hover)]"
            style="color: var(--fg-secondary);"
            :title="file"
            @click="openPendingFile(file)">
            <span class="truncate">{{ file.split('/').pop() }}</span>
            <span class="ml-auto text-[10px] shrink-0 px-1.5 rounded-full"
              style="background: rgba(224, 175, 104, 0.2); color: var(--warning);">
              {{ reviews.editsForFile(file).length }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Sync popover -->
  <Teleport to="body">
    <div v-if="showSyncPopover" class="fixed inset-0 z-50" @click="showSyncPopover = false">
      <div class="fixed z-50 rounded-lg border overflow-hidden"
        :style="syncPopoverPos"
        style="background: var(--bg-secondary); border-color: var(--border); box-shadow: 0 8px 24px rgba(0,0,0,0.4);"
        @click.stop>
        <SyncPopover
          @sync-now="handleSyncNow"
          @refresh="handleSyncRefresh"
          @open-settings="handleOpenGitHubSettings"
        />
      </div>
    </div>
  </Teleport>

  <!-- Conflict dialog -->
  <GitHubConflictDialog
    :visible="showConflictDialog"
    @close="showConflictDialog = false"
  />
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useWorkspaceStore } from '../../stores/workspace'
import { useReviewsStore } from '../../stores/reviews'
import { useEditorStore } from '../../stores/editor'
import { useUsageStore } from '../../stores/usage'
import { useToastStore } from '../../stores/toast'
import { getBillingRoute } from '../../services/apiClient'
import { gitBranch } from '../../services/git'
import { modKey, altKey } from '../../platform'
import SyncPopover from './SyncPopover.vue'
import SnapshotDialog from './SnapshotDialog.vue'
import GitHubConflictDialog from '../GitHubConflictDialog.vue'
import { IconCheck } from '@tabler/icons-vue'

const emit = defineEmits(['open-settings'])

const workspace = useWorkspaceStore()
const reviews = useReviewsStore()
const editorStore = useEditorStore()
const usageStore = useUsageStore()
const toastStore = useToastStore()

const gitBranchName = ref('')
const stats = ref({ words: 0, chars: 0, selWords: 0, selChars: 0 })
const cursorPos = ref({ line: 0, col: 0 })
const saveMessage = ref('')
const saveMessageFading = ref(false)
let saveTimer = null
const showShortcuts = ref(false)
const showPendingPopover = ref(false)
const pendingTriggerRef = ref(null)
const pendingPopoverPos = ref({})
const showSyncPopover = ref(false)
const syncTriggerRef = ref(null)
const syncPopoverPos = ref({})
const showConflictDialog = ref(false)
const showZoomPopover = ref(false)
const zoomTriggerRef = ref(null)
const zoomPopoverPos = ref({})
const zoomPresets = [75, 80, 90, 100, 110, 125, 150]
const zoomPercent = computed(() => Math.round(workspace.editorFontSize / 14 * 100))

// Save confirmation state (center section swap)
const saveConfirmationActive = ref(false)
const snapshotDialogVisible = ref(false)
let saveConfirmationTimer = null
let saveConfirmationResolve = null

// Transient center message (e.g. "All saved (no changes)")
const centerMessage = ref('')
let centerMessageTimer = null

// Model-aware billing route
const billingRoute = computed(() => {
  if (!workspace.selectedModelId) return null
  return getBillingRoute(workspace.selectedModelId, workspace)
})

// Shoulders balance (for route=shoulders display)
const shouldersBalance = computed(() => {
  if (!workspace.shouldersAuth?.token) return null
  const credits = workspace.shouldersAuth.credits
  return typeof credits === 'number' ? credits : null
})

// Footer shows billing when the current model's route has something to show
const footerBillingVisible = computed(() => {
  const route = billingRoute.value
  if (!route) return false
  if (route.route === 'shoulders') return shouldersBalance.value !== null
  if (route.route === 'direct') return usageStore.showCostEstimates && usageStore.directCost > 0
  return false
})

// Color thresholds for Shoulders balance
const shouldersBalanceColor = computed(() => {
  const cents = shouldersBalance.value ?? 0
  if (cents < 25) return 'var(--error)'
  if (cents < 100) return 'var(--warning)'
  return 'var(--fg-muted)'
})

function formatCents(cents) {
  if (cents == null) return '$0.00'
  return '$' + (cents / 100).toFixed(2)
}

function formatCost(val) {
  if (!val) return '$0.00'
  return '$' + val.toFixed(2)
}

const syncColor = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return 'var(--fg-muted)'
    case 'syncing': return 'var(--fg-muted)'
    case 'error': return 'var(--error)'
    case 'conflict': return 'var(--warning)'
    default: return 'var(--fg-muted)'
  }
})

const syncTooltip = computed(() => {
  switch (workspace.syncStatus) {
    case 'synced': return 'Synced with GitHub'
    case 'syncing': return 'Syncing with GitHub...'
    case 'conflict': return 'Needs your input — click for details'
    case 'error': return 'Needs attention — click for details'
    case 'idle': return 'GitHub: connected'
    default: return 'GitHub: not connected'
  }
})

function toggleSyncPopover() {
  showSyncPopover.value = !showSyncPopover.value
  if (showSyncPopover.value) {
    nextTick(() => {
      const rect = syncTriggerRef.value?.getBoundingClientRect()
      if (rect) {
        syncPopoverPos.value = {
          bottom: (window.innerHeight - rect.top + 4) + 'px',
          left: rect.left + 'px',
        }
      }
    })
  }
}

async function handleSyncNow() {
  showSyncPopover.value = false
  await workspace.syncNow()
}

async function handleSyncRefresh() {
  showSyncPopover.value = false
  await workspace.fetchRemoteChanges()
}

function handleOpenGitHubSettings() {
  showSyncPopover.value = false
  emit('open-settings', 'github')
}

// Show conflict dialog and toasts when sync status changes
watch(() => workspace.syncStatus, (status) => {
  if (status === 'conflict') {
    showConflictDialog.value = true
    toastStore.showOnce('sync-conflict', 'Your changes conflict with updates on GitHub. Click to resolve.', {
      type: 'warning',
      duration: 8000,
      action: { label: 'Resolve', onClick: () => { showConflictDialog.value = true } },
    })
  } else if (status === 'error') {
    const errorType = workspace.syncErrorType
    if (errorType === 'auth') {
      toastStore.showOnce('sync-auth', 'GitHub connection expired. Reconnect in Settings.', {
        type: 'error',
        duration: 8000,
        action: { label: 'Settings', onClick: () => emit('open-settings', 'github') },
      })
    } else if (errorType === 'network') {
      // Network errors are quiet — no toast, just icon change
    } else {
      toastStore.showOnce('sync-error', workspace.syncError || 'Sync failed. Click for details.', {
        type: 'error',
        duration: 6000,
        action: { label: 'Details', onClick: () => { toggleSyncPopover() } },
      })
    }
  }
})

function togglePendingPopover() {
  showPendingPopover.value = !showPendingPopover.value
  if (showPendingPopover.value) {
    nextTick(() => {
      const rect = pendingTriggerRef.value?.getBoundingClientRect()
      if (rect) {
        pendingPopoverPos.value = {
          bottom: (window.innerHeight - rect.top + 4) + 'px',
          left: rect.left + 'px',
        }
      }
    })
  }
}

function toggleZoomPopover() {
  showZoomPopover.value = !showZoomPopover.value
  if (showZoomPopover.value) {
    nextTick(() => {
      const rect = zoomTriggerRef.value?.getBoundingClientRect()
      if (rect) {
        zoomPopoverPos.value = {
          bottom: (window.innerHeight - rect.top + 4) + 'px',
          left: (rect.left + rect.width / 2 - 60) + 'px',
        }
      }
    })
  }
}

function selectZoom(level) {
  workspace.setZoomPercent(level)
  showZoomPopover.value = false
}

function openPendingFile(file) {
  editorStore.openFile(file)
  showPendingPopover.value = false
}

// Auto-close popover when no more pending edits
watch(() => reviews.pendingCount, (count) => {
  if (count === 0) showPendingPopover.value = false
})

function showSaveMessage(msg) {
  saveMessage.value = msg
  saveMessageFading.value = false
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveMessageFading.value = true
    setTimeout(() => {
      saveMessage.value = ''
      saveMessageFading.value = false
    }, 500)
  }, 2000)
}

function showCenterMessage(msg, duration = 2000) {
  clearTimeout(centerMessageTimer)
  centerMessage.value = msg
  centerMessageTimer = setTimeout(() => {
    centerMessage.value = ''
  }, duration)
}

function beginSaveConfirmation() {
  // Cancel any previous confirmation
  clearSaveConfirmation(null)

  return new Promise((resolve) => {
    saveConfirmationResolve = resolve
    saveConfirmationActive.value = true

    saveConfirmationTimer = setTimeout(() => {
      // Timeout — resolve with null (auto-commit with timestamp)
      clearSaveConfirmation(null)
    }, 8000)
  })
}

function openSnapshotDialog() {
  // Pause the timeout while dialog is open
  clearTimeout(saveConfirmationTimer)
  saveConfirmationTimer = null
  snapshotDialogVisible.value = true
}

function onSnapshotResolve(name) {
  snapshotDialogVisible.value = false
  clearSaveConfirmation(name)
}

function clearSaveConfirmation(result) {
  clearTimeout(saveConfirmationTimer)
  saveConfirmationTimer = null
  saveConfirmationActive.value = false
  if (saveConfirmationResolve) {
    const resolve = saveConfirmationResolve
    saveConfirmationResolve = null
    resolve(result)
  }
}

// Expose methods for editor to call
defineExpose({
  setEditorStats(s) {
    stats.value = s
  },
  setCursorPos(pos) {
    cursorPos.value = pos
  },
  showSaveMessage,
  showCenterMessage,
  beginSaveConfirmation,
})

let branchInterval = null

async function updateBranch() {
  if (workspace.path) {
    gitBranchName.value = await gitBranch(workspace.path)
  }
}

onMounted(() => {
  updateBranch()
  branchInterval = setInterval(updateBranch, 10000)
})

onUnmounted(() => {
  clearInterval(branchInterval)
})
</script>

<style scoped>
.sync-pulse {
  animation: syncPulse 2s ease-in-out infinite;
}
@keyframes syncPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
