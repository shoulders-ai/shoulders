<template>
  <div class="root">
    <div class="block">
      <div class="wordmark">Shoulders</div>
      <div class="shortcuts">
        <button class="row flex items-center gap-1" @click="openFile">
          <span class="key">{{ mod }} P</span>
          <span class="lbl">open file</span>
        </button>
        <button class="row" @click="newTab">
          <span class="key">{{ mod }} T</span>
          <span class="lbl">new tab</span>
        </button>
        <button class="row" @click="newFile">
          <span class="key">{{ mod }} N</span>
          <span class="lbl">new file</span>
        </button>
        <button class="row" @click="splitPane">
          <span class="key">{{ mod }} J</span>
          <span class="lbl">split pane</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { useEditorStore } from '../../stores/editor'
import { isMac } from '../../platform'

const props = defineProps({
  paneId: { type: String, required: true },
})

const editorStore = useEditorStore()
const mod = isMac ? '⌘' : 'Ctrl+'

function openFile() { window.dispatchEvent(new CustomEvent('app:focus-search')) }
function newTab()   { editorStore.openNewTab(props.paneId) }
function newFile()  { window.dispatchEvent(new CustomEvent('app:new-file')) }
function splitPane() { editorStore.openNewTabBeside() }
</script>

<style scoped>
.root {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: var(--bg-secondary);
}

.block {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.wordmark {
  font-family: 'Crimson Text', 'Lora', Georgia, serif;
  font-size: 32px;
  font-weight: 600;
  color: var(--fg-muted);
  opacity: 0.5;
  letter-spacing: 0.01em;
  user-select: none;
  cursor: default;
  text-align: center;
}

.shortcuts {
  display: flex;
  flex-direction: column;
}

.row {
  display: flex;
  align-items: baseline;
  gap: 13px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  line-height: 1.9;
  color: var(--fg-muted);
  transition: color 50ms;
  margin: auto;
}

.row:hover {
  color: var(--fg-secondary);
}

.key {
  font-family: ui-monospace, monospace;
  font-size: 12px;
  flex-shrink: 0;
  opacity: 1;
  transition: opacity 75ms;
}

.row:hover .key {
  opacity: 0.9;
}

.lbl {
  font-size: 12.5px;
  letter-spacing: 0.035em;
  width: 11ch;
  text-align: left;
  padding-left: 10px;
}
</style>
