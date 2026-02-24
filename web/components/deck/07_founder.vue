<template>
  <div class="relative flex flex-col justify-center h-full bg-white px-24 py-16">
    <!-- Label -->
    <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Founder</p>

    <!-- Photo + Text layout -->
    <div class="flex items-start gap-10">

      <!-- Photo -->
      <div class="flex-shrink-0">
        <img
          src="/img/paul.jpeg"
          alt="Paul Schneider"
          class="h-[180px]  mt-2 rounded-lg border border-stone-300/50"
        />
      </div>

      <!-- Content -->
      <div>
        <!-- Name + Credentials -->
        <h3 class="text-2xl font-semibold text-stone-900 mb-1">Paul Schneider</h3>
        <div class="flex items-center text-stone-500 mb-4 space-x-3 text-sm">
          <span>MD</span>
          <span class="h-4 w-px bg-stone-200 rounded"></span>
          <span>MSc Epidemiology</span>
          <span class="h-4 w-px bg-stone-200 rounded"></span>
          <span>PhD Medicine</span>
          <span class="h-4 w-px bg-stone-200 rounded"></span>
          <span>PhD Health Economics</span>
        </div>

        <!-- Background -->
        <div class="space-y-4 text-lg text-stone-700 max-w-xl">
          <p>
            Previously health economic and decision science researcher at the University of Sheffield, UK; 50 publications, 480 citations
          </p>
          <p>
            Co-founded a consulting firm (<a 
              href="https://linkedin.com/company/67121703"
              target="_blank"
              rel="noopener"
              class="transition underline-offset-2 no-underline hover:underline decoration-stone-400"
            >DPA</a>, $1M/year revenue)<br>and a software startup (<a 
              href="https://valorem.health/"
              target="_blank"
              rel="noopener"
              class="transition underline-offset-2 no-underline hover:underline decoration-stone-400"
            >Valorem Health</a>, failed)
          </p>
          <p>
            Built research software for national technology appraisal;<br>closed enterprise deals with pharma companies (AZ, BMS, GSK, etc.)
          </p>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
</script>
