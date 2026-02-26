<template>
  <div class="pt-36 pb-20 px-6">
    <div class="max-w-lg mx-auto">

        <!-- SUBMITTED STATE -->
        <template v-if="submitted">
          <div class="text-center pt-16">
            <IconCircleCheck :size="36" :stroke-width="1.25" class="text-sea-500 mx-auto mb-5" />
            <h1 class="text-xl font-serif font-semibold text-stone-900 tracking-tight mb-3">
              Your paper has been submitted for review
            </h1>
            <p class="text-sm text-stone-600 leading-relaxed mb-1">
              We'll email you at <strong class="font-medium text-stone-900">{{ emailInput }}</strong>
              when it's ready &mdash; it usually takes ~5 minutes.
            </p>
            <p class="text-xs text-stone-400 mb-8">Check your spam folder if you don't see it.</p>
            <button @click="reset" class="text-sm text-stone-500 underline underline-offset-2 hover:text-stone-700">
              Submit another
            </button>
          </div>
        </template>

        <!-- UPLOAD STATE -->
        <template v-else>
          <div class="text-center mb-10 pt-10">
            <p class="text-xs font-semibold text-cadet-500 uppercase tracking-[0.15em] mb-4">Free Research Preview</p>
            <h1 class="text-2xl md:text-3xl font-serif font-semibold tracking-tight text-stone-900">AI Peer Review</h1>
            <p class="mt-5 text-base text-stone-600 leading-relaxed">
              Upload a research paper (.docx or .pdf) and receive an AI review within a few minutes.
            </p>
          </div>

          <div
            class="border border-stone-200 rounded-lg p-8 transition-colors"
            :class="isDragging ? 'border-stone-400 bg-stone-50' : ''"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop.prevent="handleDrop"
          >
            <div v-if="!selectedFile" class="text-center">
              <IconFileUpload :size="36" :stroke-width="1.25" class="text-stone-300 mx-auto mb-3" />
              <p class="text-sm text-stone-600 mb-4">
                Drag and drop a <strong class="font-medium text-stone-900">.docx</strong> or <strong class="font-medium text-stone-900">.pdf</strong> file here
              </p>
              <label class="inline-flex items-center gap-2 bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2 rounded tracking-wide cursor-pointer transition-colors">
                <IconUpload :size="16" :stroke-width="1.5" />
                Choose file
                <input type="file" accept=".docx,.pdf" class="hidden" @change="handleFileSelect" />
              </label>
            </div>

            <div v-else class="space-y-5">
              <div class="flex items-center gap-3">
                <IconFileText :size="22" :stroke-width="1.5" class="text-stone-400 shrink-0" />
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-medium text-stone-900 truncate">{{ selectedFile.name }}</p>
                  <p class="text-xs text-stone-400">{{ formatSize(selectedFile.size) }}</p>
                </div>
                <button
                  v-if="!isUploading"
                  @click="selectedFile = null"
                  class="p-1 text-stone-400 hover:text-stone-600 transition-colors"
                >
                  <IconX :size="16" :stroke-width="1.5" />
                </button>
              </div>

              <div>
                <label class="block text-xs font-medium text-stone-600 mb-1.5">Email</label>
                <input
                  v-model="emailInput"
                  type="email"
                  placeholder="We'll email you when it's ready"
                  class="w-full px-3 py-2 border border-stone-200 rounded text-sm text-stone-900 placeholder:text-stone-300 focus:outline-none focus:border-stone-400"
                />
              </div>

              <button
                @click="submit"
                :disabled="isUploading || !isEmailValid"
                class="w-full bg-stone-900 hover:bg-stone-800 text-white text-sm font-medium px-5 py-2.5 rounded tracking-wide transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <IconLoader2 v-if="isUploading" :size="16" :stroke-width="1.5" class="animate-spin" />
                {{ isUploading ? 'Submitting...' : 'Submit for review' }}
              </button>
            </div>
          </div>

          <div v-if="errorMsg" class="mt-4 p-3 border border-red-200 rounded text-sm text-red-600">
            {{ errorMsg }}
          </div>

          <p class="text-center text-xs text-stone-400 mt-6">
            Reviews are available for 48 hours. No account required.
          </p>
        </template>

      </div>
    </div>
</template>

<script setup>
import { IconFileUpload, IconUpload, IconFileText, IconX, IconLoader2, IconCircleCheck } from '@tabler/icons-vue'

useHead({ title: 'AI Peer Review — Shoulders' })

const selectedFile = ref(null)
const emailInput = ref('')
const isDragging = ref(false)
const isUploading = ref(false)
const errorMsg = ref('')
const submitted = ref(false)

const isEmailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.value))

function handleDrop(e) {
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) validateAndSet(file)
}

function handleFileSelect(e) {
  const file = e.target?.files?.[0]
  if (file) validateAndSet(file)
}

function validateAndSet(file) {
  errorMsg.value = ''
  const name = file.name.toLowerCase()
  if (!name.endsWith('.docx') && !name.endsWith('.pdf')) {
    errorMsg.value = 'Only .docx and .pdf files are accepted.'
    return
  }
  if (file.size > 50 * 1024 * 1024) {
    errorMsg.value = 'File exceeds 50MB limit.'
    return
  }
  selectedFile.value = file
}

async function submit() {
  if (!selectedFile.value || isUploading.value || !isEmailValid.value) return
  isUploading.value = true
  errorMsg.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)
    formData.append('email', emailInput.value.trim())

    await $fetch('/api/review/upload', {
      method: 'POST',
      body: formData,
    })

    submitted.value = true
  } catch (e) {
    errorMsg.value = e.data?.statusMessage || e.message || 'Upload failed. Please try again.'
  } finally {
    isUploading.value = false
  }
}

function reset() {
  submitted.value = false
  selectedFile.value = null
  emailInput.value = ''
  errorMsg.value = ''
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
</script>
