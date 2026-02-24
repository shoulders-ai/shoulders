<template>
  <div class="relative flex items-center h-full bg-white px-20 py-16">
    <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Solution</p>
    <!-- Two column layout -->
    <div class="flex items-center gap-16 w-full">

      <!-- Left: Text content -->
      <div class="flex-shrink-0 w-[380px]">
        <h2 class="text-5xl font-semibold text-stone-900 mb-6 font-serif">Shoulders</h2>

        <div class="space-y-6">
          <p class="text-xl text-stone-700 leading-relaxed">
            An AI-native document editor for researchers &ndash; with surprisingly great reference management
          </p>

          <p class="text-xl text-stone-700 leading-relaxed">
            Integrates text, code, sources, and data into one unified research workspace
          </p>

          
        </div>

      </div>

      <!-- Right: Screenshot + CTA -->
      <div class="flex-1 relative pt-4">
        <div class="relative rounded-lg overflow-hidden shadow-2xl shadow-stone-900/20 border border-stone-200">
          <img
            src="/img/screenshot.png"
            alt="Shoulders application screenshot"
            class="w-full h-auto"
          />
        </div>
        <p class="mt-8 text-sm text-stone-400 font-mono tracking-wide text-center">
          Try it: <a href="https://shoulde.rs/register?invite=GIANTS" target="_blank" rel="noopener noreferrer" class="hover:text-[#6E7CA5] transition-colors border-b border-[#6E7CA5]">shoulde.rs/register?invite=GIANTS</a>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>
