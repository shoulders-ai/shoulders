<template>
  <div class="relative px-4 pb-6">
    <div class="relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <IconSearch class="h-4 w-4 text-stone-400" stroke-width="2" />
      </div>
      <input
        v-model="query"
        type="text"
        placeholder="Search docs..."
        class="block w-full pl-9 pr-3 py-2 border border-stone-200 rounded-md leading-5 bg-stone-50 text-stone-900 placeholder-stone-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-cadet-500 focus:border-cadet-500 sm:text-sm transition-colors"
        @focus="isOpen = true"
        @input="isOpen = true"
        @keydown.esc.prevent="closeSearch"
        @keydown.down.prevent="navigateDown"
        @keydown.up.prevent="navigateUp"
        @keydown.enter.prevent="selectCurrent"
      />
      
      <!-- Clear button -->
      <button 
        v-if="query" 
        @click="clearSearch"
        class="absolute inset-y-0 right-0 pr-2.5 flex items-center text-stone-400 hover:text-stone-600"
      >
        <IconX class="h-3.5 w-3.5" stroke-width="2" />
      </button>
    </div>

    <!-- Dropdown results -->
    <div 
      v-if="isOpen && query && results.length > 0" 
      class="absolute z-50 left-4 right-4 mt-1 bg-white rounded-md shadow-lg border border-stone-200 max-h-96 overflow-y-auto"
      v-click-outside="closeSearch"
    >
      <ul class="py-1">
        <li v-for="(result, index) in results" :key="result.item.id">
          <button
            @click="selectResult(result.item)"
            @mouseenter="selectedIndex = index"
            class="w-full text-left px-4 py-2 focus:outline-none transition-colors"
            :class="[
              selectedIndex === index ? 'bg-stone-100' : 'hover:bg-stone-50'
            ]"
          >
            <div class="flex flex-col">
              <span class="text-xs font-semibold text-stone-900 truncate">
                {{ result.item.title }}
              </span>
              <span class="text-xs text-stone-500 truncate mt-0.5" v-if="result.item.content">
                {{ truncateContent(result.item.content) }}
              </span>
            </div>
          </button>
        </li>
      </ul>
    </div>
    
    <!-- No results -->
    <div 
      v-if="isOpen && query && results.length === 0" 
      class="absolute z-50 left-4 right-4 mt-1 bg-white rounded-md shadow-lg border border-stone-200 px-4 py-3"
      v-click-outside="closeSearch"
    >
      <p class="text-xs text-stone-500 text-center">No results found for "{{ query }}"</p>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { IconSearch, IconX } from '@tabler/icons-vue'
import Fuse from 'fuse.js'

const emit = defineEmits(['select'])

const query = ref('')
const isOpen = ref(false)
const searchData = ref([])
const results = ref([])
const selectedIndex = ref(-1)
let fuse = null

onMounted(async () => {
  try {
    const response = await fetch('/search-index.json')
    searchData.value = await response.json()
    
    fuse = new Fuse(searchData.value, {
      keys: ['title', 'content'],
      includeScore: true,
      threshold: 0.3,
      ignoreLocation: true,
      minMatchCharLength: 2
    })
  } catch (err) {
    console.error('Failed to load search index:', err)
  }
})

watch(query, (newQuery) => {
  if (!newQuery || !fuse) {
    results.value = []
    return
  }
  
  const rawResults = fuse.search(newQuery)
  
  // Deduplicate by section ID so we don't show multiple hits for the same page
  const uniqueResults = []
  const seenSections = new Set()
  
  for (const result of rawResults) {
    // Only show the best matching block for each documentation section
    if (!seenSections.has(result.item.section)) {
      seenSections.add(result.item.section)
      uniqueResults.push(result)
      if (uniqueResults.length >= 8) break // Limit to top 8 unique page results
    }
  }
  
  results.value = uniqueResults
  selectedIndex.value = uniqueResults.length > 0 ? 0 : -1
})

const navigateDown = () => {
  if (isOpen.value && results.value.length > 0) {
    if (selectedIndex.value < results.value.length - 1) {
      selectedIndex.value++
    } else {
      selectedIndex.value = 0
    }
  }
}

const navigateUp = () => {
  if (isOpen.value && results.value.length > 0) {
    if (selectedIndex.value > 0) {
      selectedIndex.value--
    } else {
      selectedIndex.value = results.value.length - 1
    }
  }
}

const selectCurrent = () => {
  if (isOpen.value && results.value.length > 0 && selectedIndex.value >= 0) {
    selectResult(results.value[selectedIndex.value].item)
  }
}

const closeSearch = () => {
  isOpen.value = false
  selectedIndex.value = -1
}

const clearSearch = () => {
  query.value = ''
  results.value = []
  selectedIndex.value = -1
}

const selectResult = (item) => {
  emit('select', item.section, item.title)
  closeSearch()
  query.value = ''
}

const truncateContent = (content) => {
  if (!content) return ''
  if (content.length <= 60) return content
  return content.substring(0, 60) + '...'
}

// Simple v-click-outside directive implementation for Nuxt 3 / Vue 3
const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event)
      }
    }
    document.body.addEventListener('click', el.clickOutsideEvent)
  },
  unmounted(el) {
    document.body.removeEventListener('click', el.clickOutsideEvent)
  }
}
</script>
