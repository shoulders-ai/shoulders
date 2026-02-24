<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toastStore.toasts"
          :key="toast.id"
          class="toast-item"
          :class="`toast-${toast.type}`"
          @click="!toast.action && toastStore.dismiss(toast.id)"
        >
          <span class="toast-message">{{ toast.message }}</span>
          <button
            v-if="toast.action"
            class="toast-action-btn"
            @click.stop="toast.action.onClick(); toastStore.dismiss(toast.id)"
          >
            {{ toast.action.label }}
          </button>
          <button
            v-if="toast.action"
            class="toast-dismiss-btn"
            @click.stop="toastStore.dismiss(toast.id)"
          >
            &times;
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToastStore } from '../../stores/toast'
const toastStore = useToastStore()
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 36px;
  right: 16px;
  z-index: 9999;
  display: flex;
  flex-direction: column-reverse;
  gap: 8px;
  pointer-events: none;
}

.toast-item {
  pointer-events: auto;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
  backdrop-filter: blur(8px);
  border: 1px solid var(--border);
  background: var(--bg-secondary);
  color: var(--fg-primary);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-width: 360px;
  line-height: 1.4;
  display: flex;
  align-items: center;
  gap: 10px;
}

.toast-message {
  flex: 1;
}

.toast-action-btn {
  padding: 2px 10px;
  border-radius: 4px;
  border: 1px solid var(--accent);
  background: rgba(122, 162, 247, 0.1);
  color: var(--accent);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.toast-action-btn:hover {
  background: rgba(122, 162, 247, 0.25);
}

.toast-dismiss-btn {
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  font-size: 14px;
  padding: 0 2px;
  line-height: 1;
}

.toast-dismiss-btn:hover {
  color: var(--fg-primary);
}

.toast-success {
  border-left: 3px solid var(--success);
}

.toast-error {
  border-left: 3px solid var(--error, #f44);
}

.toast-warning {
  border-left: 3px solid var(--warning, #e0af68);
}

.toast-info {
  border-left: 3px solid var(--accent);
}

/* Transitions */
.toast-enter-active {
  transition: all 0.25s ease-out;
}
.toast-leave-active {
  transition: all 0.2s ease-in;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
.toast-move {
  transition: transform 0.25s ease;
}
</style>
