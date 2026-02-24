<template>
  <div class="relative flex flex-col h-full bg-white px-20 py-16">
    <!-- Slide label -->
    <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Summary</p>

    <!-- 2x4 Grid -->
    <div class="flex-1 grid grid-cols-[1.05fr_0.95fr] gap-x-20 gap-y-12 content-center">

      <!-- Row 1 -->
      <div>
        <div class="text-stone-400 text-xs mb-1">Premise</div>
        <p class="text-2xl text-stone-800 leading-snug">
          While developers <span class="italic">vibe code</span>, researchers use old tools and copy-paste from ChatGPT
        </p>
      </div>
      <div>
        <div class="text-stone-400 text-xs mb-1">Founder</div>
        <p class="text-2xl text-stone-800 leading-snug">
          Two-time founder and research software engineer. MD, 2 PhDs, 50 publications.
        </p>
      </div>

      <!-- Row 2 -->
      <div>
        <div class="text-stone-400 text-xs mb-1">Solution</div>
        <p class="text-2xl text-stone-800 leading-snug tracking-tight">
          Shoulders: an integrated AI-native document editor
        </p>
      </div>
      <div>
        <div class="text-stone-400 text-xs mb-1">Market</div>
        <p class="text-2xl text-stone-800 leading-snug">
          SAM: 3M researchers; ~$450M globally

        </p>
      </div>

      <!-- Row 3 -->
      <div>
        <div class="text-stone-400 text-xs mb-1">Status</div>
        <p class="text-2xl text-stone-800 leading-snug">
          MVP with 15 academic test users
        </p>
      </div>
      <div>
        <div class="text-stone-400 text-xs mb-1">Ask</div>
        <p class="text-2xl text-stone-800 leading-snug">Preparing pre-seed. Looking for feedback.</p>
      </div>

      <!-- Row 4 -->
      <div>
        <div class="text-stone-400 text-xs mb-1">Contact</div>
        <div class="flex items-center text-stone-700 text-2xl space-x-3">
          <span class="font-medium">Paul Schneider</span>
          <span class="h-4 w-px bg-stone-300"></span>
          <a href="mailto:paul@shoulde.rs" class="hover:text-[#6E7CA5] hover:underline underline-offset-2 decoration-[#6E7CA5] transition-colors">paul@shoulde.rs</a>
          <span class="h-4 w-px bg-stone-300"></span>
          <a href="https://www.linkedin.com/in/paul--" target="_blank" rel="noopener" class="hover:text-[#6E7CA5] hover:underline underline-offset-2 decoration-[#6E7CA5] transition-colors">LinkedIn</a>
        </div>
      </div>
      <div>
        <div class="text-stone-400 text-xs mb-1">Try it</div>
        <a href="https://shoulde.rs/register?invite=GIANTS" target="_blank" rel="noopener" class="text-2xl text-stone-700 hover:text-[#6E7CA5] hover:underline underline-offset-2 decoration-[#6E7CA5] transition-colors">shoulde.rs/register?invite=GIANTS</a>
      </div>

    </div>
  </div>
</template>

<script setup>
</script>
