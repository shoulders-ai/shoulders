<template>
  <div class="h-full flex flex-col overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center gap-2 px-3 py-1 border-b" style="background: var(--bg-secondary); border-color: var(--border); color: var(--fg-secondary);">
      <span class="text-xs tabular-nums" style="color: var(--fg-muted);">{{ dimensions }}</span>
      <span v-if="saving" class="text-xs ml-2" style="color: var(--fg-muted);">Saving...</span>
      <span v-if="error" class="text-xs ml-auto" style="color: var(--error);">{{ error }}</span>
    </div>

    <!-- Table -->
    <div ref="hotWrapper" class="flex-1 overflow-hidden relative">
      <div ref="hotContainer" class="absolute inset-0"></div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import Handsontable from 'handsontable'
import 'handsontable/dist/handsontable.full.min.css'
import Papa from 'papaparse'
import { useFilesStore } from '../../stores/files'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const files = useFilesStore()
const hotWrapper = ref(null)
const hotContainer = ref(null)
const dimensions = ref('')
const saving = ref(false)
const error = ref(null)

let hot = null
let saveTimeout = null
let resizeObserver = null
const isTsv = props.filePath.toLowerCase().endsWith('.tsv')

function updateDimensions() {
  if (!hot) return
  const rows = hot.countRows()
  const cols = hot.countCols()
  dimensions.value = `${rows} × ${cols}`
}

function scheduleSave() {
  clearTimeout(saveTimeout)
  saving.value = false
  saveTimeout = setTimeout(async () => {
    if (!hot) return
    saving.value = true
    try {
      const data = hot.getData()
      const text = Papa.unparse(data, { delimiter: isTsv ? '\t' : ',' })
      await files.saveFile(props.filePath, text)
    } catch (e) {
      error.value = e.toString()
    }
    saving.value = false
  }, 1000)
}

onMounted(async () => {
  if (!hotContainer.value) return

  try {
    let content = files.fileContents[props.filePath]
    if (content === undefined) {
      content = await files.readFile(props.filePath)
    }
    if (content === null) content = ''

    const parsed = Papa.parse(content, {
      header: false,
      delimiter: isTsv ? '\t' : undefined,
    })

    const data = parsed.data
    if (data.length === 0) data.push([''])

    // Wait for layout to settle so container has real dimensions
    await nextTick()

    const rect = hotWrapper.value?.getBoundingClientRect()

    hot = new Handsontable(hotContainer.value, {
      data,
      colHeaders: true,
      rowHeaders: true,
      contextMenu: true,
      manualColumnResize: true,
      manualRowResize: true,
      stretchH: 'all',
      width: rect ? rect.width : '100%',
      height: rect ? rect.height : '100%',
      autoColumnSize: true,
      undo: true,
      licenseKey: 'non-commercial-and-evaluation',
      afterChange(changes, source) {
        if (source === 'loadData') return
        updateDimensions()
        scheduleSave()
      },
      afterCreateRow: () => { updateDimensions(); scheduleSave() },
      afterRemoveRow: () => { updateDimensions(); scheduleSave() },
      afterCreateCol: () => { updateDimensions(); scheduleSave() },
      afterRemoveCol: () => { updateDimensions(); scheduleSave() },
    })

    updateDimensions()

    // Resize Handsontable when container resizes (e.g. sidebar toggle, pane resize)
    resizeObserver = new ResizeObserver(() => {
      if (!hot || !hotWrapper.value) return
      const r = hotWrapper.value.getBoundingClientRect()
      hot.updateSettings({ width: r.width, height: r.height })
    })
    resizeObserver.observe(hotWrapper.value)
  } catch (e) {
    error.value = e.toString()
  }
})

onUnmounted(() => {
  clearTimeout(saveTimeout)
  resizeObserver?.disconnect()
  if (hot) {
    hot.destroy()
    hot = null
  }
})
</script>
