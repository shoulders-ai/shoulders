<template>
  <div class="pt-36 pb-20 px-6">
    <div class="max-w-4xl mx-auto">
      <h1 class="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-stone-900 text-center">Pricing</h1>
      <p class="mt-4 text-base text-stone-600 text-center max-w-lg mx-auto">
        The document editor is free to use. AI access works two ways.
      </p>

      <div class="mt-16 grid grid-cols-1 md:grid-cols-2 gap-px bg-stone-200 border border-stone-200 rounded-lg overflow-hidden max-w-4xl mx-auto">
        <!-- BYO Keys -->
        <div class="bg-white p-8 md:p-10 flex flex-col">
          <h2 class="text-lg font-semibold text-stone-900">Bring your own keys</h2>
          <p class="mt-3 text-2xl font-semibold text-stone-900">Free</p>
          <p class="mt-4 text-sm text-stone-600 leading-relaxed">
            Use your own API keys to connect directly to Claude, Gemini, OpenAI, or private LLMs. You pay provider rates.
          </p>

          <ul class="mt-6 space-y-2 text-sm text-stone-600 flex-1">
            <li>No account required</li>
            <li>All editor features included</li>
            <li>Open source code</li>
          </ul>

          <NuxtLink to="/download" class="mt-8 block text-center bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
            Download
          </NuxtLink>
        </div>

        <!-- Shoulders AI -->
        <div class="bg-white p-8 md:p-10 flex flex-col">
          <h2 class="text-lg font-semibold text-stone-900">Shoulders AI Subscription</h2>
          <p class="mt-3 text-2xl font-semibold text-stone-900">$15<span class="text-base font-medium text-stone-400"> / month</span></p>
          <p class="mt-4 text-sm text-stone-600 leading-relaxed">
            Includes AI usage for writing, editing, and research. Additional balance available as needed.
          </p>

          <ul class="mt-6 space-y-2 text-sm text-stone-600 flex-1">
            <li>Free balance on signup to explore</li>
            <li>No API keys to manage</li>
            <li>Exa web search tool</li>
            <li>Cancel any time</li>
          </ul>

          <NuxtLink to="/signup" class="mt-8 block text-center bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded transition-colors">
            Create account
          </NuxtLink>
        </div>
      </div>

      <div class="mt-6 text-center">
        <a href="https://github.com/shoulders-ai/shoulders" target="_blank" rel="noopener" class="inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 transition-colors group">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 496 512"><path fill="currentColor" d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6c-3.3.3-5.6-1.3-5.6-3.6c0-2 2.3-3.6 5.2-3.6c3-.3 5.6 1.3 5.6 3.6m-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9c2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3m44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9c.3 2 2.9 3.3 5.9 2.6c2.9-.7 4.9-2.6 4.6-4.6c-.3-1.9-3-3.2-5.9-2.9M244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2c12.8 2.3 17.3-5.6 17.3-12.1c0-6.2-.3-40.4-.3-61.4c0 0-70 15-84.7-29.8c0 0-11.4-29.1-27.8-36.6c0 0-22.9-15.7 1.6-15.4c0 0 24.9 2 38.6 25.8c21.9 38.6 58.6 27.5 72.9 20.9c2.3-16 8.8-27.1 16-33.7c-55.9-6.2-112.3-14.3-112.3-110.5c0-27.5 7.6-41.3 23.6-58.9c-2.6-6.5-11.1-33.3 2.6-67.9c20.9-6.5 69 27 69 27c20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27c13.7 34.7 5.2 61.4 2.6 67.9c16 17.7 25.8 31.5 25.8 58.9c0 96.5-58.9 104.2-114.8 110.5c9.2 7.9 17 22.9 17 46.4c0 33.7-.3 75.4-.3 83.6c0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252C496 113.3 383.5 8 244.8 8M97.2 352.9c-1.3 1-1 3.3.7 5.2c1.6 1.6 3.9 2.3 5.2 1c1.3-1 1-3.3-.7-5.2c-1.6-1.6-3.9-2.3-5.2-1m-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9c1.6 1 3.6.7 4.3-.7c.7-1.3-.3-2.9-2.3-3.9c-2-.6-3.6-.3-4.3.7m32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2c2.3 2.3 5.2 2.6 6.5 1c1.3-1.3.7-4.3-1.3-6.2c-2.2-2.3-5.2-2.6-6.5-1m-11.4-14.7c-1.6 1-1.6 3.6 0 5.9s4.3 3.3 5.6 2.3c1.6-1.3 1.6-3.9 0-6.2c-1.4-2.3-4-3.3-5.6-2"/>
            <path fill="currentColor" d="M12.001 2c-5.525 0-10 4.475-10 10a9.99 9.99 0 0 0 6.837 9.488c.5.087.688-.213.688-.476c0-.237-.013-1.024-.013-1.862c-2.512.463-3.162-.612-3.362-1.175c-.113-.288-.6-1.175-1.025-1.413c-.35-.187-.85-.65-.013-.662c.788-.013 1.35.725 1.538 1.025c.9 1.512 2.337 1.087 2.912.825c.088-.65.35-1.087.638-1.337c-2.225-.25-4.55-1.113-4.55-4.938c0-1.088.387-1.987 1.025-2.687c-.1-.25-.45-1.275.1-2.65c0 0 .837-.263 2.75 1.024a9.3 9.3 0 0 1 2.5-.337c.85 0 1.7.112 2.5.337c1.913-1.3 2.75-1.024 2.75-1.024c.55 1.375.2 2.4.1 2.65c.637.7 1.025 1.587 1.025 2.687c0 3.838-2.337 4.688-4.562 4.938c.362.312.675.912.675 1.85c0 1.337-.013 2.412-.013 2.75c0 .262.188.574.688.474A10.02 10.02 0 0 0 22 12c0-5.525-4.475-10-10-10"/>
          </svg>
          Source code on GitHub
        </a>
      </div>

      <!-- Enterprise -->
      <div class="mt-20 border-t border-stone-100 pt-12 max-w-2xl mx-auto text-center">
        <h3 class="text-lg font-semibold text-stone-900">Organisations</h3>
        <p class="mt-2 text-sm text-stone-600 leading-relaxed max-w-sm mx-auto">
          Managed deployment with data governance, model configuration, and site licences.
        </p>
        <NuxtLink to="/enterprise" class="mt-4 inline-block text-sm text-stone-600 hover:text-stone-900 transition-colors">
          Contact us &rarr;
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup>
import { IconBrandGithubFilled } from '@tabler/icons-vue'
</script>
