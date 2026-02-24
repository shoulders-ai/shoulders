<template>
  <div class="search-results-dropdown">
    <div class="search-results-list">
      <!-- Title matches -->
      <template v-if="titleMatches.length > 0">
        <div class="quick-open-section" v-if="query && contentMatches.length > 0">Files</div>
        <div
          v-for="(file, idx) in titleMatches"
          :key="'t-' + file.path"
          class="quick-open-item"
          :class="{ active: idx === selectedIndex }"
          @mousedown.prevent="$emit('select-file', file.path)"
          @mouseover="selectedIndex = idx"
        >
          <span>{{ file.name }}</span>
          <span class="path">{{ relativePath(file.path) }}</span>
        </div>
      </template>

      <!-- Content matches -->
      <template v-if="contentMatches.length > 0">
        <div class="quick-open-section">Content</div>
        <div
          v-for="(match, idx) in contentMatches"
          :key="'c-' + match.path + ':' + match.line"
          class="quick-open-item"
          :class="{ active: titleMatches.length + idx === selectedIndex }"
          @mousedown.prevent="$emit('select-file', match.path)"
          @mouseover="selectedIndex = titleMatches.length + idx"
        >
          <span>{{ match.name }}</span>
          <span class="content-match">
            <span class="line-num">:{{ match.line }}</span>
            {{ match.text }}
          </span>
        </div>
      </template>

      <!-- Reference matches -->
      <template v-if="refMatches.length > 0">
        <div class="quick-open-section">References</div>
        <div
          v-for="(ref, idx) in refMatches"
          :key="'r-' + ref._key"
          class="quick-open-item"
          :class="{ active: titleMatches.length + contentMatches.length + idx === selectedIndex }"
          @mousedown.prevent="$emit('select-citation', ref._key)"
          @mouseover="selectedIndex = titleMatches.length + contentMatches.length + idx"
        >
          <span class="ref-key-badge mr-1.5">@{{ ref._key }}</span>
          <span>{{ refAuthorLine(ref) }}</span>
          <span class="path">{{ ref.title || '' }}</span>
        </div>
      </template>

      <div v-if="titleMatches.length === 0 && contentMatches.length === 0 && refMatches.length === 0 && query"
        class="quick-open-item" style="color: var(--fg-muted);">
        {{ searching ? 'Searching...' : 'No results found' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useFilesStore } from '../stores/files'
import { useWorkspaceStore } from '../stores/workspace'
import { useReferencesStore } from '../stores/references'

const props = defineProps({
  query: { type: String, default: '' },
})

const emit = defineEmits(['select-file', 'select-citation'])

const files = useFilesStore()
const workspace = useWorkspaceStore()
const referencesStore = useReferencesStore()

const selectedIndex = ref(0)
const contentMatches = ref([])
const searching = ref(false)

let searchTimer = null

const titleMatches = computed(() => {
  const q = props.query.toLowerCase()
  if (!q) return files.flatFiles.slice(0, 20)

  let list = files.flatFiles.filter((f) => {
    const name = f.name.toLowerCase()
    const path = f.path.toLowerCase()
    let qi = 0
    for (let i = 0; i < name.length && qi < q.length; i++) {
      if (name[i] === q[qi]) qi++
    }
    return qi === q.length || path.includes(q)
  })

  list.sort((a, b) => {
    const aName = a.name.toLowerCase()
    const bName = b.name.toLowerCase()
    const aExact = aName.includes(q) ? 0 : 1
    const bExact = bName.includes(q) ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aStarts = aName.startsWith(q) ? 0 : 1
    const bStarts = bName.startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return aName.localeCompare(bName)
  })

  return list.slice(0, 15)
})

const refMatches = computed(() => {
  const q = props.query.trim()
  if (q.length < 2) return []
  return referencesStore.searchRefs(q).slice(0, 8)
})

const totalItems = computed(() => titleMatches.value.length + contentMatches.value.length + refMatches.value.length)

// Debounced content search
watch(() => props.query, (q) => {
  selectedIndex.value = 0
  contentMatches.value = []

  clearTimeout(searchTimer)
  if (q.length >= 2 && workspace.path) {
    searching.value = true
    searchTimer = setTimeout(async () => {
      try {
        const results = await invoke('search_file_contents', {
          dir: workspace.path,
          query: q,
          maxResults: 10,
        })
        contentMatches.value = results
      } catch (e) {
        console.error('Content search error:', e)
        contentMatches.value = []
      }
      searching.value = false
    }, 200)
  } else {
    searching.value = false
  }
})

function relativePath(path) {
  if (workspace.path && path.startsWith(workspace.path)) {
    return path.slice(workspace.path.length + 1)
  }
  return path
}

function moveSelection(delta) {
  const len = totalItems.value
  if (len === 0) return
  selectedIndex.value = (selectedIndex.value + delta + len) % len
  nextTick(() => {
    const el = document.querySelector('.search-results-dropdown .quick-open-item.active')
    if (el) el.scrollIntoView({ block: 'nearest' })
  })
}

function confirmSelection() {
  if (totalItems.value === 0) return
  if (selectedIndex.value < titleMatches.value.length) {
    const file = titleMatches.value[selectedIndex.value]
    if (file) emit('select-file', file.path)
  } else if (selectedIndex.value < titleMatches.value.length + contentMatches.value.length) {
    const idx = selectedIndex.value - titleMatches.value.length
    const match = contentMatches.value[idx]
    if (match) emit('select-file', match.path)
  } else {
    const idx = selectedIndex.value - titleMatches.value.length - contentMatches.value.length
    const r = refMatches.value[idx]
    if (r) emit('select-citation', r._key)
  }
}

function refAuthorLine(ref) {
  const authors = ref.author || []
  if (authors.length === 0) return ''
  const first = authors[0].family || ''
  const year = ref.issued?.['date-parts']?.[0]?.[0] || ''
  if (authors.length === 1) return `${first} (${year})`
  return `${first} et al. (${year})`
}

defineExpose({ moveSelection, confirmSelection })
</script>
