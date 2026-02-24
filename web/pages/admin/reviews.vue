<template>
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <select v-model="status" @change="page=1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All statuses</option>
        <option value="processing">Processing</option>
        <option value="complete">Complete</option>
        <option value="failed">Failed</option>
      </select>
      <span class="text-xs text-stone-400" v-if="data">{{ data.pagination.total }} reviews</span>
    </div>

    <div v-if="error" class="text-xs text-red-600">Failed to load. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <!-- Stats strip -->
    <div v-if="data?.stats" class="flex items-center gap-4 mb-3 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="text-stone-500">{{ data.stats.complete }} complete</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-red-400"></span>
        <span class="text-stone-500">{{ data.stats.failed }} failed</span>
        <span v-if="data.stats.failed > 0 && data.stats.total > 0" class="text-red-400 font-medium">({{ ((data.stats.failed / data.stats.total) * 100).toFixed(1) }}%)</span>
      </div>
      <div v-if="data.stats.processing > 0" class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-yellow-400"></span>
        <span class="text-stone-500">{{ data.stats.processing }} processing</span>
      </div>
      <span class="w-px h-3 bg-stone-200"></span>
      <div class="text-stone-400">
        <span class="font-mono">${{ (data.stats.totalCostCents / 100).toFixed(2) }}</span> total cost
      </div>
      <div v-if="data.stats.avgCostCents" class="text-stone-400">
        avg <span class="font-mono">${{ (data.stats.avgCostCents / 100).toFixed(2) }}</span>/review
      </div>
      <div v-if="data.stats.avgDurationMs" class="text-stone-400">
        avg <span class="font-mono">{{ formatDuration(data.stats.avgDurationMs) }}</span>
      </div>
    </div>

    <!-- Table -->
    <div v-if="data" class="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-stone-200 bg-stone-50 text-left">
            <th class="py-2 px-3 font-medium text-stone-400">Status</th>
            <th class="py-2 px-3 font-medium text-stone-400">Slug</th>
            <th class="py-2 px-3 font-medium text-stone-400">Filename</th>
            <th class="py-2 px-3 font-medium text-stone-400">Email</th>
            <th class="py-2 px-3 font-medium text-stone-400">Domain</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Comments</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Cost</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Duration</th>
            <th class="py-2 px-3 font-medium text-stone-400">Created</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in data.reviews" :key="r.id"
            :class="r.status === 'failed' ? 'border-b border-red-100 bg-red-50/30 hover:bg-red-50/60' : 'border-b border-stone-50 hover:bg-stone-50/50'">
            <td class="py-2 px-3">
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                :class="{
                  'bg-emerald-50 text-emerald-700': r.status === 'complete',
                  'bg-yellow-50 text-yellow-700': r.status === 'processing',
                  'bg-red-50 text-red-700 cursor-pointer': r.status === 'failed',
                }"
                @click="r.status === 'failed' && toggleExpand(r.id)">
                <span class="w-1 h-1 rounded-full"
                  :class="{ 'bg-emerald-500': r.status === 'complete', 'bg-yellow-500': r.status === 'processing', 'bg-red-500': r.status === 'failed' }"></span>
                {{ r.status }}
                <svg v-if="r.status === 'failed' && r.rejectionReason" class="w-2.5 h-2.5 transition-transform" :class="expandedRows.has(r.id) && 'rotate-180'" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
                </svg>
              </span>
              <div v-if="r.status === 'failed' && expandedRows.has(r.id) && r.rejectionReason"
                class="mt-1 p-1.5 rounded bg-red-50 text-[10px] text-red-600 font-mono break-all max-w-xs max-h-32 overflow-auto whitespace-pre-wrap">{{ r.rejectionReason }}</div>
            </td>
            <td class="py-2 px-3">
              <a v-if="r.status === 'complete'" :href="`/review/${r.slug}`" target="_blank"
                class="font-mono text-stone-600 hover:text-stone-900 hover:underline">{{ r.slug }}</a>
              <span v-else class="font-mono text-stone-400">{{ r.slug }}</span>
            </td>
            <td class="py-2 px-3 text-stone-600 max-w-[150px] truncate">{{ r.filename || '-' }}</td>
            <td class="py-2 px-3 text-stone-600 max-w-[150px] truncate">{{ r.email || '-' }}</td>
            <td class="py-2 px-3 text-stone-400">{{ r.domainHint || '-' }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-600">
              {{ r.commentCount || '-' }}
              <span v-if="r.hasTimeout" class="text-yellow-500 ml-0.5" title="Agent timeout">!</span>
            </td>
            <td class="py-2 px-3 text-right font-mono text-stone-900">${{ (r.costCents / 100).toFixed(2) }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-400">{{ r.durationMs ? formatDuration(r.durationMs) : '-' }}</td>
            <td class="py-2 px-3 text-stone-400 font-mono whitespace-nowrap">{{ formatTime(r.createdAt) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Pagination -->
    <div v-if="data" class="flex items-center justify-between mt-3 text-xs text-stone-400">
      <span>Page {{ page }} of {{ data.pagination.pages || 1 }}</span>
      <div class="flex gap-2">
        <button :disabled="page <= 1" @click="page--; fetchData()"
          class="px-2 py-1 rounded border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors">Prev</button>
        <button :disabled="page >= data.pagination.pages" @click="page++; fetchData()"
          class="px-2 py-1 rounded border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors">Next</button>
      </div>
    </div>

    <div v-if="!data && !error" class="text-xs text-stone-400">Loading...</div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const status = ref('')
const page = ref(1)
const data = ref(null)
const error = ref(false)
const expandedRows = ref(new Set())

function toggleExpand(id) {
  const next = new Set(expandedRows.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expandedRows.value = next
}

function formatTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDuration(ms) {
  if (!ms) return '-'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes}m ${secs}s`
}

async function fetchData() {
  try {
    const query = { page: page.value }
    if (status.value) query.status = status.value
    data.value = await $fetch('/api/admin/reviews', { query })
  } catch {
    error.value = true
  }
}

await fetchData()
</script>
