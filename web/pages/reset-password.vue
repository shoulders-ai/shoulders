<script setup>
definePageMeta({ layout: 'auth' })

const route = useRoute()
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const success = ref(false)
const sent = ref(false)
const error = ref('')

async function handleForgot() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/v1/auth/forgot', { method: 'POST', body: { email: email.value } })
    sent.value = true
  } catch (e) {
    error.value = e.data?.error || e.message
  } finally {
    loading.value = false
  }
}

async function handleReset() {
  error.value = ''
  if (password.value !== confirm.value) { error.value = 'Passwords do not match'; return }
  loading.value = true
  try {
    const res = await $fetch('/api/v1/auth/reset', {
      method: 'POST',
      body: { token: route.query.token, password: password.value },
    })
    if (res.error) throw new Error(res.error)
    success.value = true
  } catch (e) {
    error.value = e.data?.error || e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-6">Reset password</h1>

    <div v-if="success" class="text-center">
      <p class="text-sm text-sea-600 mb-4">Password reset successfully.</p>
      <NuxtLink to="/login" class="text-sm text-stone-600 hover:text-stone-900">Sign in &rarr;</NuxtLink>
    </div>

    <template v-else>
      <p v-if="error" class="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{{ error }}</p>

      <form v-if="!route.query.token" class="space-y-4" @submit.prevent="handleForgot">
        <p class="text-xs text-stone-400 mb-3">Enter your email and we'll send a reset link.</p>
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Email</label>
          <input v-model="email" type="email" required autofocus class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="you@example.com">
        </div>
        <p v-if="sent" class="text-xs text-sea-600">Check your email for a reset link.</p>
        <button type="submit" :disabled="loading || sent" class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors">
          {{ loading ? 'Sending...' : 'Send reset link' }}
        </button>
      </form>

      <form v-else class="space-y-4" @submit.prevent="handleReset">
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">New password</label>
          <input v-model="password" type="password" minlength="8" required autofocus class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="At least 8 characters">
        </div>
        <div>
          <label class="block text-xs font-medium text-stone-600 mb-1">Confirm password</label>
          <input v-model="confirm" type="password" minlength="8" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
        </div>
        <button type="submit" :disabled="loading" class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors">
          {{ loading ? 'Resetting...' : 'Reset password' }}
        </button>
      </form>
    </template>

    <p class="mt-6 text-center text-xs">
      <NuxtLink to="/login" class="text-stone-400 hover:text-stone-600 transition-colors">Back to sign in</NuxtLink>
    </p>
    <NuxtLink to="/" class="mt-8 block text-center text-xs text-stone-400 hover:text-stone-600 transition-colors">&larr; Back to home</NuxtLink>
  </div>
</template>
