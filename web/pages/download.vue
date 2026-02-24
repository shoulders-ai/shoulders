<template>
  <div class="pt-36 pb-20 px-6">
    <div class="max-w-4xl mx-auto">
      <h1 class="font-serif text-2xl md:text-3xl font-semibold tracking-tight text-stone-900 text-center">Download Shoulders</h1>
      <p class="mt-4 text-base text-stone-600 text-center">Available for macOS, Windows, and Linux.</p>
      
      <div class="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-stone-200 border border-stone-200 rounded-lg overflow-hidden">
        <!-- macOS -->
        <div class="bg-white p-8">
          <IconBrandApple class="text-stone-700" :size="28" :stroke-width="1.5" />
          <h2 class="mt-4 text-base font-semibold text-stone-900">macOS</h2>
          <div class="mt-6 space-y-2">
            <a
              :href="getAssetUrl(['aarch64.dmg', 'aarch64.app.tar.gz'])"
              class="block text-center bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
              @click="trackDownload('mac-arm')"
            >Apple Silicon</a>
            <a
              :href="getAssetUrl(['x64.dmg', 'x86_64.dmg', 'x64.app.tar.gz'])"
              class="block text-center border border-stone-200 hover:border-stone-300 text-stone-700 text-sm font-medium px-5 py-2 rounded transition-colors"
              @click="trackDownload('mac-intel')"
            >Intel</a>
          </div>
        </div>

        <!-- Windows -->
        <div class="bg-white p-8">
          <IconBrandWindows class="text-stone-700" :size="28" :stroke-width="1.5" />
          <h2 class="mt-4 text-base font-semibold text-stone-900">Windows</h2>
          <div class="mt-6">
            <a
              :href="getAssetUrl(['.msi', '.exe'])"
              class="block text-center bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
              @click="trackDownload('windows')"
            >Download .msi</a>
          </div>
        </div>

        <!-- Linux -->
        <div class="bg-white p-8">
          <IconBrandUbuntu class="text-stone-700" :size="28" :stroke-width="1.5" />
          <h2 class="mt-4 text-base font-semibold text-stone-900">Linux</h2>
          <div class="mt-6 space-y-2">
            <a
              :href="getAssetUrl(['.appimage'])"
              class="block text-center bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded transition-colors"
              @click="trackDownload('linux-appimage')"
            >AppImage</a>
            <a
              :href="getAssetUrl(['.deb'])"
              class="block text-center border border-stone-200 hover:border-stone-300 text-stone-700 text-sm font-medium px-5 py-2 rounded transition-colors"
              @click="trackDownload('linux-deb')"
            >.deb</a>
          </div>
        </div>
      </div>

      <div class="mt-8 flex flex-col items-center gap-6">
        <div v-if="release" class="text-sm text-stone-500 flex items-center">
          <div class="text-stone-500">Research Preview</div> 
          <div class="inline-block w-px h-3 bg-stone-300 mx-2 align-middle"></div> 
          <div class="text-stone-500">Version {{ release.version || 0.2 }}</div>
          <div class="inline-block w-px h-3 bg-stone-300 mx-2 align-middle"></div> 

          <a href="https://github.com/shoulders-ai/shoulders" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 hover:text-stone-800 transition-colors underline underline-offset-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"/></svg>
          View on GitHub
        </a>
        </div>

        

        <p class="mt-2 text-center text-xs text-stone-600">
        By downloading Shoulders, you agree to the
        <NuxtLink to="/terms" class="underline underline-offset-2 hover:text-stone-900 transition-colors">terms of service</NuxtLink>
        and
        <NuxtLink to="/privacy" class="underline underline-offset-2 hover:text-stone-900 transition-colors">privacy policy</NuxtLink>.
      </p>
      </div>

    </div>
  </div>
</template>

<script setup>
import { IconBrandApple, IconBrandWindows, IconBrandUbuntu } from '@tabler/icons-vue'

const { data: release } = useFetch('/api/releases')

function getAssetUrl(exts) {
  if (!release.value?.assets?.length) return '#'
  const match = release.value.assets.find(a => {
    const n = a.name.toLowerCase()
    return exts.some(ext => n.includes(ext))
  })
  return match?.url || '#'
}

function trackDownload(platform) {
  const { $analytics } = useNuxtApp()
  $analytics?.trackDownload(platform)
}
</script>
