<script setup>
definePageMeta({ layout: 'auth' })

const router = useRouter()
const { setAuth } = useAuth()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    const data = await $fetch('/api/v1/auth/login', { method: 'POST', body: { email: email.value, password: password.value } })
    setAuth(data)
    router.push('/account')
  } catch (e) {
    error.value = e.data?.error || e.message || 'Invalid credentials'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-6">Sign in</h1>
    <p v-if="error" class="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{{ error }}</p>
    <form class="space-y-4" @submit.prevent="handleLogin">
      <div>
        <label class="block text-xs font-medium text-stone-600 mb-1">Email</label>
        <input v-model="email" type="email" required autofocus class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300" placeholder="you@example.com">
      </div>
      <div>
        <label class="block text-xs font-medium text-stone-600 mb-1">Password</label>
        <input v-model="password" type="password" required class="w-full px-3 py-2 text-sm rounded-md border border-stone-200 focus:border-cadet-400 focus:ring-1 focus:ring-cadet-400 outline-none transition-colors text-stone-900 placeholder-stone-300">
      </div>
      <button type="submit" :disabled="loading" class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-sm font-medium py-2 rounded transition-colors">
        {{ loading ? 'Signing in...' : 'Sign in' }}
      </button>
    </form>
    <div class="mt-6 flex items-center justify-between text-xs">
      <NuxtLink to="/signup" class="text-stone-600 hover:text-stone-900 transition-colors">Create account</NuxtLink>
      <NuxtLink to="/reset-password" class="text-stone-400 hover:text-stone-600 transition-colors">Forgot password?</NuxtLink>
    </div>
    <NuxtLink to="/" class="mt-8 block text-center text-xs text-stone-400 hover:text-stone-600 transition-colors">&larr; Back to home</NuxtLink>
  </div>
</template>
