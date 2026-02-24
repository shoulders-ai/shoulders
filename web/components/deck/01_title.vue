<template>
  <div class="relative flex flex-col items-center justify-center h-full overflow-hidden">
    <!-- Background Image -->
    <div
      class="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
      style="background-image: url('/img/wide-land.jpg')"
    />

    <!-- Dark Vignette Overlay -->
    <div class="absolute inset-0 bg-gradient-radial from-black/30 via-black/40 to-black/40" />

    <!-- Main content -->
    <div class="relative z-10 flex flex-col items-center text-center px-16">
      <!-- Company name - serif, commanding presence -->
      <h1 class="font-serif text-[120px] leading-none tracking-tight text-white mb-6">
        Shoulders
      </h1>

      <!-- Tagline - refined sans-serif, generous letter-spacing -->
      <p class="text-2xl tracking-[0.1em] text-white/90 drop-shadow-[0_1.5px_6px_rgba(0,0,0,0.3)]">
        The AI Workspace for Researchers
      </p>
    </div>

    <!-- Quote - positioned as scholarly marginalia -->
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 max-w-2xl text-center z-10">
      <p class="text-lg text-white/90 italic leading-relaxed font-serif font-medium">
        "If I have seen further, it is by standing on the shoulders of giants"
      </p>
      <p class="mt-1 text-xs text-white/70 font-light">
        — Isaac Newton, 1675 (echoing Bernard of Chartres, c. 1120)
      </p>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.bg-gradient-radial {
  background: radial-gradient(ellipse at center, var(--tw-gradient-stops));
}
</style>
