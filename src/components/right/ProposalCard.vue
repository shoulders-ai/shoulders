<template>
  <div class="proposal-card">
    <div class="proposal-prompt">{{ prompt }}</div>
    <div class="proposal-options">
      <div v-for="(opt, i) in options" :key="i" class="proposal-option">
        <div class="proposal-option-header">
          <span class="proposal-option-title">{{ opt.title }}</span>
        </div>
        <div class="proposal-option-desc">{{ opt.description }}</div>
        <div class="proposal-option-actions">
          <button
            v-if="opt.url || opt.doi"
            class="proposal-btn proposal-btn-open"
            @click="openUrl(opt.url || `https://doi.org/${opt.doi}`)"
          >
            Open
          </button>
          <button
            v-if="!selectedIndices.has(i)"
            class="proposal-btn proposal-btn-select"
            @click="selectOption(opt, i)"
          >
            Select
          </button>
          <span v-else class="proposal-selected">
            Selected ✓
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const props = defineProps({
  prompt: { type: String, required: true },
  options: { type: Array, required: true },
})

const emit = defineEmits(['select'])

const selectedIndices = reactive(new Set())

async function openUrl(url) {
  const { open } = await import('@tauri-apps/plugin-shell')
  open(url).catch(() => {})
}

async function selectOption(opt, index) {
  selectedIndices.add(index)
  emit('select', opt.title)

  // Add to library in background if doi present
  if (opt.doi) {
    try {
      const { lookupByDoi } = await import('../../services/crossref')
      const { useReferencesStore } = await import('../../stores/references')
      const refsStore = useReferencesStore()
      const csl = await lookupByDoi(opt.doi)
      if (csl) {
        csl._needsReview = false
        csl._matchMethod = 'doi'
        csl._addedAt = new Date().toISOString()
        refsStore.addReference(csl)
      }
    } catch (e) {
      console.warn('Failed to add reference:', e)
    }
  }
}
</script>

<style scoped>
.proposal-card {
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
  margin-top: 8px;
}

.proposal-prompt {
  padding: 8px 10px;
  font-size: var(--ui-font-size);
  font-weight: 500;
  color: var(--fg-primary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border);
}

.proposal-options {
  display: flex;
  flex-direction: column;
}

.proposal-option {
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}

.proposal-option:last-child {
  border-bottom: none;
}

.proposal-option-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.proposal-option-title {
  font-size: var(--ui-font-size);
  font-weight: 500;
  color: var(--fg-primary);
}

.proposal-option-desc {
  font-size: calc(var(--ui-font-size) - 1px);
  color: var(--fg-secondary);
  line-height: 1.4;
  margin-bottom: 6px;
}

.proposal-option-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

.proposal-btn {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: calc(var(--ui-font-size) - 2px);
  font-weight: 500;
  cursor: pointer;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-secondary);
  transition: all 0.15s;
}

.proposal-btn:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}

.proposal-btn-select {
  border-color: var(--accent);
  color: var(--accent);
  background: rgba(122, 162, 247, 0.08);
}

.proposal-btn-select:hover {
  background: rgba(122, 162, 247, 0.18);
}

.proposal-selected {
  font-size: calc(var(--ui-font-size) - 2px);
  font-weight: 500;
  color: var(--success);
}
</style>
