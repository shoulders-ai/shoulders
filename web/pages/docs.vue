<template>
  <!-- Fill viewport below the fixed SiteHeader (h-14 = 56px) -->
  <div class="h-[calc(100vh-56px)] mt-14 w-full flex flex-col overflow-hidden">

    <!-- Mobile header -->
    <div class="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-white z-20 flex-shrink-0">
      <button @click="mobileOpen = !mobileOpen" class="p-1 text-stone-400 hover:text-stone-600">
        <IconMenu2 :size="20" :stroke-width="1.5" />
      </button>
      <span class="font-serif font-medium text-base text-stone-900">{{ activeSection?.title || 'Docs' }}</span>
      <NuxtLink to="/" class="text-stone-400 hover:text-stone-600">
        <IconExternalLink :size="18" :stroke-width="1.5" />
      </NuxtLink>
    </div>

    <!-- Full-width scroll container (scrollbar at viewport edge) -->
    <div ref="scrollContainer" class="flex-1 overflow-y-auto scroll-smooth">
      <!-- Centered workspace -->
      <div class="flex w-full max-w-5xl min-h-full mx-auto relative">

        <!-- Sidebar column -->
        <div
          class="fixed inset-y-0 left-0 z-30 md:sticky md:top-0 md:inset-auto md:h-[calc(100vh-56px)] md:flex-shrink-0 bg-white md:bg-transparent shadow-lg md:shadow-none border-r border-stone-100 md:border-none"
          :class="[mobileOpen ? 'translate-x-0 w-56' : '-translate-x-full md:translate-x-0 w-56']"
        >
          <DocsSidebar
            :groups="sidebarGroups"
            :active-id="activeId"
            :is-mobile-open="mobileOpen"
            @select="selectSection"
            @toggle-mobile="mobileOpen = false"
          />
        </div>

        <!-- Mobile overlay backdrop -->
        <div
          v-if="mobileOpen"
          @click="mobileOpen = false"
          class="fixed inset-0 bg-black/10 z-20 md:hidden"
        />

        <!-- Content column -->
        <div class="flex-1 min-w-0 px-6 md:pl-12 md:pr-8">
          <article class="docs-prose py-10 md:py-14 pb-24 md:pb-32">
            <DocsGettingStarted v-if="activeId === 'getting-started'" />
            <DocsMarkdown v-else-if="activeId === 'markdown'" />
            <DocsWordDocuments v-else-if="activeId === 'word'" />
            <DocsLatex v-else-if="activeId === 'latex'" />
            <DocsReferences v-else-if="activeId === 'references'" />
            <DocsAiSetup v-else-if="activeId === 'ai-setup'" />
            <DocsInlineSuggestions v-else-if="activeId === 'inline-suggestions'" />
            <DocsAiChat v-else-if="activeId === 'ai-chat'" />
            <DocsAiTasks v-else-if="activeId === 'ai-tasks'" />
            <DocsAiTools v-else-if="activeId === 'ai-tools'" />
            <DocsCodeAndNotebooks v-else-if="activeId === 'code'" />
            <DocsNavigationSettings v-else-if="activeId === 'navigation'" />
            <DocsKeyboardShortcuts v-else-if="activeId === 'shortcuts'" />
            <DocsPrivacy v-else-if="activeId === 'privacy'" />
          </article>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { IconMenu2, IconExternalLink } from '@tabler/icons-vue'

definePageMeta({ layout: 'docs' })

useSeoMeta({
  title: 'Documentation — Shoulders',
  description: 'Learn how to use Shoulders — the AI workspace for researchers. Writing, references, code, and AI in one place.',
})

const sidebarGroups = [
  {
    label: 'Start',
    items: [
      { id: 'getting-started', title: 'Getting Started' },
    ]
  },
  {
    label: 'Writing',
    items: [
      { id: 'markdown', title: 'Markdown' },
      { id: 'word', title: 'Word Documents' },
      { id: 'latex', title: 'LaTeX' },
      { id: 'references', title: 'References & Citations' },
    ]
  },
  {
    label: 'AI Assistant',
    items: [
      { id: 'ai-setup', title: 'Setup' },
      { id: 'inline-suggestions', title: 'Inline Suggestions' },
      { id: 'ai-chat', title: 'AI Chat' },
      { id: 'ai-tasks', title: 'Tasks' },
      { id: 'ai-tools', title: 'Tools & Review' },
    ]
  },
  {
    label: 'Workspace',
    items: [
      { id: 'code', title: 'Code & Notebooks' },
      { id: 'navigation', title: 'Navigation & Settings' },
      { id: 'shortcuts', title: 'Keyboard Shortcuts' },
      { id: 'privacy', title: 'Privacy & Data' },
    ]
  }
]

const allSections = sidebarGroups.flatMap(g => g.items)
const route = useRoute()
const router = useRouter()
const mobileOpen = ref(false)
const scrollContainer = ref(null)

const activeId = ref('getting-started')
const activeSection = computed(() => allSections.find(s => s.id === activeId.value))

const selectSection = (id, headingTitle = null) => {
  activeId.value = id
  mobileOpen.value = false
  router.replace({ query: { section: id } })
  
  if (headingTitle) {
    // Wait for the new section component to mount/render
    setTimeout(() => {
      if (!scrollContainer.value) return
      
      const headings = Array.from(scrollContainer.value.querySelectorAll('.docs-prose h1, .docs-prose h2, .docs-prose h3'))
      const target = headings.find(h => h.textContent.trim() === headingTitle)
      
      if (target) {
        // We need to account for the fixed header height when scrolling
        const containerTop = scrollContainer.value.getBoundingClientRect().top
        const targetTop = target.getBoundingClientRect().top
        
        // Calculate scroll position, adding some padding (32px) above the heading
        const scrollTop = scrollContainer.value.scrollTop + (targetTop - containerTop) - 32
        
        scrollContainer.value.scrollTo({ top: scrollTop, behavior: 'smooth' })
      } else {
        scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }, 50) // Small delay to ensure DOM is updated
  } else if (scrollContainer.value) {
    scrollContainer.value.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  if (route.query.section) {
    const found = allSections.find(s => s.id === route.query.section)
    if (found) activeId.value = found.id
  }
})

watch(() => route.query.section, (val) => {
  if (val) {
    const found = allSections.find(s => s.id === val)
    if (found) activeId.value = found.id
  }
})
</script>

<style>
/* Docs prose — typography for all documentation content */
.docs-prose h1 {
  @apply font-serif text-2xl md:text-3xl font-semibold tracking-tight text-stone-900 mb-2;
}
.docs-prose .docs-subtitle {
  @apply text-base text-stone-400 mb-10;
}
.docs-prose h2 {
  @apply font-serif text-xl font-semibold tracking-tight text-stone-900 mt-14 mb-4;
}
.docs-prose h2:first-of-type {
  @apply mt-10;
}
.docs-prose h3 {
  @apply text-base font-semibold text-stone-900 mt-8 mb-3;
}
.docs-prose p {
  @apply text-base text-stone-600 leading-relaxed mb-4;
}
.docs-prose ul {
  @apply text-base text-stone-600 leading-relaxed list-disc pl-5 mb-4 space-y-1.5;
}
.docs-prose ol {
  @apply text-base text-stone-600 leading-relaxed list-decimal pl-5 mb-4 space-y-1.5;
}
.docs-prose li {
  @apply pl-0.5;
}
.docs-prose strong {
  @apply font-medium text-stone-800;
}
.docs-prose code {
  @apply text-stone-700 bg-stone-100 px-1 py-0.5 rounded text-xs font-mono;
}
.docs-prose pre {
  @apply bg-stone-50 border border-stone-200 rounded-lg p-4 mb-4 overflow-x-auto text-xs font-mono text-stone-700 leading-relaxed;
}
.docs-prose pre code {
  @apply bg-transparent p-0 rounded-none;
}
.docs-prose a {
  @apply text-stone-700 underline decoration-stone-300 hover:decoration-stone-500 transition-colors;
}
.docs-prose hr {
  @apply my-10 border-stone-100;
}
.docs-prose .docs-table {
  @apply w-full text-sm mb-6;
}
.docs-prose .docs-table th {
  @apply text-left text-xs font-semibold text-stone-400 uppercase tracking-wider pb-2 border-b border-stone-200;
}
.docs-prose .docs-table td {
  @apply py-2.5 text-stone-600 border-b border-stone-100;
}
.docs-prose .docs-table td:first-child {
  @apply text-stone-800 font-medium pr-6;
}

/* Keyboard shortcut badge */
.docs-prose kbd {
  @apply inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 text-[10px] font-medium text-stone-500 bg-stone-100 border border-stone-200 rounded shadow-[0_1px_0_0_rgba(0,0,0,0.04)] font-mono leading-none;
}

/* Step list */
.docs-prose .docs-steps {
  @apply space-y-4 mb-6;
}
.docs-prose .docs-step {
  @apply flex gap-3;
}
.docs-prose .docs-step-number {
  @apply flex-shrink-0 w-5 h-5 rounded-full bg-stone-100 text-stone-500 text-xs font-medium flex items-center justify-center mt-0.5;
}
.docs-prose .docs-step-content {
  @apply text-base text-stone-600 leading-relaxed;
}

/* Feature row */
.docs-prose .docs-feature-row {
  @apply flex justify-between items-baseline py-3 border-b border-stone-100 text-sm;
}
.docs-prose .docs-feature-row dt {
  @apply text-stone-800 font-medium;
}
.docs-prose .docs-feature-row dd {
  @apply text-stone-500 text-right;
}
</style>
