<template>
  <div class="h-full flex flex-col w-56 flex-shrink-0 pt-10 pb-4 z-20">
    <!-- Search Bar -->
    <DocsSearch @select="(id, title) => { $emit('select', id, title); $emit('toggle-mobile') }" />

    <!-- Navigation list -->
    <div class="flex-1 overflow-y-auto px-4 scrollbar-hide">
      <div class="space-y-6">
        <div v-for="group in groups" :key="group.label">
          <p class="text-xs font-semibold text-stone-400 uppercase tracking-wider mb-2">{{ group.label }}</p>
          <div class="space-y-0.5">
            <button
              v-for="item in group.items"
              :key="item.id"
              @click="$emit('select', item.id); $emit('toggle-mobile')"
              class="w-full text-left px-2 py-1.5 text-sm rounded transition-colors block"
              :class="[
                activeId === item.id
                  ? 'text-stone-900 font-medium bg-stone-100'
                  : 'text-stone-500 hover:text-stone-700'
              ]"
            >
              {{ item.title }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  activeId: { type: String, default: null },
  groups: { type: Array, required: true },
  isMobileOpen: { type: Boolean, default: false }
})

defineEmits(['select', 'toggle-mobile'])
</script>

<style scoped>
.scrollbar-hide::-webkit-scrollbar { display: none; }
.scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
</style>
