<template>
  <div class="flex flex-col h-full" style="background: var(--bg-secondary);">
    <!-- Main tab bar (Outline / Backlinks) -->
    <div class="flex items-center h-7 border-b shrink-0" style="border-color: var(--border);">
      <button
        v-for="tab in mainTabs"
        :key="tab"
        class="px-3 h-full ui-text-lg flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wider"
        :style="{
          color: mainTab === tab ? 'var(--fg-primary)' : 'var(--fg-muted)',
          borderBottom: mainTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
        }"
        @click="mainTab = tab"
      >
        {{ tab }} <span class="text-sm text-gray-500">
          {{ backlinkCount > 0 && tab === 'backlinks' ? '(' + backlinkCount + ')' : '' }}
        </span>
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-hidden relative">
      <!-- Outline panel -->
      <div v-show="mainTab === 'outline'" class="absolute inset-0 overflow-auto">
        <OutlinePanel :collapsed="false" :overrideActiveFile="documentTab" />
      </div>

      <!-- Backlinks panel -->
      <div v-show="mainTab === 'backlinks'" class="absolute inset-0 overflow-auto">
        <Backlinks :overrideActiveFile="documentTab" />
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useLinksStore } from '../../stores/links'
import { useEditorStore } from '../../stores/editor'
import Backlinks from './Backlinks.vue'
import OutlinePanel from './OutlinePanel.vue'

const linksStore = useLinksStore()
const editorStore = useEditorStore()

// Track the last focused document tab (non-chat) for document-scoped content
const lastDocumentTab = ref(null)

const documentTab = computed(() => {
  const active = editorStore.activeTab
  if (active && !active.startsWith('chat:')) return active
  // When a chat tab is focused, keep showing the last document's context
  return lastDocumentTab.value
})

// Update lastDocumentTab whenever a non-chat tab is focused
// flush:'post' prevents mid-patch state mutations that can cause Vue __vnode errors
watch(() => editorStore.activeTab, (tab) => {
  if (tab && !tab.startsWith('chat:')) {
    lastDocumentTab.value = tab
  }
}, { flush: 'post' })

const backlinkCount = computed(() => {
  const active = documentTab.value
  if (!active) return 0
  return linksStore.backlinksForFile(active).length
})
const mainTabs = computed(() => {
  const tabs = ['outline']
  if (backlinkCount.value > 0) tabs.push('backlinks')
  return tabs
})
const mainTab = ref(localStorage.getItem('rightPanelTab') || 'outline')

// Fall back to outline if current tab disappears (e.g. backlinks hidden)
watch(mainTabs, (tabs) => {
  if (!tabs.includes(mainTab.value)) {
    mainTab.value = 'outline'
  }
}, { flush: 'post' })
</script>
