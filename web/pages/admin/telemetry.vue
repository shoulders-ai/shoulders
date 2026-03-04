<template>
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <select v-model="eventType" @change="page=1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All events</option>
        <option value="app_open">app_open</option>
        <option value="workspace_open">workspace_open</option>
        <option value="file_open">file_open</option>
        <option value="chat_send">chat_send</option>
        <option value="ghost_trigger">ghost_trigger</option>
        <option value="ghost_accept">ghost_accept</option>
        <option value="ref_import">ref_import</option>
        <option value="theme_change">theme_change</option>
        <option value="export_pdf">export_pdf</option>
        <option value="error">error</option>
      </select>
      <select v-model="platform" @change="page=1; fetchData()"
        class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <option value="">All platforms</option>
        <option value="macos">macOS</option>
        <option value="windows">Windows</option>
        <option value="linux">Linux</option>
      </select>
      <input v-model="deviceId" placeholder="Device ID..." @input="debouncedFetch"
        class="px-3 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none w-44 text-stone-900 placeholder-stone-400 font-mono">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-stone-400">From</span>
        <input v-model="dateFrom" type="date" @change="page=1; fetchData()"
          class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <span class="text-xs text-stone-400">To</span>
        <input v-model="dateTo" type="date" @change="page=1; fetchData()"
          class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
      </div>
      <span class="text-xs text-stone-400" v-if="data">{{ data.pagination.total }} events</span>
    </div>

    <div v-if="error" class="text-xs text-red-600">Failed to load. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <!-- Stats strip -->
    <div v-if="data" class="flex items-center gap-4 mb-4 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs">
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-teal-400"></span>
        <span class="text-stone-500"><span class="font-mono font-medium text-stone-900">{{ data.stats.uniqueDevices.toLocaleString() }}</span> devices</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-blue-400"></span>
        <span class="text-stone-500"><span class="font-mono font-medium text-stone-900">{{ data.stats.total.toLocaleString() }}</span> events</span>
      </div>
      <div class="flex items-center gap-1.5">
        <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
        <span class="text-stone-500"><span class="font-mono font-medium text-stone-900">{{ data.stats.today.toLocaleString() }}</span> today</span>
      </div>
      <span class="w-px h-3 bg-stone-200"></span>
      <div v-if="data.sessionDuration.avgMinutes" class="text-stone-400">
        avg session <span class="font-mono text-stone-600">{{ data.sessionDuration.avgMinutes }}m</span>
      </div>
      <div v-if="data.sessionDuration.maxMinutes" class="text-stone-400">
        longest <span class="font-mono text-stone-600">{{ data.sessionDuration.maxMinutes }}m</span>
      </div>
    </div>

    <template v-if="data">
      <!-- DAU chart + breakdowns -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <!-- Left column: charts stacked -->
        <div class="space-y-4">
          <!-- DAU bar chart (primary) -->
          <div class="bg-white border border-stone-200 rounded-lg p-4">
            <div class="text-xs font-medium text-stone-900 mb-3">Daily Active Devices (30d)</div>
            <div v-if="data.dauDaily.length" class="flex items-end gap-px" style="height: 120px;">
              <div v-for="d in data.dauDaily" :key="d.date"
                class="flex-1 bg-teal-400 hover:bg-teal-500 rounded-t transition-colors cursor-default relative group"
                :style="{ height: dauBarHeight(d.count) + '%', minHeight: d.count ? '2px' : '0' }">
                <div class="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-stone-800 text-white text-[10px] rounded whitespace-nowrap z-10">
                  {{ d.date }}: {{ d.count }} {{ d.count === 1 ? 'device' : 'devices' }}
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-stone-400">No data yet.</div>
          </div>

          <!-- Daily events chart (secondary, smaller) -->
          <div class="bg-white border border-stone-200 rounded-lg p-4">
            <div class="text-xs font-medium text-stone-900 mb-3">Daily Events (30d)</div>
            <div v-if="data.dailyCounts.length" class="flex items-end gap-px" style="height: 80px;">
              <div v-for="d in data.dailyCounts" :key="d.date"
                class="flex-1 bg-blue-300 hover:bg-blue-400 rounded-t transition-colors cursor-default relative group"
                :style="{ height: eventsBarHeight(d.count) + '%', minHeight: d.count ? '2px' : '0' }">
                <div class="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-stone-800 text-white text-[10px] rounded whitespace-nowrap z-10">
                  {{ d.date }}: {{ d.count }} events
                </div>
              </div>
            </div>
            <div v-else class="text-xs text-stone-400">No events yet.</div>
          </div>
        </div>

        <!-- Right column: breakdowns -->
        <div class="space-y-4">
          <!-- Events breakdown -->
          <div class="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 border-b border-stone-100">
              <span class="text-xs font-medium text-stone-900">Event Types</span>
            </div>
            <div v-if="data.byEvent.length" class="p-3">
              <div v-for="e in data.byEvent" :key="e.event_type" class="flex justify-between text-xs py-1">
                <span class="text-stone-600 font-mono">{{ e.event_type }}</span>
                <span class="font-mono text-stone-900">{{ e.count.toLocaleString() }}</span>
              </div>
            </div>
            <div v-else class="px-3 py-3 text-xs text-stone-400">No events yet.</div>
          </div>

          <!-- Platforms breakdown -->
          <div class="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 border-b border-stone-100">
              <span class="text-xs font-medium text-stone-900">Platforms</span>
            </div>
            <div v-if="data.byPlatform.length" class="p-3">
              <div v-for="p in data.byPlatform" :key="p.platform" class="flex justify-between text-xs py-1">
                <span class="text-stone-600">{{ p.platform || 'unknown' }}</span>
                <span class="font-mono text-stone-900">{{ p.count.toLocaleString() }}</span>
              </div>
            </div>
            <div v-else class="px-3 py-3 text-xs text-stone-400">No platform data yet.</div>
          </div>
        </div>
      </div>

      <!-- Events table -->
      <div class="bg-white border border-stone-200 rounded-lg overflow-hidden">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-stone-200 bg-stone-50 text-left">
              <th class="py-2 px-3 font-medium text-stone-400">Device</th>
              <th class="py-2 px-3 font-medium text-stone-400">Event</th>
              <th class="py-2 px-3 font-medium text-stone-400">Data</th>
              <th class="py-2 px-3 font-medium text-stone-400">Version</th>
              <th class="py-2 px-3 font-medium text-stone-400">Platform</th>
              <th class="py-2 px-3 font-medium text-stone-400">Time</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in data.events" :key="e.id" class="border-b border-stone-50 hover:bg-stone-50/50">
              <td class="py-2 px-3 font-mono text-stone-600 text-[10px]">{{ e.device_id?.slice(0, 8) || '-' }}</td>
              <td class="py-2 px-3">
                <span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
                  {{ e.event_type }}
                </span>
              </td>
              <td class="py-2 px-3 font-mono text-stone-500 text-[10px] max-w-[200px]">
                <template v-if="e.event_data">
                  <span class="cursor-pointer" @click="e._expanded = !e._expanded">
                    {{ e._expanded ? e.event_data : truncateData(e.event_data) }}
                  </span>
                </template>
                <span v-else class="text-stone-300">-</span>
              </td>
              <td class="py-2 px-3 font-mono text-stone-400 text-[10px]">{{ e.app_version || '-' }}</td>
              <td class="py-2 px-3 text-stone-600">{{ e.platform || '-' }}</td>
              <td class="py-2 px-3 text-stone-400 font-mono whitespace-nowrap">{{ formatTime(e.created_at) }}</td>
            </tr>
          </tbody>
        </table>
        <div v-if="!data.events.length" class="px-3 py-6 text-xs text-stone-400 text-center">No telemetry events found.</div>
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between mt-3 text-xs text-stone-400">
        <span>Page {{ page }} of {{ data.pagination.pages || 1 }}</span>
        <div class="flex gap-2">
          <button :disabled="page <= 1" @click="page--; fetchData()"
            class="px-2 py-1 rounded border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors">Prev</button>
          <button :disabled="page >= data.pagination.pages" @click="page++; fetchData()"
            class="px-2 py-1 rounded border border-stone-200 hover:bg-white disabled:opacity-30 transition-colors">Next</button>
        </div>
      </div>
    </template>

    <div v-if="!data && !error" class="text-xs text-stone-400">Loading...</div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const eventType = ref('')
const platform = ref('')
const deviceId = ref('')
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

function truncateData(jsonStr) {
  try {
    const obj = JSON.parse(jsonStr)
    const pairs = Object.entries(obj).map(([k, v]) => `${k}=${v}`)
    const str = pairs.join(', ')
    return str.length > 40 ? str.slice(0, 37) + '...' : str
  } catch {
    return jsonStr?.length > 40 ? jsonStr.slice(0, 37) + '...' : jsonStr
  }
}

const maxDau = computed(() => {
  if (!data.value?.dauDaily?.length) return 1
  return Math.max(...data.value.dauDaily.map(d => d.count), 1)
})

const maxEvents = computed(() => {
  if (!data.value?.dailyCounts?.length) return 1
  return Math.max(...data.value.dailyCounts.map(d => d.count), 1)
})

function dauBarHeight(count) {
  return Math.round((count / maxDau.value) * 100)
}

function eventsBarHeight(count) {
  return Math.round((count / maxEvents.value) * 100)
}

function debouncedFetch() {
  clearTimeout(timer)
  timer = setTimeout(() => { page.value = 1; fetchData() }, 300)
}

async function fetchData() {
  try {
    const q = { page: page.value }
    if (eventType.value) q.eventType = eventType.value
    if (platform.value) q.platform = platform.value
    if (deviceId.value) q.deviceId = deviceId.value
    if (dateFrom.value) q.from = dateFrom.value
    if (dateTo.value) q.to = dateTo.value
    data.value = await $fetch('/api/admin/telemetry', { query: q })
  } catch {
    error.value = true
  }
}

await fetchData()
</script>
