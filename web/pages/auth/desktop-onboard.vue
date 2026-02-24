<script setup>
definePageMeta({ layout: 'auth' })

const route = useRoute()
const { auth, setAuth, authedFetch } = useAuth()

// Form state
const mode = ref(route.query.mode === 'signin' ? 'signin' : 'signup') // 'signup' | 'signin' | 'verify' | 'done'
const email = ref('')
const password = ref('')
const confirm = ref('')
const code = ref('')
const loading = ref(false)
const error = ref('')
const resendMsg = ref('')
const countdown = ref(0)
let countdownTimer = null

const state = computed(() => route.query.state || '')

onMounted(async () => {
  if (!state.value) {
    error.value = 'Missing state parameter. Please start login from the desktop app.'
    return
  }
  if (auth.value?.token) {
    await completeDesktopAuth()
  }
})

onUnmounted(() => { clearInterval(countdownTimer) })

function startCountdown() {
  countdown.value = 30
  clearInterval(countdownTimer)
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) clearInterval(countdownTimer)
  }, 1000)
}

async function handleSignup() {
  error.value = ''
  if (password.value !== confirm.value) { error.value = 'Passwords do not match'; return }
  if (password.value.length < 8) { error.value = 'Password must be at least 8 characters'; return }
  loading.value = true
  try {
    await $fetch('/api/v1/auth/signup', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    mode.value = 'verify'
    startCountdown()
  } catch (e) {
    error.value = e.data?.error || e.message || 'Something went wrong'
  } finally {
    loading.value = false
  }
}

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await $fetch('/api/v1/auth/login', {
      method: 'POST',
      body: { email: email.value, password: password.value },
    })
    setAuth(data)
    await completeDesktopAuth()
  } catch (e) {
    error.value = e.data?.error || e.message || 'Invalid credentials'
  } finally {
    loading.value = false
  }
}

async function completeDesktopAuth() {
  try {
    await authedFetch('/api/v1/auth/desktop-code', {
      method: 'POST',
      body: { state: state.value },
    })
    mode.value = 'done'
    setTimeout(() => { try { window.close() } catch {} }, 4000)
  } catch (e) {
    error.value = e.data?.error || 'Failed to authorize desktop app'
  }
}

async function handleVerify() {
  if (code.value.length !== 6) return
  error.value = ''
  loading.value = true
  try {
    const data = await $fetch('/api/v1/auth/verify-code', {
      method: 'POST',
      body: { email: email.value, code: code.value },
    })
    setAuth(data)
    await completeDesktopAuth()
  } catch (e) {
    error.value = e.data?.error || 'Verification failed'
  } finally {
    loading.value = false
  }
}

function onCodeInput(e) {
  code.value = e.target.value.replace(/\D/g, '').slice(0, 6)
  if (code.value.length === 6) handleVerify()
}

async function resend() {
  if (countdown.value > 0) return
  resendMsg.value = ''
  error.value = ''
  try {
    await $fetch('/api/v1/auth/resend-code', { method: 'POST', body: { email: email.value } })
    resendMsg.value = 'New code sent.'
    startCountdown()
  } catch {
    error.value = 'Failed to resend. Try again.'
  }
}

function switchToSignin() {
  error.value = ''
  mode.value = 'signin'
}

function switchToSignup() {
  error.value = ''
  mode.value = 'signup'
}
</script>

<template>
  <div>
    <!-- Done state -->
    <template v-if="mode === 'done'">
      <div class="text-center py-8 space-y-3">
        <div class="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 border border-green-100">
          <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
          <span class="text-sm font-medium text-green-700">Connected</span>
        </div>
        <p class="text-xs text-stone-400">You can return to the desktop app. This page can be closed.</p>
      </div>
    </template>

    <!-- Already logged in, completing -->
    <template v-else-if="auth?.token && mode !== 'signin' && mode !== 'signup'">
      <div class="text-center py-6">
        <div class="text-sm text-stone-500">Connecting to desktop app...</div>
      </div>
    </template>

    <!-- Verify email (after signup) -->
    <template v-else-if="mode === 'verify'">
      <div class="text-center">
        <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-3">Check your email</h1>
        <p class="text-sm text-stone-600 leading-relaxed">
          We sent a 6-digit code to
          <span class="font-medium text-stone-900">{{ email }}</span>.
        </p>

        <form @submit.prevent="handleVerify" class="mt-8">
          <input
            :value="code"
            @input="onCodeInput"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="000000"
            autofocus
            class="w-48 mx-auto block text-center text-2xl font-mono font-semibold tracking-[0.3em] px-4 py-3 rounded-lg border border-stone-200 focus:border-stone-400 focus:ring-1 focus:ring-stone-400 outline-none transition-colors text-stone-900 placeholder-stone-200"
          >
          <p v-if="error" class="mt-4 text-xs text-red-600">{{ error }}</p>
          <p v-if="resendMsg" class="mt-4 text-xs text-green-600">{{ resendMsg }}</p>
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
      </div>
    </template>

    <!-- Signup form (default) -->
    <template v-else-if="mode === 'signup'">
      <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-2">Create your free account</h1>
      <p class="text-sm text-stone-500 mb-6">Includes free AI usage to get started.</p>

      <p v-if="error" class="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{{ error }}</p>

      <form v-if="state" class="space-y-4" @submit.prevent="handleSignup">
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Email</label>
          <input v-model="email" type="email" required autofocus class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="you@example.com">
        </div>
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Password</label>
          <input v-model="password" type="password" minlength="8" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="At least 8 characters">
        </div>
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Confirm password</label>
          <input v-model="confirm" type="password" minlength="8" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
        </div>
        <button type="submit" :disabled="loading" class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors">
          {{ loading ? 'Creating account...' : 'Create account' }}
        </button>
      </form>

      <p class="mt-6 text-center text-xs text-stone-400">
        Already have an account?
        <button class="text-stone-600 hover:text-stone-900 transition-colors" @click="switchToSignin">Sign in</button>
      </p>
    </template>

    <!-- Signin form -->
    <template v-else-if="mode === 'signin'">
      <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-2">Sign in to connect desktop</h1>
      <p class="text-sm text-stone-500 mb-6">Authenticate your desktop app through the browser.</p>

      <p v-if="error" class="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{{ error }}</p>

      <form v-if="state" class="space-y-4" @submit.prevent="handleLogin">
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Email</label>
          <input v-model="email" type="email" required autofocus class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="you@example.com">
        </div>
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Password</label>
          <input v-model="password" type="password" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
        </div>
        <button type="submit" :disabled="loading" class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors">
          {{ loading ? 'Signing in...' : 'Sign in & connect desktop' }}
        </button>
      </form>

      <div class="mt-6 flex items-center justify-between text-xs">
        <button class="text-stone-600 hover:text-stone-900 transition-colors" @click="switchToSignup">Create account</button>
        <NuxtLink to="/reset-password" class="text-stone-400 hover:text-stone-600 transition-colors">Forgot password?</NuxtLink>
      </div>
    </template>
  </div>
</template>
