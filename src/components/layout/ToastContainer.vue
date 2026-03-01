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
          <component :is="typeIcon(toast.type)" :size="16" :stroke-width="2" class="toast-type-icon" />
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
            <IconX :size="14" :stroke-width="2" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup>
import { useToastStore } from '../../stores/toast'
import { IconCircleCheck, IconCircleX, IconAlertTriangle, IconInfoCircle, IconX } from '@tabler/icons-vue'

const toastStore = useToastStore()

function typeIcon(type) {
  switch (type) {
    case 'success': return IconCircleCheck
    case 'error': return IconCircleX
    case 'warning': return IconAlertTriangle
    case 'info': return IconInfoCircle
    default: return IconInfoCircle
  }
}
</script>

<style scoped>
.toast-container {
  position: fixed;
  bottom: 24px;
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
  border-radius: 2px;
  font-size: calc(var(--ui-font-size, 13px) - 2px);
  cursor: pointer;
  border: 1px solid color-mix(in srgb, var(--fg-muted) 30%, var(--border));
  color: var(--fg-primary);
  max-width: 380px;
  line-height: 1.45;
  display: flex;
  align-items: center;
  gap: 10px;
}

.toast-type-icon {
  flex-shrink: 0;
}

.toast-message {
  flex: 1;
}

.toast-action-btn {
  padding: 3px 10px;
  border-radius: 2px;
  border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
  background: color-mix(in srgb, var(--accent) 10%, transparent);
  color: var(--accent);
  font-size: calc(var(--ui-font-size, 13px) - 3px);
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s;
}

.toast-action-btn:hover {
  background: color-mix(in srgb, var(--accent) 20%, transparent);
}

.toast-dismiss-btn {
  display: flex;
  align-items: center;
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}

.toast-dismiss-btn:hover {
  color: var(--fg-primary);
}

/* Type styling: background tint + icon color */
.toast-success {
  background: color-mix(in srgb, var(--success) 8%, var(--bg-secondary));
}
.toast-success .toast-type-icon {
  color: var(--success);
}

.toast-error {
  background: color-mix(in srgb, var(--error, #f44) 8%, var(--bg-secondary));
}
.toast-error .toast-type-icon {
  color: var(--error, #f44);
}

.toast-warning {
  background: color-mix(in srgb, var(--warning, #e0af68) 8%, var(--bg-secondary));
}
.toast-warning .toast-type-icon {
  color: var(--warning, #e0af68);
}

.toast-info {
  background: color-mix(in srgb, var(--accent) 8%, var(--bg-secondary));
}
.toast-info .toast-type-icon {
  color: var(--accent);
}

/* Transitions */
.toast-enter-active {
  transition: opacity 0.2s ease-out, transform 0.2s ease-out;
}
.toast-leave-active {
  transition: opacity 0.08s ease-out, transform 0.08s ease-out;
}
.toast-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
.toast-move {
  transition: transform 0.15s ease;
}
</style>
