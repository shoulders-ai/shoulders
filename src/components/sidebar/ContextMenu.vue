<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div class="context-menu" :style="menuStyle">
        <!-- Creation section (folders and empty space only) -->
        <template v-if="!entry || entry.is_dir">
          <div class="context-menu-item" @click="$emit('create', { ext: null, isDir: true })">
            <IconFolderPlus :size="14" :stroke-width="1.5" />
            <span class="flex-1">New Folder</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: null })">
            <IconFilePlus :size="14" :stroke-width="1.5" />
            <span class="flex-1">New File...</span>
          </div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.md' })">
            <IconFileText :size="14" :stroke-width="1.5" />
            <span class="flex-1">Markdown</span>
            <span class="context-menu-ext">.md</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.docx' })">
            <IconFileText :size="14" :stroke-width="1.5" />
            <span class="flex-1">Word</span>
            <span class="context-menu-ext">.docx</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.tex' })">
            <IconMath :size="14" :stroke-width="1.5" />
            <span class="flex-1">LaTeX</span>
            <span class="context-menu-ext">.tex</span>
          </div>
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.R' })">
            <IconCode :size="14" :stroke-width="1.5" />
            <span class="flex-1">R Script</span>
            <span class="context-menu-ext">.R</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.py' })">
            <IconBrandPython :size="14" :stroke-width="1.5" />
            <span class="flex-1">Python</span>
            <span class="context-menu-ext">.py</span>
          </div>
          <div class="context-menu-item" @click="$emit('create', { ext: '.ipynb' })">
            <IconNotebook :size="14" :stroke-width="1.5" />
            <span class="flex-1">Notebook</span>
            <span class="context-menu-ext">.ipynb</span>
          </div>
        </template>

        <!-- Actions section -->
        <template v-if="entry">
          <div v-if="entry.is_dir" class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('rename', entry)">
            <IconPencil :size="14" :stroke-width="1.5" />
            Rename
          </div>
          <div class="context-menu-item" @click="$emit('duplicate', entry)">
            <IconCopy :size="14" :stroke-width="1.5" />
            Duplicate
          </div>
          <div class="context-menu-item context-menu-item-danger" @click="$emit('delete', entry)">
            <IconTrash :size="14" :stroke-width="1.5" />
            Delete
          </div>
        </template>

        <div v-if="selectedCount > 1" class="context-menu-separator"></div>
        <div v-if="selectedCount > 1" class="context-menu-item context-menu-item-danger" @click="$emit('delete-selected')">
          <IconTrash :size="14" :stroke-width="1.5" />
          Delete {{ selectedCount }} Selected
        </div>

        <template v-if="entry && !entry.is_dir">
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('version-history', entry)">
            <IconClock :size="14" :stroke-width="1.5" />
            Version History
          </div>
        </template>

        <template v-if="isImportable">
          <div class="context-menu-item" @click="$emit('import-to-refs', entry)">
            <IconBook2 :size="14" :stroke-width="1.5" />
            Import to References
          </div>
        </template>

        <template v-if="entry">
          <div class="context-menu-separator"></div>
          <div class="context-menu-item" @click="$emit('reveal-in-finder', entry)">
            <IconExternalLink :size="14" :stroke-width="1.5" />
            {{ revealLabel }}
          </div>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { computed } from 'vue'
import {
  IconFileText, IconNotebook, IconMath, IconCode, IconBrandPython,
  IconFilePlus, IconFolderPlus, IconPencil, IconCopy, IconTrash, IconClock,
  IconExternalLink, IconBook2,
} from '@tabler/icons-vue'
import { isMac } from '../../platform'

const isWindows = /Win/.test(navigator.platform)
const revealLabel = isMac ? 'Reveal in Finder' : isWindows ? 'Show in Explorer' : 'Open in File Manager'

const props = defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  entry: { type: Object, default: null },
  selectedCount: { type: Number, default: 0 },
})

defineEmits(['close', 'create', 'rename', 'duplicate', 'delete', 'delete-selected', 'version-history', 'reveal-in-finder', 'import-to-refs'])

const IMPORTABLE_EXTS = ['.bib', '.ris', '.json', '.pdf', '.csl', '.nbib', '.enw']

const isImportable = computed(() => {
  if (!props.entry || props.entry.is_dir) return false
  const lower = props.entry.name.toLowerCase()
  return IMPORTABLE_EXTS.some(ext => lower.endsWith(ext))
})

// Keep menu within viewport
const menuStyle = computed(() => {
  const menuWidth = 220
  const menuHeight = (props.entry ? 13 : 8) * 28 + 16
  const maxX = window.innerWidth - menuWidth - 8
  const maxY = window.innerHeight - menuHeight - 8
  return {
    left: Math.min(props.x, maxX) + 'px',
    top: Math.min(props.y, maxY) + 'px',
  }
})
</script>

<style>
.context-menu-ext {
  font-size: 10px;
  color: var(--fg-muted);
  opacity: 0.6;
  margin-left: auto;
  font-family: var(--font-mono, 'JetBrains Mono', monospace);
}
</style>
