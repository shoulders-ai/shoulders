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
  transition: background 0.15s;
}
.resize-handle.vertical {
  width: 3px;
  cursor: col-resize;
}
.resize-handle.horizontal {
  height: 3px;
  cursor: row-resize;
}
.resize-handle:hover,
.resize-handle.dragging {
  background: var(--accent);
}
</style>
