<template>
  <div class="min-h-screen bg-stone-50 font-sans antialiased flex flex-col">
    <!-- Top bar -->
    <header class="border-b border-stone-200 bg-white sticky top-0 z-10">
      <div class="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
        <NuxtLink to="/triage" class="text-sm font-semibold tracking-tight text-stone-900 hover:text-stone-700 transition-colors">
          Paper Triage
        </NuxtLink>
        <NuxtLink to="/triage"
          class="px-3.5 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors">
          Upload New
        </NuxtLink>
      </div>
    </header>

    <!-- Main -->
    <div class="flex-1 mt-10">
      <div class="max-w-3xl mx-auto px-6">

        <!-- Error state -->
        <div v-if="fetchError" class="text-center py-24">
          <p class="text-sm text-stone-600 mb-2">Triage not found</p>
          <p class="text-xs text-stone-400 mb-6">This assessment may have expired or the URL is incorrect.</p>
          <NuxtLink to="/triage"
            class="px-5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors inline-block">
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

            <StepRow :done="!!steps.metadata" :active="!!steps.extracted && !steps.metadata">
              <template v-if="steps.metadata">
                Metadata — {{ steps.metadata.authors }} {{ steps.metadata.authors === 1 ? 'author' : 'authors' }} identified
              </template>
              <template v-else>Extracting metadata</template>
            </StepRow>

            <StepRow :done="!!steps.referencesExtracted" :active="!!steps.metadata && !steps.referencesExtracted">
              <template v-if="steps.referencesExtracted">{{ steps.referencesExtracted.count }} references identified</template>
              <template v-else>Identifying references</template>
            </StepRow>

            <StepRow :done="!!steps.referencesChecked" :active="data?.currentStep === 'checking' && !steps.referencesChecked">
              <template v-if="steps.referencesChecked">
                Verified — {{ steps.referencesChecked.verified }} ok{{ steps.referencesChecked.unverified ? `, ${steps.referencesChecked.unverified} unverified` : '' }}{{ steps.referencesChecked.errors ? `, ${steps.referencesChecked.errors} errors` : '' }}
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
            class="px-5 py-2 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors inline-block">
            Upload another paper
          </NuxtLink>
        </div>

        <!-- ═══════════ Dashboard ═══════════ -->
        <div v-else-if="data.status === 'complete'" class="bg-white border-x border-b border-stone-200 px-8 py-6 mb-8">

          <!-- ─── THE PAPER ─── -->
          <div class="mb-6">
            <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-3">The Paper</p>

            <!-- Title -->
            <h1 class="text-lg font-semibold text-stone-900 leading-snug mb-2">
              {{ paperTitle }}
            </h1>

            <!-- Authors -->
            <div v-if="paperAuthors.length" class="mb-3">
              <div class="flex flex-wrap gap-x-1 gap-y-1 items-baseline">
                <template v-for="(author, i) in paperAuthors" :key="i">
                  <button v-if="author.profile?.status === 'found'"
                    @click="toggleAuthor(i)"
                    class="text-sm text-stone-600 hover:text-stone-900 transition-colors">
                    {{ author.display }}<span v-if="i < paperAuthors.length - 1" class="text-stone-300">,</span>
                  </button>
                  <span v-else class="text-sm text-stone-500">
                    {{ author.display }}<span v-if="i < paperAuthors.length - 1" class="text-stone-300">,</span>
                  </span>
                </template>
              </div>

              <!-- Expanded author profile -->
              <div v-if="expandedAuthorIdx !== null && paperAuthors[expandedAuthorIdx]?.profile?.status === 'found'"
                class="mt-2 pl-3 border-l-2 border-stone-200 py-2">
                <p class="text-xs text-stone-700 font-medium">{{ paperAuthors[expandedAuthorIdx].profile.openalex_name }}</p>
                <p class="text-xs text-stone-500 font-mono mt-1">
                  {{ paperAuthors[expandedAuthorIdx].profile.institution || 'Institution unknown' }}
                  <template v-if="paperAuthors[expandedAuthorIdx].profile.works_count">
                    · {{ fmt(paperAuthors[expandedAuthorIdx].profile.works_count) }} works
                  </template>
                  <template v-if="paperAuthors[expandedAuthorIdx].profile.cited_by_count">
                    · {{ fmt(paperAuthors[expandedAuthorIdx].profile.cited_by_count) }} citations
                  </template>
                </p>
                <p v-if="paperAuthors[expandedAuthorIdx].profile.orcid" class="text-xs text-stone-400 font-mono mt-0.5">
                  ORCID: {{ paperAuthors[expandedAuthorIdx].profile.orcid }}
                </p>
              </div>
            </div>

            <!-- Stats line -->
            <p class="text-xs text-stone-400 font-mono mb-4">
              <template v-if="steps.extracted?.pageEstimate">{{ steps.extracted.pageEstimate }} pages · </template>
              <template v-if="steps.extracted?.wordCount">{{ fmt(steps.extracted.wordCount) }} words · </template>
              <template v-if="steps.extracted?.tableCount">{{ steps.extracted.tableCount }} {{ steps.extracted.tableCount === 1 ? 'table' : 'tables' }} · </template>
              <template v-if="steps.extracted?.figureCount">{{ steps.extracted.figureCount }} {{ steps.extracted.figureCount === 1 ? 'figure' : 'figures' }} · </template>
              {{ refStats.total }} references
            </p>

            <!-- Abstract -->
            <div v-if="paperAbstract">
              <button @click="toggleSection('abstract')" class="w-full text-left group">
                <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-1 flex items-center gap-2">
                  Abstract
                  <span class="text-stone-300 group-hover:text-stone-500 transition-colors">
                    {{ expanded.abstract ? 'Hide ▾' : 'Show ▸' }}
                  </span>
                </p>
              </button>
              <p v-if="expanded.abstract" class="text-sm text-stone-600 leading-relaxed mt-1">{{ paperAbstract }}</p>
            </div>

            <!-- View Original -->
            <a v-if="data.hasFile" :href="`/api/triage/${slug}/file`" target="_blank"
              class="inline-block mt-3 px-3 py-1.5 text-xs font-medium text-stone-600 border border-stone-200 hover:border-stone-300 hover:text-stone-800 transition-colors">
              View Original
            </a>
          </div>

          <!-- ─── VERDICT ─── -->
          <div class="border-t border-stone-200 py-5">
            <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-3">Verdict</p>

            <!-- TL;DR -->
            <p class="text-sm text-stone-700 leading-relaxed mb-4">
              {{ assessmentVerdict }}
            </p>

            <!-- Scope Fit -->
            <div v-if="scopeFit" class="mb-3">
              <button @click="toggleSection('scope')" class="w-full text-left flex items-start justify-between gap-4 group">
                <div class="flex-1 min-w-0">
                  <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]">Scope</span>
                  <span class="text-sm text-stone-700 ml-2">{{ scopeFit.headline }}</span>
                </div>
                <span v-if="scopeFit.detail" class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-0.5">
                  {{ expanded.scope ? 'Hide ▾' : 'Details ▸' }}
                </span>
              </button>
              <p v-if="expanded.scope && scopeFit.detail" class="text-xs text-stone-500 leading-relaxed mt-2 pl-0">
                {{ scopeFit.detail }}
              </p>
            </div>

            <!-- Impact + Citation Forecast -->
            <div v-if="impactSection">
              <button @click="toggleSection('impact')" class="w-full text-left flex items-start justify-between gap-4 group">
                <div class="flex-1 min-w-0">
                  <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]">Impact</span>
                  <span class="text-sm text-stone-700 ml-2">{{ impactSection.headline }}</span>
                  <span v-if="forecast" class="text-sm text-stone-500 ml-1">
                    — <span class="font-mono tabular-nums">~{{ forecast.point_estimate }}</span> cit/<span class="font-mono tabular-nums">{{ forecast.horizon_months || 24 }}</span>mo
                    <span class="text-stone-400 font-mono tabular-nums">({{ forecast.range_low }}–{{ forecast.range_high }})</span>
                  </span>
                </div>
                <span class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-0.5">
                  {{ expanded.impact ? 'Hide ▾' : 'Details ▸' }}
                </span>
              </button>
              <div v-if="expanded.impact" class="mt-2">
                <p v-if="forecast?.reasoning" class="text-xs text-stone-500 leading-relaxed">{{ forecast.reasoning }}</p>
              </div>
            </div>
          </div>

          <!-- ─── INTEGRITY ─── -->
          <div class="border-t border-stone-200 py-5">
            <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-3">Integrity</p>

            <!-- References -->
            <IntegrityRow
              :status="refIntegrityStatus"
              label="References"
              :headline="refHeadline"
              :has-detail="true"
              :is-expanded="!!expanded.refs"
              @toggle="toggleSection('refs')">
              <template #detail>
                <!-- Assessment summary -->
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

                <!-- Full list toggle -->
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
                      <span v-if="r.refText" class="text-stone-500">{{ r.refText.slice(0, 100) }}{{ r.refText.length > 100 ? '...' : '' }}</span>
                      <span v-if="r.note" class="text-stone-400"> — {{ r.note }}</span>
                    </span>
                  </div>
                </div>
              </template>
            </IntegrityRow>

            <!-- AI Content -->
            <IntegrityRow
              :status="aiIntegrityStatus"
              label="AI content"
              :headline="aiHeadline"
              :has-detail="!!aiDetail"
              :is-expanded="!!expanded.ai_content"
              @toggle="toggleSection('ai_content')">
              <template #detail>
                <p class="text-xs text-stone-500 leading-relaxed">{{ aiDetail }}</p>
              </template>
            </IntegrityRow>

            <!-- Methods -->
            <IntegrityRow
              :status="methodsStatus"
              label="Methods"
              :headline="methodsHeadline"
              :has-detail="!!methodsDetail"
              :is-expanded="!!expanded.methods"
              @toggle="toggleSection('methods')">
              <template #detail>
                <p class="text-xs text-stone-500 leading-relaxed">{{ methodsDetail }}</p>
              </template>
            </IntegrityRow>

            <!-- Writing -->
            <IntegrityRow
              :status="writingStatus"
              label="Writing"
              :headline="writingHeadline"
              :has-detail="!!writingDetail"
              :is-expanded="!!expanded.writing"
              @toggle="toggleSection('writing')">
              <template #detail>
                <p class="text-xs text-stone-500 leading-relaxed">{{ writingDetail }}</p>
              </template>
            </IntegrityRow>
          </div>

          <!-- ─── CONTEXT ─── -->
          <div class="border-t border-stone-200 py-5">
            <p class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em] mb-3">Context</p>

            <!-- Contribution -->
            <div class="mb-3">
              <button @click="toggleSection('contribution')" class="w-full text-left flex items-start justify-between gap-4 group">
                <div class="flex-1 min-w-0">
                  <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]">Contribution</span>
                  <span class="text-sm text-stone-700 ml-2">{{ contributionHeadline }}</span>
                </div>
                <span class="text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-0.5">
                  {{ expanded.contribution ? 'Hide ▾' : 'Details ▸' }}
                </span>
              </button>

              <div v-if="expanded.contribution" class="mt-2">
                <p v-if="contributionDetail" class="text-xs text-stone-500 leading-relaxed mb-3">{{ contributionDetail }}</p>

                <!-- Novelty summary -->
                <p v-if="noveltySummary" class="text-xs text-stone-500 leading-relaxed mb-3">{{ noveltySummary }}</p>

                <!-- Featured papers -->
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

                <!-- All papers toggle -->
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
            <div class="flex items-center justify-between mt-2">
              <span class="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]">Reviewer Suggestions</span>
              <span class="text-[10px] text-stone-300 font-mono">coming soon</span>
            </div>
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

const IntegrityRow = defineComponent({
  props: { status: String, label: String, headline: String, hasDetail: Boolean, isExpanded: Boolean },
  emits: ['toggle'],
  setup(props, { emit, slots }) {
    const statusIcon = () => {
      if (props.status === 'clear') return h('span', { class: 'text-emerald-600' }, '✓')
      if (props.status === 'warning') return h('span', { class: 'text-amber-600' }, '⚠')
      if (props.status === 'concern') return h('span', { class: 'text-red-600' }, '✗')
      return h('span', { class: 'text-stone-400' }, '—')
    }

    return () => h('div', { class: 'mb-2' }, [
      h('button', {
        class: 'w-full text-left flex items-start gap-2 group',
        onClick: () => emit('toggle'),
      }, [
        h('span', { class: 'text-sm flex-shrink-0 mt-px w-4 text-center' }, [statusIcon()]),
        h('div', { class: 'flex-1 min-w-0 flex items-start justify-between gap-4' }, [
          h('div', { class: 'flex-1 min-w-0' }, [
            h('span', { class: 'text-[10px] font-semibold text-stone-400 uppercase tracking-[0.12em]' }, props.label),
            h('span', { class: 'text-sm text-stone-700 ml-2' }, props.headline),
          ]),
          props.hasDetail
            ? h('span', { class: 'text-[10px] text-stone-400 group-hover:text-stone-600 transition-colors whitespace-nowrap mt-0.5' },
                `${props.isExpanded ? 'Hide ▾' : 'Details ▸'}`)
            : null,
        ]),
      ]),
      props.isExpanded && props.hasDetail
        ? h('div', { class: 'mt-2 ml-6' }, slots.detail?.())
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
const expanded = reactive({ abstract: true })
const expandedAuthorIdx = ref(null)
let pollTimer = null

useHead({ title: 'Paper Triage — Shoulders' })

const steps = computed(() => data.value?.stepDetails || {})

// ─── Paper Identity ───

const paperTitle = computed(() => {
  return data.value?.metadata?.title || data.value?.filename || 'Untitled'
})

const paperAuthors = computed(() => {
  const meta = data.value?.metadata?.authors || []
  const profiles = data.value?.authorProfiles || []

  return meta.map(a => {
    const profile = profiles.find(p =>
      p.name?.toLowerCase() === a.name?.toLowerCase() ||
      p.openalex_name?.toLowerCase() === a.name?.toLowerCase()
    )
    const affiliation = profile?.institution || a.affiliation
    return {
      display: affiliation ? `${a.name} (${affiliation})` : a.name,
      profile,
    }
  })
})

const paperAbstract = computed(() => data.value?.metadata?.abstract || null)

function toggleAuthor(idx) {
  expandedAuthorIdx.value = expandedAuthorIdx.value === idx ? null : idx
}

// ─── Verdict ───

const assessmentVerdict = computed(() => {
  const a = data.value?.assessment
  if (!a) return ''
  // New format: verdict string
  if (a.verdict) return a.verdict
  // Old format: summary array
  if (Array.isArray(a.summary)) return a.summary.join(' ')
  // Old format: summary string
  if (typeof a.summary === 'string') return a.summary
  return ''
})

const scopeFit = computed(() => {
  const a = data.value?.assessment
  if (!a) return null
  // New format
  if (a.scope_fit) return a.scope_fit
  // Old format
  if (a.scope) return typeof a.scope === 'string' ? { headline: a.scope, detail: '' } : a.scope
  return null
})

const impactSection = computed(() => {
  const a = data.value?.assessment
  if (!a) return null
  // New format
  if (a.impact) return a.impact
  // Old format: contribution had the headline
  if (a.contribution?.headline) return { headline: a.contribution.headline }
  return null
})

const forecast = computed(() => {
  const a = data.value?.assessment
  if (!a) return null
  return a.impact?.citation_forecast || a.contribution?.citation_forecast || a.citation_forecast || null
})

// ─── Integrity ───

// References
const refStats = computed(() => {
  const results = data.value?.refCheck?.results || []
  return {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    errors: results.filter(r => r.status === 'error' || r.status === 'corrected').length,
    unverified: results.filter(r => r.status === 'unverified' || r.status === 'not_found').length,
  }
})

const refIntegrityStatus = computed(() => {
  if (refStats.value.errors > 0) return 'warning'
  if (refStats.value.unverified > 3) return 'warning'
  return 'clear'
})

const refHeadline = computed(() => {
  const s = refStats.value
  let text = `${s.verified}/${s.total} verified`
  if (s.errors) text += ` · ${s.errors} ${s.errors === 1 ? 'error' : 'errors'}`
  if (s.unverified) text += ` · ${s.unverified} unverified`
  return text
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

// AI Content
const aiPct = computed(() => Math.round((data.value?.pangram?.aiScore || 0) * 100))
const humanPct = computed(() => Math.round((data.value?.pangram?.humanScore || 0) * 100))

const aiIntegrityStatus = computed(() => {
  if (!data.value?.pangram?.available) return 'neutral'
  if (aiPct.value > 30) return 'concern'
  if (aiPct.value > 10) return 'warning'
  return 'clear'
})

const aiHeadline = computed(() => {
  if (!data.value?.pangram?.available) return 'AI detection not available'
  const prediction = data.value.pangram.prediction
  if (prediction === 'human') return `${humanPct.value}% human`
  if (prediction === 'ai') return `${aiPct.value}% AI detected`
  return `${humanPct.value}% human · ${aiPct.value}% AI`
})

const aiDetail = computed(() => {
  const a = data.value?.assessment
  // New format
  if (a?.ai_content) return typeof a.ai_content === 'string' ? a.ai_content : a.ai_content.detail || a.ai_content.headline || ''
  return ''
})

// Methods
const methodsStatus = computed(() => {
  const a = data.value?.assessment
  if (a?.methodology?.status) return a.methodology.status
  if (a?.methods?.status) return a.methods.status
  return 'neutral'
})

const methodsHeadline = computed(() => {
  const a = data.value?.assessment
  if (a?.methodology?.headline) return a.methodology.headline
  if (a?.methods) return typeof a.methods === 'string' ? a.methods : a.methods.headline || ''
  return ''
})

const methodsDetail = computed(() => {
  const a = data.value?.assessment
  if (a?.methodology?.detail) return a.methodology.detail
  if (a?.methods?.detail) return a.methods.detail
  return ''
})

// Writing
const writingStatus = computed(() => {
  const a = data.value?.assessment
  return a?.writing?.status || 'neutral'
})

const writingHeadline = computed(() => {
  const a = data.value?.assessment
  if (!a?.writing) return ''
  return typeof a.writing === 'string' ? a.writing : a.writing.headline || ''
})

const writingDetail = computed(() => {
  const a = data.value?.assessment
  return a?.writing?.detail || ''
})

// ─── Context ───

const contributionHeadline = computed(() => {
  const a = data.value?.assessment
  if (!a?.contribution) return ''
  return typeof a.contribution === 'string' ? a.contribution : a.contribution.headline || ''
})

const contributionDetail = computed(() => {
  const a = data.value?.assessment
  return a?.contribution?.detail || ''
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

// ─── Helpers ───

function toggleSection(key) {
  expanded[key] = !expanded[key]
}

function fmt(n) {
  if (n == null) return '0'
  return Number(n).toLocaleString()
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
