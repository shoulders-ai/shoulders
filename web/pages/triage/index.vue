<template>
  <div class="min-h-screen bg-white font-sans antialiased">
    <!-- Top bar -->
    <header class="border-b border-stone-200 bg-white">
      <div class="max-w-3xl mx-auto px-6 py-3 flex items-center">
        <span class="text-sm font-semibold tracking-tight text-stone-900">Paper Triage</span>
      </div>
    </header>

    <div class="max-w-lg mx-auto px-6 py-20">
      <h1 class="text-base font-semibold tracking-tight text-stone-900 mb-1 text-center">
        Manuscript triage
      </h1>
      <p class="text-sm text-stone-500 mb-10 leading-relaxed text-center">
        Structured desk assessment with reference verification, citation forecast, and related work analysis.
      </p>

      <!-- Journal selector -->
      <div class="mb-3">
        <label class="block text-xs font-medium text-stone-600 mb-1">Target journal</label>
        <select v-model="selectedJournal"
          class="w-full border border-stone-200 rounded-sm px-3 py-2 text-sm text-stone-700 bg-white focus:outline-none focus:border-stone-400 transition-colors">
          <option value="">None (general assessment)</option>
          <option v-for="j in journals" :key="j.id" :value="j.id">{{ j.name }}</option>
          <option value="__custom">Custom...</option>
        </select>
      </div>

      <!-- Custom journal scope -->
      <div v-if="selectedJournal === '__custom'" class="mb-3">
        <textarea v-model="customJournalScope"
          rows="2"
          placeholder="Describe the journal's scope and audience"
          class="w-full border border-stone-200 rounded-sm px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors resize-none"
        ></textarea>
      </div>

      <!-- Custom instructions -->
      <div class="mb-6">
        <label class="block text-xs font-medium text-stone-600 mb-1">Instructions <span class="text-stone-400 font-normal">(optional)</span></label>
        <textarea v-model="customInstructions"
          rows="2"
          placeholder="E.g. 'Focus on statistical methodology' or 'Assess suitability for a special issue on disability rights'"
          class="w-full border border-stone-200 rounded-sm px-3 py-2 text-sm text-stone-700 placeholder:text-stone-300 focus:outline-none focus:border-stone-400 transition-colors resize-none"
        ></textarea>
      </div>

      <!-- Drop zone -->
      <div v-if="!selectedFile"
        @dragover.prevent="dragOver = true"
        @dragleave.prevent="dragOver = false"
        @drop.prevent="handleDrop"
        @click="fileInput?.click()"
        class="border-2 border-dashed px-8 py-12 cursor-pointer transition-all duration-150 mb-4"
        :class="dragOver
          ? 'border-stone-400 bg-stone-50'
          : 'border-stone-200 hover:border-stone-300'"
      >
        <p class="text-sm text-stone-500 select-none mb-1 text-center">
          Drop a manuscript here
        </p>
        <p class="text-xs text-stone-400 text-center">
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

      <!-- Selected file -->
      <div v-else class="border border-stone-200 px-4 py-3 mb-4 flex items-center justify-between">
        <div>
          <p class="text-sm text-stone-800 font-mono">{{ selectedFile.name }}</p>
          <p class="text-xs text-stone-400 font-mono">{{ formatFileSize(selectedFile.size) }}</p>
        </div>
        <button @click="clearFile" class="text-xs text-stone-400 hover:text-stone-600 transition-colors">
          Remove
        </button>
      </div>

      <!-- Error -->
      <p v-if="error" class="text-xs text-red-500 mb-4">{{ error }}</p>

      <!-- Start button -->
      <button v-if="selectedFile && !uploading" @click="startAssessment"
        class="w-full py-2.5 text-sm font-medium text-white bg-stone-900 hover:bg-stone-800 transition-colors">
        Start Assessment
      </button>

      <!-- Uploading state -->
      <div v-if="uploading" class="flex items-center justify-center gap-2 text-sm text-stone-500 py-2.5">
        <svg class="w-4 h-4 animate-spin text-stone-400" viewBox="0 0 24 24" fill="none">
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
definePageMeta({ layout: false })

const router = useRouter()
const fileInput = ref(null)
const dragOver = ref(false)
const uploading = ref(false)
const error = ref('')
const selectedFile = ref(null)
const selectedJournal = ref('')
const customJournalScope = ref('')
const customInstructions = ref('')
const journals = ref([])

useHead({ title: 'Paper Triage — Shoulders' })

onMounted(async () => {
  try {
    journals.value = await $fetch('/triage/journals.json')
  } catch {
    console.warn('Could not load journal presets')
  }
})

function getJournalScope() {
  if (selectedJournal.value === '__custom') return customJournalScope.value.trim() || null
  if (!selectedJournal.value) return null
  const j = journals.value.find(j => j.id === selectedJournal.value)
  return j ? `${j.name}: ${j.scope}` : null
}

function validateFile(file) {
  const name = file.name.toLowerCase()
  if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
    error.value = 'Only .pdf and .docx files are accepted.'
    return false
  }
  if (file.size > 50 * 1024 * 1024) {
    error.value = 'File exceeds 50MB limit.'
    return false
  }
  error.value = ''
  return true
}

function handleDrop(e) {
  dragOver.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file && validateFile(file)) selectedFile.value = file
}

function handleFileSelect(e) {
  const file = e.target.files?.[0]
  if (file && validateFile(file)) selectedFile.value = file
}

function clearFile() {
  selectedFile.value = null
  error.value = ''
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

async function startAssessment() {
  if (!selectedFile.value) return
  uploading.value = true
  error.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    const scope = getJournalScope()
    if (scope) formData.append('journalScope', scope)
    const instr = customInstructions.value.trim()
    if (instr) formData.append('customInstructions', instr)

    const { slug } = await $fetch('/api/triage/upload', { method: 'POST', body: formData })
    router.push(`/triage/${slug}`)
  } catch (e) {
    error.value = e.data?.statusMessage || e.message || 'Upload failed.'
    uploading.value = false
  }
}
</script>
