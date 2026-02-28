<template>
  <div class="min-h-screen bg-stone-50 font-sans antialiased flex flex-col">
    <!-- Top bar -->
    <header class="border-b border-stone-200 bg-white sticky top-0 z-10">
      <div class="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
        <NuxtLink to="/triage" class="text-sm font-semibold tracking-tight text-stone-900 hover:text-stone-700 transition-colors">
          Paper Triage
        </NuxtLink>
        <NuxtLink to="/triage"
          class="px-3.5 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-sm transition-colors">
          Upload New
        </NuxtLink>
      </div>
    </header>

    <!-- Main -->
    <div class="flex-1">
      <div class="max-w-3xl mx-auto px-6">

        <!-- Error state -->
        <div v-if="fetchError" class="text-center py-24">
          <p class="text-sm text-stone-600 mb-2">Triage not found</p>
          <p class="text-xs text-stone-400 mb-6">This assessment may have expired or the URL is incorrect.</p>
          <NuxtLink to="/triage"
            class="px-5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-sm transition-colors inline-block">
            Upload a paper
          </NuxtLink>
        </div>

        <!-- Processing state -->
        <div v-else-if="!data || data.status === 'processing'" class="max-w-md mx-auto py-20">
          <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.15em] mb-3">Analysing</p>
          <p class="text-sm font-semibold text-stone-900 mb-8">{{ data?.filename || 'Document' }}</p>

          <div class="space-y-3.5">
            <StepRow :done="!!steps.extracted" :active="data?.currentStep === 'extracting'">
              <template v-if="steps.extracted">
                Extracted — {{ steps.extracted.pageEstimate ? `${steps.extracted.pageEstimate}p, ` : '' }}{{ fmt(steps.extracted.wordCount) }} words
              </template>
              <template v-else>Extracting text</template>
            </StepRow>

            <StepRow :done="!!steps.referencesExtracted" :active="!!steps.extracted && !steps.referencesExtracted">
              <template v-if="steps.referencesExtracted">{{ steps.referencesExtracted.count }} references identified</template>
              <template v-else>Identifying references</template>
            </StepRow>

            <StepRow :done="!!steps.referencesChecked" :active="data?.currentStep === 'checking' && !steps.referencesChecked">
              <template v-if="steps.referencesChecked">
                Verified — {{ steps.referencesChecked.verified }} ok{{ (steps.referencesChecked.unverified || steps.referencesChecked.notFound) ? `, ${steps.referencesChecked.unverified || steps.referencesChecked.notFound} unverified` : '' }}{{ (steps.referencesChecked.errors || steps.referencesChecked.corrected) ? `, ${steps.referencesChecked.errors || steps.referencesChecked.corrected} errors` : '' }}
              </template>
              <template v-else>Verifying references</template>
            </StepRow>

            <StepRow :done="steps.pangram !== undefined" :active="data?.currentStep === 'checking' && steps.pangram === undefined">
              <template v-if="steps.pangram !== undefined">AI content scanned</template>
              <template v-else>Scanning for AI content</template>
            </StepRow>

            <StepRow :done="data?.currentStep === 'complete'" :active="data?.currentStep === 'assessing'">
              <template v-if="data?.currentStep === 'complete'">Assessment complete</template>
              <template v-else>Running assessment</template>
            </StepRow>
          </div>

          <p class="text-xs text-stone-400 mt-12">This usually takes 2–5 minutes.</p>
        </div>

        <!-- Failed state -->
        <div v-else-if="data.status === 'failed'" class="text-center py-24">
          <p class="text-sm text-stone-600 mb-2">Assessment could not be completed</p>
          <p class="text-xs text-stone-400 mb-6">Something went wrong during processing.</p>
          <NuxtLink to="/triage"
            class="px-5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded-sm transition-colors inline-block">
            Upload another paper
          </NuxtLink>
        </div>

        <!-- ═══════════ Dashboard ═══════════ -->
        <div v-else-if="data.status === 'complete' && data.assessment" class="bg-white border-x border-b border-stone-200 px-8 py-6 mb-8">

          <!-- File info line -->
          <p class="text-xs text-stone-400 font-mono mb-6">
            {{ data.filename }}
            <template v-if="steps.extracted?.pageEstimate"> · {{ steps.extracted.pageEstimate }} pages</template>
            <template v-if="steps.extracted?.wordCount"> · {{ fmt(steps.extracted.wordCount) }} words</template>
            <template v-if="steps.extracted?.tableCount"> · {{ steps.extracted.tableCount }} {{ steps.extracted.tableCount === 1 ? 'table' : 'tables' }}</template>
            <template v-if="steps.extracted?.figureCount"> · {{ steps.extracted.figureCount }} {{ steps.extracted.figureCount === 1 ? 'figure' : 'figures' }}</template>
          </p>

          <!-- Summary bullets -->
          <div class="mb-6">
            <!-- New format: array of bullets -->
            <ul v-if="Array.isArray(data.assessment.summary)" class="space-y-1.5">
              <li v-for="(bullet, i) in data.assessment.summary" :key="i"
                class="text-sm text-stone-700 leading-snug flex gap-2">
                <span class="text-stone-300 select-none">·</span>
                <span>{{ bullet }}</span>
              </li>
            </ul>
            <!-- Old format: paragraph -->
            <p v-else class="text-sm text-stone-700 leading-relaxed">{{ data.assessment.summary }}</p>
          </div>

          <!-- Citation forecast -->
          <div v-if="forecast" class="border-t border-stone-200 py-5">
            <div class="flex items-baseline justify-between gap-4 mb-1">
              <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]">Citation forecast</p>
              <span class="text-[10px] text-stone-400 font-mono">{{ forecast.horizon_months || 24 }} months · 80% CI</span>
            </div>
            <div class="flex items-baseline gap-3 mb-2">
              <span class="text-2xl font-mono font-semibold text-stone-900 tabular-nums">{{ forecast.point_estimate }}</span>
              <span class="text-sm font-mono text-stone-400 tabular-nums">{{ forecast.range_low }}–{{ forecast.range_high }}</span>
            </div>
            <p v-if="forecast.reasoning" class="text-xs text-stone-500 leading-relaxed">{{ forecast.reasoning }}</p>
          </div>

          <!-- Assessment sections -->
          <SectionRow v-for="section in assessmentSections" :key="section.key"
            :label="section.label"
            :headline="getSectionHeadline(section.key)"
            :detail="getSectionDetail(section.key)"
            :expanded="!!expanded[section.key]"
            @toggle="toggleSection(section.key)" />

          <!-- Authors -->
          <div v-if="authors" class="border-t border-stone-200 py-4">
            <button @click="toggleSection('authors')" class="w-full text-left flex items-start justify-between gap-4 group">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-1">Authors</p>
                <p class="text-sm text-stone-700">{{ authors.names?.join(', ') || 'Not identified' }}</p>
              </div>
              <span v-if="authors.note" class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-1">
                {{ expanded.authors ? 'Hide' : 'Details' }} {{ expanded.authors ? '▾' : '▸' }}
              </span>
            </button>
            <p v-if="expanded.authors && authors.note" class="text-xs text-stone-500 leading-relaxed mt-2">{{ authors.note }}</p>
          </div>

          <!-- Old-format credibility fallback -->
          <SectionRow v-else-if="data.assessment.credibility"
            label="Credibility"
            :headline="getSectionHeadline('credibility')"
            :detail="getSectionDetail('credibility')"
            :expanded="!!expanded.credibility"
            @toggle="toggleSection('credibility')" />

          <!-- AI Content -->
          <div class="border-t border-stone-200 py-4">
            <button @click="toggleSection('ai_content')" class="w-full text-left flex items-start justify-between gap-4 group">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-1">AI Content</p>
                <p class="text-sm text-stone-700">
                  <template v-if="data.pangram?.available">
                    <span class="font-mono">{{ humanPct }}%</span> human
                    <template v-if="aiPct > 0"> · <span class="font-mono">{{ aiPct }}%</span> AI</template>
                    <template v-if="data.pangram.prediction"> · {{ data.pangram.prediction }}</template>
                  </template>
                  <template v-else>{{ getSectionHeadline('ai_content') }}</template>
                </p>
              </div>
              <span v-if="getSectionDetail('ai_content')" class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-1">
                {{ expanded.ai_content ? 'Hide' : 'Details' }} {{ expanded.ai_content ? '▾' : '▸' }}
              </span>
            </button>
            <p v-if="expanded.ai_content && getSectionDetail('ai_content')"
              class="text-xs text-stone-500 leading-relaxed mt-2">
              {{ getSectionDetail('ai_content') }}
            </p>
          </div>

          <!-- References -->
          <div class="border-t border-stone-200 py-4">
            <button @click="toggleSection('refs')" class="w-full text-left flex items-start justify-between gap-4 group">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-1">References</p>
                <p class="text-sm text-stone-700">
                  <span class="font-mono">{{ refStats.verified }}/{{ refStats.total }}</span> verified
                  <template v-if="refStats.errors"> · <span class="font-mono text-amber-700">{{ refStats.errors }}</span> {{ refStats.errors === 1 ? 'error' : 'errors' }}</template>
                  <template v-if="refStats.unverified"> · <span class="font-mono">{{ refStats.unverified }}</span> unverified</template>
                </p>
              </div>
              <span class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-1">
                {{ expanded.refs ? 'Hide' : 'Details' }} {{ expanded.refs ? '▾' : '▸' }}
              </span>
            </button>

            <div v-if="expanded.refs" class="mt-3">
              <!-- Summary from assessment -->
              <p v-if="referencesSummary" class="text-xs text-stone-500 leading-relaxed mb-3">{{ referencesSummary }}</p>

              <!-- Issues -->
              <div v-if="refIssues.length" class="space-y-2 mb-3">
                <div v-for="issue in refIssues" :key="issue.key"
                  class="border-l-2 pl-3 py-1"
                  :class="issue.status === 'error' || issue.status === 'corrected' ? 'border-amber-400' : 'border-stone-200'">
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-mono text-stone-600">{{ issue.key }}</span>
                    <span class="text-[10px] font-semibold uppercase tracking-wide"
                      :class="issue.status === 'error' || issue.status === 'corrected' ? 'text-amber-600' : 'text-stone-400'">
                      {{ issue.status === 'error' || issue.status === 'corrected' ? 'ERROR' : 'UNVERIFIED' }}
                    </span>
                  </div>
                  <p v-if="issue.refText" class="text-xs text-stone-500 mt-0.5 leading-relaxed line-clamp-2">{{ issue.refText }}</p>
                  <p v-if="issue.note" class="text-xs text-stone-400 mt-0.5">{{ issue.note }}</p>
                </div>
              </div>

              <!-- Full list -->
              <button @click="refsExpanded = !refsExpanded"
                class="text-[10px] text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1">
                {{ refsExpanded ? 'Hide' : `All ${refStats.total}` }} references {{ refsExpanded ? '▾' : '▸' }}
              </button>
              <div v-if="refsExpanded" class="mt-2 space-y-0.5">
                <div v-for="r in sortedRefs" :key="r.key"
                  class="flex items-start gap-2 text-xs py-0.5"
                  :class="r.status !== 'verified' ? 'text-stone-700' : 'text-stone-400'">
                  <span class="font-mono w-6 flex-shrink-0 text-right text-stone-400">{{ r.key }}</span>
                  <span class="flex-1">
                    <span v-if="r.status === 'error' || r.status === 'corrected'" class="text-amber-600 font-mono mr-1">err</span>
                    <span v-else-if="r.status === 'unverified' || r.status === 'not_found'" class="text-stone-400 font-mono mr-1">unv</span>
                    <span v-if="r.refText" class="text-stone-500">{{ r.refText.slice(0, 100) }}{{ r.refText.length > 100 ? '…' : '' }}</span>
                    <span v-if="r.note" class="text-stone-400"> — {{ r.note }}</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Related Work -->
          <div class="border-t border-stone-200 py-4">
            <button @click="toggleSection('novelty')" class="w-full text-left flex items-start justify-between gap-4 group">
              <div class="flex-1 min-w-0">
                <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-1">Related Work</p>
                <p class="text-sm text-stone-700">
                  <span class="font-mono">{{ data.novelty?.relatedPapers?.length || 0 }}</span> papers
                  <template v-if="featuredPapers.length"> · Most cited: <span class="font-mono">{{ fmt(featuredPapers[0].paper.citedByCount) }}</span> cit.</template>
                </p>
              </div>
              <span class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-1">
                {{ expanded.novelty ? 'Hide' : 'Details' }} {{ expanded.novelty ? '▾' : '▸' }}
              </span>
            </button>

            <div v-if="expanded.novelty" class="mt-3">
              <p v-if="noveltySummary" class="text-xs text-stone-500 leading-relaxed mb-3">{{ noveltySummary }}</p>

              <!-- Featured -->
              <div v-if="featuredPapers.length" class="space-y-2 mb-3">
                <div v-for="(fp, i) in featuredPapers" :key="i" class="flex items-start gap-2">
                  <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-wide w-16 flex-shrink-0 pt-0.5">{{ fp.tag }}</span>
                  <div class="flex-1 min-w-0">
                    <p class="text-xs text-stone-700 leading-snug">{{ fp.paper.title }}</p>
                    <p class="text-[10px] text-stone-400 font-mono mt-0.5">
                      {{ fp.paper.year || '?' }}
                      <template v-if="fp.paper.citedByCount"> · {{ fmt(fp.paper.citedByCount) }} cit.</template>
                      <template v-if="fp.paper.journal"> · {{ fp.paper.journal }}</template>
                    </p>
                  </div>
                </div>
              </div>

              <!-- Full list -->
              <div v-if="data.novelty?.relatedPapers?.length > 2">
                <button @click="noveltyExpanded = !noveltyExpanded"
                  class="text-[10px] text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1">
                  {{ noveltyExpanded ? 'Hide' : `All ${data.novelty.relatedPapers.length}` }} papers {{ noveltyExpanded ? '▾' : '▸' }}
                </button>
                <div v-if="noveltyExpanded" class="mt-2 space-y-1">
                  <div v-for="(p, i) in data.novelty.relatedPapers" :key="i" class="flex items-start gap-2 text-xs">
                    <span class="font-mono text-stone-300 w-4 flex-shrink-0 text-right">{{ i + 1 }}</span>
                    <div class="flex-1 min-w-0">
                      <p class="text-stone-600 leading-snug">{{ p.title }}</p>
                      <p class="text-[10px] text-stone-400 font-mono">
                        {{ p.year || '?' }}
                        <template v-if="p.citedByCount"> · {{ fmt(p.citedByCount) }} cit.</template>
                        <template v-if="p.journal"> · {{ p.journal }}</template>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Reviewer Suggestions -->
          <div class="border-t border-stone-200 py-4 flex items-center justify-between">
            <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]">Reviewer Suggestions</p>
            <span class="text-[10px] text-stone-300 font-mono">coming soon</span>
          </div>

          <!-- Cost -->
          <div v-if="data.costCents" class="border-t border-stone-100 pt-3 pb-1">
            <p class="text-[10px] text-stone-300 font-mono text-right">
              ${{ (data.costCents / 100).toFixed(2) }} · {{ fmtK(data.inputTokens) }}in / {{ fmtK(data.outputTokens) }}out
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-stone-200 bg-white py-3 text-center mt-auto">
      <a href="https://shoulde.rs" class="text-xs text-stone-300 hover:text-stone-400 transition-colors tracking-wide">
        shoulde.rs
      </a>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

// ─── Inline components ───

const StepRow = defineComponent({
  props: { done: Boolean, active: Boolean },
  setup(props, { slots }) {
    return () => h('div', { class: 'flex items-start gap-3' }, [
      h('div', { class: 'w-4 h-4 mt-0.5 flex-shrink-0 flex items-center justify-center' }, [
        props.done
          ? h('svg', { class: 'w-3.5 h-3.5 text-emerald-500', viewBox: '0 0 20 20', fill: 'currentColor', innerHTML: '<path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>' })
          : props.active
            ? h('svg', { class: 'w-3.5 h-3.5 text-stone-400 animate-spin', viewBox: '0 0 24 24', fill: 'none', innerHTML: '<circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" /><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />' })
            : h('div', { class: 'w-1 h-1 rounded-full bg-stone-300' })
      ]),
      h('p', { class: ['text-xs', props.done ? 'text-stone-700' : props.active ? 'text-stone-500' : 'text-stone-300'] },
        slots.default?.()
      )
    ])
  }
})

const SectionRow = defineComponent({
  props: { label: String, headline: String, detail: String, expanded: Boolean },
  emits: ['toggle'],
  setup(props, { emit }) {
    return () => h('div', { class: 'border-t border-stone-200 py-4' }, [
      h('button', {
        class: 'w-full text-left flex items-start justify-between gap-4 group',
        onClick: () => emit('toggle'),
      }, [
        h('div', { class: 'flex-1 min-w-0' }, [
          h('p', { class: 'text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-1' }, props.label),
          h('p', { class: 'text-sm text-stone-700' }, props.headline),
        ]),
        props.detail
          ? h('span', { class: 'text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-1' },
              `${props.expanded ? 'Hide' : 'Details'} ${props.expanded ? '▾' : '▸'}`)
          : null,
      ]),
      props.expanded && props.detail
        ? h('p', { class: 'text-xs text-stone-500 leading-relaxed mt-2' }, props.detail)
        : null,
    ])
  }
})

// ─── State ───

const route = useRoute()
const slug = route.params.slug

const data = ref(null)
const fetchError = ref('')
const refsExpanded = ref(false)
const noveltyExpanded = ref(false)
const expanded = reactive({})
let pollTimer = null

useHead({ title: 'Paper Triage — Shoulders' })

const steps = computed(() => data.value?.stepDetails || {})

// New assessment sections (old format uses different keys — handled in getSectionHeadline)
const assessmentSections = computed(() => {
  const a = data.value?.assessment
  if (!a) return []
  // New format
  if (a.contribution) {
    return [
      { key: 'scope', label: 'Scope' },
      { key: 'contribution', label: 'Contribution' },
      { key: 'methods', label: 'Methods' },
      { key: 'writing', label: 'Writing' },
    ]
  }
  // Old format fallback
  return [
    { key: 'scope', label: 'Scope' },
    { key: 'significance', label: 'Significance' },
    { key: 'craft', label: 'Craft' },
    { key: 'methods', label: 'Methods' },
    { key: 'strategic_value', label: 'Strategic Value' },
  ]
})

// Backward-compatible section accessors
function getSectionHeadline(key) {
  const val = data.value?.assessment?.[key]
  if (!val) return ''
  if (typeof val === 'string') return val
  return val.headline || ''
}

function getSectionDetail(key) {
  const val = data.value?.assessment?.[key]
  if (!val || typeof val === 'string') return ''
  return val.detail || ''
}

function toggleSection(key) {
  expanded[key] = !expanded[key]
}

// Citation forecast — check both new (nested in contribution) and old (top-level) locations
const forecast = computed(() => {
  const a = data.value?.assessment
  if (!a) return null
  return a.contribution?.citation_forecast || a.citation_forecast || null
})

// Authors (new format)
const authors = computed(() => data.value?.assessment?.authors || null)

// AI content
const aiPct = computed(() => Math.round((data.value?.pangram?.aiScore || 0) * 100))
const humanPct = computed(() => Math.round((data.value?.pangram?.humanScore || 0) * 100))

// Reference stats — handles both old and new status names
const refStats = computed(() => {
  const results = data.value?.refCheck?.results || []
  return {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    errors: results.filter(r => r.status === 'error' || r.status === 'corrected').length,
    unverified: results.filter(r => r.status === 'unverified' || r.status === 'not_found').length,
  }
})

const refTextMap = computed(() => {
  const map = {}
  for (const r of (data.value?.references || [])) {
    if (r.key && r.raw) map[r.key] = r.raw
  }
  return map
})

const refIssues = computed(() => {
  return (data.value?.refCheck?.results || [])
    .filter(r => r.status !== 'verified')
    .map(r => ({ ...r, refText: refTextMap.value[r.key] || '' }))
})

const sortedRefs = computed(() => {
  return [...(data.value?.refCheck?.results || [])]
    .map(r => ({ ...r, refText: refTextMap.value[r.key] || '' }))
    .sort((a, b) => {
      const order = { error: 0, corrected: 0, unverified: 1, not_found: 1, verified: 2 }
      return (order[a.status] ?? 2) - (order[b.status] ?? 2)
    })
})

const referencesSummary = computed(() => {
  const a = data.value?.assessment
  return a?.references_summary || a?.references_interpretation || ''
})

const noveltySummary = computed(() => {
  const a = data.value?.assessment
  return a?.novelty_summary || a?.novelty_interpretation || ''
})

const featuredPapers = computed(() => {
  const papers = data.value?.novelty?.relatedPapers
  if (!papers?.length) return []
  const picks = []
  const byCitations = [...papers].sort((a, b) => (b.citedByCount || 0) - (a.citedByCount || 0))
  if (byCitations[0]?.citedByCount) {
    picks.push({ tag: 'Top cited', paper: byCitations[0] })
  }
  const byYear = [...papers].sort((a, b) => (b.year || 0) - (a.year || 0))
  if (byYear[0] && byYear[0].title !== picks[0]?.paper?.title) {
    picks.push({ tag: 'Recent', paper: byYear[0] })
  } else if (byYear[1]) {
    picks.push({ tag: 'Recent', paper: byYear[1] })
  }
  return picks
})

function fmt(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
}

function fmtK(n) {
  if (!n) return '0'
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

// ─── Data fetching ───

async function fetchStatus() {
  try {
    const result = await $fetch(`/api/triage/${slug}/status`)
    if (data.value) {
      data.value.status = result.status
      data.value.currentStep = result.currentStep
      data.value.stepDetails = result.stepDetails
      data.value.filename = result.filename
    } else {
      data.value = result
    }
    if (result.status === 'complete' || result.status === 'failed') {
      stopPolling()
      if (result.status === 'complete') await fetchFull()
    }
  } catch (e) {
    if (e.statusCode === 404) {
      fetchError.value = 'Triage not found.'
      stopPolling()
    }
  }
}

async function fetchFull() {
  try {
    data.value = await $fetch(`/api/triage/${slug}`)
  } catch (e) {
    fetchError.value = e.data?.statusMessage || 'Failed to load results.'
  }
}

function startPolling() { pollTimer = setInterval(fetchStatus, 2000) }
function stopPolling() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null } }

onMounted(async () => {
  await fetchFull()
  if (data.value?.status === 'processing') startPolling()
})

onUnmounted(() => stopPolling())
</script>
