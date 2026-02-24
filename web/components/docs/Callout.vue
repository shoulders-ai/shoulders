<template>
  <div class="my-6 flex gap-3 text-sm leading-relaxed" :class="typeClasses">
    <component :is="icon" :size="16" :stroke-width="1.5" class="shrink-0 mt-0.5" />
    <div><slot /></div>
  </div>
</template>

<script setup>
import { IconInfoCircle, IconBulb, IconAlertTriangle } from '@tabler/icons-vue'

const props = defineProps({
  type: { type: String, default: 'note', validator: v => ['note', 'tip', 'warning'].includes(v) }
})

const icon = computed(() => ({
  note: IconInfoCircle,
  tip: IconBulb,
  warning: IconAlertTriangle
}[props.type]))

const typeClasses = computed(() => ({
  note: 'text-stone-500',
  tip: 'text-stone-500',
  warning: 'text-stone-500'
}[props.type]))
</script>
