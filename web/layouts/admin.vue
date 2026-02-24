<template>
  <div class="min-h-screen font-sans bg-stone-50 antialiased text-stone-900">
    <nav class="bg-white border-b border-stone-200 px-6 py-3 flex items-center gap-6 sticky top-0 z-10">
      <span class="font-semibold text-sm tracking-tight mr-2">Shoulders Admin</span>
      <NuxtLink to="/admin" class="text-xs" :class="route.path === '/admin' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'" active-class="">Dashboard</NuxtLink>
      <NuxtLink to="/admin/users" class="text-xs" :class="route.path === '/admin/users' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'">Users</NuxtLink>
      <NuxtLink to="/admin/calls" class="text-xs" :class="route.path === '/admin/calls' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'">API Calls</NuxtLink>
      <NuxtLink to="/admin/reviews" class="text-xs" :class="route.path === '/admin/reviews' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'">Reviews</NuxtLink>
      <NuxtLink to="/admin/decks" class="text-xs" :class="route.path === '/admin/decks' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'">Decks</NuxtLink>
      <NuxtLink to="/admin/contacts" class="text-xs" :class="route.path === '/admin/contacts' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'">Contacts</NuxtLink>
      <NuxtLink to="/admin/analytics" class="text-xs" :class="route.path === '/admin/analytics' ? 'text-stone-900 font-medium' : 'text-stone-400 hover:text-stone-600'">Analytics</NuxtLink>
      <div class="flex-1" />
      <button @click="logout" class="text-xs text-stone-400 hover:text-stone-600 transition-colors">Logout</button>
    </nav>
    <div class="max-w-6xl mx-auto p-6">
      <slot />
    </div>
  </div>
</template>

<script setup>
const route = useRoute()
const router = useRouter()

async function logout() {
  await $fetch('/api/admin/logout', { method: 'POST' })
  router.push('/admin/login')
}
</script>
