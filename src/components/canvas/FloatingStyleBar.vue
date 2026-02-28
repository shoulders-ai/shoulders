<template>
  <Teleport to="body">
    <div
      v-if="barPosition"
      class="floating-style-bar"
      :style="{ left: barPosition.x + 'px', top: barPosition.y + 'px' }"
    >
      <!-- Node type toggle (text/prompt only) -->
      <button
        v-if="canToggleType"
        class="bar-btn"
        :title="isPrompt ? 'Switch to text node' : 'Switch to prompt node'"
        @click="$emit('toggle-type')"
      >
        <svg v-if="isPrompt" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6h16M4 12h16M4 18h10" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="6,3 20,12 6,21" />
        </svg>
      </button>

      <div v-if="canToggleType" class="bar-sep" />

      <!-- Color picker -->
      <div class="picker-wrap">
        <button
          class="bar-btn"
          title="Color"
          @click.stop="togglePopover('color')"
        >
          <span class="color-dot" :style="{ background: currentColorCss }" />
        </button>
        <div v-if="activePopover === 'color'" class="popover" @click.stop>
          <button
            v-for="color in colors"
            :key="color.value ?? 'default'"
            class="color-swatch"
            :class="{ active: currentColor === color.value }"
            :style="{ background: color.bg }"
            :title="color.label"
            @click="$emit('update-style', { color: color.value }); activePopover = null"
          />
        </div>
      </div>

      <!-- Border picker -->
      <div class="picker-wrap">
        <button
          class="bar-btn"
          title="Border"
          @click.stop="togglePopover('border')"
        >
          <div class="border-indicator" :style="{ borderWidth: currentBorderPx }" />
        </button>
        <div v-if="activePopover === 'border'" class="popover" @click.stop>
          <button
            v-for="bw in borderWidths"
            :key="bw.value"
            class="popover-btn"
            :class="{ active: currentBorder === bw.value }"
            @click="$emit('update-style', { borderWidth: bw.value }); activePopover = null"
          >
            <div class="border-preview" :style="{ borderWidth: bw.px }" />
            <span class="popover-label">{{ bw.label }}</span>
          </button>
        </div>
      </div>

      <!-- Font size picker -->
      <div class="picker-wrap">
        <button
          class="bar-btn text-btn"
          title="Font size"
          @click.stop="togglePopover('font')"
        >
          {{ currentFontDisplay }}
        </button>
        <div v-if="activePopover === 'font'" class="popover" @click.stop>
          <button
            v-for="fs in fontSizes"
            :key="fs.value"
            class="popover-btn"
            :class="{ active: currentFont === fs.value }"
            @click="$emit('update-style', { fontSize: fs.value }); activePopover = null"
          >
            <span class="popover-label" :style="{ fontSize: fs.previewSize }">{{ fs.label }}</span>
          </button>
        </div>
      </div>

      <!-- Alignment picker -->
      <div class="picker-wrap">
        <button
          class="bar-btn"
          title="Text alignment"
          @click.stop="togglePopover('align')"
        >
          <svg v-if="currentAlign === 'center'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>
          <svg v-else-if="currentAlign === 'right'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>
        </button>
        <div v-if="activePopover === 'align'" class="popover" @click.stop>
          <button class="popover-btn" :class="{ active: currentAlign === 'left' }" @click="$emit('update-style', { textAlign: 'left' }); activePopover = null">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h16M4 10h10M4 14h16M4 18h10"/></svg>
            <span class="popover-label">Left</span>
          </button>
          <button class="popover-btn" :class="{ active: currentAlign === 'center' }" @click="$emit('update-style', { textAlign: 'center' }); activePopover = null">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h16M7 10h10M4 14h16M7 18h10"/></svg>
            <span class="popover-label">Center</span>
          </button>
          <button class="popover-btn" :class="{ active: currentAlign === 'right' }" @click="$emit('update-style', { textAlign: 'right' }); activePopover = null">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 6h16M10 10h10M4 14h16M10 18h10"/></svg>
            <span class="popover-label">Right</span>
          </button>
        </div>
      </div>

      <div class="bar-sep" />

      <!-- Title toggle -->
      <button
        class="bar-btn"
        :class="{ active: hasTitle }"
        title="Toggle title"
        @click="$emit('toggle-title')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 4v16M18 4v16M6 4h12M6 12h12" />
        </svg>
      </button>

      <!-- Expand / Collapse height -->
      <button
        class="bar-btn"
        title="Expand to full content"
        @click="$emit('expand-height')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v18M5 8l7-5 7 5M5 16l7 5 7-5" />
        </svg>
      </button>
      <button
        class="bar-btn"
        title="Collapse to compact"
        @click="$emit('collapse-height')"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v18M5 10l7 2 7-2M5 14l7-2 7 2" />
        </svg>
      </button>

      <div class="bar-sep" />

      <!-- Delete -->
      <button class="bar-btn delete-btn" title="Delete" @click="$emit('delete')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'

const props = defineProps({
  nodes: { type: Array, required: true },
})

defineEmits(['update-style', 'delete', 'toggle-type', 'toggle-title', 'expand-height', 'collapse-height'])

const activePopover = ref(null)

function togglePopover(name) {
  activePopover.value = activePopover.value === name ? null : name
}

const colors = [
  { value: null, label: 'Default', bg: 'var(--bg-primary)' },
  { value: 'yellow', label: 'Yellow', bg: 'var(--canvas-yellow)' },
  { value: 'blue', label: 'Blue', bg: 'var(--canvas-blue)' },
  { value: 'green', label: 'Green', bg: 'var(--canvas-green)' },
  { value: 'pink', label: 'Pink', bg: 'var(--canvas-pink)' },
  { value: 'purple', label: 'Purple', bg: 'var(--canvas-purple)' },
  { value: 'orange', label: 'Orange', bg: 'var(--canvas-orange)' },
  { value: 'gray', label: 'Gray', bg: 'var(--canvas-gray)' },
]

const borderWidths = [
  { value: 'thin', label: 'Thin', px: '1px' },
  { value: 'medium', label: 'Medium', px: '2px' },
  { value: 'thick', label: 'Thick', px: '3px' },
]

const fontSizes = [
  { value: 'small', label: 'Small', display: 'S', previewSize: '10px' },
  { value: 'medium', label: 'Medium', display: 'M', previewSize: '12px' },
  { value: 'large', label: 'Large', display: 'L', previewSize: '14px' },
]

const firstNode = computed(() => props.nodes[0])
const isPrompt = computed(() => firstNode.value?.type === 'prompt')
const canToggleType = computed(() => {
  const t = firstNode.value?.type
  return t === 'text' || t === 'prompt'
})
const hasTitle = computed(() => {
  const title = firstNode.value?.data?.title
  return title !== null && title !== undefined
})
const currentColor = computed(() => firstNode.value?.data?.color || null)
const currentColorCss = computed(() => {
  const c = currentColor.value
  if (!c) return 'var(--fg-muted)'
  return `var(--canvas-${c})`
})
const currentBorder = computed(() => firstNode.value?.data?.borderWidth || 'thin')
const currentBorderPx = computed(() => {
  const map = { thin: '1px', medium: '2px', thick: '3px' }
  return map[currentBorder.value] || '1px'
})
const currentFont = computed(() => firstNode.value?.data?.fontSize || 'medium')
const currentAlign = computed(() => firstNode.value?.data?.textAlign || 'left')
const currentFontDisplay = computed(() => {
  const map = { small: 'S', medium: 'M', large: 'L' }
  return map[currentFont.value] || 'M'
})

const barPosition = ref(null)

function updatePosition() {
  if (props.nodes.length === 0) {
    barPosition.value = null
    return
  }

  const nodeEls = props.nodes.map(n =>
    document.querySelector(`[data-id="${n.id}"]`)
  ).filter(Boolean)

  if (nodeEls.length === 0) {
    barPosition.value = null
    return
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity
  for (const el of nodeEls) {
    const rect = el.getBoundingClientRect()
    minX = Math.min(minX, rect.left)
    minY = Math.min(minY, rect.top)
    maxX = Math.max(maxX, rect.right)
  }

  const centerX = (minX + maxX) / 2
  barPosition.value = {
    x: Math.max(10, centerX - 120),
    y: Math.max(10, minY - 44),
  }
}

function onDocClick() {
  activePopover.value = null
}

let raf = null
function scheduleUpdate() {
  if (raf) cancelAnimationFrame(raf)
  raf = requestAnimationFrame(updatePosition)
}

watch(() => props.nodes.length, () => {
  nextTick(updatePosition)
}, { immediate: true })

onMounted(() => {
  window.addEventListener('scroll', scheduleUpdate, true)
  window.addEventListener('resize', scheduleUpdate)
  document.addEventListener('click', onDocClick)
  const observer = new MutationObserver(scheduleUpdate)
  const flowEl = document.querySelector('.vue-flow__transformationpane')
  if (flowEl) {
    observer.observe(flowEl, { attributes: true, attributeFilter: ['style'] })
  }
  scheduleUpdate._observer = observer
})

onUnmounted(() => {
  window.removeEventListener('scroll', scheduleUpdate, true)
  window.removeEventListener('resize', scheduleUpdate)
  document.removeEventListener('click', onDocClick)
  if (scheduleUpdate._observer) scheduleUpdate._observer.disconnect()
  if (raf) cancelAnimationFrame(raf)
})
</script>

<style scoped>
.floating-style-bar {
  position: fixed;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  z-index: 9990;
  user-select: none;
}

.bar-sep {
  width: 1px;
  height: 18px;
  background: var(--border);
  margin: 0 3px;
}

.bar-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fg-secondary);
  transition: background 0.1s;
}

.bar-btn:hover {
  background: var(--bg-hover);
}

.bar-btn.active {
  background: var(--bg-hover);
  color: var(--accent);
}

.text-btn {
  font-size: 12px;
  font-weight: 700;
}

/* Picker wrapper */
.picker-wrap {
  position: relative;
}

/* Shared popover style */
.popover {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  padding: 6px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  z-index: 9991;
  min-width: 120px;
}

/* Color dot indicator */
.color-dot {
  display: block;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
}

/* Color swatches in popover */
.color-swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--border);
  cursor: pointer;
  transition: transform 0.1s;
}

.color-swatch:hover {
  transform: scale(1.15);
}

.color-swatch.active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent);
}

/* Border indicator in toolbar */
.border-indicator {
  width: 14px;
  height: 10px;
  border: solid var(--fg-secondary);
  border-radius: 2px;
}

/* Border preview in popover */
.border-preview {
  width: 16px;
  height: 10px;
  border: solid var(--fg-secondary);
  border-radius: 2px;
  flex-shrink: 0;
}

/* Popover button (for border / font) */
.popover-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 4px 8px;
  border: none;
  background: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--fg-secondary);
  font-size: 11px;
  transition: background 0.1s;
}

.popover-btn:hover {
  background: var(--bg-hover);
}

.popover-btn.active {
  background: var(--bg-hover);
  color: var(--accent);
}

.popover-label {
  white-space: nowrap;
}

.delete-btn {
  color: var(--fg-muted);
}

.delete-btn:hover {
  color: #e06c75;
  background: rgba(224, 108, 117, 0.1);
}
</style>
