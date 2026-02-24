<template>
  <div class="fixed inset-0 bg-black flex items-center justify-center outline-none" @keydown="handleKeydown" tabindex="0" ref="containerRef">
    <!-- Scaled slide container -->
    <div
      class="absolute overflow-hidden"
      :style="{
        width: `${scaledWidth}px`,
        height: `${scaledHeight}px`,
      }"
    >
      <!-- Inner container at design resolution, scaled down -->
      <div
        :style="{
          width: `${designWidth}px`,
          height: `${designHeight}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top left'
        }"
      >
        <slot :current-slide="currentSlide" :total-slides="totalSlides" :print-mode="isPrintMode" />
      </div>
    </div>

    <!-- Left arrow (hidden in print mode) -->
    <button
      v-if="!isPrintMode"
      @click="prevSlide"
      :disabled="currentSlide <= 1"
      class="absolute left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-transparent hover:bg-stone-200/30 text-stone-300 hover:text-stone-500 transition-all disabled:opacity-0 disabled:pointer-events-none"
    >
      <Icon name="tabler:chevron-left" size="20" />
    </button>

    <!-- Right arrow (hidden in print mode) -->
    <button
      v-if="!isPrintMode"
      @click="nextSlide"
      :disabled="currentSlide >= totalSlides"
      class="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-transparent hover:bg-stone-200/30 text-stone-300 hover:text-stone-500 transition-all disabled:opacity-0 disabled:pointer-events-none"
    >
      <Icon name="tabler:chevron-right" size="20" />
    </button>

  </div>
</template>

<script setup>
const props = defineProps({
  deckName: { type: String, required: true },
  totalSlides: { type: Number, required: true },
  sessionId: { type: String, default: null }
})

const route = useRoute()
const isPrintMode = computed(() => route.query.print !== undefined)

const containerRef = ref(null)
const currentSlide = ref(1)

// Fixed design resolution (16:9 HD)
const designWidth = 1280
const designHeight = 720

const scale = ref(1)
const scaledWidth = ref(designWidth)
const scaledHeight = ref(designHeight)

function calculateScale() {
  const windowWidth = window.innerWidth
  const windowHeight = window.innerHeight

  // Calculate scale to fit while maintaining 16:9 aspect ratio
  const scaleX = windowWidth / designWidth
  const scaleY = windowHeight / designHeight
  scale.value = Math.min(scaleX, scaleY)

  // Calculate the actual displayed size
  scaledWidth.value = designWidth * scale.value
  scaledHeight.value = designHeight * scale.value
}

function nextSlide() {
  if (currentSlide.value < props.totalSlides) currentSlide.value++
}

function prevSlide() {
  if (currentSlide.value > 1) currentSlide.value--
}

function handleKeydown(e) {
  if (e.key === 'ArrowRight' || e.key === ' ') {
    e.preventDefault()
    nextSlide()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prevSlide()
  }
}

let pingInterval = null

function startPinging() {
  if (pingInterval) return
  pingInterval = setInterval(() => {
    $fetch('/api/deck/ping', {
      method: 'POST',
      body: { session_id: props.sessionId, current_slide: currentSlide.value }
    }).catch(() => {})
  }, 1000)
}

watch(() => props.sessionId, (newId) => {
  if (newId) startPinging()
}, { immediate: true })

onMounted(() => {
  calculateScale()
  window.addEventListener('resize', calculateScale)
  containerRef.value?.focus()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', calculateScale)
  if (pingInterval) clearInterval(pingInterval)
})

defineExpose({ currentSlide })
</script>
