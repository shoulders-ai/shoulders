<template>
  <div class="min-h-screen flex items-center justify-center bg-stone-50 font-sans antialiased">
    <div class="w-full max-w-xs">
      <h1 class="text-sm font-semibold text-stone-900 mb-4">Admin Login</h1>
      <p v-if="error" class="mb-3 text-xs text-red-600">{{ error }}</p>
      <form @submit.prevent="handleLogin" class="space-y-3">
        <input v-model="key" type="password" placeholder="Admin key" required autofocus
          class="w-full px-3 py-2 text-sm rounded border border-stone-300 bg-white focus:border-stone-500 focus:ring-1 focus:ring-stone-400 outline-none font-mono text-stone-900 placeholder-stone-400">
        <button type="submit" :disabled="loading"
          class="w-full bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-medium py-2 rounded transition-colors">
          {{ loading ? 'Verifying...' : 'Login' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup>
definePageMeta({ layout: false })

const router = useRouter()
const key = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/admin/login', { method: 'POST', body: { key: key.value } })
    router.push('/admin')
  } catch (e) {
    error.value = e.data?.error || 'Invalid key'
  } finally {
    loading.value = false
  }
}
</script>
