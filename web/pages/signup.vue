<script setup>
definePageMeta({ layout: 'auth' })

const router = useRouter()
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')

async function handleSignup() {
  error.value = ''
  if (password.value !== confirm.value) { error.value = 'Passwords do not match'; return }
  loading.value = true
  try {
    await $fetch('/api/v1/auth/signup', { method: 'POST', body: { email: email.value, password: password.value } })
    router.push('/verify-email?email=' + encodeURIComponent(email.value))
  } catch (e) {
    error.value = e.data?.error || e.message || 'Something went wrong'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="text-xl font-semibold text-stone-900 tracking-tight mb-6">Create your account</h1>
    <p v-if="error" class="mb-4 text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{{ error }}</p>
    <form class="space-y-4" @submit.prevent="handleSignup">
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
      <NuxtLink to="/login" class="text-stone-600 hover:text-stone-900 transition-colors">Sign in</NuxtLink>
    </p>
    <NuxtLink to="/" class="mt-8 block text-center text-xs text-stone-400 hover:text-stone-600 transition-colors">&larr; Back to home</NuxtLink>
  </div>
</template>
