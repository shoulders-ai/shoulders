<template>
  <div class="min-h-screen">
    <!-- LOADING -->
    <div v-if="state === 'loading'" class="min-h-screen flex items-center justify-center">
      <IconLoader2 :size="24" :stroke-width="1.5" class="text-stone-300 animate-spin" />
    </div>

    <!-- PROCESSING -->
    <div v-else-if="state === 'processing'" class="min-h-screen flex flex-col">
      <div class="px-6 py-4">
        <NuxtLink to="/" class="font-serif text-lg font-semibold text-stone-900 tracking-tight">Shoulders</NuxtLink>
      </div>
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="w-full max-w-md text-center">
          <IconLoader2 :size="28" :stroke-width="1.5" class="text-stone-300 animate-spin mx-auto mb-5" />
          <h1 class="text-xl font-serif font-semibold text-stone-900 tracking-tight mb-2">Your paper is being reviewed</h1>
          <p class="text-sm text-stone-600 leading-relaxed mb-6">
            This usually takes a few minutes. You can leave and come back &mdash; your review will be here.
          </p>
          <div
            class="flex items-center gap-2 border border-stone-200 rounded px-3 py-2 mb-4 cursor-pointer"
            @click="copyUrl"
          >
            <input
              type="text"
              :value="currentUrl"
              readonly
              class="flex-1 text-sm text-stone-600 bg-transparent border-none outline-none cursor-pointer"
            />
            <button class="p-1 text-stone-400 hover:text-stone-600 shrink-0 transition-colors">
              <span v-if="copied" class="text-xs text-sea-500 font-medium">Copied</span>
              <IconCheck v-if="copied" :size="16" :stroke-width="1.5" />
              <IconCopy v-else :size="16" :stroke-width="1.5" />
            </button>
          </div>
          <p class="text-xs text-stone-400">Bookmark this URL to return later.</p>
        </div>
      </div>
    </div>

    <!-- EXPIRED / NOT FOUND -->
    <div v-else-if="state === 'expired' || state === 'not_found'" class="min-h-screen flex flex-col">
      <div class="px-6 py-4">
        <NuxtLink to="/" class="font-serif text-lg font-semibold text-stone-900 tracking-tight">Shoulders</NuxtLink>
      </div>
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="w-full max-w-md text-center">
          <IconClockOff :size="28" :stroke-width="1.5" class="text-stone-300 mx-auto mb-5" />
          <h1 class="text-xl font-serif font-semibold text-stone-900 tracking-tight mb-2">
            {{ state === 'expired' ? 'This review has expired' : 'Review not found' }}
          </h1>
          <p class="text-sm text-stone-600 leading-relaxed mb-6">
            {{ state === 'expired' ? 'Reviews are automatically deleted after 48 hours.' : 'This review may have expired or the link is incorrect.' }}
          </p>
          <NuxtLink to="/review" class="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded tracking-wide transition-colors">
            Submit another paper
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- FAILED -->
    <div v-else-if="state === 'failed'" class="min-h-screen flex flex-col">
      <div class="px-6 py-4">
        <NuxtLink to="/" class="font-serif text-lg font-semibold text-stone-900 tracking-tight">Shoulders</NuxtLink>
      </div>
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="w-full max-w-md text-center">
          <IconAlertTriangle :size="28" :stroke-width="1.5" class="text-stone-300 mx-auto mb-5" />
          <h1 class="text-xl font-serif font-semibold text-stone-900 tracking-tight mb-2">Review could not be completed</h1>
          <p class="text-sm text-stone-600 leading-relaxed mb-6">
            We couldn't process this paper. This may happen with very short documents or non-research content.
          </p>
          <NuxtLink to="/review" class="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded tracking-wide transition-colors">
            Try again
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- COMPLETE -->
    <template v-else-if="state === 'complete'">
      <!-- Action Bar -->
      <div class="border-b border-stone-200 bg-white px-6 py-3 flex items-center justify-between print:hidden">
        <div class="flex items-center gap-3 min-w-0">
          <NuxtLink to="/" class="font-serif text-lg font-semibold text-stone-900 tracking-tight">Shoulders</NuxtLink>
          <span aria-hidden="true" class="inline-block h-4 w-px bg-stone-200" />
          <span class="text-sm text-stone-400">AI Review Report</span>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <span v-if="reviewData.expiresAt" class="text-xs text-stone-400">
            Expires {{ formatExpiry(reviewData.expiresAt) }}
          </span>
          <button @click="handleDelete" class="text-xs text-stone-400 hover:text-red-500 px-2 py-1.5 rounded transition-colors underline">
            Delete
          </button>
          <span aria-hidden="true" class="inline-block h-4 w-px bg-stone-200 mx-1" />
          <button @click="downloadMarkdown" class="text-xs text-stone-500 hover:text-stone-700 px-2 py-1.5 rounded transition-colors tracking-wide">
            .md
          </button>
          <button @click="downloadPdf" :disabled="isDownloadingPdf" class="bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium px-3.5 py-1.5 rounded tracking-wide transition-colors disabled:opacity-50">
            {{ isDownloadingPdf ? 'Generating...' : 'Download PDF' }}
          </button>
        </div>
      </div>

      <!-- Desktop: side-by-side (report+doc left, positioned comments right) -->
      <div v-if="isDesktop" class="flex justify-center" style="height: calc(100vh - 49px)">
        <div class="flex w-full max-w-7xl">
        <!-- Left: scrollable document panel -->
        <div ref="docPanel" class="review-doc-panel flex-1 overflow-y-auto" @click="handleDocClick">
          <div class="max-w-3xl px-8">
            <!-- Stats header -->
            <div v-if="summaryPhrase" class="mt-10 bg-stone-50 border border-stone-500 rounded px-3 py-2">
              <h2 class="text-sm font-semibold text-stone-900 leading-snug mb-1">
                Review results: {{ summaryPhrase }}.
              </h2>
              <p class="text-sm text-stone-500">
                Read the full report below and check the inline comments marked in your paper.
              </p>
            </div>
            <div v-if="reviewData.report" class="py-10 review-report" v-html="renderMarkdown(reviewData.report)" />
            <div v-if="reviewData.report" class="border-t border-stone-100 my-0" />
            <div class="py-10 review-document review-paper" v-html="reviewData.anchoredHtml" />

            <!-- Print-only: comments appendix -->
            <div v-if="sortedComments.length" class="hidden print:block border-t border-stone-200 py-8 review-print-comments">
              <h2 class="text-lg font-semibold text-stone-900 font-serif mb-6">Inline Comments</h2>
              <div v-for="comment in sortedComments" :key="'print-' + comment.id" class="mb-5">
                <div class="flex items-center gap-2 mb-1 text-xs">
                  <span class="font-medium text-stone-500">{{ comment.number }}.</span>
                  <span class="font-medium">[{{ comment.severity }}]</span>
                  <span class="text-stone-500">{{ comment.reviewer }}</span>
                </div>
                <blockquote class="text-xs text-stone-500 italic border-l-2 border-stone-300 pl-2 mb-1">
                  &ldquo;{{ comment.text_snippet }}&rdquo;
                </blockquote>
                <p class="text-sm text-stone-700 leading-relaxed">{{ comment.content }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: positioned comments column -->
        <div
          v-if="sortedComments.length"
          ref="commentsOuter"
          class="review-comments-column w-80 lg:w-96 shrink-0 overflow-hidden relative border-l border-stone-100 bg-stone-50/50"
        >
          <div ref="commentsInner" class="absolute w-full top-0 left-0 will-change-transform">
            <div class="relative w-full" :style="{ minHeight: totalHeight + 'px' }">
              <div
                v-for="comment in sortedComments"
                :key="comment.id"
                :ref="el => registerCard(el, comment.id)"
                class="absolute w-full px-2"
                :style="{
                  top: `${positions[comment.id] ?? 0}px`,
                  opacity: positions[comment.id] !== undefined ? 1 : 0,
                  zIndex: activeCommentId === comment.id ? 50 : 10,
                  transition: 'top 0.2s ease, opacity 0.15s ease',
                }"
                @click="setActive(comment.id)"
              >
                <div
                  class="rounded-lg bg-white p-3 cursor-pointer transition-shadow"
                  :class="activeCommentId === comment.id ? 'ring-1 ring-stone-300 shadow-sm' : 'hover:shadow-sm'"
                >
                  <div class="flex items-center gap-1.5 mb-1.5 text-xs">
                    <span class="font-medium text-stone-400">{{ comment.number }}.</span>
                    <span class="font-medium px-1.5 py-0.5 rounded" :class="severityClass(comment.severity)">
                      {{ comment.severity }}
                    </span>
                    <span class="text-stone-400 truncate">{{ comment.reviewer }}</span>
                  </div>
                  <p
                    class="text-sm text-stone-600 leading-relaxed"
                    :class="activeCommentId === comment.id ? '' : 'line-clamp-4'"
                  >
                    {{ comment.content }}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>

      <!-- Mobile: stacked layout -->
      <div v-else class="overflow-y-auto" @click="handleDocClick">
        <div class="max-w-3xl mx-auto px-6">
          <!-- Stats header -->
          <div v-if="summaryPhrase" class="mt-8 mb-6 bg-stone-50 border border-stone-200 rounded-lg px-5 py-4">
            <h2 class="text-base font-semibold text-stone-900 leading-snug mb-1.5">
              We reviewed your {{ domainPrefix }}paper and found {{ summaryPhrase }}.
            </h2>
            <p class="text-sm text-stone-500">
              Read the full report below, or check the inline comments marked in your paper.
            </p>
          </div>
          <div v-if="reviewData.report" class="py-8 review-report" v-html="renderMarkdown(reviewData.report)" />
          <div v-if="reviewData.report" class="border-t border-stone-100 my-0" />
          <div class="py-8 review-document review-paper" v-html="reviewData.anchoredHtml" />
        </div>

        <div v-if="sortedComments.length" class="max-w-3xl mx-auto px-6 pb-12">
          <div class="border-t border-stone-100 pt-8">
            <h3 class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-5">Inline Comments</h3>
            <div class="space-y-5">
              <div
                v-for="comment in sortedComments"
                :key="comment.id"
                :id="`comment-${comment.id}`"
                class="cursor-pointer"
                @click="scrollToMark(comment.id)"
              >
                <div class="flex items-center gap-2 mb-1.5">
                  <span class="text-xs font-medium text-stone-400">{{ comment.number }}.</span>
                  <span class="text-xs font-medium px-1.5 py-0.5 rounded" :class="severityClass(comment.severity)">
                    {{ comment.severity }}
                  </span>
                  <span class="text-xs text-stone-400">{{ comment.reviewer }}</span>
                </div>
                <p class="text-sm text-stone-600 leading-relaxed">{{ comment.content }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import {
  IconLoader2, IconClockOff, IconAlertTriangle,
  IconCheck, IconCopy
} from '@tabler/icons-vue'
import { useReviewLayout } from '~/composables/useReviewLayout'
import { useScrollSync } from '~/composables/useScrollSync'

definePageMeta({ layout: false })
useHead({ title: 'Peer Review — Shoulders' })

const route = useRoute()
const router = useRouter()
const slug = computed(() => String(route.params.slug))

const state = ref('loading')
const reviewData = ref({})
const copied = ref(false)
const currentUrl = computed(() => typeof window !== 'undefined' ? window.location.href : '')
const activeCommentId = ref(null)
const isDesktop = ref(true)

const docPanel = ref(null)
const commentsOuter = ref(null)
const commentsInner = ref(null)
const isDownloadingPdf = ref(false)

let pollInterval = null

// Sort comments by mark position in document HTML
const sortedComments = computed(() => {
  const comments = reviewData.value?.comments
  const html = reviewData.value?.anchoredHtml
  if (!comments?.length || !html) return comments || []

  const markOrder = {}
  const regex = /data-comment-id="([^"]+)"/g
  let match, idx = 0
  while ((match = regex.exec(html)) !== null) {
    if (!(match[1] in markOrder)) markOrder[match[1]] = idx++
  }
  return [...comments].sort((a, b) => (markOrder[a.id] ?? Infinity) - (markOrder[b.id] ?? Infinity))
})

// Summary sentence for stats header
const summaryPhrase = computed(() => {
  const counts = { major: 0, minor: 0, suggestion: 0 }
  for (const c of sortedComments.value) {
    if (c.severity in counts) counts[c.severity]++
  }
  const parts = []
  if (counts.major) parts.push(`${counts.major} major issue${counts.major !== 1 ? 's' : ''}`)
  if (counts.minor) parts.push(`${counts.minor} minor issue${counts.minor !== 1 ? 's' : ''}`)
  if (counts.suggestion) parts.push(`${counts.suggestion} suggestion${counts.suggestion !== 1 ? 's' : ''}`)
  if (!parts.length) return null
  if (parts.length === 1) return parts[0]
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`
  return `${parts[0]}, ${parts[1]}, and ${parts[2]}`
})

const domainPrefix = computed(() => {
  const hint = reviewData.value?.domainHint
  return hint ? `${hint.toLowerCase()} ` : ''
})

// Comment positioning
const commentsRef = computed(() => sortedComments.value)
const { positions, registerCardHeight, recalculate } = useReviewLayout(docPanel, commentsRef, activeCommentId)
useScrollSync(docPanel, commentsInner)

const totalHeight = computed(() => {
  const c = sortedComments.value
  if (!c.length) return 0
  const last = c[c.length - 1]
  return (positions.value[last.id] ?? 0) + 200
})

function registerCard(el, id) {
  if (!el) return
  nextTick(() => {
    const h = el.getBoundingClientRect().height
    if (h > 0) registerCardHeight(id, h)
  })
}

function setActive(id) {
  activeCommentId.value = activeCommentId.value === id ? null : id
  if (activeCommentId.value) {
    const mark = docPanel.value?.querySelector(`mark[data-comment-id="${id}"]`)
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
      mark.classList.add('ring-2', 'ring-stone-400')
      setTimeout(() => mark.classList.remove('ring-2', 'ring-stone-400'), 2000)
    }
  }
}

function handleDocClick(e) {
  const mark = e.target.closest('mark[data-comment-id]')
  if (!mark) return
  setActive(mark.getAttribute('data-comment-id'))
}

function scrollToMark(commentId) {
  const mark = document.querySelector(`mark[data-comment-id="${commentId}"]`)
  if (mark) {
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' })
    mark.classList.add('ring-2', 'ring-stone-400')
    setTimeout(() => mark.classList.remove('ring-2', 'ring-stone-400'), 2000)
  }
}

function severityClass(severity) {
  if (severity === 'major') return 'bg-red-50 text-red-700'
  if (severity === 'minor') return 'bg-amber-50 text-amber-700'
  return 'bg-blue-50 text-blue-700'
}

function renderMarkdown(text) {
  if (!text) return ''
  return text
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^\- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[hul])(.+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
}

async function checkStatus() {
  try {
    const { status } = await $fetch(`/api/review/${slug.value}/status`)
    if (status === 'complete') {
      clearInterval(pollInterval)
      await loadReview()
    } else if (status === 'failed') {
      clearInterval(pollInterval)
      state.value = 'failed'
    }
  } catch (e) {
    if (e.statusCode === 404) {
      clearInterval(pollInterval)
      state.value = 'not_found'
    }
  }
}

async function loadReview() {
  try {
    const data = await $fetch(`/api/review/${slug.value}`)

    if (data.status === 'failed') {
      state.value = 'failed'
      return
    }

    if (data.status !== 'complete') {
      state.value = 'processing'
      return
    }

    reviewData.value = data
    state.value = 'complete'

    // Trigger layout recalculation after DOM renders
    await nextTick()
    await nextTick()
    recalculate()
  } catch (e) {
    if (e.statusCode === 410) state.value = 'expired'
    else if (e.statusCode === 404) state.value = 'not_found'
    else if (e.statusCode) state.value = 'failed'
  }
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(window.location.href)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {}
}

async function downloadPdf() {
  isDownloadingPdf.value = true
  try {
    const blob = await $fetch(`/api/review/${slug.value}/pdf`, { responseType: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `peer-review-${slug.value}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('PDF download failed:', e)
  } finally {
    isDownloadingPdf.value = false
  }
}

function downloadMarkdown() {
  const data = reviewData.value
  if (!data) return

  let md = '# Peer Review Report\n\n'
  if (data.report) md += data.report + '\n\n---\n\n'

  if (sortedComments.value.length) {
    md += '## Comments\n\n'
    for (const c of sortedComments.value) {
      md += `### ${c.number}. [${c.severity}] — ${c.reviewer}\n`
      md += `> "${c.text_snippet}"\n\n`
      md += `${c.content}\n\n`
    }
  }

  const blob = new Blob([md], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `peer-review-${slug.value}.md`
  a.click()
  URL.revokeObjectURL(url)
}

async function handleDelete() {
  if (!confirm('Delete this review? This cannot be undone.')) return
  try {
    await $fetch(`/api/review/${slug.value}`, { method: 'DELETE' })
    router.push('/review')
  } catch {}
}

function formatExpiry(dateStr) {
  const expiry = new Date(dateStr)
  const now = new Date()
  const hours = Math.max(0, Math.round((expiry - now) / (1000 * 60 * 60)))
  if (hours < 1) return 'soon'
  if (hours < 24) return `in ${hours}h`
  return `in ${Math.round(hours / 24)}d`
}

function checkDesktop() { isDesktop.value = window.innerWidth >= 1024 }

onMounted(async () => {
  checkDesktop()
  window.addEventListener('resize', checkDesktop)

  await loadReview()
  if (state.value === 'processing') {
    pollInterval = setInterval(checkStatus, 5000)
  }
})

onBeforeUnmount(() => {
  if (pollInterval) clearInterval(pollInterval)
  window.removeEventListener('resize', checkDesktop)
})
</script>

<style>
/* Document display styles */
.review-document {
  font-family: 'Open Sans', sans-serif;
  color: #44403c;
  font-size: 15px;
  line-height: 1.7;
}
.review-document h1 { font-size: 24px; font-weight: 600; color: #1c1917; margin: 1.5em 0 0.5em; font-family: 'Crimson Text', serif; }
.review-document h2 { font-size: 20px; font-weight: 600; color: #1c1917; margin: 1.5em 0 0.5em; font-family: 'Crimson Text', serif; }
.review-document h3 { font-size: 17px; font-weight: 600; color: #1c1917; margin: 1.5em 0 0.5em; font-family: 'Crimson Text', serif; }
.review-document p { margin: 0.75em 0; }
.review-document table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 13px; }
.review-document th, .review-document td { border: 1px solid #e7e5e4; padding: 6px 10px; text-align: left; }
.review-document th { background: #fafaf9; font-weight: 600; }
.review-document img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 4px; }

/* Comment mark highlights */
.review-document mark[data-severity="major"] {
  background: #fef2f2; border-bottom: 2px solid #fca5a5; padding: 1px 0; cursor: pointer;
}
.review-document mark[data-severity="minor"] {
  background: #fffbeb; border-bottom: 2px solid #fcd34d; padding: 1px 0; cursor: pointer;
}
.review-document mark[data-severity="suggestion"] {
  background: #eff6ff; border-bottom: 2px solid #93c5fd; padding: 1px 0; cursor: pointer;
}

/* Report section */
.review-report h1 { font-size: 20px; font-weight: 600; color: #1c1917; margin: 0 0 0.75em; font-family: 'Crimson Text', serif; }
.review-report h2 { font-size: 17px; font-weight: 600; color: #1c1917; margin: 1.25em 0 0.5em; font-family: 'Crimson Text', serif; }
.review-report h3 { font-size: 15px; font-weight: 600; color: #1c1917; margin: 1em 0 0.5em; font-family: 'Crimson Text', serif; }
.review-report ul { padding-left: 1.25em; margin: 0.5em 0; }
.review-report li { margin: 0.25em 0; font-size: 14px; color: #57534e; }
.review-report p { font-size: 14px; color: #57534e; line-height: 1.6; margin: 0.5em 0; }
</style>
