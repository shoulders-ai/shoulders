<template>
  <div
    class="split-handle shrink-0"
    :class="[direction, { dragging }]"
    @mousedown.prevent="startDrag"
  ></div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  direction: { type: String, default: 'vertical' },
})

const emit = defineEmits(['resize'])
const dragging = ref(false)

function startDrag(e) {
  dragging.value = true

  function onMouseMove(e) {
    emit('resize', { x: e.clientX, y: e.clientY, target: e.target })
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
.split-handle {
  z-index: 5;
  background: var(--border);
  transition: background 0.15s;
}
.split-handle.vertical {
  width: 3px;
  cursor: col-resize;
}
.split-handle.horizontal {
  height: 3px;
  cursor: row-resize;
}
.split-handle:hover,
.split-handle.dragging {
  background: var(--accent);
}
</style>
