<template>
  <div
    v-show="isActive"
    class="absolute inset-0"
  >
    <div class="w-full h-full relative">
      <slot />

      <!-- Scaffolding -->
      <div class="absolute inset-0 pointer-events-none">
        <!-- Top right: download link on last slide only (matches slide title position) -->
        <a
          v-if="n === totalSlides && !hideMeta && !printMode"
          :href="pdfPath"
          download="shoulders-deck-0126.pdf"
          class="absolute top-14 right-20 text-xs uppercase tracking-widest text-stone-400 hover:text-stone-600 transition-colors pointer-events-auto flex items-center gap-1.5"
        >
          Download PDF
          <IconDownload  size="12" />
        </a>

        <!-- Bottom row: brand (left), date + page (right) -->
        <div class="absolute bottom-6 left-10 right-10 flex justify-between items-end">
          <span v-if="!hideMeta" class="font-serif text-[15px] text-stone-400">Shoulders</span>
          <span v-else></span>
          <span v-if="!hidePageNumber" class="scaffold-mono text-[11px] text-stone-400 tracking-wide flex items-center">
            <span>{{ date }}</span>
            <span class="mx-2 text-stone-300">|</span>
            <span class="tabular-nums"><span v-if="n < 10" class="invisible">0</span>{{ n }}/{{ totalSlides }}</span>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { IconDownload } from '@tabler/icons-vue'
const props = defineProps({
  n: { type: Number, required: true },
  currentSlide: { type: Number, required: true },
  totalSlides: { type: Number, default: 12 },
  section: { type: String, default: null },
  date: { type: String, default: '15 January 2026' },
  hidePageNumber: { type: Boolean, default: false },
  hideMeta: { type: Boolean, default: false },
  printMode: { type: Boolean, default: false },
  pdfPath: { type: String, default: '/pdf/shoulders-deck.pdf' }
})

const isActive = computed(() => props.currentSlide === props.n)
</script>

<style scoped>
.scaffold-humanist {
  font-family: 'Open Sans', system-ui, sans-serif;
  font-weight: 300;
}

.scaffold-mono {
  font-family: 'IBM Plex Mono', 'SF Mono', monospace;
  font-weight: 400;
}
</style>
