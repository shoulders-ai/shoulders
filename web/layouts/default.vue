<template>
  <div class="min-h-screen flex flex-col font-sans bg-white text-stone-900 antialiased">
    <SiteHeader />
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
