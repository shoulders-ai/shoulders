<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-white font-sans antialiased px-4">
    <NuxtLink to="/" class="mb-10 font-serif text-xl font-semibold text-stone-900 tracking-tight">
      Shoulders
    </NuxtLink>
    <div class="w-full max-w-sm">
      <slot />
    </div>
  </div>
</template>
