<template>
  <div class="min-h-screen bg-white font-sans antialiased">
    <!-- Top bar -->
    <header class="border-b border-stone-200 bg-white sticky top-0 z-10">
      <div class="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
        <NuxtLink to="/triage" class="font-serif font-semibold text-base tracking-tight text-stone-900 hover:text-stone-700 transition-colors">
          Paper Triage
        </NuxtLink>
        <NuxtLink to="/triage"
          class="px-4 py-1.5 text-xs font-medium text-white bg-stone-900 hover:bg-stone-800 rounded tracking-wide transition-colors">
          Upload New
        </NuxtLink>
      </div>
    </header>

    <div class="max-w-4xl mx-auto px-6 py-8">

      <!-- Error state -->
      <div v-if="fetchError" class="text-center py-24">
        <p class="text-base text-stone-600 mb-2">Triage not found</p>
        <p class="text-sm text-stone-400 mb-6">This assessment may have expired or the URL is incorrect.</p>
        <NuxtLink to="/triage"
          class="px-5 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 rounded tracking-wide transition-colors inline-block">
          Upload a paper
        </NuxtLink>
      </div>

      <!-- Processing state -->
      <div v-else-if="!data || data.status === 'processing'" class="max-w-lg mx-auto py-16">
        <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-3">Analysing</p>
        <h1 class="font-serif text-xl font-semibold tracking-tight text-stone-900 mb-8">{{ data?.filename || 'Document' }}</h1>

        <div class="space-y-4">
          <!-- Step: Extract -->
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
              <svg v-if="steps.extracted" class="w-4 h-4 text-sea-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="data?.currentStep === 'extracting'" class="w-4 h-4 text-cadet-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div v-else class="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
            </div>
            <p class="text-sm" :class="steps.extracted ? 'text-stone-900' : data?.currentStep === 'extracting' ? 'text-stone-500' : 'text-stone-300'">
              <template v-if="steps.extracted">
                Text extracted — {{ steps.extracted.pageEstimate ? `~${steps.extracted.pageEstimate} pages, ` : '' }}{{ formatNumber(steps.extracted.wordCount) }} words
              </template>
              <template v-else>Extracting text</template>
            </p>
          </div>

          <!-- Step: References identified -->
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
              <svg v-if="steps.referencesExtracted" class="w-4 h-4 text-sea-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="steps.extracted && !steps.referencesExtracted" class="w-4 h-4 text-cadet-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div v-else class="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
            </div>
            <p class="text-sm" :class="steps.referencesExtracted ? 'text-stone-900' : steps.extracted ? 'text-stone-500' : 'text-stone-300'">
              <template v-if="steps.referencesExtracted">{{ steps.referencesExtracted.count }} references identified</template>
              <template v-else>Identifying references</template>
            </p>
          </div>

          <!-- Step: References verified -->
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
              <svg v-if="steps.referencesChecked" class="w-4 h-4 text-sea-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="data?.currentStep === 'checking' && !steps.referencesChecked" class="w-4 h-4 text-cadet-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div v-else class="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
            </div>
            <p class="text-sm" :class="steps.referencesChecked ? 'text-stone-900' : data?.currentStep === 'checking' ? 'text-stone-500' : 'text-stone-300'">
              <template v-if="steps.referencesChecked">
                References verified — {{ steps.referencesChecked.verified }} confirmed{{ steps.referencesChecked.notFound ? `, ${steps.referencesChecked.notFound} not found` : '' }}{{ steps.referencesChecked.corrected ? `, ${steps.referencesChecked.corrected} corrected` : '' }}
              </template>
              <template v-else>Verifying references</template>
            </p>
          </div>

          <!-- Step: AI scan -->
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
              <svg v-if="steps.pangram !== undefined" class="w-4 h-4 text-sea-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="data?.currentStep === 'checking' && steps.pangram === undefined" class="w-4 h-4 text-cadet-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div v-else class="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
            </div>
            <p class="text-sm" :class="steps.pangram !== undefined ? 'text-stone-900' : data?.currentStep === 'checking' ? 'text-stone-500' : 'text-stone-300'">
              <template v-if="steps.pangram !== undefined">AI content scan complete</template>
              <template v-else>Scanning for AI content</template>
            </p>
          </div>

          <!-- Step: Assessment -->
          <div class="flex items-start gap-3">
            <div class="w-5 h-5 mt-0.5 flex-shrink-0 flex items-center justify-center">
              <svg v-if="data?.currentStep === 'complete'" class="w-4 h-4 text-sea-500" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
              </svg>
              <svg v-else-if="data?.currentStep === 'assessing'" class="w-4 h-4 text-cadet-500 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" />
                <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <div v-else class="w-1.5 h-1.5 rounded-full bg-stone-200"></div>
            </div>
            <p class="text-sm" :class="data?.currentStep === 'complete' ? 'text-stone-900' : data?.currentStep === 'assessing' ? 'text-stone-500' : 'text-stone-300'">
              <template v-if="data?.currentStep === 'complete'">Assessment complete</template>
              <template v-else>Running assessment</template>
            </p>
          </div>
        </div>

        <p class="text-xs text-stone-300 mt-10">This usually takes 1–2 minutes.</p>
      </div>

      <!-- Failed state -->
      <div v-else-if="data.status === 'failed'" class="text-center py-24">
        <p class="text-base text-stone-600 mb-2">Assessment could not be completed</p>
        <p class="text-sm text-stone-400 mb-6">Something went wrong during processing. Please try again with a different file.</p>
        <NuxtLink to="/triage"
          class="px-5 py-2 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 rounded tracking-wide transition-colors inline-block">
          Upload another paper
        </NuxtLink>
      </div>

      <!-- ═══════════ Dashboard ═══════════ -->
      <div v-else-if="data.status === 'complete' && data.assessment">

        <!-- Document header -->
        <div class="mb-8">
          <h1 class="font-serif text-xl font-semibold tracking-tight text-stone-900">{{ data.filename }}</h1>
          <div class="flex items-center gap-3 mt-2 text-xs text-stone-400">
            <span v-if="steps.extracted?.pageEstimate" class="font-mono">{{ steps.extracted.pageEstimate }} pages</span>
            <span v-if="steps.extracted?.wordCount" class="font-mono">{{ formatNumber(steps.extracted.wordCount) }} words</span>
            <span v-if="data.references?.length" class="font-mono">{{ data.references.length }} references</span>
            <span v-if="refStats.total" class="font-mono">{{ refStats.verified }} verified</span>
          </div>
        </div>

        <!-- Summary — hero section -->
        <div class="border border-stone-200 rounded-lg p-6 mb-8">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-3">Summary</p>
          <p class="text-base text-stone-600 leading-relaxed">{{ data.assessment.summary }}</p>
        </div>

        <!-- Assessment grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div v-for="section in assessmentSections" :key="section.key"
            class="border border-stone-200 rounded-lg p-5">
            <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-2">{{ section.label }}</p>
            <p class="text-sm text-stone-600 leading-relaxed">{{ data.assessment[section.key] }}</p>
          </div>
        </div>

        <!-- AI Content -->
        <div class="border border-stone-200 rounded-lg p-5 mb-8">
          <div class="flex items-baseline justify-between gap-4 mb-2">
            <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em]">AI Content</p>
            <span v-if="data.pangram?.available" class="text-xs text-stone-400 font-mono">
              {{ Math.round((data.pangram.humanScore || 0) * 100) }}% human · {{ Math.round((data.pangram.aiScore || 0) * 100) }}% AI-assisted
            </span>
          </div>
          <p class="text-sm text-stone-600 leading-relaxed">{{ data.assessment.ai_content }}</p>
        </div>

        <!-- Reference Issues -->
        <div class="border border-stone-200 rounded-lg p-5 mb-8">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em]">References</p>
            <span class="text-xs text-stone-400 font-mono">
              {{ refStats.verified }} of {{ refStats.total }} verified{{ refStats.corrected ? ` · ${refStats.corrected} corrected` : '' }}{{ refStats.notFound ? ` · ${refStats.notFound} not found` : '' }}
            </span>
          </div>

          <!-- Issues first (corrected + not found) -->
          <div v-if="refIssues.length" class="space-y-3 mb-4">
            <div v-for="issue in refIssues" :key="issue.key"
              class="border-l-2 pl-4 py-1"
              :class="issue.status === 'corrected' ? 'border-amber-400' : 'border-stone-300'">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-stone-900">{{ issue.key }}</span>
                <span class="text-xs"
                  :class="issue.status === 'corrected' ? 'text-amber-600' : 'text-stone-400'">
                  {{ issue.status === 'corrected' ? 'Corrected' : 'Not found' }}
                </span>
              </div>
              <p v-if="issue.note" class="text-xs text-stone-500 mt-1 leading-relaxed">{{ issue.note }}</p>
            </div>
          </div>

          <!-- Interpretation -->
          <p v-if="data.assessment.references_interpretation" class="text-sm text-stone-600 leading-relaxed"
            :class="refIssues.length ? 'pt-3 border-t border-stone-100' : ''">
            {{ data.assessment.references_interpretation }}
          </p>

          <!-- Expand full list -->
          <button v-if="refStats.total > 0" @click="refsExpanded = !refsExpanded"
            class="mt-3 text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1">
            {{ refsExpanded ? 'Hide' : 'Show' }} all {{ refStats.total }} references
            <svg class="w-3 h-3 transition-transform" :class="refsExpanded && 'rotate-180'" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
            </svg>
          </button>
          <div v-if="refsExpanded" class="mt-3 pt-3 border-t border-stone-100">
            <div v-for="r in sortedRefs" :key="r.key"
              class="flex items-start gap-3 py-1.5 text-xs"
              :class="r.status !== 'verified' ? 'text-stone-700' : 'text-stone-400'">
              <span class="font-mono w-8 flex-shrink-0 text-right">{{ r.key }}</span>
              <span class="flex-1">
                <span v-if="r.status === 'corrected'" class="text-amber-600 font-medium mr-1">corrected</span>
                <span v-else-if="r.status === 'not_found'" class="text-stone-400 mr-1">not found</span>
                <span v-if="r.note" class="text-stone-500"> — {{ r.note }}</span>
              </span>
            </div>
          </div>
        </div>

        <!-- Related Work -->
        <div class="border border-stone-200 rounded-lg p-5 mb-8">
          <div class="flex items-center justify-between mb-3">
            <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em]">Related Work</p>
            <span v-if="data.novelty?.relatedPapers?.length" class="text-xs text-stone-400 font-mono">
              {{ data.novelty.relatedPapers.length }} papers found
            </span>
          </div>

          <p v-if="data.assessment.novelty_interpretation" class="text-sm text-stone-600 leading-relaxed mb-4">
            {{ data.assessment.novelty_interpretation }}
          </p>

          <div v-if="data.novelty?.relatedPapers?.length">
            <button @click="noveltyExpanded = !noveltyExpanded"
              class="text-xs text-stone-400 hover:text-stone-600 transition-colors flex items-center gap-1">
              {{ noveltyExpanded ? 'Hide' : 'Show' }} papers
              <svg class="w-3 h-3 transition-transform" :class="noveltyExpanded && 'rotate-180'" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd"/>
              </svg>
            </button>
            <div v-if="noveltyExpanded" class="mt-3 pt-3 border-t border-stone-100 space-y-3">
              <div v-for="(p, i) in data.novelty.relatedPapers" :key="i">
                <p class="text-sm text-stone-700">{{ p.title }}</p>
                <p class="text-xs text-stone-400 mt-0.5">
                  <span class="font-mono">{{ p.year || '?' }}</span>
                  <template v-if="p.journal"> · {{ p.journal }}</template>
                  <template v-if="p.citedByCount"> · <span class="font-mono">{{ p.citedByCount }}</span> citations</template>
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Reviewer Suggestions -->
        <div class="border border-stone-200 rounded-lg p-5 mb-12">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-2">Reviewer Suggestions</p>
          <p class="text-sm text-stone-300">Coming soon</p>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="border-t border-stone-100 py-4 text-center">
      <a href="https://shoulde.rs" class="text-xs text-stone-300 hover:text-stone-400 transition-colors tracking-wide">
        shoulde.rs
      </a>
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const slug = route.params.slug

const data = ref(null)
const fetchError = ref('')
const refsExpanded = ref(false)
const noveltyExpanded = ref(false)
let pollTimer = null

useHead({ title: 'Paper Triage — Shoulders' })

const steps = computed(() => data.value?.stepDetails || {})

const assessmentSections = [
  { key: 'scope', label: 'Scope' },
  { key: 'significance', label: 'Significance' },
  { key: 'credibility', label: 'Credibility' },
  { key: 'craft', label: 'Craft' },
  { key: 'methods', label: 'Methods' },
  { key: 'strategic_value', label: 'Strategic Value' },
]

const refStats = computed(() => {
  const results = data.value?.refCheck?.results || []
  return {
    total: results.length,
    verified: results.filter(r => r.status === 'verified').length,
    corrected: results.filter(r => r.status === 'corrected').length,
    notFound: results.filter(r => r.status === 'not_found').length,
  }
})

const refIssues = computed(() => {
  const results = data.value?.refCheck?.results || []
  return results.filter(r => r.status === 'corrected' || r.status === 'not_found')
})

const sortedRefs = computed(() => {
  const results = data.value?.refCheck?.results || []
  // Issues first, then verified
  return [...results].sort((a, b) => {
    const order = { corrected: 0, not_found: 1, verified: 2 }
    return (order[a.status] ?? 2) - (order[b.status] ?? 2)
  })
})

function formatNumber(n) {
  if (!n) return '0'
  return n.toLocaleString()
}

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
      if (result.status === 'complete') {
        await fetchFull()
      }
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

function startPolling() {
  pollTimer = setInterval(fetchStatus, 2000)
}

function stopPolling() {
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null }
}

onMounted(async () => {
  await fetchFull()
  if (data.value?.status === 'processing') {
    startPolling()
  }
})

onUnmounted(() => stopPolling())
</script>
