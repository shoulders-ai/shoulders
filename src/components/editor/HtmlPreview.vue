<template>
  <div class="flex flex-col h-full" style="background: var(--bg-primary);">
    <!-- Toolbar -->
    <div class="flex items-center h-7 px-2 shrink-0 border-b" style="border-color: var(--border);">
      <span class="text-[11px] truncate flex-1" style="color: var(--fg-muted);">
        {{ fileName }}
      </span>
      <button
        class="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
        style="color: var(--fg-muted);"
        @click="refresh"
        title="Refresh preview"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M2 8a6 6 0 0111.5-2.5M14 8a6 6 0 01-11.5 2.5"/>
          <path d="M2 3v3.5h3.5M14 13v-3.5h-3.5"/>
        </svg>
      </button>
    </div>
    <!-- Iframe -->
    <div class="flex-1 overflow-hidden">
      <iframe
        ref="iframeRef"
        :srcdoc="htmlContent"
        class="w-full h-full border-0"
        sandbox="allow-same-origin"
        style="background: white;"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const props = defineProps({
  filePath: { type: String, required: true },
})

const iframeRef = ref(null)
const htmlContent = ref('<html><body><p style="color:#888;font-family:sans-serif;padding:2em;">Rendering...</p></body></html>')

const fileName = props.filePath.split('/').pop()

async function loadHtml() {
  // The rendered file is typically in the same directory with .html extension
  const htmlPath = props.filePath.replace(/\.(rmd|qmd)$/i, '.html')
  try {
    const content = await invoke('read_file', { path: htmlPath })
    if (content) {
      htmlContent.value = content
    }
  } catch (e) {
    htmlContent.value = `<html><body><p style="color:#c44;font-family:sans-serif;padding:2em;">Could not load rendered file: ${htmlPath}<br><br>${e}</p></body></html>`
  }
}

function refresh() {
  loadHtml()
}

onMounted(() => {
  loadHtml()
})

watch(() => props.filePath, () => {
  loadHtml()
})
</script>
