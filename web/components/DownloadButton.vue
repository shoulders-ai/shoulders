<template>
  <a
    :href="downloadUrl"
    :class="[
      'inline-flex items-center justify-center gap-2 font-medium rounded transition-colors tracking-wide',
      large
        ? 'bg-stone-900 hover:bg-stone-800 text-white text-base px-6 py-2.5'
        : 'bg-stone-900 hover:bg-stone-800 text-white text-sm px-5 py-2',
    ]"
    @click="trackClick"
  >
    <component :is="platformIcon" :size="large ? 18 : 16" :stroke-width="1.5" />
    <span>{{ buttonText }}</span>
  </a>
</template>

<script setup>
import { IconBrandApple, IconBrandWindows, IconBrandUbuntu, IconDownload } from '@tabler/icons-vue'

defineProps({
  large: { type: Boolean, default: false },
})

const { data: release } = useFetch('/api/releases')
const platform = ref('unknown')

onMounted(() => {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) platform.value = 'mac'
  else if (ua.includes('win')) platform.value = 'windows'
  else if (ua.includes('linux')) platform.value = 'linux'
})

const platformIcon = computed(() => {
  const icons = { mac: IconBrandApple, windows: IconBrandWindows, linux: IconBrandUbuntu }
  return icons[platform.value] || IconDownload
})

const buttonText = computed(() => {
  const names = { mac: 'macOS', windows: 'Windows', linux: 'Linux' }
  return names[platform.value] ? `Download for ${names[platform.value]}` : 'Download'
})

const downloadUrl = computed(() => {
  if (!release.value?.assets?.length) return '/download'
  const exts = { mac: ['.dmg'], windows: ['.msi', '.exe'], linux: ['.appimage', '.deb'] }
  const want = exts[platform.value] || []
  const match = release.value.assets.find(a => want.some(ext => a.name.toLowerCase().includes(ext)))
  return match?.url || '/download'
})

function trackClick() {
  const { $analytics } = useNuxtApp()
  $analytics?.trackDownload(platform.value || 'unknown')
}
</script>
