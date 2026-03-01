<template>
  <Teleport to="body">
    <div class="context-menu-backdrop" @click="$emit('close')" @contextmenu.prevent="$emit('close')">
      <div
        class="context-menu"
        :style="{ left: x + 'px', top: y + 'px' }"
        @click.stop
      >
        <!-- Pane context -->
        <template v-if="type === 'pane'">
          <button class="ctx-item" @click="$emit('add-text-node')">
            <span class="ctx-label">Add text node</span>
            <span class="ctx-shortcut">Dbl-click</span>
          </button>
          <button class="ctx-item" @click="$emit('add-prompt-node')">
            <span class="ctx-label">Add prompt node</span>
          </button>
          <button class="ctx-item" @click="$emit('add-label-node')">
            <span class="ctx-label">Add label</span>
          </button>
          <button class="ctx-item" @click="$emit('add-group-node')">
            <span class="ctx-label">Add group / frame</span>
          </button>
          <div class="ctx-sep" />
          <button class="ctx-item" @click="$emit('select-all')">
            <span class="ctx-label">Select all</span>
            <span class="ctx-shortcut">{{ modKey }}+A</span>
          </button>
        </template>

        <!-- Node context -->
        <template v-if="type === 'node'">
          <button class="ctx-item" @click="$emit('duplicate-selected')">
            <span class="ctx-label">Duplicate</span>
            <span class="ctx-shortcut">{{ modKey }}+D</span>
          </button>
          <div class="ctx-sep" />
          <button class="ctx-item ctx-danger" @click="$emit('delete-selected')">
            <span class="ctx-label">Delete</span>
            <span class="ctx-shortcut">Del</span>
          </button>
        </template>

        <!-- Edge context -->
        <template v-if="type === 'edge'">
          <button class="ctx-item ctx-danger" @click="$emit('delete-selected')">
            <span class="ctx-label">Delete edge</span>
          </button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { modKey } from '../../platform'

defineProps({
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  type: { type: String, default: 'pane' },
  nodeId: { type: String, default: null },
  edgeId: { type: String, default: null },
})

defineEmits(['close', 'add-text-node', 'add-prompt-node', 'add-label-node', 'add-group-node', 'delete-selected', 'duplicate-selected', 'select-all'])
</script>

<style scoped>
.context-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9999;
}

.context-menu {
  position: fixed;
  min-width: 180px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  z-index: 10000;
}

.ctx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  border: none;
  background: none;
  color: var(--fg-primary);
  font-size: 12px;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
}

.ctx-item:hover {
  background: var(--bg-hover);
}

.ctx-danger {
  color: #e06c75;
}

.ctx-danger:hover {
  background: rgba(224, 108, 117, 0.1);
}

.ctx-label {
  flex: 1;
}

.ctx-shortcut {
  font-size: 10px;
  color: var(--fg-muted);
  margin-left: 16px;
  font-family: var(--font-mono);
}

.ctx-sep {
  height: 1px;
  background: var(--border);
  margin: 4px 6px;
}
</style>
