<template>
  <div class="flex flex-col h-full" style="background: var(--bg-primary);">
    <ChatSession
      v-if="session"
      ref="chatSessionRef"
      :key="sessionId"
      :session="session"
    />
    <div v-else class="flex items-center justify-center h-full ui-text-base" style="color: var(--fg-muted);">
      Loading chat session...
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useChatStore } from '../../stores/chat'
import { useEditorStore } from '../../stores/editor'
import { getChatSessionId } from '../../utils/fileTypes'
import ChatSession from './ChatSession.vue'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId:   { type: String, required: true },
})

const chatStore   = useChatStore()
const editorStore = useEditorStore()

const chatSessionRef = ref(null)

const sessionId = computed(() => getChatSessionId(props.filePath))

const session = computed(() =>
  chatStore.sessions.find(s => s.id === sessionId.value) || null
)

onMounted(async () => {
  const sid = sessionId.value
  if (!sid) return

  const exists = chatStore.sessions.find(s => s.id === sid)
  if (!exists) {
    await chatStore.reopenSession(sid, { skipArchive: true })
  }

  chatStore.activeSessionId = sid
  chatSessionRef.value?.focus()
})

// When this pane becomes active: sync activeSessionId and focus the input
watch(
  () => editorStore.activePaneId === props.paneId,
  (isActive) => {
    if (isActive && sessionId.value) {
      chatStore.activeSessionId = sessionId.value
      chatSessionRef.value?.focus()
    }
  },
)

function focus() {
  chatSessionRef.value?.focus()
}

defineExpose({ focus })
</script>
