<template>
  <div class="relative flex flex-col h-full bg-white px-20 pb-14 pt-20">
    <!-- Label -->
    <p class="absolute top-14 left-20 text-xs uppercase tracking-widest text-stone-400">Market & Business Model</p>
    
    <!-- Main content: Image + Business Model -->
    <div class="flex-1 flex gap-10 min-h-0 mt-20">
      
      <!-- Left: Market diagram -->
      <div class="flex items-start justify-start w-2/3">
        <div class="flex flex-col justify-start ">
          <img
            src="/img/market.png"
            alt="Market sizing: TAM 12M+, SAM 3M+, SOM 1.5M+"
            class="w-full object-contain pe-4"
          />
        </div>
      </div>

      <!-- Right: Business Model -->
      <div class="w-1/3 flex flex-col justify-start ps-12 mt-3">
        

        <!-- Revenue -->
        <div class="mb-12 pt-6">
          <p class="text-xs uppercase tracking-widest text-stone-400 mb-3 font-medium">FOR Consumers</p>
          <div class="space-y-1 text-stone-700">

            <p>Freemium</p>
            <p>Subscriptions tiers</p>
            <p>Usage-based for overages</p>
          </div>
        </div>

        <!-- Enterprise -->
        <div>
          <p class="text-xs uppercase tracking-widest text-stone-400 mb-3 font-medium">FOR B2B / Enterprise</p>
          
          <div class="space-y-1 text-stone-700">
            <p>Private infrastructure</p>
            <p>Compliance</p>
            <p class="text-lg font-medium text-stone-800">$5K–$40K<span class="text-sm font-normal text-stone-500"> /seat /year</span></p>
          </div>
        </div>

      </div>
    </div>

    <!-- Market narrative -->
    <div class="absolute bottom-24 left-0 text-sm text-stone-500 flex items-center w-full text-center justify-center">
      <span class="text-stone-400 font-medium">Path:</span>
      <span class="ml-2">Build PMF in quantitative health research</span>
      <Icon name="tabler:arrow-right" class="mx-3 text-stone-300" size="16" />
      <span>Expand across labs and academic institutions</span>
      <Icon name="tabler:arrow-right" class="mx-3 text-stone-300" size="16" />
      <span>Scale into regulated enterprise R&D</span>
    </div>
  </div>
</template>

<script setup>
</script>
