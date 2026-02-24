<template>
  <div>
    <div v-if="error" class="text-sm text-red-600">Failed to load stats. <NuxtLink to="/admin/login" class="underline">Re-login</NuxtLink></div>

    <div v-else-if="stats">

      <!-- 1. KPI strip with deltas + sparklines -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div v-for="kpi in kpis" :key="kpi.label" class="bg-white border border-stone-200 rounded-lg p-4">
          <div class="flex items-center justify-between mb-1">
            <div class="text-xs text-stone-400 uppercase tracking-wider">{{ kpi.label }}</div>
            <svg v-if="kpi.spark.length" :width="72" :height="22" class="flex-shrink-0">
              <path :d="sparklineArea(kpi.spark, 72, 22)" fill="#e7e5e4" />
              <polyline :points="sparklinePoints(kpi.spark, 72, 22)" fill="none" stroke="#a8a29e" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="text-2xl font-mono font-semibold">{{ kpi.value }}</div>
          <div class="text-xs mt-1" :class="kpi.delta.class">{{ kpi.delta.text }}</div>
        </div>
      </div>

      <!-- 2. Visitor funnel (30 days) -->
      <div class="bg-white border border-stone-200 rounded-lg p-4 mb-6">
        <div class="text-xs font-medium text-stone-900 mb-3">Visitor Funnel <span class="text-stone-400 font-normal">last 30 days</span></div>
        <div class="flex items-center">
          <template v-for="(step, i) in funnelSteps" :key="step.label">
            <div class="flex-1 text-center">
              <div class="text-lg font-mono font-semibold text-stone-900">{{ step.value.toLocaleString() }}</div>
              <div class="text-[10px] text-stone-400 uppercase tracking-wider mt-0.5">{{ step.label }}</div>
            </div>
            <div v-if="i < funnelSteps.length - 1" class="flex flex-col items-center px-2">
              <svg width="20" height="12" class="text-stone-300"><path d="M2 6h12m-4-4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              <div class="text-[10px] font-mono mt-0.5" :class="conversionColor(funnelSteps[i].value, funnelSteps[i + 1].value)">
                {{ conversionRate(funnelSteps[i].value, funnelSteps[i + 1].value) }}
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- 3. 14-day activity chart (SVG line chart) -->
      <div class="bg-white border border-stone-200 rounded-lg p-4 mb-6">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-medium text-stone-900">14-Day Activity</div>
          <div class="flex items-center gap-3 text-[10px] text-stone-400">
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-blue-400"></span>Page views</span>
            <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-emerald-500"></span>Signups</span>
          </div>
        </div>
        <div class="relative" style="height: 120px;">
          <svg width="100%" height="100%" :viewBox="`0 0 ${chartW} ${chartH}`" preserveAspectRatio="none" class="overflow-visible">
            <!-- Grid lines -->
            <line v-for="y in [0.25, 0.5, 0.75]" :key="y" x1="0" :y1="chartH * y" :x2="chartW" :y2="chartH * y" stroke="#f5f5f4" stroke-width="1" />
            <!-- Page views area + line -->
            <path :d="chartArea(stats.trends.pageViews)" fill="#bfdbfe" fill-opacity="0.4" />
            <polyline :points="chartLine(stats.trends.pageViews)" fill="none" stroke="#60a5fa" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
            <!-- Signups area + line -->
            <path :d="chartArea(stats.trends.signups)" fill="#6ee7b7" fill-opacity="0.4" />
            <polyline :points="chartLine(stats.trends.signups)" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
            <!-- Data points (page views) -->
            <circle v-for="(d, i) in stats.trends.pageViews" :key="'pv'+i"
              :cx="chartX(i)" :cy="chartY(d.count)" r="3" fill="#60a5fa" stroke="white" stroke-width="1.5"
              vector-effect="non-scaling-stroke" class="opacity-0 hover:opacity-100 transition-opacity" />
          </svg>
          <!-- Hover columns for tooltips -->
          <div class="absolute inset-0 flex">
            <div v-for="(d, i) in stats.trends.pageViews" :key="d.date" class="flex-1 relative group cursor-default">
              <div class="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-1 bg-stone-800 text-white text-[10px] rounded whitespace-nowrap z-10 leading-relaxed">
                <div class="font-mono">{{ d.date.slice(5) }}</div>
                <div>{{ d.count }} views · {{ stats.trends.signups[i].count }} signups</div>
              </div>
              <div class="hidden group-hover:block absolute inset-y-0 left-1/2 w-px bg-stone-200"></div>
            </div>
          </div>
        </div>
        <div class="flex mt-1">
          <div v-for="(d, i) in stats.trends.pageViews" :key="d.date + '-label'"
            class="flex-1 text-center text-[8px] font-mono text-stone-300">
            {{ i === 0 || i === 6 || i === 13 ? d.date.slice(5) : '' }}
          </div>
        </div>
      </div>

      <!-- 4. Compact metric rows with sparklines -->
      <div class="bg-white border border-stone-200 rounded-lg divide-y divide-stone-100 mb-6">
        <div v-for="row in metricRows" :key="row.label"
          class="flex items-center gap-3 px-4 py-3 hover:bg-stone-50/50 transition-colors">
          <div class="text-xs font-medium text-stone-900 w-24 flex-shrink-0">{{ row.label }}</div>
          <div class="flex-1 text-xs text-stone-500">
            <span v-for="(stat, j) in row.stats" :key="j">
              <span class="font-mono text-stone-700">{{ stat.value }}</span>
              <span> {{ stat.suffix }}</span>
              <span v-if="j < row.stats.length - 1" class="text-stone-300 mx-1">&middot;</span>
            </span>
          </div>
          <svg v-if="row.spark.length" :width="72" :height="20" class="flex-shrink-0">
            <path :d="sparklineArea(row.spark, 72, 20)" :fill="(row.sparkColor || '#a8a29e') + '20'" />
            <polyline :points="sparklinePoints(row.spark, 72, 20)" fill="none" :stroke="row.sparkColor || '#a8a29e'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <NuxtLink v-if="row.link" :to="row.link" class="text-[10px] text-stone-400 hover:text-stone-600 flex-shrink-0">&rarr;</NuxtLink>
        </div>
      </div>

      <!-- 5. Needs attention (conditional) -->
      <div v-if="attentionItems.length" class="mb-6">
        <div class="text-xs font-medium text-stone-900 mb-2">Needs Attention</div>
        <div class="space-y-2">
          <div v-for="item in attentionItems" :key="item.text"
            class="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
            :class="item.level === 'warn' ? 'bg-yellow-50 border border-yellow-200 text-yellow-800' : 'bg-stone-50 border border-stone-200 text-stone-700'">
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :class="item.level === 'warn' ? 'bg-yellow-400' : 'bg-stone-400'"></span>
            <span>{{ item.text }}</span>
            <NuxtLink v-if="item.link" :to="item.link" class="ml-auto text-[10px] underline underline-offset-2 opacity-60 hover:opacity-100">View</NuxtLink>
          </div>
        </div>
      </div>

    </div>

    <div v-else class="text-xs text-stone-400">Loading...</div>
  </div>
</template>

<script setup>
definePageMeta({ layout: 'admin' })

const stats = ref(null)
const error = ref(false)

try { stats.value = await $fetch('/api/admin/stats') }
catch { error.value = true }

// --- Sparkline helper ---
function sparklinePoints(values, w, h) {
  if (!values.length) return ''
  const max = Math.max(...values, 1)
  const pad = 2
  const usable = h - pad * 2
  const step = w / Math.max(values.length - 1, 1)
  return values.map((v, i) => {
    const x = i * step
    const y = h - pad - (v / max) * usable
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}
// Area fill path for sparkline (closed polygon)
function sparklineArea(values, w, h) {
  if (!values.length) return ''
  const pts = sparklinePoints(values, w, h)
  return `M0,${h} L${pts} L${w},${h} Z`
}

// --- Delta helper ---
function formatDelta(thisWeek, lastWeek, { prefix = '', cents = false } = {}) {
  const tw = cents ? thisWeek / 100 : thisWeek
  const lw = cents ? lastWeek / 100 : lastWeek
  const diff = tw - lw
  const fmt = (v) => cents ? prefix + Math.abs(v).toFixed(2) : prefix + Math.abs(v)
  if (lw === 0 && tw === 0) return { text: 'no change', class: 'text-stone-400' }
  if (lw === 0) return { text: `+${fmt(tw)} this week`, class: 'text-emerald-600' }
  const pct = Math.round((diff / lw) * 100)
  const sign = diff >= 0 ? '+' : '-'
  const arrow = diff > 0 ? '\u2191' : diff < 0 ? '\u2193' : ''
  const color = diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-red-500' : 'text-stone-400'
  return { text: `${sign}${fmt(diff)} this week (${arrow}${Math.abs(pct)}%)`, class: color }
}

// --- Line chart helpers ---
const chartW = 560
const chartH = 120
const chartPad = 4
const chartMaxVal = computed(() => {
  if (!stats.value) return 1
  const pvMax = Math.max(...stats.value.trends.pageViews.map(d => d.count), 0)
  const suMax = Math.max(...stats.value.trends.signups.map(d => d.count), 0)
  return Math.max(pvMax, suMax, 1)
})
function chartX(i) {
  const count = stats.value?.trends.pageViews.length || 14
  return chartPad + (i / Math.max(count - 1, 1)) * (chartW - chartPad * 2)
}
function chartY(val) {
  return chartH - chartPad - (val / chartMaxVal.value) * (chartH - chartPad * 2)
}
function chartLine(series) {
  return series.map((d, i) => `${chartX(i).toFixed(1)},${chartY(d.count).toFixed(1)}`).join(' ')
}
function chartArea(series) {
  const pts = series.map((d, i) => `${chartX(i).toFixed(1)},${chartY(d.count).toFixed(1)}`)
  const x0 = chartX(0).toFixed(1)
  const xN = chartX(series.length - 1).toFixed(1)
  const bottom = (chartH - chartPad).toFixed(1)
  return `M${x0},${bottom} L${pts.join(' L')} L${xN},${bottom} Z`
}

// --- KPI cards ---
const kpis = computed(() => {
  if (!stats.value) return []
  const s = stats.value
  return [
    {
      label: 'Users',
      value: s.users.total.toLocaleString(),
      spark: s.trends.signups.map(d => d.count),
      delta: formatDelta(s.deltas.signups.thisWeek, s.deltas.signups.lastWeek),
    },
    {
      label: 'Active Users',
      value: s.activeUsers.mau.toLocaleString(),
      spark: s.trends.apiCalls.map(d => d.count),
      delta: formatDelta(s.deltas.activeUsers.thisWeek, s.deltas.activeUsers.lastWeek),
    },
    {
      label: 'Revenue',
      value: '$' + (s.credits.total / 100).toFixed(2),
      spark: [], // no daily revenue trend yet
      delta: formatDelta(s.deltas.revenue.thisWeek, s.deltas.revenue.lastWeek, { prefix: '$', cents: true }),
    },
    {
      label: 'Landing Views',
      value: s.landingViews.total.toLocaleString(),
      spark: s.trends.pageViews.map(d => d.count),
      delta: formatDelta(s.deltas.pageViews.thisWeek, s.deltas.pageViews.lastWeek),
    },
  ]
})

// --- Funnel ---
const funnelSteps = computed(() => {
  if (!stats.value) return []
  const f = stats.value.funnel
  return [
    { label: 'Landing', value: f.landing },
    { label: 'Download page', value: f.downloadPage },
    { label: 'Download click', value: f.downloadClick },
    { label: 'Signup', value: f.signups },
  ]
})
function conversionRate(from, to) {
  if (!from) return '0%'
  return (to / from * 100).toFixed(1) + '%'
}
function conversionColor(from, to) {
  if (!from) return 'text-stone-400'
  const rate = to / from
  if (rate >= 0.3) return 'text-emerald-600'
  if (rate >= 0.1) return 'text-stone-500'
  return 'text-red-500'
}

// --- Compact metric rows ---
const metricRows = computed(() => {
  if (!stats.value) return []
  const s = stats.value
  const successRate = (s.reviews.complete + s.reviews.failed) > 0
    ? Math.round(s.reviews.complete / (s.reviews.complete + s.reviews.failed) * 100) : 0

  const topPlatforms = s.downloads.byPlatform.slice(0, 3).map(d => `${d.platform}: ${d.count}`).join(', ')

  const errorRate = s.apiCalls.today > 0
    ? (s.apiCalls.errorsToday / s.apiCalls.today * 100).toFixed(1) : '0.0'

  return [
    {
      label: 'Reviews',
      stats: [
        { value: s.reviews.complete, suffix: 'complete' },
        { value: s.reviews.failed, suffix: 'failed' },
        { value: successRate + '%', suffix: 'success' },
      ],
      spark: s.trends.reviews.map(d => d.count),
      sparkColor: '#10b981',
      link: '/admin/reviews',
    },
    {
      label: 'Deck Views',
      stats: [
        { value: s.decks.totalViews.toLocaleString(), suffix: 'total' },
        { value: s.decks.viewsThisWeek, suffix: 'this week' },
      ],
      spark: s.trends.deckViews.map(d => d.count),
      sparkColor: '#8b5cf6',
      link: '/admin/decks',
    },
    {
      label: 'Downloads',
      stats: [
        { value: s.downloads.byPlatform.reduce((a, d) => a + d.count, 0), suffix: 'clicks' },
        ...(topPlatforms ? [{ value: topPlatforms, suffix: '' }] : []),
      ],
      spark: s.trends.downloads.map(d => d.count),
      sparkColor: '#3b82f6',
      link: '/admin/analytics',
    },
    {
      label: 'API Calls',
      stats: [
        { value: s.apiCalls.total.toLocaleString(), suffix: 'total' },
        { value: s.apiCalls.today, suffix: 'today' },
        { value: errorRate + '%', suffix: 'errors' },
      ],
      spark: s.trends.apiCalls.map(d => d.count),
      sparkColor: '#f59e0b',
      link: '/admin/calls',
    },
  ]
})

// --- Needs attention ---
const attentionItems = computed(() => {
  if (!stats.value) return []
  const items = []
  const s = stats.value
  if (s.reviews.processing > 0) {
    items.push({ text: `${s.reviews.processing} review${s.reviews.processing > 1 ? 's' : ''} currently processing`, level: 'warn', link: '/admin/reviews' })
  }
  if (s.apiCalls.today > 0 && (s.apiCalls.errorsToday / s.apiCalls.today) > 0.05) {
    items.push({ text: `API error rate is ${(s.apiCalls.errorsToday / s.apiCalls.today * 100).toFixed(1)}% today (${s.apiCalls.errorsToday} errors)`, level: 'warn', link: '/admin/calls' })
  }
  if (s.contact.undismissed > 0) {
    items.push({ text: `${s.contact.undismissed} enterprise enquir${s.contact.undismissed === 1 ? 'y' : 'ies'} pending`, level: 'info', link: '/admin/contacts' })
  }
  return items
})

</script>
