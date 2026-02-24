<template>
  <div>

    <!-- HERO -->
    <section class="pt-36 pb-20 md:pt-44 md:pb-24 px-6">
      <div class="max-w-3xl mx-auto text-center">
        <h1 class="font-serif text-3xl sm:text-3xl md:text-4xl font-semibold leading-tight tracking-tight text-stone-900">
          The AI Workspace for Researchers
        </h1>
        <p class="mt-5 text-base md:text-lg text-stone-600 max-w-md mx-auto leading-relaxed">
          Writing, reference management, and coding, combined with truly capable AI assistance
        </p>
        <div class="mt-9">
          <DownloadButton :large="true" />
        </div>
      </div>
      <div class="max-w-5xl mx-auto mt-16 md:mt-20">
        <img src="/img/hero-main.png" alt="Shoulders workspace — paper draft, references sidebar, AI chat" class="w-full" />
        <!-- rounded-lg shadow-xl -->
      </div>
    </section>


    <!-- SOCIAL PROOF -->
    <section class="py-12 border-y border-stone-100">
      <div class="max-[100vw] mx-auto px-6">
        <p class="text-center text-xs font-medium text-stone-400 uppercase tracking-[0.2em] mb-8">
          Used by researchers at
        </p>
        <div class="flex flex-wrap justify-center items-center gap-x-8 md:gap-x-10 gap-y-6 mb-6">
          <img
            v-for="inst in institutions"
            :key="inst.name"
            :src="inst.src"
            :alt="inst.name"
            :style="{ width: (inst.w * 1.2) + 'px', height: 'auto' }"
            class="grayscale opacity-40 hover:opacity-60 transition-opacity select-none"
          >
        </div>
      </div>
    </section>


    <!-- PILLAR 1 — AI integration -->
    <section class="py-24 md:py-32">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row-reverse items-center gap-12 md:gap-16">
        <div class="flex-1">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">AI Integration</p>
          <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900">
            Work with AI on a shared canvas
          </h2>
          <p class="mt-5 text-base text-stone-600 leading-relaxed">
            The AI can access your workspace and help you write or find references &ndash; it can suggest changes directly in your document.
          </p>
        </div>
        <div class="flex-1 w-full md:flex-[1.2]">
          <video ref="video1" muted loop playsinline poster="/img/feat-1.png" class="w-full rounded-lg shadow-xl"></video>
        </div>
      </div>
    </section>


    <!-- PILLAR 2 — References -->
    <section class="py-24 md:py-32 border-t border-stone-100 bg-stone-50/80">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-12 md:gap-16">
        <div class="flex-1">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">References</p>
          <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900">
            Surprisingly great reference management
          </h2>
          <p class="mt-5 text-base text-stone-600 leading-relaxed">
            Add references by pasting titles, DOIs, or dropping PDFs &ndash; Shoulders will try to find and verify the metadata.
          </p>
        </div>
        <div class="flex-1 w-full md:flex-[1.2]">
          <video ref="video2" muted loop playsinline poster="/img/feat-2.png" class="w-full rounded-lg shadow-xl"></video>
        </div>
      </div>
    </section>


    <!-- PILLAR 3 — Ghost suggestions -->
    <section class="py-24 md:py-32 border-t border-stone-100">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row-reverse items-center gap-12 md:gap-16">
        <div class="flex-1">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">Writing</p>
          <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900">
            Built to augment, not intrude
          </h2>
          <p class="mt-5 text-base text-stone-600 leading-relaxed">
            The AI stays out of your way until you ask &ndash; press <kbd class="inline-block rounded-sm border border-stone-200 bg-stone-50 px-1 py-0 text-[0.75em] font-medium text-stone-500 shadow-[0_1px_0_rgba(0,0,0,0.06)] align-middle ms-0.5">+</kbd><kbd class="inline-block rounded-sm border border-stone-200 bg-stone-50 px-1 py-0 text-[0.75em] font-medium text-stone-500 shadow-[0_1px_0_rgba(0,0,0,0.06)] align-middle mx-0.5">+</kbd>
            and get a few ideas to complete your thought without breaking your flow.
          </p>
        </div>
        <div class="flex-1 w-full md:flex-[1.2]">
          <video ref="video3" muted loop playsinline poster="/img/feat-3.png" class="w-full rounded-lg shadow-xl"></video>
        </div>
      </div>
    </section>


    <!-- PILLAR 4 — Coding -->
    <section class="py-24 md:py-32 border-t border-stone-100 bg-stone-50/80">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-12 md:gap-16">
        <div class="flex-1">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">Coding & Data</p>
          <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900">
            Analysis and manuscript in one place
          </h2>
          <p class="mt-5 text-base text-stone-600 leading-relaxed">
            Run code next to your draft. The AI can critique your analysis, or check that your methods section actually matches your code.
          </p>
        </div>
        <div class="flex-1 w-full md:flex-[1.2]">
          <video ref="video4" muted loop playsinline poster="/img/feat-4.png" class="w-full rounded-lg shadow-xl"></video>
        </div>
      </div>
    </section>


    <!-- FEATURE GRID -->
    <section id="features" class="py-24 md:py-32 border-t border-stone-100 bg-white">
      <div class="max-w-6xl mx-auto px-6">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-10">
          <!-- Lead 1 — Full control -->
          <div class="sm:col-span-2 border-t-2 border-stone-500 pt-6 pb-10 rounded-b">
            <h3 class="flex items-center gap-3 text-lg font-semibold text-stone-900 tracking-tight">
              <IconAdjustments :size="20" class="text-stone-400 shrink-0" :stroke-width="1.5" />
              Full control
            </h3>
            <p class="mt-2.5 text-base text-stone-600 leading-relaxed max-w-md">
              All files stay on your machine. You can use API keys to connect to public or private LLMs — or subscribe to for simplicity. 
            </p>
          </div>
          <!-- Lead 2 — Shared context -->
          <div class="sm:col-span-2 border-t-2 border-stone-500 pt-6 pb-10 rounded-b">
            <h3 class="flex items-center gap-3 text-lg font-semibold text-stone-900 tracking-tight">
              <IconBrain :size="20" class="text-stone-400 shrink-0" :stroke-width="1.5" />
              Shared context
            </h3>
            <p class="mt-2.5 text-base text-stone-600 leading-relaxed max-w-md">
              Your references, notes, PDFs, data, code, and manuscripts — all in one workspace, shared with your AI research assistant.
            </p>
          </div>
          <div v-for="feat in features" :key="feat.title" class="border-t border-stone-200 pt-6 pb-10">
            <h3 class="flex items-center gap-3 text-lg font-semibold text-stone-900 tracking-tight">
              <component :is="feat.icon" :size="18" class="text-stone-400 shrink-0" :stroke-width="1.5" />
              {{ feat.title }}
            </h3>
            <p class="mt-2.5 text-base text-stone-600 leading-relaxed">{{ feat.desc }}</p>
          </div>
        </div>
      </div>
    </section>


    <!-- COMPARISON TABLE -->
    <section class="py-24 md:py-32 border-t border-stone-100 bg-stone-50/80">
      <div class="max-w-4xl mx-auto px-6">
        <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900 text-center mb-14">
          The AI Workspace for Researchers
        </h2>

        <!-- Desktop -->
        <div class="hidden md:block bg-white border border-stone-200 rounded-lg shadow-sm overflow-hidden">
          <table class="w-full">
            <thead class="bg-stone-50">
              <tr class="border-b border-stone-200">
                <th class="text-left py-3.5 pl-6 pr-6 text-xs font-semibold text-stone-500 uppercase tracking-wider w-[40%]">Task</th>
                <th class="text-left py-3.5 px-6 text-xs font-semibold text-stone-500 uppercase tracking-wider">What researchers use today</th>
                <th class="text-left py-3.5 px-6 text-xs font-semibold text-stone-500 uppercase tracking-wider w-48">Shoulders</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in comparisons" :key="row.task" class="border-b border-stone-100 last:border-b-0 even:bg-stone-50/50 hover:bg-stone-50 transition-colors">
                <td class="py-3.5 pl-6 pr-6 text-sm font-medium text-stone-800">{{ row.task }}</td>
                <td class="py-3.5 px-6 text-sm text-stone-500">{{ row.tools }}</td>
                <td class="py-3.5 px-6">
                  <span class="inline-flex items-center gap-2">
                    <IconCheck :size="15" class="text-sea-700 shrink-0" :stroke-width="2.5" />
                    <span v-if="row.qualifier" class="text-xs text-stone-400">{{ row.qualifier }}</span>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Mobile -->
        <div class="md:hidden bg-white border border-stone-200 rounded-lg shadow-sm divide-y divide-stone-100 overflow-hidden">
          <div v-for="row in comparisons" :key="row.task" class="p-4 even:bg-stone-50/50">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-stone-800">{{ row.task }}</span>
              <span class="inline-flex items-center gap-1.5 shrink-0 ml-3 bg-stone-50 px-2 py-0.5 rounded border border-stone-100">
                <IconCheck :size="14" class="text-sea-600" :stroke-width="2.5" />
                <span v-if="row.qualifier" class="text-[10px] font-medium text-stone-500 uppercase tracking-wider">{{ row.qualifier }}</span>
              </span>
            </div>
            <p class="mt-2 text-xs text-stone-500">{{ row.tools }}</p>
          </div>
        </div>

        <p class="mt-12 text-center text-base font-medium text-stone-700 tracking-tight">
          Better AI collaboration through shared context in a fully integrated workspace.
        </p>
      </div>
    </section>


    <!-- PEER REVIEW (free tool) -->
    <section class="py-24 md:py-32 border-t border-stone-100">
      <div class="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center gap-12 md:gap-16">
        <div class="flex-1">
          <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">Free Research Preview</p>
          <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900">
            AI peer review
          </h2>
          <p class="mt-5 text-base text-stone-600 leading-relaxed">
            Upload a draft manuscript and receive a structured AI review &mdash; methodology checks, editorial feedback, and reference verification.
          </p>
          <p class="mt-4 text-xs text-stone-400 leading-relaxed">
            Takes about five minutes. No account required.
          </p>
          <div class="mt-8">
            <NuxtLink to="/review" class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded tracking-wide transition-colors">
              Upload a paper
            </NuxtLink>
          </div>
        </div>
        <div class="flex-1 w-full md:flex-[1.2]">
          <div class="border border-stone-200 rounded-lg shadow-sm overflow-hidden select-none" aria-hidden="true">
            <div class="px-4 py-2.5 border-b border-stone-100 flex items-center gap-2 text-[10px]">
              <span class="font-medium text-stone-800">Review complete</span>
              <span class="text-stone-200">&middot;</span>
              <span class="text-red-600/80 font-medium">3 major</span>
              <span class="text-stone-200">&middot;</span>
              <span class="text-amber-600/80 font-medium">5 minor</span>
              <span class="text-stone-200">&middot;</span>
              <span class="text-blue-600/80 font-medium">4 suggestions</span>
            </div>
            <div class="flex">
              <div class="flex-1 p-5 text-xs leading-[1.7] text-stone-500">
                <p class="text-[10px] font-semibold text-stone-700 uppercase tracking-wider mb-2">3. Results</p>
                <p>
                  The Supimab intervention group
                  <mark class="bg-red-50/80 border-b-[1.5px] border-red-300/70 rounded-sm px-0.5 text-stone-600">approaches a borderline significant improvement (p&nbsp;=&nbsp;0.07)</mark>
                  compared to control group, with a mean change of 4.2 points on the composite score. <mark class="bg-amber-50/80 border-b-[1.5px] border-amber-300/70 rounded-sm px-0.5 text-stone-600">We found that effect sizes ranged from small to moderate</mark> across all primary endpoints.
                </p>
                <p class="mt-2">
                  We applied the MXTT approach, as previously described in Egghart et al. (2025), and confirmed <mark class="bg-blue-50/80 border-b-[1.5px] border-blue-300/70 rounded-sm px-0.5 text-stone-600">consistent trends across pre-specified subgroups.</mark>
                </p>
              </div>
              <div class="w-40 lg:w-48 shrink-0 border-l border-stone-100 bg-stone-50/30 p-2.5 space-y-2 hidden sm:block">
                <div class="bg-white border border-stone-200/60 rounded p-2">
                  <span class="inline-block px-1 py-px rounded text-[9px] font-medium bg-red-50 text-red-700/80 mb-1">Major</span>
                  <p class="text-[10px] leading-[1.5] text-stone-500">Exceeds conventional significance threshold. Report as &ldquo;not statistically significant&rdquo;.</p>
                </div>
                <div class="bg-white border border-stone-200/60 rounded p-2">
                  <span class="inline-block px-1 py-px rounded text-[9px] font-medium bg-amber-50 text-amber-700/80 mb-1">Minor</span>
                  <p class="text-[10px] leading-[1.5] text-stone-500">Report mean effect sizes with confidence intervals.</p>
                </div>
                <div class="bg-white border border-stone-200/60 rounded p-2">
                  <span class="inline-block px-1 py-px rounded text-[9px] font-medium bg-blue-50 text-blue-700/80 mb-1">Suggestion</span>
                  <p class="text-[10px] leading-[1.5] text-stone-500">State if subgroup comparisons were pre-specified.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>


    <!-- NEWTON QUOTE -->
    <section class="relative min-h-[min(70vh,700px)] flex items-center overflow-hidden">
      <div class="absolute inset-0 bg-cover bg-center" style="background-image: url('/img/wide-land.jpg')" />
      <div class="absolute inset-0 bg-stone-950/[0.4]" />
      <div class="relative max-w-2xl mx-auto px-6 text-center py-24 md:py-32">
        <blockquote class="font-serif text-xl md:text-2xl italic leading-relaxed text-white/90">
          &ldquo;If I have seen further, it is by standing on the shoulders of giants.&rdquo;
        </blockquote>
        <p class="mt-6 text-sm text-white/90 tracking-wider" >
          Isaac Newton, 1675 <span class="px-0.5"></span>(echoing Bernard of Chartres, c. 1120)
        </p>
      </div>
    </section>


    <!-- CTA -->
    <section class="py-28 md:py-36 border-t border-stone-100">
      <div class="max-w-2xl mx-auto px-6 text-center">
        <h2 class="font-serif text-2xl md:text-2xl font-semibold leading-tight tracking-tight text-stone-900">
          Try Shoulders now
        </h2>
        <div class="mt-9">
          <DownloadButton :large="true" />
        </div>
        <div class="mt-3 flex items-center justify-center gap-4 text-xs text-stone-600">
          <NuxtLink to="/download" class="hover:text-stone-900 transition-colors">All downloads</NuxtLink>
          <span class="text-stone-200">&middot;</span>
          <a href="https://github.com/shoulders-ai/shoulders" target="_blank" rel="noopener" class="hover:text-stone-900 transition-colors">
            Source code
          </a>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import {
  IconBrain,
  IconFileText,
  IconCode,
  IconAdjustments,
  IconLink,
  IconEye,
  IconHistory,
  IconCheck,
} from '@tabler/icons-vue'

// ---------------------------------------------------------------------------
// Feature videos — scroll-driven play/pause, deferred loading
// ---------------------------------------------------------------------------

const video1 = ref(null)
const video2 = ref(null)
const video3 = ref(null)
const video4 = ref(null)

const VIDEO_SOURCES = [
  [video1, '/video/feat-ai-ref-fetch.mp4'],
  [video2, '/video/feat-ref-imports.mp4'],
  [video3, '/video/feat-ghost.mp4'],
  [video4, '/video/feat-r-to-md.mp4'],
]

let observer = null

onMounted(() => {
  let active = null

  // --- Helpers ---
  const play = (el) => {
    if (active && active !== el) active.pause()
    active = el
    if (document.hidden) return
    el.play().catch(() => {
      // Video not ready yet — retry once buffered
      el.addEventListener('canplay', () => {
        if (active === el && !document.hidden) el.play().catch(() => {})
      }, { once: true })
    })
  }
  const pause = (el) => {
    el.pause()
    if (active === el) active = null
  }

  // --- Scroll-driven play/pause (primary) ---
  // Active zone = middle 50% of viewport.
  observer = new IntersectionObserver((entries) => {
    entries.forEach(e => e.isIntersecting ? play(e.target) : pause(e.target))
  }, { rootMargin: '-25% 0px -25% 0px' })

  VIDEO_SOURCES.forEach(([r]) => { if (r.value) observer.observe(r.value) })

  // --- Scroll fallback (safety net) ---
  // rAF-throttled, passive — catches observer misses on fast scroll / WebKit edge cases.
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      const mid = window.innerHeight / 2
      let closest = null, closestDist = Infinity
      VIDEO_SOURCES.forEach(([r]) => {
        if (!r.value?.src) return
        const rect = r.value.getBoundingClientRect()
        if (rect.bottom < 0 || rect.top > window.innerHeight) return
        const dist = Math.abs(rect.top + rect.height / 2 - mid)
        if (dist < closestDist) { closest = r.value; closestDist = dist }
      })
      if (closest && closest !== active) play(closest)
      if (!closest && active) { active.pause(); active = null }
    })
  }
  window.addEventListener('scroll', onScroll, { passive: true })

  // --- Tab visibility: pause when hidden, resume when visible ---
  const onVisibility = () => {
    if (!active) return
    document.hidden ? active.pause() : active.play().catch(() => {})
  }
  document.addEventListener('visibilitychange', onVisibility)

  // --- Deferred loading: inject src after critical path (hero, CSS, fonts) ---
  const loadSources = () => {
    VIDEO_SOURCES.forEach(([r, src]) => {
      if (!r.value) return
      r.value.src = src
      r.value.load()
      // If already scrolled into active zone before load finished, play once ready
      if (r.value === active) {
        r.value.addEventListener('canplay', () => {
          if (r.value === active && !document.hidden) r.value.play().catch(() => {})
        }, { once: true })
      }
    })
  }

  if (document.readyState === 'complete') loadSources()
  else window.addEventListener('load', loadSources, { once: true })
})

onUnmounted(() => {
  if (observer) observer.disconnect()
})

// Pre-computed widths from area-equalization formula: pow(ratio, 0.525) * base
// Height clamped to ~50px max so emblem logos don't tower over wordmarks
const institutions = [
  { name: 'Northwestern University', src: '/img/northwestern.png', w: 127 },
  { name: 'OECD', src: '/img/oecd.svg', w: 123 },
  { name: 'Erasmus University Rotterdam', src: '/img/erasmus.svg.png', w: 130 },
  { name: 'University of Oxford', src: '/img/oxford.svg', w: 114 },
  { name: 'University of British Columbia', src: '/img/ubc.png', w: 137 },
  { name: 'GSK', src: '/img/gsk.svg', w: 109 },
  { name: 'Humboldt-Universität zu Berlin', src: '/img/humboldt.jpg', w: 95 },
]

const features = [
  { icon: IconFileText, title: 'Write in any format', desc: 'Word, Markdown, or LaTeX. Export publication-ready documents with formatted citations.' },
  { icon: IconLink, title: 'Linked notes', desc: 'Connect ideas with [[wiki links]]. Bidirectional references between your notes and papers.' },
  { icon: IconEye, title: 'Full transparency', desc: 'Shoulders\' full source code is openly available. No hidden fees. No vendor lock-in.' },
  { icon: IconHistory, title: 'Version control', desc: 'Every change saved automatically. Full history, one-click restore. Never lose work again.' },
]

const comparisons = [
  { task: 'Write a paper', tools: 'Word, Markdown, LaTeX', qualifier: 'supports all 3 formats' },
  { task: 'Manage references', tools: 'Zotero, Mendeley, Endnote', qualifier: 'built-in' },
  { task: 'AI writing assistance', tools: 'ChatGPT (copy-paste)', qualifier: 'contextual' },
  { task: 'Summarise papers', tools: 'ChatGPT, NotebookLM', qualifier: 'reads your PDFs' },
  { task: 'Search for papers', tools: 'Google Scholar, Semantic Scholar', qualifier: 'integrated tools' },
  { task: 'Run analysis code', tools: 'RStudio, VS Code, Cursor', qualifier: 'built-in' },
  { task: 'Organise notes', tools: 'Notepad, Notion, Obsidian', qualifier: 'wiki links' },
  { task: 'Version control', tools: 'Git CLI, Overleaf premium', qualifier: 'automatic' },
  { task: 'Read PDFs', tools: 'Zotero, browser, Adobe', qualifier: 'built-in' },
]
</script>