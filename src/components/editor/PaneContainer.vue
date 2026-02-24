<template>
  <!-- Leaf pane -->
  <EditorPane
    v-if="node.type === 'leaf'"
    :paneId="node.id"
    :tabs="node.tabs"
    :activeTab="node.activeTab"
    @cursor-change="(pos) => $emit('cursor-change', pos)"
    @editor-stats="(stats) => $emit('editor-stats', stats)"
  />

  <!-- Split pane -->
  <div
    v-else-if="node.type === 'split'"
    ref="splitContainer"
    class="flex h-full w-full"
    :class="{ 'flex-col': node.direction === 'horizontal' }"
  >
    <div
      :style="firstChildStyle"
      class="overflow-hidden"
    >
      <PaneContainer
        :node="node.children[0]"
        @cursor-change="(pos) => $emit('cursor-change', pos)"
        @editor-stats="(stats) => $emit('editor-stats', stats)"
      />
    </div>

    <SplitHandle
      :direction="node.direction === 'horizontal' ? 'horizontal' : 'vertical'"
      @resize="(e) => handleResize(e)"
    />

    <div
      :style="secondChildStyle"
      class="overflow-hidden"
    >
      <PaneContainer
        :node="node.children[1]"
        @cursor-change="(pos) => $emit('cursor-change', pos)"
        @editor-stats="(stats) => $emit('editor-stats', stats)"
      />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useEditorStore } from '../../stores/editor'
import EditorPane from './EditorPane.vue'
import SplitHandle from './SplitHandle.vue'

const props = defineProps({
  node: { type: Object, required: true },
})

const emit = defineEmits(['cursor-change', 'editor-stats'])
const editorStore = useEditorStore()
const splitContainer = ref(null)

const firstChildStyle = computed(() => {
  if (props.node.type !== 'split') return {}
  const ratio = props.node.ratio || 0.5
  const prop = props.node.direction === 'horizontal' ? 'height' : 'width'
  return { [prop]: `calc(${ratio * 100}% - 1.5px)` }
})

const secondChildStyle = computed(() => {
  if (props.node.type !== 'split') return {}
  const ratio = props.node.ratio || 0.5
  const prop = props.node.direction === 'horizontal' ? 'height' : 'width'
  return { [prop]: `calc(${(1 - ratio) * 100}% - 1.5px)` }
})

function handleResize(e) {
  if (props.node.type !== 'split') return

  const container = splitContainer.value
  if (!container) return

  const rect = container.getBoundingClientRect()
  let ratio

  if (props.node.direction === 'horizontal') {
    ratio = (e.y - rect.top) / rect.height
  } else {
    ratio = (e.x - rect.left) / rect.width
  }

  editorStore.setSplitRatio(props.node, ratio)
}
</script>
