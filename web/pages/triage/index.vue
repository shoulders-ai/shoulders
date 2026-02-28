<template>
  <div class="min-h-screen bg-white font-sans antialiased">
    <!-- Top bar -->
    <header class="border-b border-stone-200 bg-white">
      <div class="max-w-4xl mx-auto px-6 py-3 flex items-center">
        <span class="font-serif font-semibold text-base tracking-tight text-stone-900">Paper Triage</span>
      </div>
    </header>

    <div class="max-w-lg mx-auto px-6 py-24 text-center">
      <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">Manuscript Assessment</p>
      <h1 class="font-serif text-2xl font-semibold tracking-tight text-stone-900 mb-3">
        Structured triage for editorial desk decisions
      </h1>
      <p class="text-sm text-stone-400 mb-12 leading-relaxed">
        Upload a manuscript to receive a qualitative assessment covering scope, significance, methodology, references, and related work.
      </p>

      <!-- Drop zone -->
      <div
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="handleDrop"
        @click="fileInput?.click()"
        class="border-2 border-dashed rounded-lg px-8 py-16 cursor-pointer transition-all duration-150 mb-6"
        :class="dragOver
          ? 'border-cadet-400 bg-cadet-50/30'
          : 'border-stone-200 hover:border-stone-300'"
      >
        <p class="text-base text-stone-400 select-none mb-1">
          Drop a manuscript here
        </p>
        <p class="text-xs text-stone-300">
          .pdf or .docx, up to 50 MB
        </p>
        <input
          ref="fileInput"
          type="file"
          accept=".pdf,.docx"
          class="hidden"
          @change="handleFileSelect"
        >
      </div>

      <!-- Error -->
      <p v-if="error" class="text-xs text-red-500 mb-4">{{ error }}</p>

      <!-- Uploading state -->
      <div v-if="uploading" class="flex items-center justify-center gap-2 text-sm text-stone-500">
        <svg class="w-4 h-4 animate-spin text-cadet-500" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" class="opacity-20" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        Uploading...
      </div>
    </div>

    <!-- Footer -->
    <div class="fixed bottom-0 left-0 right-0 border-t border-stone-100 bg-white py-3 text-center">
      <a href="https://shoulde.rs" class="text-xs text-stone-300 hover:text-stone-400 transition-colors tracking-wide">
        shoulde.rs
      </a>
    </div>
  </div>
</template>

<script setup>
const router = useRouter()
const fileInput = ref(null)
const dragOver = ref(false)
const uploading = ref(false)
const error = ref('')

useHead({ title: 'Paper Triage — Shoulders' })

async function uploadFile(file) {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
    error.value = 'Only .pdf and .docx files are accepted.'
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    error.value = 'File exceeds 50MB limit.'
    return
  }

  error.value = ''
  uploading.value = true

  try {
    const formData = new FormData()
    formData.append('file', file)
    const { slug } = await $fetch('/api/triage/upload', { method: 'POST', body: formData })
    router.push(`/triage/${slug}`)
  } catch (e) {
    error.value = e.data?.statusMessage || e.message || 'Upload failed.'
    uploading.value = false
  }
}

function handleDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) uploadFile(file)
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file) uploadFile(file)
}
</script>
