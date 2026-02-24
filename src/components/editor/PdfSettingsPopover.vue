<template>
  <Teleport to="body">
    <div v-if="visible" class="pdf-settings-backdrop" @mousedown.self="$emit('close')"></div>
    <div v-if="visible" class="pdf-settings-popover" :style="posStyle">
      <div class="pdf-settings-header">
        <span>PDF Settings</span>
        <button class="pdf-close" @click="$emit('close')">&times;</button>
      </div>

      <!-- Template -->
      <label class="pdf-label">Template</label>
      <div class="pdf-templates">
        <button
          v-for="t in templates"
          :key="t.id"
          class="pdf-template-btn"
          :class="{ active: local.template === t.id }"
          @click="local.template = t.id"
          :title="t.desc"
        >
          {{ t.label }}
        </button>
      </div>

      <!-- Font -->
      <label class="pdf-label">Font</label>
      <select v-model="local.font" class="pdf-select">
        <option v-for="f in fonts" :key="f" :value="f">{{ f }}</option>
      </select>

      <!-- Font size + Page size row -->
      <div class="pdf-row mt-2">
        <div class="pdf-col">
          <label class="pdf-label">Size</label>
          <select v-model.number="local.font_size" class="pdf-select">
            <option v-for="s in fontSizes" :key="s" :value="s">{{ s }}pt</option>
          </select>
        </div>
        <div class="pdf-col">
          <label class="pdf-label">Page</label>
          <select v-model="local.page_size" class="pdf-select">
            <option value="a4">A4</option>
            <option value="us-letter">US Letter</option>
            <option value="a5">A5</option>
          </select>
        </div>
        <div class="pdf-col">
          <label class="pdf-label">Margins</label>
          <select v-model="local.margins" class="pdf-select">
            <option value="narrow">Narrow</option>
            <option value="normal">Normal</option>
            <option value="wide">Wide</option>
          </select>
        </div>
        <div class="pdf-col">
          <label class="pdf-label">Spacing</label>
          <select v-model="local.spacing" class="pdf-select">
            <option value="compact">Compact</option>
            <option value="normal">Normal</option>
            <option value="relaxed">Relaxed</option>
          </select>
        </div>
      </div>

      <!-- Export button -->
      <button class="pdf-export-btn" @click="doExport">
        Create PDF
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  anchorRect: { type: Object, default: null },
  settings: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['close', 'export'])

const templates = [
  { id: 'clean', label: 'Clean', desc: 'Minimal, no numbering — good for notes and drafts' },
  { id: 'academic', label: 'Academic', desc: 'Numbered sections, indented paragraphs — papers and essays' },
  { id: 'report', label: 'Report', desc: 'Numbered sections, page numbers, chapter breaks' },
  { id: 'letter', label: 'Letter', desc: 'Left-aligned, no justification — correspondence' },
  { id: 'compact', label: 'Compact', desc: 'Two-column, small font — reference sheets and handouts' },
]

const fonts = [
  'STIX Two Text',
  'Lora',
  'Times New Roman',
  'Inter',
  'Arial',
]

const fontSizes = [9, 10, 10.5, 11, 11.5, 12, 13, 14]

const local = reactive({ ...props.settings })

watch(() => props.settings, (s) => {
  Object.assign(local, s)
  if (local.font && !fonts.includes(local.font)) {
    local.font = fonts[0]
  }
}, { deep: true })

const posStyle = ref({})
watch(() => [props.visible, props.anchorRect], () => {
  if (!props.visible || !props.anchorRect) return
  const r = props.anchorRect
  const popoverWidth = 320
  const margin = 8
  const maxLeft = window.innerWidth - popoverWidth - margin
  posStyle.value = {
    position: 'fixed',
    top: (r.bottom + 6) + 'px',
    left: Math.min(maxLeft, Math.max(margin, r.left - 120)) + 'px',
    zIndex: 10000,
  }
}, { immediate: true })

function doExport() {
  emit('export', { ...local })
}
</script>

<style scoped>
.pdf-settings-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.pdf-settings-popover {
  width: 320px;
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  font-size: 12px;
  color: var(--fg-primary);
}

.pdf-settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 13px;
}

.pdf-close {
  background: none;
  border: none;
  color: var(--fg-muted);
  font-size: 16px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.pdf-close:hover { color: var(--fg-primary); }

.pdf-label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--fg-muted);
  margin: 8px 0 4px;
}

.pdf-label:first-of-type {
  margin-top: 0;
}

.pdf-templates {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.pdf-template-btn {
  padding: 2px 4px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}
.pdf-template-btn:hover {
  border-color: var(--fg-muted);
  color: var(--fg-primary);
}
.pdf-template-btn.active {
  border-color: var(--accent);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 10%, var(--bg-primary));
}

.pdf-select {
  width: 100%;
  padding: 5px 8px;
  border-radius: 4px;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  color: var(--fg-primary);
  font-size: 12px;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}
.pdf-select:focus {
  border-color: var(--accent);
}

.pdf-row {
  display: flex;
  gap: 8px;
}

.pdf-col {
  flex: 1;
  min-width: 0;
}

.pdf-export-btn {
  width: 100%;
  margin-top: 12px;
  padding: 7px;
  border-radius: 5px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.15s;
}
.pdf-export-btn:hover {
  opacity: 0.9;
}
</style>
