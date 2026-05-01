<template>
  <Teleport to="body">
    <Transition name="snapshot-dialog">
      <div
        v-if="visible"
        class="snapshot-overlay"
        @click.self="close"
        @keydown.esc="close"
      >
        <div class="snapshot-dialog" style="width: 380px;">
          <div class="snapshot-header">
            <span class="snapshot-title">Your team workspace is ready</span>
            <button class="snapshot-close" @click="close" aria-label="Close">&times;</button>
          </div>

          <p class="text-xs text-content-muted mb-3">Share this link with your team to invite them.</p>

          <div class="flex items-center gap-2 mb-4">
            <input
              :value="inviteUrl"
              readonly
              class="snapshot-input font-mono text-xs flex-1"
              @focus="$event.target.select()"
            />
            <button
              class="shrink-0 px-3 py-1.5 text-xs font-medium rounded-md bg-accent text-surface cursor-pointer border-none transition-opacity hover:opacity-85"
              @click="copyLink"
            >
              {{ copied ? 'Copied' : 'Copy' }}
            </button>
          </div>

          <button class="snapshot-btn" @click="close">Done</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  inviteToken: { type: String, default: '' },
})

const emit = defineEmits(['close'])

const copied = ref(false)

const inviteUrl = computed(() =>
  props.inviteToken ? `shoulde.rs/join/${props.inviteToken}` : ''
)

async function copyLink() {
  try {
    await navigator.clipboard.writeText(inviteUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // fallback: select the input
  }
}

function close() {
  copied.value = false
  emit('close')
}
</script>
