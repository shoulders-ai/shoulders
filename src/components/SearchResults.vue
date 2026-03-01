<template>
  <div class="search-results-dropdown">
    <div class="search-results-list">
      <!-- Title matches -->
      <template v-if="titleMatches.length > 0">
        <div class="quick-open-section" v-if="query && (contentMatches.length > 0 || chatMatches.length > 0)">Files</div>
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

      <!-- Chat matches -->
      <template v-if="chatMatches.length > 0">
        <div class="quick-open-section">Chats</div>
        <div
          v-for="(chat, idx) in chatMatches"
          :key="'ch-' + chat.id"
          class="quick-open-item"
          :class="{ active: titleMatches.length + contentMatches.length + refMatches.length + idx === selectedIndex }"
          @mousedown.prevent="$emit('select-chat', chat.id)"
          @mouseover="selectedIndex = titleMatches.length + contentMatches.length + refMatches.length + idx"
        >
          <svg class="shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--accent);">
            <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275z"/>
          </svg>
          <span class="truncate">{{ chat.label }}</span>
          <span class="chat-meta">
            <span class="chat-msg-count">{{ chat.messageCount }}</span>
            <span class="chat-time">{{ relativeTime(chat.updatedAt) }}</span>
          </span>
        </div>
      </template>

      <div v-if="titleMatches.length === 0 && contentMatches.length === 0 && refMatches.length === 0 && chatMatches.length === 0 && query"
        class="quick-open-item" style="color: var(--fg-muted);">
        {{ searching ? 'Searching...' : 'No results found' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useFilesStore } from '../stores/files'
import { useWorkspaceStore } from '../stores/workspace'
import { useReferencesStore } from '../stores/references'
import { useChatStore } from '../stores/chat'

const props = defineProps({
  query: { type: String, default: '' },
})

const emit = defineEmits(['select-file', 'select-citation', 'select-chat'])

const files = useFilesStore()
const workspace = useWorkspaceStore()
const referencesStore = useReferencesStore()
const chatStore = useChatStore()

const selectedIndex = ref(0)
const contentMatches = ref([])
const searching = ref(false)

let searchTimer = null

// Ensure chat session metadata is loaded
onMounted(() => {
  chatStore.loadAllSessionsMeta()
})

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

const chatMatches = computed(() => {
  const q = props.query.trim().toLowerCase()
  if (q.length < 2) return []

  return chatStore.allSessionsMeta
    .filter(meta => {
      if (meta.label?.toLowerCase().includes(q)) return true
      if (meta._keywords?.some(k => k.toLowerCase().includes(q))) return true
      return false
    })
    .slice(0, 5)
})

const totalItems = computed(() =>
  titleMatches.value.length + contentMatches.value.length + refMatches.value.length + chatMatches.value.length
)

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

function relativeTime(dateStr) {
  if (!dateStr) return ''
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
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
  const fileEnd = titleMatches.value.length
  const contentEnd = fileEnd + contentMatches.value.length
  const refEnd = contentEnd + refMatches.value.length

  if (selectedIndex.value < fileEnd) {
    const file = titleMatches.value[selectedIndex.value]
    if (file) emit('select-file', file.path)
  } else if (selectedIndex.value < contentEnd) {
    const idx = selectedIndex.value - fileEnd
    const match = contentMatches.value[idx]
    if (match) emit('select-file', match.path)
  } else if (selectedIndex.value < refEnd) {
    const idx = selectedIndex.value - contentEnd
    const r = refMatches.value[idx]
    if (r) emit('select-citation', r._key)
  } else {
    const idx = selectedIndex.value - refEnd
    const chat = chatMatches.value[idx]
    if (chat) emit('select-chat', chat.id)
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
