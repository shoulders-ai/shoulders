<script setup>
definePageMeta({ layout: 'default' })

const { auth, authedFetch } = useAuth()
const router = useRouter()

const alreadySubscribed = computed(() => auth.value?.plan === 'pro' || auth.value?.plan === 'enterprise')
const subscribeLoading = ref(false)

onMounted(() => {
  if (alreadySubscribed.value) {
    router.push('/account')
  }
})

async function handleSubscribe() {
  if (!auth.value?.token) {
    router.push('/login?redirect=/subscribe')
    return
  }
  subscribeLoading.value = true
  try {
    const res = await authedFetch('/api/v1/stripe/checkout', { method: 'POST' })
    if (res.url) window.location.href = res.url
  } catch (e) {
    console.error('Checkout error:', e)
  } finally {
    subscribeLoading.value = false
  }
}
</script>

<template>
  <div class="pt-28 pb-20 px-6">
    <div class="max-w-md mx-auto">
      <NuxtLink to="/account" class="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition-colors mb-8">
        &larr; Back to account
      </NuxtLink>

      <h1 class="font-serif text-2xl font-semibold text-stone-900 tracking-tight mb-2">Shoulders AI</h1>
      <p class="text-sm text-stone-500 mb-10">AI-powered writing assistance without managing API keys.</p>

      <!-- Plan card -->
      <div class="border border-stone-200 rounded-lg overflow-hidden">
        <!-- Price header -->
        <div class="px-6 py-5 border-b border-stone-100">
          <div class="flex items-baseline gap-1">
            <span class="text-3xl font-semibold text-stone-900">$15</span>
            <span class="text-sm text-stone-500">/ month</span>
          </div>
        </div>

        <!-- What's included -->
        <div class="px-6 py-5">
          <h3 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-3">Included</h3>
          <ul class="space-y-2.5">
            <li class="flex items-start gap-2.5 text-sm text-stone-700">
              <svg class="w-4 h-4 text-sea-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span><strong class="font-medium text-stone-900">Generous AI usage</strong> included monthly</span>
            </li>
            <li class="flex items-start gap-2.5 text-sm text-stone-700">
              <svg class="w-4 h-4 text-sea-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>No API keys to manage</span>
            </li>
            <li class="flex items-start gap-2.5 text-sm text-stone-700">
              <svg class="w-4 h-4 text-sea-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>Exa web search tool</span>
            </li>
            <li class="flex items-start gap-2.5 text-sm text-stone-700">
              <svg class="w-4 h-4 text-sea-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
              <span>Cancel any time</span>
            </li>
          </ul>

          <div class="mt-5 pt-4 border-t border-stone-100">
            <h3 class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">Need more?</h3>
            <p class="text-sm text-stone-600">
              Purchase additional balance as needed. Your balance carries over — no surprise charges.
            </p>
          </div>
        </div>

        <!-- CTA area -->
        <div class="px-6 py-5 bg-stone-50 border-t border-stone-100">
          <button
            @click="handleSubscribe"
            :disabled="subscribeLoading"
            class="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium py-2.5 rounded transition-colors disabled:opacity-50"
          >
            {{ subscribeLoading ? 'Redirecting...' : 'Start subscription' }}
          </button>
          <p class="mt-3 text-xs text-stone-500 text-center leading-relaxed">
            You'll be redirected to Stripe to complete payment.
          </p>
        </div>
      </div>

      <!-- FAQ -->
      <div class="mt-12 space-y-6">
        <h2 class="text-xs font-semibold text-stone-400 uppercase tracking-wider">Common questions</h2>
        <div>
          <h3 class="text-sm font-medium text-stone-900">How does billing work?</h3>
          <p class="text-xs text-stone-500 mt-1 leading-relaxed">Your subscription includes generous AI usage each month. Each AI call is billed at the model's real token cost — cheaper models like Haiku cost less than Opus. Your balance is shown in dollars on your account page.</p>
        </div>
        <div>
          <h3 class="text-sm font-medium text-stone-900">Can I still use my own API keys?</h3>
          <p class="text-xs text-stone-500 mt-1 leading-relaxed">Yes. The subscription is entirely optional. You can use your own Anthropic, OpenAI, or Google keys at any time — the editor is free and open source.</p>
        </div>
        <div>
          <h3 class="text-sm font-medium text-stone-900">What happens when my balance runs out?</h3>
          <p class="text-xs text-stone-500 mt-1 leading-relaxed">AI features pause until your next billing cycle or until you add more funds. Your documents and workspace are never affected.</p>
        </div>
        <div>
          <h3 class="text-sm font-medium text-stone-900">Can I cancel?</h3>
          <p class="text-xs text-stone-500 mt-1 leading-relaxed">Any time. Your account and documents remain yours. You just won't receive new balance.</p>
        </div>
      </div>
    </div>
  </div>
</template>
