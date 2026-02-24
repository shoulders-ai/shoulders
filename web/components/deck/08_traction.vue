<template>
  <div class="relative flex flex-col justify-center h-full bg-white px-20 py-16">
    <!-- Label -->
    <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Progress</p>

    <!-- Timeline -->
    <div class="relative mt-28">
      <!-- Timeline line with arrow -->
      <div class="absolute top-3 left-0 right-0 h-px bg-stone-300">
        <!-- Arrow at end -->
        <div class="absolute right-0 top-1/2 -translate-y-1/2 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-stone-300"></div>
      </div>

      <!-- Three phases -->
      <div class="grid grid-cols-3 gap-8">

        <!-- DONE -->
        <div class="relative">
          <!-- Dot -->
          <div class="w-6 h-6 rounded-full bg-stone-900 mb-6"></div>
          <!-- Label -->
          <p class="text-xs uppercase tracking-widest text-stone-400 mb-4">Since Sept 2025</p>
          <!-- Content -->
          <div class="space-y-2 text-lg text-stone-700">
            <p>23 researcher interviews</p>
            <p>Prototype built</p>
          </div>
        </div>

        <!-- NOW -->
        <div class="relative">
          <!-- Dot - highlighted -->
          <div class="w-6 h-6 rounded-full bg-[#6E7CA5] mb-6 ring-4 ring-[#5f9ea0]/20"></div>
          <!-- Label -->
          <p class="text-xs uppercase tracking-widest text-[#6E7CA5] mb-4 font-medium">Now</p>
          <!-- Content -->
          <div class="space-y-2 text-lg text-stone-700">
            <p>Launched in private beta</p>
            <p>15 academic test users</p>
            <p>Raising pre-seed round</p>
          </div>
        </div>

        <!-- NEXT -->
        <div class="relative">
          <!-- Dot - outline -->
          <div class="w-6 h-6 rounded-full border-2 border-stone-300 bg-white mb-6"></div>
          <!-- Label -->
          <p class="text-xs uppercase tracking-widest text-stone-400 mb-4">Next</p>
          <!-- Content -->
          <div class="space-y-2 text-lg text-stone-700">
            <p>Develop desktop app</p>
            <p>Grow user base</p>
            <p>Design partnerships</p>
          </div>
        </div>

      </div>
    </div>

    <!-- Testimonials -->
    <div class="mt-20">
      <div class="w-12 h-px bg-stone-300 mb-6"></div>
      <div class="grid grid-cols-4 gap-8">
        <div class="relative pl-4">
          <span class="absolute -top-2 left-0 text-4xl text-stone-300 leading-none font-serif">&ldquo;</span>
          <p class="text-sm italic text-stone-600 mb-2">You took everything I use and put it into one interface.</p>
          <p class="text-xs font-medium text-stone-700">Erin</p>
          <p class="text-[11px] text-stone-400">Institute of Health Economics, Canada</p>
        </div>
        <div class="relative pl-4">
          <span class="absolute -top-2 left-0 text-4xl text-stone-300 leading-none font-serif">&ldquo;</span>
          <p class="text-sm italic text-stone-600 mb-2">It's like your reference manager is a colleague that could bat ideas at you.</p>
          <p class="text-xs font-medium text-stone-700">Alan</p>
          <p class="text-[11px] text-stone-400">MSD, UK</p>
        </div>
        <div class="relative pl-4">
          <span class="absolute -top-2 left-0 text-4xl text-stone-300 leading-none font-serif">&ldquo;</span>
          <p class="text-sm italic text-stone-600 mb-2">Even without the AI, it's a great editor, that does what it needs to do very well.</p>
          <p class="text-xs font-medium text-stone-700">Edi</p>
          <p class="text-[11px] text-stone-400">University of Sheffield, UK</p>
        </div>
        <div class="relative pl-4">
          <span class="absolute -top-2 left-0 text-4xl text-stone-300 leading-none font-serif">&ldquo;</span>
          <p class="text-sm italic text-stone-600 mb-2">Oh... wow, that is so cool!</p>
          <p class="text-xs font-medium text-stone-700">Lalitha</p>
          <p class="text-[11px] text-stone-400">Penn State University, USA</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
</script>
