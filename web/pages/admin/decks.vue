<template>
  <div>
    <div v-if="error" class="text-sm text-red-600">Failed to load data. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <div v-else-if="shares">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <span class="text-xs text-stone-400">{{ shares.length }} share{{ shares.length !== 1 ? 's' : '' }}</span>
        </div>
        <div class="flex items-center gap-2">
          <button
            @click="fetchData"
            :disabled="loading"
            class="px-2 py-1.5 text-xs rounded border border-stone-200 bg-white hover:bg-stone-50 text-stone-600 disabled:opacity-30 transition-colors"
          >
            Refresh
          </button>
          <button
            @click="showNewShareForm = true"
            class="px-3 py-1.5 text-xs rounded bg-stone-900 text-white hover:bg-stone-800 transition-colors"
          >
            + New Share
          </button>
        </div>
      </div>

      <!-- Stats strip -->
      <div v-if="shares.length > 0" class="flex items-center gap-4 mb-3 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs">
        <div class="text-stone-500">
          <span class="font-mono font-medium text-stone-900">{{ totalSessions }}</span> sessions
        </div>
        <span class="w-px h-3 bg-stone-200"></span>
        <div class="text-stone-500">
          <span class="font-mono font-medium text-stone-900">{{ formatDuration(totalTime) }}</span> total view time
        </div>
        <span class="w-px h-3 bg-stone-200"></span>
        <div class="text-stone-500">
          <span class="font-mono font-medium text-stone-900">{{ activeShares }}</span> active
        </div>
      </div>

      <!-- New Share Form -->
      <div v-if="showNewShareForm" class="mb-4 p-4 bg-white border border-stone-200 rounded-lg">
        <div class="text-xs font-medium text-stone-900 mb-3">Create New Share</div>
        <div class="flex items-end gap-3">
          <div class="flex-1">
            <label class="block text-[10px] text-stone-400 uppercase tracking-wider mb-1">Recipient</label>
            <input
              v-model="newRecipient"
              type="text"
              class="w-full px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 focus:ring-1 focus:ring-stone-400 outline-none text-stone-900 placeholder-stone-400"
              placeholder="e.g., Sequoia - John Smith"
              autofocus
            />
          </div>
          <button
            @click="createShare"
            :disabled="!newRecipient || saving"
            class="px-3 py-1.5 text-xs rounded bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-30 transition-colors"
          >
            {{ saving ? 'Creating...' : 'Create' }}
          </button>
          <button
            @click="showNewShareForm = false; newRecipient = ''"
            class="px-3 py-1.5 text-xs rounded border border-stone-200 hover:bg-stone-50 text-stone-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- Shares List -->
      <div v-if="shares.length === 0" class="p-8 text-center text-xs text-stone-400 bg-white border border-stone-200 rounded-lg">
        No deck shares yet. Create one to get started.
      </div>

      <div class="space-y-2">
        <div
          v-for="share in shares"
          :key="share.id"
          class="bg-white border border-stone-200 rounded-lg overflow-hidden"
        >
          <!-- Share Row (always visible, clickable to expand) -->
          <div
            class="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-stone-50/50 transition-colors"
            @click="toggleExpand(share.id)"
          >
            <div class="flex items-center gap-3 min-w-0">
              <svg class="w-3.5 h-3.5 text-stone-400 shrink-0 transition-transform" :class="expandedShares.has(share.id) && 'rotate-90'" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clip-rule="evenodd"/>
              </svg>
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-medium text-stone-900">{{ share.recipient }}</span>
                </div>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <code class="text-[10px] text-stone-400 font-mono truncate">{{ share.url }}</code>
                  <button
                    @click.stop="copyUrl(share)"
                    class="text-stone-400 hover:text-stone-600 transition-colors shrink-0"
                    :title="copied === share.id ? 'Copied!' : 'Copy URL'"
                  >
                    <svg v-if="copied === share.id" class="w-3 h-3 text-emerald-500" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clip-rule="evenodd"/>
                    </svg>
                    <svg v-else class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z"/>
                      <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            <!-- Summary stats -->
            <div class="flex items-center gap-5 shrink-0">
              <div class="text-right">
                <div class="text-xs font-mono text-stone-900">{{ share.session_count }}</div>
                <div class="text-[10px] text-stone-400">session{{ share.session_count !== 1 ? 's' : '' }}</div>
              </div>
              <div class="text-right">
                <div class="text-xs font-mono text-stone-900">{{ formatDuration(share.total_time_seconds) }}</div>
                <div class="text-[10px] text-stone-400">total</div>
              </div>
              <div class="text-right min-w-[56px]">
                <div class="text-xs font-mono text-stone-400">{{ formatDate(share.created_at) }}</div>
                <div class="text-[10px] text-stone-400">created</div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-1" @click.stop>
                <button
                  v-if="share.session_count > 0"
                  @click="clearSessions(share.id)"
                  class="p-1 text-stone-400 hover:text-amber-600 rounded transition-colors"
                  title="Clear sessions"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 20H7L3 16l5-5 5 5 4-4 3 3v5z"/><path d="M18 7l-3-3-3 3"/>
                  </svg>
                </button>
                <button
                  @click="deleteShare(share.id)"
                  class="p-1 text-stone-400 hover:text-red-600 rounded transition-colors"
                  title="Delete share"
                >
                  <svg class="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clip-rule="evenodd"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <!-- Expanded: Views Detail -->
          <div v-if="expandedShares.has(share.id)" class="px-4 py-3 border-t border-stone-100 bg-stone-50/50">
            <div v-if="share.views.length === 0" class="text-[10px] text-stone-400">
              No views yet
            </div>
            <div v-else class="space-y-3">
              <div
                v-for="(view, vi) in share.views"
                :key="view.session_id"
                class="bg-white border border-stone-100 rounded p-3"
              >
                <div class="flex items-center gap-2 mb-2 text-[10px] text-stone-500">
                  <span class="font-mono">{{ formatDateTime(view.started_at) }}</span>
                  <span class="text-stone-300">&middot;</span>
                  <span class="font-mono font-medium text-stone-700">{{ formatDuration(view.total_seconds) }}</span>
                  <span class="text-stone-300">&middot;</span>
                  <span>{{ parseBrowser(view.user_agent) }}</span>
                  <template v-if="view.referrer">
                    <span class="text-stone-300">&middot;</span>
                    <span>from {{ parseReferrer(view.referrer) }}</span>
                  </template>
                </div>
                <!-- Slide time bars -->
                <div class="space-y-0.5 max-w-md">
                  <div
                    v-for="slideNum in getTotalSlides()"
                    :key="slideNum"
                    class="flex items-center gap-1.5"
                  >
                    <span class="text-[9px] text-stone-400 w-4 text-right font-mono">{{ slideNum }}</span>
                    <div class="flex-1 h-2.5 bg-stone-100 rounded-sm overflow-hidden">
                      <div
                        class="h-full bg-stone-400 rounded-sm transition-all"
                        :style="{ width: `${Math.min(100, ((view.slide_times[slideNum] || 0) / maxSlideTime(view)) * 100)}%` }"
                      />
                    </div>
                    <span class="text-[9px] text-stone-500 w-6 font-mono text-right">{{ view.slide_times[slideNum] || 0 }}s</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-xs text-stone-400">Loading...</div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const shares = ref(null)
const loading = ref(false)
const error = ref(false)
const showNewShareForm = ref(false)
const newRecipient = ref('')
const saving = ref(false)
const copied = ref(null)
const expandedShares = ref(new Set())

const totalSessions = computed(() => {
  if (!shares.value) return 0
  return shares.value.reduce((sum, s) => sum + s.session_count, 0)
})

const totalTime = computed(() => {
  if (!shares.value) return 0
  return shares.value.reduce((sum, s) => sum + s.total_time_seconds, 0)
})

const activeShares = computed(() => {
  if (!shares.value) return 0
  return shares.value.filter(s => s.is_active).length
})

function toggleExpand(shareId) {
  const next = new Set(expandedShares.value)
  if (next.has(shareId)) next.delete(shareId)
  else next.add(shareId)
  expandedShares.value = next
}

async function fetchData() {
  loading.value = true
  try {
    const result = await $fetch('/api/admin/decks')
    shares.value = result.shares || []
  } catch (e) {
    error.value = true
  } finally {
    loading.value = false
  }
}

async function createShare() {
  if (!newRecipient.value) return
  saving.value = true
  try {
    await $fetch('/api/admin/decks', {
      method: 'POST',
      body: {
        recipient: newRecipient.value,
        deck_name: 'deck-antler'
      }
    })
    await fetchData()
    showNewShareForm.value = false
    newRecipient.value = ''
  } catch (e) {
    console.error('Failed to create share:', e)
  } finally {
    saving.value = false
  }
}

async function deleteShare(id) {
  if (!confirm('Delete this share? All view data will be lost.')) return
  try {
    await $fetch(`/api/admin/decks/${id}`, { method: 'DELETE' })
    await fetchData()
  } catch (e) {
    console.error('Failed to delete share:', e)
  }
}

async function clearSessions(id) {
  if (!confirm('Clear all sessions for this share?')) return
  try {
    await $fetch(`/api/admin/decks/${id}/clear`, { method: 'POST' })
    await fetchData()
  } catch (e) {
    console.error('Failed to clear sessions:', e)
  }
}

async function copyUrl(share) {
  const fullUrl = `${window.location.origin}${share.url}`
  try {
    await navigator.clipboard.writeText(fullUrl)
    copied.value = share.id
    setTimeout(() => { copied.value = null }, 2000)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

function maxSlideTime(view) {
  const times = Object.values(view.slide_times || {})
  return Math.max(...times, 1)
}

function getTotalSlides() {
  return 11
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now - date
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (diffHours < 1) return 'just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function formatDateTime(dateStr) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(seconds) {
  if (!seconds) return '0s'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  if (mins < 60) return `${mins}m ${secs}s`
  const hours = Math.floor(mins / 60)
  return `${hours}h ${mins % 60}m`
}

function parseBrowser(userAgent) {
  if (!userAgent) return 'Unknown'
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) return 'Chrome'
  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return 'Safari'
  if (userAgent.includes('Firefox')) return 'Firefox'
  if (userAgent.includes('Edg')) return 'Edge'
  return 'Other'
}

function parseReferrer(referrer) {
  if (!referrer) return null
  try {
    const url = new URL(referrer)
    return url.hostname.replace('www.', '')
  } catch {
    return referrer
  }
}

await fetchData()
</script>
