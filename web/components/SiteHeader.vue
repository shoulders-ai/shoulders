<template>
  <header
    :class="[
      'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
      scrolled ? 'bg-white/95 backdrop-blur-sm' : 'bg-transparent',
    ]"
  >
    <div class="max-w-6xl mx-auto px-6 h-14 grid grid-cols-[1fr_auto_1fr] items-center">
      <NuxtLink to="/" class="font-serif text-xl font-semibold text-stone-900 tracking-tight justify-self-start">
        Shoulders
      </NuxtLink>

      <nav class="hidden md:flex items-center gap-7">
        <NuxtLink to="/about" class="text-sm text-stone-600 hover:text-stone-900 transition-colors tracking-wide">About</NuxtLink>
        <NuxtLink to="/pricing" class="text-sm text-stone-600 hover:text-stone-900 transition-colors tracking-wide">Pricing</NuxtLink>
        <NuxtLink to="/docs" class="text-sm text-stone-600 hover:text-stone-900 transition-colors tracking-wide">Docs</NuxtLink>
      </nav>

      <div class="hidden md:flex items-center gap-6 justify-self-end">
        <ClientOnly>
          <NuxtLink v-if="isLoggedIn" to="/account" class="text-sm text-stone-600 hover:text-stone-900 transition-colors tracking-wide">Account</NuxtLink>
          <NuxtLink v-else to="/login" class="text-sm text-stone-600 hover:text-stone-900 transition-colors tracking-wide">Sign in</NuxtLink>
          <template #fallback>
            <NuxtLink to="/login" class="text-sm text-stone-600 hover:text-stone-900 transition-colors tracking-wide">Sign in</NuxtLink>
          </template>
        </ClientOnly>
        <NuxtLink to="/download" class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-3.5 py-1.5 rounded tracking-wide transition-colors">
          Download
        </NuxtLink>
      </div>

      <button class="md:hidden p-2 -mr-2 text-stone-600" @click="mobileOpen = !mobileOpen">
        <IconX v-if="mobileOpen" :size="20" :stroke-width="1.5" />
        <IconMenu2 v-else :size="20" :stroke-width="1.5" />
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div v-if="mobileOpen" class="md:hidden absolute top-full left-0 right-0 bg-white border-t border-stone-100 shadow-xl z-50">
        <div class="max-w-6xl mx-auto px-6 py-3 space-y-0.5">
          <NuxtLink to="/about" class="block py-2 text-sm text-stone-600" @click="mobileOpen = false">About</NuxtLink>
          <NuxtLink to="/pricing" class="block py-2 text-sm text-stone-600" @click="mobileOpen = false">Pricing</NuxtLink>
          <NuxtLink to="/docs" class="block py-2 text-sm text-stone-600" @click="mobileOpen = false">Docs</NuxtLink>
          <div class="h-px bg-stone-100 my-1" />
          <ClientOnly>
            <NuxtLink v-if="isLoggedIn" to="/account" class="block py-2 text-sm text-stone-600" @click="mobileOpen = false">Account</NuxtLink>
            <NuxtLink v-else to="/login" class="block py-2 text-sm text-stone-600" @click="mobileOpen = false">Sign in</NuxtLink>
            <template #fallback>
              <NuxtLink to="/login" class="block py-2 text-sm text-stone-600" @click="mobileOpen = false">Sign in</NuxtLink>
            </template>
          </ClientOnly>
        </div>
      </div>
    </Transition>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="mobileOpen" class="md:hidden fixed inset-0 bg-stone-900/20 backdrop-blur-sm -z-10" @click="mobileOpen = false" />
    </Transition>
  </header>
</template>

<script setup>
import { IconMenu2, IconX } from '@tabler/icons-vue'

const { auth } = useAuth()

const mobileOpen = ref(false)
const scrolled = ref(false)
const isLoggedIn = computed(() => !!auth.value?.token)

onMounted(() => {
  const onScroll = () => { scrolled.value = window.scrollY > 10 }
  onScroll()
  window.addEventListener('scroll', onScroll, { passive: true })
  onUnmounted(() => window.removeEventListener('scroll', onScroll))
})
</script>
