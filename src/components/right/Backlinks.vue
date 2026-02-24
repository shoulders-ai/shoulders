<template>
  <div class="flex flex-col h-full overflow-hidden" style="color: var(--fg-primary);">
    <div class="px-3 py-2 ui-text-lg font-medium shrink-0" style="color: var(--fg-muted);">
      Backlinks to {{ currentFileName }}
    </div>

    <div v-if="backlinks.length === 0" class="px-3 py-4 ui-text-lg" style="color: var(--fg-muted);">
      No other files link to this file.
    </div>

    <div v-else class="flex-1 overflow-y-auto">
      <div
        v-for="(link, idx) in backlinks"
        :key="idx"
        class="px-3 py-2 cursor-pointer hover:bg-[var(--bg-hover)] border-b"
        style="border-color: var(--border);"
        @click="navigateToSource(link)"
      >
        <div class="flex items-center gap-2 ui-text-lg">
          <span class="font-medium" style="color: var(--accent);">{{ link.sourceName }}</span>
          <span class="ui-text-md" style="color: var(--fg-muted);">:{{ link.lineNumber }}</span>
        </div>
        <div class="mt-1 ui-text-base truncate" style="color: var(--fg-muted);">
          {{ link.context }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useLinksStore } from '../../stores/links'
import { useEditorStore } from '../../stores/editor'

const linksStore = useLinksStore()
const editorStore = useEditorStore()

const currentFilePath = computed(() => editorStore.activeTab)

const currentFileName = computed(() => {
  if (!currentFilePath.value) return '...'
  return currentFilePath.value.split('/').pop().replace(/\.md$/, '')
})

const backlinks = computed(() => {
  if (!currentFilePath.value) return []
  return linksStore.backlinksForFile(currentFilePath.value)
})

function navigateToSource(link) {
  editorStore.openFile(link.sourcePath)
}
</script>
