<template>
  <div class="relative flex h-full overflow-hidden">
    <!-- Left: Content -->
    <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Premise</p>
    <div class="flex-1 bg-white flex flex-col justify-center px-20 py-20">
      <!-- Intro -->
      <p class="text-lg text-stone-500 mb-6">Meanwhile...</p>

      <!-- Three equal-weight statements -->
      <div class="space-y-3 mb-16">
        <p class="text-2xl font-medium text-stone-800">Researchers copy-paste from ChatGPT</p>
        <p class="text-2xl font-medium text-stone-800">They use fragmented toolchains</p>
        <p class="text-2xl font-medium text-stone-800">No shared context, no integration</p>
      </div>

      <!-- Conclusion - with pause mark -->
      <div>
        <div class="w-12 h-px bg-stone-300 mb-6"></div>
        <p class="text-lg text-stone-500">
          AI will become central to research in 2-3 years
        </p>
        <p class="text-xl font-medium text-stone-900 mt-2">
          The tools for this haven't been built yet
        </p>
      </div>
    </div>

    <!-- Right: Image with light background -->
    <div class="flex-1 min-w-[550px] h-full  pb-12 px-8 bg-stone-100 relative">
      <!-- Label -->
      <p class="absolute bottom-24 left-10 text-sm text-stone-800 font-medium">Research workflows today</p>

      <div class="relative w-full h-full">
      <img
        src="/img/old-tools2.png"
        alt="Fragmented research toolchain"
        class="absolute inset-0 w-full h-full object-contain"
      />

    </div>
    </div>
  </div>
</template>

<script setup>
</script>
