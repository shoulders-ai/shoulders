<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div class="context-menu" :style="{ left: x + 'px', top: y + 'px' }">
        <!-- Single ref actions -->
        <div class="context-menu-item" @click="$emit('copy-citation', refKey)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3a1 1 0 011-1h8"/>
          </svg>
          Copy [@{{ refKey }}]
        </div>

        <div v-if="selectedCount > 1" class="context-menu-item" @click="$emit('copy-multi-citation')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="5" y="5" width="8" height="8" rx="1"/><path d="M3 11V3a1 1 0 011-1h8"/>
          </svg>
          Copy {{ selectedCount }} citations
        </div>

        <div v-if="hasPdf" class="context-menu-item" @click="$emit('open-pdf', refKey)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 1H4a1 1 0 00-1 1v12a1 1 0 001 1h8a1 1 0 001-1V5L9 1z"/>
            <path d="M9 1v4h4"/>
          </svg>
          Open PDF
        </div>

        <div class="context-menu-item" @click="$emit('view-details', refKey)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6"/><path d="M8 5v3M8 10h0"/>
          </svg>
          View Details
        </div>

        <div class="context-menu-separator"></div>

        <div v-if="selectedCount > 1" class="context-menu-item" @click="$emit('export-selected', 'bib')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v8M4 6l4-4 4 4M2 12h12"/>
          </svg>
          Export {{ selectedCount }} as .bib
        </div>
        <div v-if="selectedCount > 1" class="context-menu-item" @click="$emit('export-selected', 'ris')">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v8M4 6l4-4 4 4M2 12h12"/>
          </svg>
          Export {{ selectedCount }} as .ris
        </div>

        <div class="context-menu-item" @click="$emit('copy-formatted', refKey)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4h8M4 8h6M4 12h8"/>
          </svg>
          Copy as formatted
        </div>

        <div class="context-menu-separator"></div>

        <div class="context-menu-item context-menu-item-danger" @click="$emit('delete', refKey)">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 4h12M5.33 4V2.67a1.33 1.33 0 011.34-1.34h2.66a1.33 1.33 0 011.34 1.34V4M12.67 4v9.33a1.33 1.33 0 01-1.34 1.34H4.67a1.33 1.33 0 01-1.34-1.34V4"/>
          </svg>
          Delete{{ selectedCount > 1 ? ` ${selectedCount} selected` : '' }}
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  refKey: { type: String, required: true },
  hasPdf: { type: Boolean, default: false },
  selectedCount: { type: Number, default: 1 },
})

defineEmits([
  'close', 'copy-citation', 'copy-multi-citation', 'open-pdf',
  'view-details', 'export-selected', 'copy-formatted', 'delete',
])
</script>
