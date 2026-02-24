<script setup>
definePageMeta({ layout: 'auth' })

const route = useRoute()
const router = useRouter()
const { setAuth } = useAuth()

const email = route.query.email || ''
const code = ref('')
const loading = ref(false)
const error = ref('')
const countdown = ref(30)
const resendMsg = ref('')
let timer = null

// Start initial countdown
onMounted(() => { startCountdown() })
onUnmounted(() => { clearInterval(timer) })

function startCountdown() {
  countdown.value = 30
  clearInterval(timer)
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) clearInterval(timer)
  }, 1000)
}

async function verify() {
  if (code.value.length !== 6) return
  error.value = ''
  loading.value = true
  try {
    const data = await $fetch('/api/v1/auth/verify-code', {
      method: 'POST',
      body: { email, code: code.value },
    })
    setAuth(data)
    router.push('/account')
  } catch (e) {
    error.value = e.data?.error || 'Verification failed'
  } finally {
    loading.value = false
  }
}

function onInput(e) {
  code.value = e.target.value.replace(/\D/g, '').slice(0, 6)
  if (code.value.length === 6) verify()
}

async function resend() {
  if (countdown.value > 0) return
  resendMsg.value = ''
  error.value = ''
  try {
    await $fetch('/api/v1/auth/resend-code', { method: 'POST', body: { email } })
    resendMsg.value = 'New code sent.'
    startCountdown()
  } catch {
    error.value = 'Failed to resend. Try again.'
  }
}
</script>

<template>
  <div class="text-center">
    <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-3">Check your email</h1>
    <p class="text-sm text-stone-600 leading-relaxed">
      We sent a 6-digit code to
      <span v-if="email" class="font-medium text-stone-900">{{ email }}</span>
      <span v-else>your email address</span>.
    </p>

    <form @submit.prevent="verify" class="mt-8">
      <input
        :value="code"
        @input="onInput"
        type="text"
        inputmode="numeric"
        autocomplete="one-time-code"
        maxlength="6"
        placeholder="000000"
        autofocus
        class="w-48 mx-auto block text-center text-2xl font-mono font-semibold tracking-[0.3em] px-4 py-3 rounded-lg border border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-400 outline-none transition-colors text-stone-900 placeholder-stone-200"
      >
      <p v-if="error" class="mt-4 text-xs text-red-600">{{ error }}</p>
      <p v-if="resendMsg" class="mt-4 text-xs text-sea-600">{{ resendMsg }}</p>
      <p class="mt-4 text-xs text-stone-400">Code expires in 10 minutes.</p>
    </form>

    <button
      @click="resend"
      :disabled="countdown > 0"
      class="mt-6 text-xs transition-colors"
      :class="countdown > 0 ? 'text-stone-300 cursor-default' : 'text-stone-600 hover:text-stone-900'"
    >
      {{ countdown > 0 ? `Resend code (${countdown}s)` : 'Resend code' }}
    </button>

    <NuxtLink to="/" class="mt-8 block text-xs text-stone-400 hover:text-stone-600 transition-colors">
      &larr; Back to home
    </NuxtLink>
  </div>
</template>
