<template>
  <div class="flex flex-col h-full">
    <!-- Detail mode: active thread -->
    <template v-if="activeThread">
      <TaskThread
        ref="taskThreadRef"
        :thread="activeThread"
      />
    </template>

    <!-- List mode: no active thread -->
    <template v-else>
      <!-- Header -->
      <div class="px-3 py-2 ui-text-xl font-medium uppercase tracking-wider shrink-0"
        style="color: var(--fg-muted); border-bottom: 1px solid var(--border);">
        Tasks ({{ threads.length }})
      </div>

      <!-- Empty state -->
      <div v-if="threads.length === 0" class="flex-1 flex items-center justify-center px-4">
        <div class="text-center ui-text-xl" style="color: var(--fg-muted);">
          <div class="mb-2">No tasks yet</div>
          <div style="opacity: 0.6;">Select text and press {{ modKey }}+Shift+C</div>
        </div>
      </div>

      <!-- Thread list -->
      <div v-else class="flex-1 overflow-y-auto">
        <div
          v-for="thread in sortedThreads"
          :key="thread.id"
          class="px-3 py-2.5 cursor-pointer hover:bg-[var(--bg-hover)] border-b"
          :style="{
            borderColor: 'var(--border)',
            opacity: thread.status === 'resolved' ? 0.5 : 1,
          }"
          @click="tasksStore.setActiveThread(thread.id)"
        >
          <div class="flex items-center gap-2 mb-1">
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :style="{ background: statusColor(thread.status) }"
            ></span>
            <span class="ui-text-lg font-medium truncate" style="color: var(--fg-primary);">
              {{ firstMessagePreview(thread) }}
            </span>
            <span v-if="thread.status === 'resolved'"
              class="ui-text-base shrink-0 ml-auto" style="color: var(--success);">
              resolved
            </span>
          </div>
          <div class="flex items-center gap-2 ui-text-base" style="color: var(--fg-muted);">
            <span class="truncate">
              {{ thread.fileId.split('/').pop() }}
              <template v-if="thread.cellId"> &middot; Cell {{ thread.cellIndex != null ? thread.cellIndex : '?' }}</template>
            </span>
            <span class="ml-auto shrink-0">{{ relativeTime(thread.updatedAt) }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useTasksStore } from '../../stores/tasks'
import TaskThread from './TaskThread.vue'
import { modKey } from '../../platform'

const tasksStore = useTasksStore()
const taskThreadRef = ref(null)

const threads = computed(() => tasksStore.threads)
const sortedThreads = computed(() => {
  const active = threads.value.filter(t => t.status !== 'resolved')
  const resolved = threads.value.filter(t => t.status === 'resolved')
  return [...active, ...resolved]
})
const activeThread = computed(() => tasksStore.activeThread)

function firstMessagePreview(thread) {
  const first = thread.messages[0]
  if (!first) return 'Empty thread'
  const text = first.content || ''
  return text.length > 50 ? text.slice(0, 50) + '...' : text
}

function statusColor(status) {
  if (status === 'streaming') return 'var(--accent)'
  if (status === 'error') return 'var(--error)'
  if (status === 'resolved') return 'var(--success)'
  return 'var(--fg-muted)'
}

function relativeTime(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const days = Math.floor(hr / 24)
  return `${days}d ago`
}

function focusInput() {
  taskThreadRef.value?.focusInput()
}

defineExpose({ focusInput })
</script>
