<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Status bar (compile controls are in the .tex editor TabBar) -->
    <div v-if="errorCount > 0 || warningCount > 0"
         class="flex items-center gap-2 px-3 py-1 border-b"
         style="background: var(--bg-secondary); border-color: var(--border);">
      <button v-if="errorCount > 0" class="latex-btn text-xs" @click="toggleErrors"
              style="color: var(--error, #f87171);">
        {{ errorCount }} error{{ errorCount !== 1 ? 's' : '' }}
      </button>
      <button v-if="warningCount > 0" class="latex-btn text-xs" @click="toggleErrors"
              style="color: var(--warning, #fbbf24);">
        {{ warningCount }} warning{{ warningCount !== 1 ? 's' : '' }}
      </button>
    </div>

    <!-- Error panel (collapsible) -->
    <div v-if="errorsVisible && (errors.length > 0 || warnings.length > 0)"
         class="border-b overflow-auto" style="background: var(--bg-secondary); border-color: var(--border); max-height: 150px;">
      <div v-for="(err, i) in errors" :key="'e' + i"
           class="flex items-center gap-2 px-3 py-1 text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
           @click="jumpToLine(err.line)">
        <span style="color: var(--error, #f87171);">&#x2716;</span>
        <span v-if="err.line" class="tabular-nums" style="color: var(--fg-muted);">L{{ err.line }}</span>
        <span class="flex-1 truncate" style="color: var(--fg-primary);">{{ err.message }}</span>
        <button class="latex-btn text-[11px]" @click.stop="askAiToFix(err)" title="Ask AI to fix this error">
          Ask AI &#x25B8;
        </button>
      </div>
      <div v-for="(warn, i) in warnings" :key="'w' + i"
           class="flex items-center gap-2 px-3 py-1 text-xs hover:bg-[var(--bg-hover)] cursor-pointer"
           @click="jumpToLine(warn.line)">
        <span style="color: var(--warning, #fbbf24);">&#x26A0;</span>
        <span v-if="warn.line" class="tabular-nums" style="color: var(--fg-muted);">L{{ warn.line }}</span>
        <span class="flex-1 truncate" style="color: var(--fg-primary);">{{ warn.message }}</span>
      </div>
    </div>

    <!-- PDF viewer -->
    <div class="flex-1 overflow-hidden">
      <PdfViewer
        v-if="hasPdf"
        ref="pdfViewerRef"
        :key="pdfReloadKey"
        :filePath="pdfPath"
        :paneId="paneId"
        @dblclick-page="handleBackwardSync"
      />
      <div v-else class="flex items-center justify-center h-full" style="color: var(--fg-muted);">
        <div class="text-center text-sm">
          <div v-if="compileStatus === 'compiling'">
            Compiling…
          </div>
          <div v-else-if="!latexStore.tectonicEnabled">
            Tectonic is disabled. Enable it in Settings.
          </div>
          <div v-else>
            No PDF yet — click Compile in the .tex tab
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useLatexStore } from '../../stores/latex'
import { useChatStore } from '../../stores/chat'
import { useFilesStore } from '../../stores/files'
import PdfViewer from './PdfViewer.vue'

const props = defineProps({
  filePath: { type: String, required: true }, // The .pdf path
  paneId: { type: String, required: true },
})

const latexStore = useLatexStore()
const chatStore = useChatStore()
const filesStore = useFilesStore()

// Derive .tex path from .pdf path
const texPath = computed(() => {
  return props.filePath.replace(/\.pdf$/, '.tex')
})

const state = computed(() => latexStore.stateForFile(texPath.value))
const compileStatus = computed(() => state.value?.status || null)
const errors = computed(() => state.value?.errors || [])
const warnings = computed(() => state.value?.warnings || [])
const errorCount = computed(() => errors.value.length)
const warningCount = computed(() => warnings.value.length)
const pdfPath = computed(() => state.value?.pdfPath || props.filePath)
const hasPdf = ref(false)

const pdfViewerRef = ref(null)
const errorsVisible = ref(false)
const pdfReloadKey = ref(0)

function toggleErrors() {
  errorsVisible.value = !errorsVisible.value
}

function jumpToLine(line) {
  if (!line) return
  window.dispatchEvent(new CustomEvent('latex-backward-sync', {
    detail: { file: texPath.value, line },
  }))
}

function handleBackwardSync({ page, x, y }) {
  const synctexPath = state.value?.synctexPath
  if (!synctexPath || !page) return

  invoke('synctex_backward', { synctexPath, page, x, y })
    .then(result => {
      if (result?.line) {
        window.dispatchEvent(new CustomEvent('latex-backward-sync', {
          detail: { file: result.file, line: result.line },
        }))
      }
    })
    .catch(() => {})
}

async function askAiToFix(err) {
  let context = ''
  try {
    const content = filesStore.fileContents[texPath.value] || await filesStore.readFile(texPath.value)
    if (content && err.line) {
      const lines = content.split('\n')
      const start = Math.max(0, err.line - 6)
      const end = Math.min(lines.length, err.line + 5)
      context = lines.slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n')
    }
  } catch {}

  const fileName = texPath.value.split('/').pop()
  const lineInfo = err.line ? ` line ${err.line}` : ''
  const message = `LaTeX compilation error in ${fileName}${lineInfo}:\n\`\`\`\n${err.message}\n\`\`\`\n${context ? `Code around the error:\n\`\`\`tex\n${context}\n\`\`\`\n` : ''}Briefly explain what this means, then fix it.`

  window.dispatchEvent(new CustomEvent('open-chat'))
  if (!chatStore.activeSession) chatStore.createSession()
  window.dispatchEvent(new CustomEvent('chat-prefill', {
    detail: { message },
  }))
}

function handleCompileDone(e) {
  if (e.detail?.texPath === texPath.value) {
    pdfReloadKey.value++
    checkPdfExists()
    if (e.detail?.errors?.length > 0) {
      errorsVisible.value = true
    }
  }
}

async function checkPdfExists() {
  try {
    hasPdf.value = await invoke('path_exists', { path: pdfPath.value })
  } catch {
    hasPdf.value = false
  }
}

// Forward sync: listen for cursor-response and invoke synctex_forward
function handleCursorResponse(e) {
  const { texPath: tp, line } = e.detail || {}
  if (tp !== texPath.value) return
  const synctexPath = state.value?.synctexPath
  if (!synctexPath) return

  invoke('synctex_forward', { synctexPath, texPath: texPath.value, line })
    .then(result => {
      if (result?.page) {
        pdfViewerRef.value?.scrollToPage(result.page)
      }
    })
    .catch(() => {})
}

onMounted(() => {
  window.addEventListener('latex-compile-done', handleCompileDone)
  window.addEventListener('latex-cursor-response', handleCursorResponse)
  checkPdfExists()
})

onUnmounted(() => {
  window.removeEventListener('latex-compile-done', handleCompileDone)
  window.removeEventListener('latex-cursor-response', handleCursorResponse)
})
</script>

<style scoped>
.latex-btn {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  background: var(--bg-tertiary);
  color: var(--fg-secondary);
  border: 1px solid var(--border);
  transition: background 0.15s;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.latex-btn:hover {
  background: var(--bg-hover);
  color: var(--fg-primary);
}
.latex-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
