<template>
  <footer class="border-t border-stone-200">
    <div class="max-w-6xl mx-auto px-6 pb-14 pt-20">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-10">
        <div class="col-span-2 md:col-span-1">
          <NuxtLink to="/" class="font-serif text-lg font-semibold text-stone-900">Shoulders</NuxtLink>
          <p class="mt-2 text-xs text-stone-400 leading-relaxed max-w-[200px]">
            The AI workspace for researchers.
          </p>
          <a href="mailto:contact@shoulde.rs" class="block mt-3 text-xs text-stone-400 hover:text-stone-600 transition-colors">contact@shoulde.rs</a>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-stone-800 uppercase tracking-wider mb-3">Product</h4>
          <nav class="space-y-2">
            <NuxtLink to="/download" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">Download</NuxtLink>
            <NuxtLink to="/pricing" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">Pricing</NuxtLink>
            <NuxtLink to="/docs" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">Documentation</NuxtLink>
            <NuxtLink to="/review" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">AI Peer Review</NuxtLink>
          </nav>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-stone-800 uppercase tracking-wider mb-3">About</h4>
          <nav class="space-y-2">
            <NuxtLink to="/about" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">About</NuxtLink>
            <NuxtLink to="/enterprise" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">Organisations</NuxtLink>
            <a href="https://github.com/shoulders-ai/shoulders" target="_blank" rel="noopener" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">GitHub</a>
          </nav>
        </div>

        <div>
          <h4 class="text-xs font-semibold text-stone-800 uppercase tracking-wider mb-3">Legal</h4>
          <nav class="space-y-2">
            <NuxtLink to="/privacy" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">Privacy</NuxtLink>
            <NuxtLink to="/terms" class="block text-xs text-stone-400 hover:text-stone-600 transition-colors">Terms</NuxtLink>
          </nav>
        </div>
      </div>

      <div class="mt-14 pt-8 border-t border-stone-100 flex flex-col md:flex-row justify-between items-center gap-4">
        <p class="text-xs text-stone-600">&copy; {{ new Date().getFullYear() }} Shoulders</p>
        <p class="font-serif text-sm italic text-stone-600 tracking-wide">
          &ldquo;If I have seen further, it is by standing on the shoulders of giants.&rdquo;
        </p>
      </div>
    </div>
  </footer>
</template>
