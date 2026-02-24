<template>
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <select v-model="provider" @change="page=1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All providers</option>
        <option value="anthropic">Anthropic</option>
        <option value="openai">OpenAI</option>
        <option value="google">Google</option>
      </select>
      <select v-model="status" @change="page=1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All statuses</option>
        <option value="success">Success</option>
        <option value="error">Error</option>
      </select>
      <input v-model="userId" placeholder="User ID..." @input="debouncedFetch"
        class="px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none w-44 text-stone-900 placeholder-stone-400 font-mono">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-stone-400">From</span>
        <input v-model="dateFrom" type="date" @change="page=1; fetchData()"
          class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <span class="text-xs text-stone-400">To</span>
        <input v-model="dateTo" type="date" @change="page=1; fetchData()"
          class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
      </div>
      <span class="text-xs text-stone-400" v-if="data">{{ data.pagination.total }} calls</span>
    </div>

    <div v-if="error" class="text-xs text-red-600">Failed to load. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <!-- Status summary strip -->
    <div v-if="data && data.stats" class="flex items-center gap-4 mb-3 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="text-stone-500">{{ data.stats.success.toLocaleString() }} success</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-red-400"></span>
        <span class="text-stone-500">{{ data.stats.errors.toLocaleString() }} errors</span>
        <span v-if="data.stats.errors > 0" class="text-red-400 font-medium">({{ data.stats.errorRate }}%)</span>
      </div>
      <span class="w-px h-3 bg-stone-200"></span>
      <div class="text-stone-400">
        <span class="font-mono">{{ (data.stats.totalInput + data.stats.totalOutput).toLocaleString() }}</span> tokens
      </div>
      <div class="text-stone-400">
        <span class="font-mono">${{ (data.stats.totalCredits / 100).toFixed(2) }}</span> cost
      </div>
      <div v-if="data.stats.avgDuration" class="text-stone-400">
        avg <span class="font-mono">{{ data.stats.avgDuration.toLocaleString() }}</span>ms
      </div>
    </div>

    <div v-if="data" class="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <table class="w-full text-xs">
        <thead>
          <tr class="border-b border-stone-200 bg-stone-50 text-left">
            <th class="py-2 px-3 font-medium text-stone-400">User</th>
            <th class="py-2 px-3 font-medium text-stone-400">Provider</th>
            <th class="py-2 px-3 font-medium text-stone-400">Model</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">In</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Out</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">Cost</th>
            <th class="py-2 px-3 font-medium text-stone-400 text-right">ms</th>
            <th class="py-2 px-3 font-medium text-stone-400">Status</th>
            <th class="py-2 px-3 font-medium text-stone-400">Time</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="c in data.calls" :key="c.id"
            :class="c.status === 'error' ? 'border-b border-red-100 bg-red-50/30 hover:bg-red-50/60' : 'border-b border-stone-50 hover:bg-stone-50/50'">
            <td class="py-2 px-3 font-mono text-stone-600">{{ c.user_email || c.user_id?.slice(0, 8) }}</td>
            <td class="py-2 px-3 capitalize text-stone-600">{{ c.provider }}</td>
            <td class="py-2 px-3 font-mono text-stone-900 text-[10px]">{{ c.model || '-' }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-600">{{ (c.input_tokens || 0).toLocaleString() }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-600">{{ (c.output_tokens || 0).toLocaleString() }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-900">${{ ((c.credits_used || 0) / 100).toFixed(2) }}</td>
            <td class="py-2 px-3 text-right font-mono text-stone-400">{{ c.duration_ms ? c.duration_ms.toLocaleString() : '-' }}</td>
            <td class="py-2 px-3">
              <span v-if="c.status === 'success'"
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-50 text-emerald-700">
                <span class="w-1 h-1 rounded-full bg-emerald-500"></span>OK
              </span>
              <span v-else
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 cursor-pointer"
                @click="c._expanded = !c._expanded">
                <span class="w-1 h-1 rounded-full bg-red-500"></span>Error
                <svg v-if="c.error_message" class="w-2.5 h-2.5 transition-transform" :class="c._expanded && 'rotate-180'" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
                </svg>
              </span>
              <div v-if="c.status === 'error' && c.error_message && c._expanded"
                class="mt-1 p-1.5 rounded bg-red-50 text-[10px] text-red-600 font-mono break-all max-w-xs max-h-32 overflow-auto whitespace-pre-wrap">{{ c.error_message }}</div>
            </td>
            <td class="py-2 px-3 text-stone-400 font-mono whitespace-nowrap">{{ formatTime(c.created_at) }}</td>
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

const route = useRoute()

const provider = ref('')
const status = ref('')
const userId = ref(route.query.userId || '')
const dateFrom = ref('')
const dateTo = ref('')
const page = ref(1)
const data = ref(null)
const error = ref(false)
let timer = null

function formatTime(iso) {
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function debouncedFetch() {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; fetchData() }, 300)
}

async function fetchData() {
  try {
    const query = { page: page.value, provider: provider.value, status: status.value }
    if (userId.value) query.userId = userId.value
    if (dateFrom.value) query.from = dateFrom.value
    if (dateTo.value) query.to = dateTo.value
    data.value = await $fetch('/api/admin/calls', { query })
  } catch {
    error.value = true
  }
}

await fetchData()
</script>
