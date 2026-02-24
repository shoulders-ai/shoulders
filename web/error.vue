<template>
  <div class="min-h-screen flex flex-col font-sans bg-white text-stone-900 antialiased">
    <SiteHeader />

    <main class="flex-1 flex items-center justify-center px-6">
      <div class="max-w-md text-center py-24 md:py-32">
        <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">
          Error {{ error?.statusCode || 500 }}
        </p>

        <h1 class="font-serif text-2xl md:text-3xl font-semibold leading-tight tracking-tight text-stone-900">
          {{ title }}
        </h1>

        <p class="mt-5 text-base text-stone-600 leading-relaxed">
          {{ description }}
        </p>

        <div class="mt-10">
          <button
            @click="handleError"
            class="bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded tracking-wide transition-colors"
          >
            Back to home
          </button>
        </div>
      </div>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup>
const props = defineProps({
  error: Object,
})

const title = computed(() => {
  const code = props.error?.statusCode
  if (code === 404) return 'Page not found'
  if (code === 403) return 'Access denied'
  if (code === 500) return 'Something went wrong'
  return 'An error occurred'
})

const description = computed(() => {
  const code = props.error?.statusCode
  if (code === 404) return 'The page you are looking for does not exist or has been moved.'
  if (code === 403) return 'You do not have permission to access this page.'
  if (code === 500) return 'An internal error occurred. Please try again later.'
  return props.error?.message || 'An unexpected error occurred.'
})

const handleError = () => clearError({ redirect: '/' })
</script>
