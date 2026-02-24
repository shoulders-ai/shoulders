<template>
  <DeckViewer
    :deck-name="deckName"
    :total-slides="11"
    :session-id="sessionId"
    v-slot="{ currentSlide, totalSlides, printMode }"
    class="deck-root"
  >
    <DeckSlide :n="1" :current-slide="currentSlide" :total-slides="totalSlides" :hide-page-number="true" :hide-meta="true"><Deck01Title /></DeckSlide>
    <DeckSlide :n="2" :current-slide="currentSlide" :total-slides="totalSlides" section="Summary"><Deck02SummaryAntler /></DeckSlide>
    <DeckSlide :n="3" :current-slide="currentSlide" :total-slides="totalSlides" section="Stage"><Deck03Stage /></DeckSlide>
    <DeckSlide :n="4" :current-slide="currentSlide" :total-slides="totalSlides" section="Problem"><Deck04Problem /></DeckSlide>
    <DeckSlide :n="5" :current-slide="currentSlide" :total-slides="totalSlides" section="Solution"><Deck05Product /></DeckSlide>
    <DeckSlide :n="6" :current-slide="currentSlide" :total-slides="totalSlides" section="Approach"><Deck06Philosophy /></DeckSlide>
    <DeckSlide :n="7" :current-slide="currentSlide" :total-slides="totalSlides" section="Founder"><Deck07Founder /></DeckSlide>
    <DeckSlide :n="8" :current-slide="currentSlide" :total-slides="totalSlides" section="Progress"><Deck08Traction /></DeckSlide>
    <DeckSlide :n="9" :current-slide="currentSlide" :total-slides="totalSlides" section="Market"><Deck09Market /></DeckSlide>
    <DeckSlide :n="10" :current-slide="currentSlide" :total-slides="totalSlides" section="Landscape"><Deck10Competitors /></DeckSlide>
    <DeckSlide :n="11" :current-slide="currentSlide" :total-slides="totalSlides" :print-mode="printMode" :pdf-path="pdfPath" section="Ask"><Deck11AskAntler /></DeckSlide>
  </DeckViewer>
</template>

<script setup>
definePageMeta({ layout: false })

const route = useRoute()
const slug = computed(() => String(route.params.slug))

const { data: share, error: shareError } = await useFetch(`/api/deck/${slug.value}`)
if (shareError.value || !share.value) {
  throw createError({ statusCode: 404, message: 'Deck not found' })
}

const deckName = computed(() => share.value?.deck_name || 'deck-antler')
const pdfPath = '/pdf/shoulders-deck-antler.pdf'

const sessionId = ref(null)

onMounted(async () => {
  sessionId.value = crypto.randomUUID()

  await $fetch('/api/deck/track', {
    method: 'POST',
    body: { slug: slug.value, session_id: sessionId.value }
  }).catch(() => {})
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&display=swap');

.font-serif {
  font-family: 'Crimson Text', 'Georgia', serif;
  font-weight: 400;
}
.font-mono {
  font-family: 'IBM Plex Mono', 'SF Mono', monospace;
  font-weight: 400;
}
.font-sans {
  font-family: 'Open Sans', system-ui, sans-serif;
  font-weight: 400;
}

.deck-root  .text-xl {
  font-size: 20px !important;
}
.deck-root  .text-2xl {
  font-size: 24px !important;
}
.deck-root  .text-3xl {
  font-size: 30px !important;
}
.deck-root  .text-4xl {
  font-size: 36px !important;
}
.deck-root  .text-5xl {
  font-size: 48px !important;
  font-weight: 600 !important;
}
</style>
