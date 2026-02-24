<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" data-ref-dialog @click.self="$emit('close')">
      <div
        class="add-ref-dialog rounded-lg border shadow-2xl overflow-hidden relative"
        :style="{ background: 'var(--bg-secondary)', borderColor: 'var(--border)', width: '480px', maxHeight: '70vh' }"
        @keydown.escape="$emit('close')"
      >
        <!-- Header -->
        <div class="flex items-center px-4 py-3" :style="{ borderBottom: '1px solid var(--border)' }">
          <span class="text-sm font-medium" :style="{ color: 'var(--fg-primary)' }">Add Reference</span>
          <div class="flex-1"></div>
          <button
            class="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)]"
            :style="{ color: 'var(--fg-muted)' }"
            @click="$emit('close')"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M2 2l6 6M8 2l-6 6"/>
            </svg>
          </button>
        </div>

        <!-- Input area -->
        <div class="px-4 py-3">
          <textarea
            ref="inputEl"
            v-model="inputText"
            class="w-full px-3 py-2 text-xs rounded border outline-none resize-none"
            :style="{
              background: 'var(--bg-tertiary)',
              color: 'var(--fg-primary)',
              borderColor: inputFocused ? 'var(--accent)' : 'var(--border)',
              minHeight: '80px',
            }"
            placeholder="Paste a DOI, BibTeX, RIS, citation text, or drag files here..."
            @focus="inputFocused = true"
            @blur="inputFocused = false"
            @keydown.meta.enter="lookup"
            @keydown.ctrl.enter="lookup"
          ></textarea>

          <!-- Drop overlay -->
          <div
            v-if="dropActive"
            class="absolute inset-0 flex items-center justify-center pointer-events-none rounded-lg"
            :style="{ background: 'rgba(122, 162, 247, 0.1)', border: '2px dashed var(--accent)' }"
          >
            <span class="text-xs" :style="{ color: 'var(--accent)' }">Drop files to import</span>
          </div>

          <div class="flex items-center mt-2">
            <span class="text-[10px]" :style="{ color: 'var(--fg-muted)' }">
              {{ statusText }}
            </span>
            <div class="flex-1"></div>
            <button
              class="px-3 py-1 text-xs rounded"
              :style="{
                background: 'var(--accent)',
                color: 'var(--bg-primary)',
                opacity: loading || !inputText.trim() ? 0.5 : 1,
              }"
              :disabled="loading || !inputText.trim()"
              @click="lookup"
            >
              {{ loading ? 'Looking up...' : 'Look up' }}
            </button>
          </div>
        </div>

        <!-- Results -->
        <div v-if="results.length > 0" class="border-t" :style="{ borderColor: 'var(--border)' }">
          <div class="px-4 py-1.5 text-[10px] font-medium uppercase tracking-wider" :style="{ color: 'var(--fg-muted)' }">
            Results
          </div>
          <div class="overflow-y-auto" style="max-height: 280px;">
            <div
              v-for="(r, idx) in results"
              :key="idx"
              class="px-4 py-2.5 hover:bg-[var(--bg-hover)]"
              :style="{ borderBottom: idx < results.length - 1 ? '1px solid var(--border)' : 'none' }"
            >
              <div class="flex items-center gap-2 mb-1">
                <span class="text-[10px] px-1.5 py-0.5 rounded-full" :class="confidenceClass(r.confidence)">
                  {{ confidenceLabel(r.confidence) }}
                </span>
                <span class="ref-key-badge">{{ r.csl._key || 'auto' }}</span>
              </div>
              <div class="text-xs mb-0.5" :style="{ color: 'var(--fg-primary)' }">{{ r.csl.title || 'Untitled' }}</div>
              <div class="text-[10px]" :style="{ color: 'var(--fg-muted)' }">
                {{ formatAuthors(r.csl) }}{{ r.csl.issued?.['date-parts']?.[0]?.[0] ? ' (' + r.csl.issued['date-parts'][0][0] + ')' : '' }}
                <template v-if="r.csl['container-title']"> — {{ r.csl['container-title'] }}</template>
              </div>
              <div v-if="r.csl.DOI" class="text-[10px] mt-0.5" :style="{ color: 'var(--fg-muted)' }">DOI: {{ r.csl.DOI }}</div>
              <div class="flex items-center justify-end gap-2 mt-1.5">
                <template v-if="r.existingKey && !r.added">
                  <span class="text-[10px] px-1.5 py-0.5 rounded-full" :style="{ background: 'var(--bg-tertiary)', color: 'var(--fg-muted)' }">Already in library</span>
                  <button
                    class="text-[11px] underline"
                    :style="{ color: 'var(--accent)' }"
                    @click="viewExisting(r.existingKey)"
                  >View</button>
                </template>
                <button
                  v-else-if="!r.added"
                  class="px-2.5 py-0.5 text-[11px] rounded"
                  :style="{ background: 'var(--accent)', color: 'var(--bg-primary)' }"
                  @click="addResult(r)"
                >Add</button>
                <span v-else class="text-[11px]" :style="{ color: 'var(--success)' }">Added</span>
              </div>
            </div>
          </div>
          <div v-if="results.length > 1" class="px-4 py-2 border-t" :style="{ borderColor: 'var(--border)' }">
            <button
              v-if="newCount > 0"
              class="w-full py-1.5 text-xs rounded"
              :style="{ background: 'var(--accent)', color: 'var(--bg-primary)' }"
              @click="addAll"
            >Add {{ newCount }} reference{{ newCount > 1 ? 's' : '' }}</button>
            <div v-if="dupCount > 0" class="text-[10px] mt-1 text-center" :style="{ color: 'var(--fg-muted)' }">
              {{ dupCount }} already in library
            </div>
          </div>
        </div>

        <!-- Errors -->
        <div v-if="errors.length > 0" class="px-4 py-2">
          <div v-for="(err, idx) in errors" :key="idx" class="text-[11px]" :style="{ color: 'var(--error)' }">{{ err }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { importFromText, importFromPdf } from '../../services/referenceImport'

const emit = defineEmits(['close'])

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()

const inputEl = ref(null)
const inputText = ref('')
const inputFocused = ref(false)
const loading = ref(false)
const dropActive = ref(false)
const statusText = ref('Cmd+Enter to look up')
const results = ref([])
const errors = ref([])

// --- PDF drop via custom events (routed by FileTree) ---

async function onRefFileDrop(event) {
  dropActive.value = false
  const { paths } = event.detail
  if (!paths?.length) return

  const TEXT_EXTS = ['.bib', '.ris', '.json', '.nbib', '.enw', '.txt']
  const pdfPaths = paths.filter(p => p.toLowerCase().endsWith('.pdf'))
  const textPaths = paths.filter(p => TEXT_EXTS.some(ext => p.toLowerCase().endsWith(ext)))

  // Handle text format files
  for (const filePath of textPaths) {
    loading.value = true
    statusText.value = `Importing ${filePath.split('/').pop()}...`
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const content = await invoke('read_file', { path: filePath })
      const { results: importResults, errors: importErrors } = await importFromText(content, workspace)
      for (const r of importResults) {
        results.value.push({ ...r, added: false })
      }
      errors.value.push(...importErrors)
      if (importResults.length > 0) {
        statusText.value = `Found ${importResults.length} reference${importResults.length > 1 ? 's' : ''}`
      }
    } catch (e) {
      errors.value.push(`Failed: ${filePath.split('/').pop()} - ${e.message}`)
    }
    loading.value = false
  }

  if (pdfPaths.length === 0) return

  loading.value = true
  statusText.value = 'Importing PDF...'

  for (const filePath of pdfPaths) {
    const result = await importFromPdf(filePath, workspace, referencesStore)
    if (result) {
      results.value.push({
        csl: result.csl,
        confidence: result.confidence,
        status: result.confidence,
        added: true,
      })
      statusText.value = `Imported: @${result.key}`
    }
  }

  loading.value = false
}

function onRefDragOver() {
  dropActive.value = true
}

function onRefDragLeave() {
  dropActive.value = false
}

onMounted(() => {
  nextTick(() => inputEl.value?.focus())
  window.addEventListener('ref-file-drop', onRefFileDrop)
  window.addEventListener('ref-drag-over', onRefDragOver)
  window.addEventListener('ref-drag-leave', onRefDragLeave)
})

onUnmounted(() => {
  window.removeEventListener('ref-file-drop', onRefFileDrop)
  window.removeEventListener('ref-drag-over', onRefDragOver)
  window.removeEventListener('ref-drag-leave', onRefDragLeave)
})

// --- Text lookup ---

async function lookup() {
  if (!inputText.value.trim() || loading.value) return

  loading.value = true
  statusText.value = 'Looking up...'
  results.value = []
  errors.value = []

  try {
    const { results: importResults, errors: importErrors } = await importFromText(inputText.value, workspace)
    results.value = importResults.map(r => {
      const existingKey = referencesStore.findDuplicate(r.csl)
      return { ...r, added: false, existingKey }
    })
    errors.value = importErrors

    if (importResults.length > 0) {
      statusText.value = `Found ${importResults.length} reference${importResults.length > 1 ? 's' : ''}`
    } else if (importErrors.length > 0) {
      statusText.value = 'Lookup failed'
    } else {
      statusText.value = 'No results found'
    }
  } catch (e) {
    errors.value = [e.message]
    statusText.value = 'Error'
  }

  loading.value = false
}

const newCount = computed(() => results.value.filter(r => !r.added && !r.existingKey).length)
const dupCount = computed(() => results.value.filter(r => r.existingKey && !r.added).length)

function viewExisting(existingKey) {
  emit('close')
  referencesStore.activeKey = existingKey
  editorStore.openFile(`ref:@${existingKey}`)
}

function addResult(r) {
  const result = referencesStore.addReference({ ...r.csl, _addedAt: new Date().toISOString() })
  r.added = true
  r.csl._key = result.key
}

function addAll() {
  for (const r of results.value) {
    if (!r.added && !r.existingKey) addResult(r)
  }
}

function formatAuthors(csl) {
  const authors = csl.author || []
  if (authors.length === 0) return ''
  const first = authors[0].family || authors[0].given || ''
  if (authors.length === 1) return first
  if (authors.length === 2) return `${first} & ${authors[1].family || ''}`
  return `${first} et al.`
}

function confidenceClass(confidence) {
  return {
    'ref-confidence-verified': confidence === 'verified',
    'ref-confidence-matched': confidence === 'matched',
    'ref-confidence-unverified': confidence === 'unverified',
    'ref-confidence-failed': confidence === 'failed',
  }
}

function confidenceLabel(confidence) {
  return { verified: 'Verified via CrossRef', matched: 'Matched via CrossRef', unverified: 'Unverified', failed: 'Failed' }[confidence] || confidence
}
</script>
