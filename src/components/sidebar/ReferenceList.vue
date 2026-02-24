<template>
  <div ref="rootEl" data-ref-drop-zone class="flex flex-col h-full overflow-hidden" :style="{ background: 'var(--bg-secondary)' }">
    <!-- Header -->
    <div
      class="flex items-center h-10 shrink-0 px-2 gap-1 select-none"
      :style="{ color: 'var(--fg-muted)', borderBottom: collapsed ? 'none' : '1px solid var(--border)' }"
    >
      <div class="flex items-center gap-1 cursor-pointer" @click="$emit('toggle-collapse')">
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"
          :style="{ transform: collapsed ? '' : 'rotate(90deg)', transition: 'transform 0.1s' }"
        >
          <path d="M6 4l4 4-4 4"/>
        </svg>
        <span class="text-[11px] font-medium uppercase tracking-wider">References</span>
      </div>
      <span
        v-if="referencesStore.refCount > 0"
        class="text-[11px] px-1.5 py-0.5 rounded-full"
        :style="{ background: 'var(--bg-tertiary)', color: 'var(--fg-muted)' }"
      >
        {{ referencesStore.refCount }}
      </span>
      <div class="flex-1"></div>

        <div v-if="!collapsed" class="flex items-center gap-1">
        <!-- Export button -->
        <button
          v-if="referencesStore.refCount > 0"
          ref="exportBtnEl"
          class="h-5 px-1.5 flex items-center gap-1 rounded text-[11px] hover:opacity-80"
          :style="{ color: 'var(--fg-muted)' }"
          title="Export references"
          @click.stop="toggleExportMenu"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 10V2M4 6l4-4 4 4M2 13h12"/>
          </svg>
          Export
        </button>
      </div>

      <!-- Export menu (Teleported) -->
      <Teleport to="body">
        <template v-if="showExportMenu">
          <div class="fixed inset-0 z-50" @click="showExportMenu = false"></div>
          <div class="context-menu z-50" :style="exportMenuPos">
            <div class="context-menu-section">Export as .bib</div>
            <div class="context-menu-item" @click="saveExport('bib', null)">
              All ({{ referencesStore.refCount }})
            </div>
            <div v-if="citedCount > 0" class="context-menu-item" @click="saveExport('bib', [...referencesStore.citedKeys])">
              Cited only ({{ citedCount }})
            </div>
            <div v-if="searchQuery.trim()" class="context-menu-item" @click="saveExport('bib', filteredRefs.map(r => r._key))">
              Filtered ({{ filteredRefs.length }})
            </div>
            <div v-if="referencesStore.selectedKeys.size > 0" class="context-menu-item" @click="saveExport('bib', [...referencesStore.selectedKeys])">
              Selected ({{ referencesStore.selectedKeys.size }})
            </div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-section">Export as .ris</div>
            <div class="context-menu-item" @click="saveExport('ris', null)">
              All ({{ referencesStore.refCount }})
            </div>
            <div v-if="citedCount > 0" class="context-menu-item" @click="saveExport('ris', [...referencesStore.citedKeys])">
              Cited only ({{ citedCount }})
            </div>
            <div v-if="searchQuery.trim()" class="context-menu-item" @click="saveExport('ris', filteredRefs.map(r => r._key))">
              Filtered ({{ filteredRefs.length }})
            </div>
            <div v-if="referencesStore.selectedKeys.size > 0" class="context-menu-item" @click="saveExport('ris', [...referencesStore.selectedKeys])">
              Selected ({{ referencesStore.selectedKeys.size }})
            </div>
          </div>
        </template>
      </Teleport>
    </div>

    <!-- Content -->
    <template v-if="!collapsed">
      <!-- Search + Add button row -->
      <div class="flex items-center gap-1 px-2 py-1 shrink-0">
        <div class="flex-1 min-w-0 flex items-center rounded border px-1 overflow-hidden"
          :style="{ background: 'var(--bg-tertiary)', borderColor: searchFocused ? 'var(--accent)' : 'var(--border)' }">
          <IconSearch :size="12" :stroke-width="1.5" style="color: var(--fg-muted); flex-shrink: 0;" />
          <input
            v-model="searchQuery"
            class="flex-1 px-1 py-0.5 ui-text-md outline-none bg-transparent"
            style="color: var(--fg-primary);"
            placeholder="Search references..."
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            @focus="searchFocused = true"
            @blur="searchFocused = false"
          />
        </div>
        <button
          class="shrink-0 h-5 px-1.5 flex items-center gap-0.5 rounded ui-text-sm hover:bg-[var(--bg-hover)]"
          :style="{ color: 'var(--fg-muted)' }"
          title="Add reference"
          @click.stop="showAddDialog = true"
        >
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 3v10M3 8h10"/>
          </svg>
          Add
        </button>
      </div>

      <!-- Style picker dropdown (Teleported) -->
      <Teleport to="body">
        <template v-if="showStyleMenu">
          <div class="fixed inset-0 z-50" @click="showStyleMenu = false"></div>
          <div
            class="context-menu z-50 pt-0"
            :style="styleMenuPos"
            style="width: 240px; max-height: 320px; overflow-y: auto;"
          >
            <!-- Search input (sticky, z-index to stay above scrolling items) -->
            <div class="sticky top-0 z-10 px-2 py-1.5" style="background: var(--bg-secondary); border-bottom: 1px solid var(--border);">
              <input
                ref="styleSearchEl"
                v-model="styleSearchQuery"
                class="w-full px-1.5 py-0.5 ui-text-md rounded border outline-none"
                :style="{ background: 'var(--bg-tertiary)', color: 'var(--fg-primary)', borderColor: 'var(--border)' }"
                placeholder="Search styles..."
                autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                @keydown.escape.stop="showStyleMenu = false"
              />
            </div>
            <!-- Style items -->
            <div
              v-for="style in filteredStyles"
              :key="style.id"
              class="context-menu-item"
              :style="{ color: referencesStore.citationStyle === style.id ? 'var(--accent)' : undefined, fontWeight: referencesStore.citationStyle === style.id ? '500' : undefined }"
              @click="selectStyle(style.id)"
            >
              <span class="flex-1 ui-text-sm">{{ style.name }}</span>
              <span v-if="style.category" class="ui-text-xs ml-2 opacity-50">{{ style.category }}</span>
            </div>
            <div v-if="filteredStyles.length === 0" class="px-3 py-2 ui-text-md" style="color: var(--fg-muted);">
              No matching styles
            </div>
            <!-- Add custom style -->
            <div
              class="context-menu-item"
              :style="{ borderTop: '1px solid var(--border)', color: 'var(--fg-muted)' }"
              @click="addCustomStyle"
            >
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" style="flex-shrink: 0;">
                <path d="M8 3v10M3 8h10"/>
              </svg>
              <span class="ml-1 ui-text-md">Add custom style (.csl)...</span>
            </div>
          </div>
        </template>
      </Teleport>

      <!-- Sort + filter | style (single compact row) -->
      <div v-if="referencesStore.refCount > 0" class="flex items-center gap-1 px-2 pt-1 pb-0.5 shrink-0">
        <!-- Sort button -->
        <button
          ref="sortBtnEl"
          class="w-5 h-5 flex items-center justify-center rounded shrink-0 hover:opacity-80"
          :style="{ color: 'var(--fg-muted)' }"
          title="Sort references"
          @click.stop="toggleSortMenu"
        >
          <IconArrowsSort :size="13" :stroke-width="1.5" />
        </button>

        <!-- Filter dropdown -->
        <button
          ref="filterBtnEl"
          class="h-5 px-1.5 flex items-center gap-0.5 rounded shrink-0 ui-text-sm hover:opacity-80"
          :style="{ color: citedFilter !== 'all' ? 'var(--accent)' : 'var(--fg-muted)' }"
          title="Filter references"
          @click.stop="toggleFilterMenu"
        >
          {{ filterLabel }}
          <svg width="6" height="4" viewBox="0 0 8 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink: 0;">
            <path d="M1 1l3 3 3-3"/>
          </svg>
        </button>

        <!-- Filter menu (Teleported) -->
        <Teleport to="body">
          <template v-if="showFilterMenu">
            <div class="fixed inset-0 z-50" @click="showFilterMenu = false"></div>
            <div class="context-menu z-50" :style="filterMenuPos">
              <div
                v-for="f in filterOptions"
                :key="f.value"
                class="context-menu-item"
                :style="{ color: citedFilter === f.value ? 'var(--accent)' : undefined }"
                @click="citedFilter = f.value; showFilterMenu = false"
              >
                {{ f.label }}
              </div>
            </div>
          </template>
        </Teleport>

        <div class="flex-1"></div>

        <!-- Citation style (separate concern, right-aligned) -->
        <button
          ref="styleBtnEl"
          class="h-5 px-1.5 flex items-center gap-0.5 rounded shrink-0 ui-text-sm hover:opacity-80"
          :style="{ color: 'var(--fg-muted)' }"
          title="Citation style"
          @click.stop="toggleStyleMenu"
        >
          <span
            class="block truncate"
            style="max-width: 100px;"
            :title="activeStyleName"
          >
            {{ activeStyleName }}
          </span>
          <svg width="6" height="4" viewBox="0 0 8 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" style="flex-shrink: 0;">
            <path d="M1 1l3 3 3-3"/>
          </svg>
        </button>

        <!-- Sort menu -->
        <Teleport to="body">
          <template v-if="showSortMenu">
            <div class="fixed inset-0 z-50" @click="showSortMenu = false"></div>
            <div
              ref="sortMenuEl"
              class="context-menu z-50"
              :style="sortMenuPos"
            >
              <div
                v-for="opt in sortOptions"
                :key="opt.value"
                class="context-menu-item"
                :style="{ color: currentSortKey === opt.value ? 'var(--accent)' : undefined }"
                @click="applySortOption(opt.value); showSortMenu = false"
              >
                {{ opt.label }}
              </div>
            </div>
          </template>
        </Teleport>
      </div>

      <!-- Import status toast -->
      <div
        v-if="importToast"
        class="flex items-center gap-1.5 mx-2 mb-1 px-2 py-1 rounded ui-text-md shrink-0"
        :style="{ background: 'var(--bg-tertiary)', color: 'var(--fg-secondary)' }"
      >
        <svg v-if="importToast.hasAdded" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="var(--success)" stroke-width="2">
          <path d="M3 8l3 3 7-7"/>
        </svg>
        {{ importToast.text }}
      </div>

      <!-- Reference list -->
      <div class="flex-1 overflow-y-auto relative py-1">
        <!-- Importing placeholders -->
        <div
          v-for="imp in importing"
          :key="imp.id"
          class="py-1.5 px-2"
        >
          <div class="flex items-center gap-1">
            <div class="flex-1 min-w-0 ui-text-base truncate" :style="{ color: 'var(--fg-muted)' }">
              {{ imp.name }}
            </div>
            <div class="ref-import-spinner shrink-0"></div>
          </div>
          <div class="ui-text-sm mt-0.5" :style="{ color: 'var(--fg-muted)' }">Importing...</div>
        </div>

        <ReferenceItem
          v-for="r in filteredRefs"
          :key="r._key"
          :reference="r"
          :isSelected="referencesStore.selectedKeys.has(r._key)"
          :isCited="referencesStore.citedKeys.has(r._key)"
          @click="handleItemClick"
          @context-menu="handleContextMenu"
          @drag-start="handleDragStart"
        />

        <!-- Empty state -->
        <div
          v-if="filteredRefs.length === 0 && importing.length === 0"
          class="px-3 py-4 text-center ui-text-md"
          :style="{ color: 'var(--fg-muted)' }"
        >
          <template v-if="searchQuery">No matching references</template>
          <template v-else>
            Drop PDFs, .bib, .ris, or .json files here
          </template>
        </div>

        <!-- Drop zone overlay -->
        <div
          v-if="dropActive"
          class="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          :style="{ background: 'rgba(122, 162, 247, 0.1)', border: '2px dashed var(--accent)' }"
        >
          <span class="ui-text-base" :style="{ color: 'var(--accent)' }">Drop files to import</span>
        </div>
      </div>
    </template>

    <!-- Context menu -->
    <ReferenceContextMenu
      v-if="contextMenu.show"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :refKey="contextMenu.key"
      :hasPdf="contextMenu.hasPdf"
      :selectedCount="referencesStore.selectedKeys.size"
      @close="contextMenu.show = false"
      @copy-citation="copyCitation"
      @copy-multi-citation="copyMultiCitation"
      @open-pdf="openPdf"
      @view-details="viewDetails"
      @export-selected="exportSelected"
      @copy-formatted="copyFormatted"
      @delete="deleteRef"
    />

    <!-- Add dialog -->
    <AddReferenceDialog
      v-if="showAddDialog"
      @close="showAddDialog = false"
    />
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useReferencesStore } from '../../stores/references'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { formatReference } from '../../services/citationFormatter'
import { getAvailableStyles, getStyleName } from '../../services/citationStyleRegistry'
import { importFromPdf, importFromText } from '../../services/referenceImport'
import { isMod } from '../../platform'
import { ask, save } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { IconSearch, IconArrowsSort } from '@tabler/icons-vue'
import ReferenceItem from './ReferenceItem.vue'
import ReferenceContextMenu from './ReferenceContextMenu.vue'
import AddReferenceDialog from './AddReferenceDialog.vue'

const props = defineProps({
  collapsed: { type: Boolean, default: false },
})
const emits = defineEmits(['toggle-collapse'])

const referencesStore = useReferencesStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()

const rootEl = ref(null)
const searchQuery = ref('')
const searchFocused = ref(false)
const showAddDialog = ref(false)
const dropActive = ref(false)
const importing = reactive([])
let importId = 0
const showSortMenu = ref(false)
const sortMenuEl = ref(null)
const sortBtnEl = ref(null)

// Style picker
const showStyleMenu = ref(false)
const styleBtnEl = ref(null)
const styleSearchEl = ref(null)
const styleSearchQuery = ref('')

const activeStyleName = computed(() => getStyleName(referencesStore.citationStyle))



const filteredStyles = computed(() => {
  const all = getAvailableStyles()
  if (!styleSearchQuery.value.trim()) return all
  const q = styleSearchQuery.value.toLowerCase()
  return all.filter(s =>
    s.name.toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q)
  )
})

// Cited filter
const citedFilter = ref('all') // 'all' | 'cited' | 'notCited'
const showFilterMenu = ref(false)
const filterBtnEl = ref(null)
const filterMenuPosState = ref({ position: 'fixed', left: '0px', top: '0px' })
const filterMenuPos = computed(() => filterMenuPosState.value)

const filterOptions = computed(() => [
  { value: 'all', label: `All (${searchedRefs.value.length})` },
  { value: 'cited', label: `Cited (${citedCount.value})` },
  { value: 'notCited', label: `Not cited (${notCitedCount.value})` },
])

const filterLabel = computed(() => {
  if (citedFilter.value === 'cited') return `Cited ${citedCount.value}`
  if (citedFilter.value === 'notCited') return `Not cited ${notCitedCount.value}`
  return `All ${searchedRefs.value.length}`
})

function toggleFilterMenu() {
  showFilterMenu.value = !showFilterMenu.value
  if (showFilterMenu.value && filterBtnEl.value) {
    const rect = filterBtnEl.value.getBoundingClientRect()
    filterMenuPosState.value = {
      position: 'fixed',
      left: rect.left + 'px',
      top: (rect.bottom + 2) + 'px',
    }
  }
}

// Export menu
const showExportMenu = ref(false)
const exportBtnEl = ref(null)
const exportMenuPosState = ref({ position: 'fixed', left: '0px', top: '0px' })
const exportMenuPos = computed(() => exportMenuPosState.value)

// Import status toast
const importToast = ref(null)
let toastTimer = null

const sortOptions = [
  { value: 'addedAt-desc', label: 'Date added (newest)', field: 'addedAt', dir: 'desc' },
  { value: 'addedAt-asc', label: 'Date added (oldest)', field: 'addedAt', dir: 'asc' },
  { value: 'author-asc', label: 'Author A \u2192 Z', field: 'author', dir: 'asc' },
  { value: 'author-desc', label: 'Author Z \u2192 A', field: 'author', dir: 'desc' },
  { value: 'year-desc', label: 'Year (newest)', field: 'year', dir: 'desc' },
  { value: 'year-asc', label: 'Year (oldest)', field: 'year', dir: 'asc' },
  { value: 'title-asc', label: 'Title A \u2192 Z', field: 'title', dir: 'asc' },
  { value: 'title-desc', label: 'Title Z \u2192 A', field: 'title', dir: 'desc' },
]

const currentSortKey = computed(() => `${referencesStore.sortBy}-${referencesStore.sortDir}`)

function applySortOption(value) {
  const opt = sortOptions.find(o => o.value === value)
  if (opt) {
    referencesStore.sortBy = opt.field
    referencesStore.sortDir = opt.dir
  }
}

const sortMenuPos = computed(() => sortMenuPosState.value)
const sortMenuPosState = ref({ position: 'fixed', left: '0px', top: '0px' })

const contextMenu = reactive({
  show: false,
  x: 0,
  y: 0,
  key: '',
  hasPdf: false,
})

const searchedRefs = computed(() => {
  if (!searchQuery.value.trim()) return referencesStore.sortedLibrary
  return referencesStore.searchRefs(searchQuery.value)
})

const citedCount = computed(() =>
  searchedRefs.value.filter(r => referencesStore.citedKeys.has(r._key)).length
)
const notCitedCount = computed(() =>
  searchedRefs.value.length - citedCount.value
)

const filteredRefs = computed(() => {
  if (citedFilter.value === 'cited') {
    return searchedRefs.value.filter(r => referencesStore.citedKeys.has(r._key))
  }
  if (citedFilter.value === 'notCited') {
    return searchedRefs.value.filter(r => !referencesStore.citedKeys.has(r._key))
  }
  return searchedRefs.value
})

// --- Style menu ---

const styleMenuPosState = ref({ position: 'fixed', left: '0px', top: '0px' })
const styleMenuPos = computed(() => styleMenuPosState.value)

function toggleStyleMenu() {
  showStyleMenu.value = !showStyleMenu.value
  styleSearchQuery.value = ''
  if (showStyleMenu.value && styleBtnEl.value) {
    const rect = styleBtnEl.value.getBoundingClientRect()
    styleMenuPosState.value = {
      position: 'fixed',
      left: rect.left + 'px',
      top: (rect.bottom + 2) + 'px',
    }
    nextTick(() => styleSearchEl.value?.focus())
  }
}

function selectStyle(id) {
  referencesStore.setCitationStyle(id)
  showStyleMenu.value = false
}

async function addCustomStyle() {
  showStyleMenu.value = false
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    multiple: false,
    filters: [{ name: 'CSL Style', extensions: ['csl'] }],
  })
  if (!selected) return

  try {
    const { parseCslMetadata, deriveStyleId } = await import('../../utils/cslParser')
    const { setUserStyles, getAvailableStyles: getAllStyles } = await import('../../services/citationStyleRegistry')
    const xml = await invoke('read_file', { path: selected })
    const meta = parseCslMetadata(xml)
    const id = deriveStyleId(meta.id, meta.title)
    const filename = `${id}.csl`

    // Copy to .project/styles/
    const destPath = `${workspace.projectDir}/styles/${filename}`
    await invoke('write_file', { path: destPath, content: xml })

    // Re-load user styles
    await referencesStore._loadUserStyles(workspace.projectDir)

    // Auto-select the newly added style
    referencesStore.setCitationStyle(id)

    showToast(0, 0)
    importToast.value = { text: `Added style: ${meta.title}`, hasAdded: true }
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { importToast.value = null }, 4000)
  } catch (e) {
    console.warn('Failed to import CSL style:', e)
  }
}

// --- Sort menu ---

function toggleSortMenu() {
  showSortMenu.value = !showSortMenu.value
  if (showSortMenu.value && sortBtnEl.value) {
    const rect = sortBtnEl.value.getBoundingClientRect()
    sortMenuPosState.value = {
      position: 'fixed',
      left: rect.left + 'px',
      top: (rect.bottom + 2) + 'px',
    }
  }
}

// --- Export menu ---

function toggleExportMenu() {
  showExportMenu.value = !showExportMenu.value
  if (showExportMenu.value && exportBtnEl.value) {
    const rect = exportBtnEl.value.getBoundingClientRect()
    exportMenuPosState.value = {
      position: 'fixed',
      left: rect.left + 'px',
      top: (rect.bottom + 2) + 'px',
    }
  }
}

async function saveExport(format, keys) {
  showExportMenu.value = false
  const content = format === 'ris'
    ? referencesStore.exportRis(keys)
    : referencesStore.exportBibTeX(keys)

  const ext = format === 'ris' ? 'ris' : 'bib'
  const path = await save({
    title: `Export references as .${ext}`,
    defaultPath: `references.${ext}`,
    filters: [{ name: format === 'ris' ? 'RIS' : 'BibTeX', extensions: [ext] }],
  })
  if (path) {
    await invoke('write_file', { path, content })
  }
}

function showToast(added, duplicates) {
  const parts = []
  if (added > 0) parts.push(`${added} added`)
  if (duplicates > 0) parts.push(`${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped`)
  if (parts.length === 0) return
  importToast.value = { text: parts.join(', '), hasAdded: added > 0 }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { importToast.value = null }, 4000)
}

// --- Selection ---

const lastClickedIndex = ref(null)

function handleItemClick({ key, event }) {
  const refs = filteredRefs.value
  const clickedIndex = refs.findIndex(r => r._key === key)

  if (event.shiftKey && lastClickedIndex.value !== null) {
    // Shift+click: range select
    const start = Math.min(lastClickedIndex.value, clickedIndex)
    const end = Math.max(lastClickedIndex.value, clickedIndex)
    referencesStore.selectedKeys.clear()
    for (let i = start; i <= end; i++) {
      referencesStore.selectedKeys.add(refs[i]._key)
    }
    referencesStore.activeKey = key
  } else if (isMod(event)) {
    // Cmd/Ctrl+click: toggle multi-select
    if (referencesStore.selectedKeys.has(key)) {
      referencesStore.selectedKeys.delete(key)
    } else {
      referencesStore.selectedKeys.add(key)
    }
    referencesStore.activeKey = key
    lastClickedIndex.value = clickedIndex
  } else {
    // Single click: select + open reference view in editor
    referencesStore.selectedKeys.clear()
    referencesStore.selectedKeys.add(key)
    referencesStore.activeKey = key
    editorStore.openFile(`ref:@${key}`)
    lastClickedIndex.value = clickedIndex
  }
}

// --- Context menu ---

function handleContextMenu({ event, ref: refData }) {
  contextMenu.show = true
  contextMenu.x = event.clientX
  contextMenu.y = event.clientY
  contextMenu.key = refData._key
  contextMenu.hasPdf = !!refData._pdfFile

  if (!referencesStore.selectedKeys.has(refData._key)) {
    referencesStore.selectedKeys.clear()
    referencesStore.selectedKeys.add(refData._key)
  }
}

function copyCitation(key) {
  navigator.clipboard.writeText(`[@${key}]`)
  contextMenu.show = false
}

function copyMultiCitation() {
  const keys = [...referencesStore.selectedKeys]
  const cite = `[${keys.map(k => '@' + k).join('; ')}]`
  navigator.clipboard.writeText(cite)
  contextMenu.show = false
}

function openPdf(key) {
  contextMenu.show = false
  const r = referencesStore.getByKey(key)
  if (r?._pdfFile) {
    const pdfPath = `${workspace.projectDir}/references/pdfs/${r._pdfFile}`
    editorStore.openFile(pdfPath)
  }
}

function viewDetails(key) {
  contextMenu.show = false
  referencesStore.activeKey = key
  editorStore.openFile(`ref:@${key}`)
}

async function exportSelected(format = 'bib') {
  contextMenu.show = false
  const keys = [...referencesStore.selectedKeys]
  await saveExport(format, keys)
}

function copyFormatted(key) {
  contextMenu.show = false
  const r = referencesStore.getByKey(key)
  if (r) {
    navigator.clipboard.writeText(formatReference(r, referencesStore.citationStyle))
  }
}

async function deleteRef(key) {
  contextMenu.show = false
  const keys = referencesStore.selectedKeys.size > 1
    ? [...referencesStore.selectedKeys]
    : [key]
  const msg = keys.length === 1
    ? `Delete reference @${keys[0]}?`
    : `Delete ${keys.length} references?`
  const yes = await ask(msg, { title: 'Confirm Delete', kind: 'warning' })
  if (yes) {
    referencesStore.removeReferences(keys)
  }
}

// --- Drag to editor ---

function handleDragStart({ key, event }) {
  const selected = referencesStore.selectedKeys.size > 1
    ? [...referencesStore.selectedKeys]
    : [key]

  // Detect if active editor is a .tex file — use \cite{} syntax instead of [@]
  const activeTab = editorStore.activeTab
  const isTexTarget = activeTab && (activeTab.endsWith('.tex') || activeTab.endsWith('.latex'))

  const citeText = isTexTarget
    ? (selected.length === 1
        ? `\\cite{${selected[0]}}`
        : `\\cite{${selected.join(', ')}}`)
    : (selected.length === 1
        ? `[@${selected[0]}]`
        : `[${selected.map(k => '@' + k).join('; ')}]`)

  const ghost = document.createElement('div')
  ghost.className = 'tab-ghost'
  ghost.textContent = citeText
  ghost.style.left = event.clientX + 'px'
  ghost.style.top = event.clientY + 'px'
  document.body.appendChild(ghost)
  document.body.classList.add('tab-dragging')

  const onMouseMove = (ev) => {
    ghost.style.left = ev.clientX + 'px'
    ghost.style.top = ev.clientY + 'px'
  }

  const onMouseUp = (ev) => {
    document.body.removeChild(ghost)
    document.body.classList.remove('tab-dragging')
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)

    const target = document.elementFromPoint(ev.clientX, ev.clientY)
    const cmContent = target?.closest('.cm-content')
    if (cmContent) {
      const editorEl = cmContent.closest('.cm-editor')
      if (editorEl?.cmView?.view) {
        const view = editorEl.cmView.view
        const pos = view.posAtCoords({ x: ev.clientX, y: ev.clientY })
        if (pos !== null) {
          view.dispatch({
            changes: { from: pos, to: pos, insert: citeText },
            selection: { anchor: pos + citeText.length },
          })
          view.focus()
        }
      }
    }
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

// --- PDF drop via custom events (routed by FileTree) ---

function onRefDragOver() {
  dropActive.value = true
}

function onRefDragLeave() {
  dropActive.value = false
}

async function onRefFileDrop(event) {
  dropActive.value = false
  const { paths } = event.detail
  if (!paths?.length) return

  let totalAdded = 0
  let totalDuplicates = 0
  const TEXT_EXTS = ['.bib', '.ris', '.json', '.nbib', '.enw', '.txt']
  const pdfs = []
  const textFiles = []
  const cslFiles = []

  for (const p of paths) {
    const lower = p.toLowerCase()
    if (lower.endsWith('.pdf')) pdfs.push(p)
    else if (lower.endsWith('.csl')) cslFiles.push(p)
    else if (TEXT_EXTS.some(ext => lower.endsWith(ext))) textFiles.push(p)
  }

  // Handle .csl style files (import as citation styles, not references)
  for (const filePath of cslFiles) {
    try {
      const { parseCslMetadata, deriveStyleId } = await import('../../utils/cslParser')
      const xml = await invoke('read_file', { path: filePath })
      const meta = parseCslMetadata(xml)
      const id = deriveStyleId(meta.id, meta.title)
      await invoke('write_file', { path: `${workspace.projectDir}/styles/${id}.csl`, content: xml })
      await referencesStore._loadUserStyles(workspace.projectDir)
      referencesStore.setCitationStyle(id)
      importToast.value = { text: `Added style: ${meta.title}`, hasAdded: true }
      clearTimeout(toastTimer)
      toastTimer = setTimeout(() => { importToast.value = null }, 4000)
    } catch (e) {
      console.warn('CSL import failed:', filePath, e)
    }
  }

  // Handle text format files (.bib, .ris, .json, .nbib, .enw, .txt)
  for (const filePath of textFiles) {
    const id = ++importId
    const name = filePath.split('/').pop()
    importing.push({ id, name })
    try {
      const content = await invoke('read_file', { path: filePath })
      const result = await importFromText(content, workspace)
      if (result.results?.length > 0) {
        const report = referencesStore.addReferences(result.results.map(r => r.csl))
        totalAdded += report.added.length
        totalDuplicates += report.duplicates.length
      }
    } catch (e) {
      console.warn('File import failed:', filePath, e)
    }
    const idx = importing.findIndex(i => i.id === id)
    if (idx !== -1) importing.splice(idx, 1)
  }

  // Handle PDF files (in parallel with optimistic placeholders)
  const pdfPromises = pdfs.map(async (filePath) => {
    const id = ++importId
    const name = filePath.split('/').pop()
    importing.push({ id, name })
    try {
      const result = await importFromPdf(filePath, workspace, referencesStore)
      if (result) totalAdded++
      else totalDuplicates++
    } catch (e) {
      console.warn('PDF import failed:', filePath, e)
    }
    const idx = importing.findIndex(i => i.id === id)
    if (idx !== -1) importing.splice(idx, 1)
  })

  await Promise.all(pdfPromises)
  showToast(totalAdded, totalDuplicates)
}

onMounted(() => {
  window.addEventListener('ref-drag-over', onRefDragOver)
  window.addEventListener('ref-drag-leave', onRefDragLeave)
  window.addEventListener('ref-file-drop', onRefFileDrop)
})

onUnmounted(() => {
  window.removeEventListener('ref-drag-over', onRefDragOver)
  window.removeEventListener('ref-drag-leave', onRefDragLeave)
  window.removeEventListener('ref-file-drop', onRefFileDrop)
})
</script>
