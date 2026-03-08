<template>
  <div
    class="resize-handle"
    :class="[direction, { dragging }]"
    @mousedown.prevent="startDrag"
    @dblclick.prevent="$emit('dblclick')"
  ></div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  direction: { type: String, default: 'vertical' }, // 'vertical' (left/right) or 'horizontal' (top/bottom)
})

const emit = defineEmits(['resize', 'dblclick'])

const dragging = ref(false)

function startDrag(e) {
  dragging.value = true
  const startX = e.clientX
  const startY = e.clientY

  // Prevent iframes from capturing mouse events during drag
  const style = document.createElement('style')
  style.id = 'resize-drag-iframe-block'
  style.textContent = 'iframe { pointer-events: none !important; }'
  document.head.appendChild(style)

  function onMouseMove(e) {
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    emit('resize', { dx, dy, x: e.clientX, y: e.clientY })
  }

  function onMouseUp() {
    dragging.value = false
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    document.getElementById('resize-drag-iframe-block')?.remove()
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
  document.body.style.cursor = props.direction === 'vertical' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}
</script>

<style scoped>
.resize-handle {
  flex-shrink: 0;
  z-index: 10;
  position: relative;
  transition: background 0.15s;
}

/* Vertical: 1px wide line with 7px hit area */
.resize-handle.vertical {
  width: 1px;
  cursor: col-resize;
  background: var(--border);
}
.resize-handle.vertical::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: -3px;
  right: -3px;
  cursor: col-resize;
}

/* Horizontal: 1px tall line with 7px hit area */
.resize-handle.horizontal {
  height: 1px;
  cursor: row-resize;
  background: var(--border);
}
.resize-handle.horizontal::before {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: -3px;
  bottom: -3px;
  cursor: row-resize;
}

/* Hover/drag: accent highlight */
.resize-handle:hover,
.resize-handle.dragging {
  background: var(--accent);
}
</style>
