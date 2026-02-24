<template>
  <div>
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <div class="flex items-center gap-1.5">
        <span class="text-xs text-stone-400">From</span>
        <input v-model="dateFrom" type="date" @change="fetchData()"
          class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
        <span class="text-xs text-stone-400">To</span>
        <input v-model="dateTo" type="date" @change="fetchData()"
          class="px-2 py-1.5 text-xs rounded border border-stone-300 bg-white focus:border-stone-500 outline-none text-stone-900">
      </div>
      <button @click="setRange(7)" class="px-2 py-1 text-xs rounded border border-stone-200 hover:bg-white transition-colors text-stone-500">7d</button>
      <button @click="setRange(30)" class="px-2 py-1 text-xs rounded border border-stone-200 hover:bg-white transition-colors text-stone-500">30d</button>
      <button @click="setRange(90)" class="px-2 py-1 text-xs rounded border border-stone-200 hover:bg-white transition-colors text-stone-500">90d</button>
    </div>

    <div v-if="error" class="text-xs text-red-600">Failed to load. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <template v-if="data">
      <!-- Stats strip -->
      <div class="flex items-center gap-4 mb-4 px-3 py-2 bg-white border border-stone-200 rounded-lg text-xs">
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-blue-400"></span>
          <span class="text-stone-500"><span class="font-mono font-medium text-stone-900">{{ data.summary.totalViews.toLocaleString() }}</span> views</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span class="text-stone-500"><span class="font-mono font-medium text-stone-900">{{ data.summary.totalDownloads.toLocaleString() }}</span> downloads</span>
        </div>
        <span class="w-px h-3 bg-stone-200"></span>
        <div class="text-stone-400">
          avg <span class="font-mono">{{ data.summary.avgDuration }}s</span> on page
        </div>
        <div class="text-stone-400">
          <span class="font-mono">{{ data.summary.uniquePaths }}</span> unique pages
        </div>
      </div>

      <!-- Daily views chart -->
      <div class="bg-white border border-stone-200 rounded-lg p-4 mb-4">
        <div class="text-xs font-medium text-stone-900 mb-3">Daily Page Views</div>
        <div v-if="data.dailyViews.length" class="flex items-end gap-px" style="height: 120px;">
          <div v-for="d in data.dailyViews" :key="d.date"
            class="flex-1 bg-blue-400 hover:bg-blue-500 rounded-t transition-colors cursor-default relative group"
            :style="{ height: barHeight(d.views) + '%', minHeight: d.views ? '2px' : '0' }">
            <div class="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 bg-stone-800 text-white text-[10px] rounded whitespace-nowrap z-10">
              {{ d.date }}: {{ d.views }}
            </div>
          </div>
        </div>
        <div v-else class="text-xs text-stone-400">No views in this period.</div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <!-- Top pages -->
        <div class="bg-white border border-stone-200 rounded-lg overflow-hidden">
          <div class="px-3 py-2 border-b border-stone-100">
            <span class="text-xs font-medium text-stone-900">Top Pages</span>
          </div>
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-stone-100 bg-stone-50 text-left">
                <th class="py-1.5 px-3 font-medium text-stone-400">Path</th>
                <th class="py-1.5 px-3 font-medium text-stone-400 text-right">Views</th>
                <th class="py-1.5 px-3 font-medium text-stone-400 text-right">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in data.topPages" :key="p.path" class="border-b border-stone-50 hover:bg-stone-50/50">
                <td class="py-1.5 px-3 font-mono text-stone-700 truncate max-w-[200px]">{{ p.path }}</td>
                <td class="py-1.5 px-3 text-right font-mono text-stone-900">{{ p.views }}</td>
                <td class="py-1.5 px-3 text-right font-mono text-stone-400">{{ Math.round(p.avg_duration) }}s</td>
              </tr>
            </tbody>
          </table>
          <div v-if="!data.topPages.length" class="px-3 py-3 text-xs text-stone-400">No page views yet.</div>
        </div>

        <!-- Downloads + Referrers -->
        <div class="space-y-4">
          <!-- Download clicks -->
          <div class="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 border-b border-stone-100">
              <span class="text-xs font-medium text-stone-900">Download Clicks</span>
            </div>
            <div v-if="data.downloads.length" class="p-3">
              <div v-for="d in data.downloads" :key="d.platform" class="flex justify-between text-xs py-1">
                <span class="text-stone-600 font-mono">{{ d.platform || 'unknown' }}</span>
                <span class="font-mono text-stone-900">{{ d.count }}</span>
              </div>
            </div>
            <div v-else class="px-3 py-3 text-xs text-stone-400">No downloads yet.</div>
          </div>

          <!-- Top referrers -->
          <div class="bg-white border border-stone-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 border-b border-stone-100">
              <span class="text-xs font-medium text-stone-900">Top Referrers</span>
            </div>
            <div v-if="data.topReferrers.length" class="p-3">
              <div v-for="r in data.topReferrers" :key="r.referrer_domain" class="flex justify-between text-xs py-1">
                <span class="text-stone-600 truncate mr-2">{{ r.referrer_domain }}</span>
                <span class="font-mono text-stone-900">{{ r.count }}</span>
              </div>
            </div>
            <div v-else class="px-3 py-3 text-xs text-stone-400">No referrer data yet.</div>
          </div>
        </div>
      </div>
    </template>

    <div v-if="!data && !error" class="text-xs text-stone-400">Loading...</div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const dateFrom = ref(daysAgo(30))
const dateTo = ref(today())
const data = ref(null)
const error = ref(false)

function today() {
  return new Date().toISOString().slice(0, 10)
}

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function setRange(days) {
  dateFrom.value = daysAgo(days)
  dateTo.value = today()
  fetchData()
}

const maxViews = computed(() => {
  if (!data.value?.dailyViews?.length) return 1
  return Math.max(...data.value.dailyViews.map(d => d.views), 1)
})

function barHeight(views) {
  return Math.round((views / maxViews.value) * 100)
}

async function fetchData() {
  try {
    data.value = await $fetch('/api/admin/analytics', {
      query: { from: dateFrom.value, to: dateTo.value },
    })
  } catch {
    error.value = true
  }
}

await fetchData()
</script>
