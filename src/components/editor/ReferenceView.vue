<template>
  <div v-if="ref" class="flex flex-col h-full">
    <!-- Collapsible metadata header -->
    <div class="shrink-0" style="border-bottom: 1px solid var(--border);">
      <!-- Needs review banner (always visible) -->
      <div
        v-if="ref._needsReview"
        class="px-3 py-1.5 text-[11px] flex items-center gap-2"
        :style="{ background: 'rgba(224, 175, 104, 0.1)', color: 'var(--warning)' }"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 1l7 13H1L8 1zM8 6v3M8 11h0"/>
        </svg>
        <span>Unverified — review metadata before citing</span>
        <button
          class="ml-auto px-2 py-0.5 rounded text-[10px]"
          :style="{ background: 'var(--warning)', color: 'var(--bg-primary)' }"
          @click="confirmRef"
        >
          Confirm
        </button>
      </div>

      <!-- Toggle row -->
      <div
        class="flex items-center gap-1.5 px-3 py-1.5 cursor-pointer select-none hover:bg-[var(--bg-hover)]"
        @click="detailsOpen = !detailsOpen"
      >
        <svg
          width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
          :style="{ color: 'var(--fg-muted)', transform: detailsOpen ? 'rotate(90deg)' : '', transition: 'transform 0.1s' }"
        >
          <path d="M6 4l4 4-4 4"/>
        </svg>
        <span class="text-[11px] font-medium" :style="{ color: 'var(--fg-secondary)' }">Details</span>
        <span class="ref-key-badge text-[10px] ml-1">@{{ ref._key }}</span>
        <!-- Collapsed summary -->
        <span v-if="!detailsOpen" class="text-[11px] ml-2 truncate flex-1" :style="{ color: 'var(--fg-muted)' }">
          {{ authorLine }}{{ year ? ` (${year})` : '' }}
        </span>
        <div class="flex-1" v-if="detailsOpen"></div>
        <!-- Copy actions -->
        <div class="flex items-center gap-1 ml-auto" @click.stop>
          <button
            class="px-2 py-0.5 text-[10px] rounded border hover:bg-[var(--bg-hover)] transition-colors"
            :style="{ borderColor: copyFlash ? 'var(--success)' : 'var(--border)', color: copyFlash ? 'var(--success)' : 'var(--fg-secondary)' }"
            @click="handleCopyAs(copyFormat)"
          >
            {{ copyFlash ? 'Copied!' : 'Copy' }}
          </button>
          <select
            :value="copyFormat"
            class="ref-type-select"
            @change="copyFormat = $event.target.value; handleCopyAs($event.target.value)"
          >
            <option value="apa">APA</option>
            <option value="chicago">Chicago</option>
            <option value="ieee">IEEE</option>
            <option value="harvard">Harvard</option>
            <option value="vancouver">Vancouver</option>
            <option value="bibtex">BibTeX</option>
          </select>
        </div>
        <span class="mx-1 text-[10px]" :style="{ color: 'var(--border)' }">|</span>
        <button
          class="px-1.5 py-0.5 text-[11px] rounded hover:bg-[var(--bg-hover)]"
          :style="{ color: 'var(--error)' }"
          @click.stop="deleteRef"
        >
          Delete
        </button>
      </div>

      <!-- Expandable details -->
      <div v-if="detailsOpen" class="overflow-y-auto" style="max-height: 40vh;">
        <div class="px-3 pb-3 space-y-2.5">
          <!-- Title -->
          <div>
            <label class="ref-detail-label">Title</label>
            <input
              :value="ref.title"
              class="ref-detail-input"
              @change="update('title', $event.target.value)"
            />
          </div>

          <!-- Authors + Year row -->
          <div class="flex gap-2">
            <div class="flex-1">
              <label class="ref-detail-label">Authors</label>
              <input
                :value="authorsString"
                class="ref-detail-input"
                placeholder="Last, First and Last, First"
                @change="updateAuthors($event.target.value)"
              />
            </div>
            <div class="w-20">
              <label class="ref-detail-label">Year</label>
              <input
                :value="year"
                class="ref-detail-input"
                type="number"
                @change="updateYear($event.target.value)"
              />
            </div>
          </div>

          <!-- Type + Journal row -->
          <div class="flex gap-2">
            <div class="w-40">
              <label class="ref-detail-label">Type</label>
              <select
                :value="ref.type"
                class="ref-detail-input ref-type-select"
                @change="update('type', $event.target.value)"
              >
                <option value="article-journal">Journal Article</option>
                <option value="paper-conference">Conference Paper</option>
                <option value="book">Book</option>
                <option value="chapter">Book Chapter</option>
                <option value="thesis">Thesis</option>
                <option value="report">Report</option>
                <option value="article">Preprint / Article</option>
                <option value="webpage">Webpage</option>
              </select>
            </div>
            <div class="flex-1">
              <label class="ref-detail-label">Journal / Conference</label>
              <input
                :value="ref['container-title']"
                class="ref-detail-input"
                @change="update('container-title', $event.target.value)"
              />
            </div>
          </div>

          <!-- Volume / Issue / Pages / DOI row -->
          <div class="flex gap-2">
            <div class="w-16">
              <label class="ref-detail-label">Vol</label>
              <input :value="ref.volume" class="ref-detail-input" @change="update('volume', $event.target.value)" />
            </div>
            <div class="w-16">
              <label class="ref-detail-label">Issue</label>
              <input :value="ref.issue" class="ref-detail-input" @change="update('issue', $event.target.value)" />
            </div>
            <div class="w-20">
              <label class="ref-detail-label">Pages</label>
              <input :value="ref.page" class="ref-detail-input" @change="update('page', $event.target.value)" />
            </div>
            <div class="flex-1">
              <label class="ref-detail-label">DOI</label>
              <input :value="ref.DOI" class="ref-detail-input" @change="update('DOI', $event.target.value)" />
            </div>
          </div>

          <!-- Tags -->
          <div>
            <label class="ref-detail-label">Tags</label>
            <input
              :value="(ref._tags || []).join(', ')"
              class="ref-detail-input"
              placeholder="comma-separated"
              @change="updateTags($event.target.value)"
            />
          </div>

          <!-- Extra fields (publisher, URL, ISBN, etc.) -->
          <div v-if="extraFields.length > 0">
            <label class="ref-detail-label">Other fields</label>
            <div class="space-y-1">
              <div v-for="f in extraFields" :key="f.key" class="flex gap-1.5 items-start">
                <span class="text-[10px] w-20 shrink-0 text-right pt-[3px]" :style="{ color: 'var(--fg-muted)' }">{{ f.label }}</span>
                <input
                  :value="f.value"
                  class="ref-detail-input flex-1"
                  @change="update(f.key, $event.target.value)"
                />
              </div>
            </div>
          </div>

          <!-- Add field -->
          <div v-if="!addingField">
            <button
              class="text-[10px] hover:underline"
              :style="{ color: 'var(--fg-muted)' }"
              @click="addingField = true"
            >+ Add field</button>
          </div>
          <div v-else class="flex gap-1.5 items-center">
            <select
              v-model="newFieldKey"
              class="ref-type-select text-[11px]"
              style="width: 100px;"
            >
              <option value="" disabled>Field...</option>
              <option v-for="opt in addableFields" :key="opt.key" :value="opt.key">{{ opt.label }}</option>
            </select>
            <input
              v-model="newFieldValue"
              class="ref-detail-input flex-1"
              placeholder="Value"
              @keydown.enter="confirmAddField"
            />
            <button
              class="text-[10px] px-1.5 py-0.5 rounded hover:bg-[var(--bg-hover)]"
              :style="{ color: 'var(--accent)' }"
              :disabled="!newFieldKey || !newFieldValue"
              @click="confirmAddField"
            >Add</button>
            <button
              class="text-[10px] px-1 py-0.5 rounded hover:bg-[var(--bg-hover)]"
              :style="{ color: 'var(--fg-muted)' }"
              @click="addingField = false; newFieldKey = ''; newFieldValue = ''"
            >Cancel</button>
          </div>

          <!-- Abstract (collapsible) -->
          <div v-if="ref.abstract">
            <label class="ref-detail-label">Abstract</label>
            <div class="text-[11px] leading-relaxed" :style="{ color: 'var(--fg-secondary)' }">
              <template v-if="!abstractExpanded">
                <span class="ref-abstract-clamped">{{ ref.abstract }}</span>
                <button
                  v-if="ref.abstract.length > 200"
                  class="text-[10px] ml-1 hover:underline"
                  :style="{ color: 'var(--accent)' }"
                  @click="abstractExpanded = true"
                >read more</button>
              </template>
              <template v-else>
                <span>{{ ref.abstract }}</span>
                <button
                  class="text-[10px] ml-1 hover:underline"
                  :style="{ color: 'var(--accent)' }"
                  @click="abstractExpanded = false"
                >collapse</button>
              </template>
            </div>
          </div>

          <!-- Cited in -->
          <div v-if="citedInFiles.length > 0">
            <label class="ref-detail-label">Cited in {{ citedInFiles.length }} file{{ citedInFiles.length !== 1 ? 's' : '' }}</label>
            <div class="flex flex-wrap gap-x-3 gap-y-0.5">
              <span
                v-for="file in citedInFiles"
                :key="file"
                class="text-[11px] cursor-pointer hover:underline truncate"
                :style="{ color: 'var(--hl-link)' }"
                @click="editorStore.openFile(file)"
              >
                {{ relativePath(file) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom: PDF viewer or empty state -->
    <div class="flex-1 overflow-hidden" style="min-height: 100px;">
      <PdfViewer
        v-if="pdfPath"
        :key="pdfPath"
        :filePath="pdfPath"
        :paneId="paneId"
      />
      <div v-else class="flex flex-col items-center justify-center h-full gap-3" :style="{ color: 'var(--fg-muted)' }">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.4;">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span class="text-[11px]">No PDF attached</span>
        <button
          class="px-3 py-1 text-[11px] rounded border hover:bg-[var(--bg-hover)]"
          :style="{ borderColor: 'var(--border)', color: 'var(--fg-secondary)' }"
          @click="attachPdf"
        >
          Attach PDF...
        </button>
      </div>
    </div>
  </div>

  <!-- Deleted / not found -->
  <div v-else class="flex items-center justify-center h-full text-[11px]" :style="{ color: 'var(--fg-muted)' }">
    Reference not found
  </div>
</template>

<script setup>
import { ref as vRef, computed, watch, onMounted } from 'vue'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { formatReference } from '../../services/citationFormatter'
import { ask, open } from '@tauri-apps/plugin-dialog'
import PdfViewer from './PdfViewer.vue'

const props = defineProps({
  refKey: { type: String, required: true },
  paneId: { type: String, required: true },
})

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()

const detailsOpen = vRef(!referencesStore.getByKey(props.refKey)?._pdfFile)
const abstractExpanded = vRef(false)
const copyFlash = vRef(false)
let copyFlashTimer = null
const copyFormat = vRef(localStorage.getItem('refCopyFormat') || referencesStore.citationStyle)
const addingField = vRef(false)
const newFieldKey = vRef('')
const newFieldValue = vRef('')

const ADDABLE_FIELDS = [
  { key: 'publisher', label: 'Publisher' },
  { key: 'URL', label: 'URL' },
  { key: 'ISBN', label: 'ISBN' },
  { key: 'ISSN', label: 'ISSN' },
  { key: 'language', label: 'Language' },
  { key: 'edition', label: 'Edition' },
  { key: 'note', label: 'Note' },
  { key: 'collection-title', label: 'Series' },
  { key: 'number-of-pages', label: 'Page count' },
  { key: 'source', label: 'Source' },
]

const addableFields = computed(() => {
  if (!ref.value) return ADDABLE_FIELDS
  return ADDABLE_FIELDS.filter(f => ref.value[f.key] == null || ref.value[f.key] === '')
})

const ref = computed(() => referencesStore.getByKey(props.refKey))

const pdfPath = computed(() => {
  if (!ref.value?._pdfFile) return null
  return `${workspace.projectDir}/references/pdfs/${ref.value._pdfFile}`
})

const authorsString = computed(() => {
  if (!ref.value?.author) return ''
  return ref.value.author.map(a =>
    a.given ? `${a.family}, ${a.given}` : a.family
  ).join(' and ')
})

const year = computed(() => {
  return ref.value?.issued?.['date-parts']?.[0]?.[0] || ''
})

const authorLine = computed(() => {
  const authors = ref.value?.author || []
  if (authors.length === 0) return 'Unknown'
  const first = authors[0].family || authors[0].given || ''
  if (authors.length === 1) return first
  if (authors.length === 2) return `${first} & ${authors[1].family || ''}`
  return `${first} et al.`
})

// Fields already shown in the main form
const MAIN_FIELDS = new Set([
  'id', '_key', '_addedAt', '_matchMethod', '_needsReview', '_pdfFile', '_textFile', '_tags',
  'type', 'title', 'author', 'issued', 'container-title', 'volume', 'issue', 'page', 'DOI', 'abstract',
])

const EXTRA_LABELS = {
  publisher: 'Publisher',
  URL: 'URL',
  ISBN: 'ISBN',
  ISSN: 'ISSN',
  editor: 'Editor',
  edition: 'Edition',
  note: 'Note',
  language: 'Language',
  'collection-title': 'Series',
  'number-of-pages': 'Pages',
  source: 'Source',
}

const extraFields = computed(() => {
  if (!ref.value) return []
  return Object.keys(ref.value)
    .filter(k => !MAIN_FIELDS.has(k) && ref.value[k] != null && ref.value[k] !== '')
    .map(k => ({
      key: k,
      label: EXTRA_LABELS[k] || k,
      value: typeof ref.value[k] === 'object' ? JSON.stringify(ref.value[k]) : String(ref.value[k]),
    }))
})

const citedInFiles = computed(() => {
  if (!ref.value?._key) return []
  return referencesStore.citedIn[ref.value._key] || []
})

// Sync activeKey
onMounted(() => {
  referencesStore.activeKey = props.refKey
})

// Auto-close tab when reference is deleted
watch(ref, (val) => {
  if (!val) {
    editorStore.closeTab(props.paneId, `ref:@${props.refKey}`)
  }
})

function update(field, value) {
  if (!ref.value) return
  referencesStore.updateReference(ref.value._key, { [field]: value || undefined })
}

function updateAuthors(value) {
  const authors = value.split(/\s+and\s+/i).map(part => {
    part = part.trim()
    if (part.includes(',')) {
      const [family, ...rest] = part.split(',')
      return { family: family.trim(), given: rest.join(',').trim() }
    }
    const words = part.split(/\s+/)
    return {
      family: words[words.length - 1],
      given: words.slice(0, -1).join(' '),
    }
  }).filter(a => a.family)
  referencesStore.updateReference(ref.value._key, { author: authors })
}

function updateYear(value) {
  const yr = parseInt(value, 10)
  if (!isNaN(yr)) {
    referencesStore.updateReference(ref.value._key, {
      issued: { 'date-parts': [[yr]] },
    })
  }
}

function updateTags(value) {
  const tags = value.split(',').map(s => s.trim()).filter(Boolean)
  referencesStore.updateReference(ref.value._key, { _tags: tags })
}

function confirmRef() {
  referencesStore.updateReference(ref.value._key, { _needsReview: false })
}

async function handleCopyAs(style) {
  if (!ref.value || !style) return
  let text
  if (style === 'bibtex') {
    text = referencesStore.exportBibTeX([ref.value._key])
  } else {
    const { getFormatter } = await import('../../services/citationStyleRegistry')
    const formatter = getFormatter(style)
    const result = formatter.formatReference(ref.value)
    text = result instanceof Promise ? await result : result
  }
  navigator.clipboard.writeText(text)
  copyFormat.value = style
  localStorage.setItem('refCopyFormat', style)
  copyFlash.value = true
  clearTimeout(copyFlashTimer)
  copyFlashTimer = setTimeout(() => { copyFlash.value = false }, 1500)
}

function confirmAddField() {
  if (!newFieldKey.value || !newFieldValue.value || !ref.value) return
  referencesStore.updateReference(ref.value._key, { [newFieldKey.value]: newFieldValue.value })
  newFieldKey.value = ''
  newFieldValue.value = ''
  addingField.value = false
}

async function deleteRef() {
  if (!ref.value) return
  const yes = await ask(`Delete reference @${ref.value._key}?`, { title: 'Confirm Delete', kind: 'warning' })
  if (yes) {
    referencesStore.removeReference(ref.value._key)
    // Tab auto-closes via the watcher above
  }
}

async function attachPdf() {
  const selected = await open({
    multiple: false,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!selected || !ref.value) return

  // Copy PDF to references/pdfs/ and update the reference
  const { invoke } = await import('@tauri-apps/api/core')
  const fileName = selected.split('/').pop()
  const destDir = `${workspace.projectDir}/references/pdfs`
  await invoke('create_dir', { path: destDir })
  await invoke('copy_file', { src: selected, dest: `${destDir}/${fileName}` })
  referencesStore.updateReference(ref.value._key, { _pdfFile: fileName })
}

function relativePath(path) {
  if (workspace.path && path.startsWith(workspace.path)) {
    return path.slice(workspace.path.length + 1)
  }
  return path
}
</script>

<style scoped>
.ref-type-select {
  appearance: none;
  -webkit-appearance: none;
  padding: 2px 20px 2px 6px;
  font-size: 11px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  cursor: pointer;
  outline: none;
  background-image: url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3' stroke='%23888' stroke-width='1.2' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
}
.ref-type-select:focus {
  border-color: var(--accent);
}
.ref-abstract-clamped {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
