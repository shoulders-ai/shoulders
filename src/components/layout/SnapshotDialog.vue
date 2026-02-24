<template>
  <Teleport to="body">
    <Transition name="snapshot-dialog">
      <div
        v-if="visible"
        class="snapshot-overlay"
        @click.self="cancel"
        @keydown.esc="cancel"
      >
        <div class="snapshot-dialog" @keydown.esc="cancel">
          <div class="snapshot-header">
            <span class="snapshot-title">Create Snapshot</span>
            <button class="snapshot-close" @click="cancel" aria-label="Close">&times;</button>
          </div>
          <input
            ref="inputEl"
            v-model="name"
            class="snapshot-input font-medium text-sm px-4 py-2"
            placeholder="e.g., Submitted draft"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            @keydown.enter="submit"
          />
          <p class="snapshot-helper">
            Your files auto-save. Use this dialog to create named checkpoints in Version History.<br />
          </p>
          <button class="snapshot-btn" @click="submit">Save</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['resolve'])

const inputEl = ref(null)
const name = ref('')

watch(() => props.visible, async (v) => {
  if (v) {
    name.value = ''
    await nextTick()
    inputEl.value?.focus()
  }
})

function submit() {
  const trimmed = name.value.trim()
  emit('resolve', trimmed || null)
}

function cancel() {
  emit('resolve', null)
}
</script>
