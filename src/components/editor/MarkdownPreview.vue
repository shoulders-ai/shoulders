<template>
  <div class="md-preview-container" ref="containerEl">
    <!-- Knitting indicator for .Rmd/.qmd -->
    <div v-if="knitting" class="md-preview-knitting">
      <div class="md-preview-knitting-dots">
        <div class="chunk-spinner-dot"></div>
        <div class="chunk-spinner-dot"></div>
        <div class="chunk-spinner-dot"></div>
      </div>
      <span>Knitting{{ knittingProgress ? ` (${knittingProgress})` : '' }}...</span>
    </div>
    <div class="md-preview-content" v-html="renderedHtml" @click="handleClick"></div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useFilesStore } from '../../stores/files'
import { useEditorStore } from '../../stores/editor'
import { useWorkspaceStore } from '../../stores/workspace'
import { useReferencesStore } from '../../stores/references'
import { useLinksStore } from '../../stores/links'
import { renderPreview } from '../../utils/markdownPreview'
import { isRmdOrQmd } from '../../utils/fileTypes'

const props = defineProps({
  filePath: { type: String, required: true },
  paneId: { type: String, required: true },
})

const filesStore = useFilesStore()
const editorStore = useEditorStore()
const workspace = useWorkspaceStore()
const referencesStore = useReferencesStore()
const linksStore = useLinksStore()
const containerEl = ref(null)

// Extract source path from preview: prefix
const sourcePath = computed(() => props.filePath.replace(/^preview:/, ''))
const isRmd = computed(() => isRmdOrQmd(sourcePath.value))

// Knitting state
const knitting = ref(false)
const knittingProgress = ref('')
let knittedMarkdown = null  // Cache of last knitted output

// Debounced render
let renderTimer = null
const renderedHtml = ref('')

async function doRender() {
  let md = filesStore.fileContents[sourcePath.value]
  if (md === undefined) return

  // For .Rmd/.qmd: use knitted markdown if available, otherwise preprocess (strip {r} headers)
  if (isRmd.value) {
    if (knittedMarkdown) {
      md = knittedMarkdown
    } else {
      const { preprocessRmd } = await import('../../services/rmdKnit')
      md = preprocessRmd(md)
    }
  }

  const result = renderPreview(md, referencesStore, referencesStore.citationStyle)
  renderedHtml.value = result instanceof Promise ? await result : result
}

/**
 * Knit the .Rmd: execute all chunks and embed outputs in the preview.
 */
async function doKnit() {
  const md = filesStore.fileContents[sourcePath.value]
  if (!md) return

  knitting.value = true
  knittingProgress.value = ''
  try {
    const { knitRmd } = await import('../../services/rmdKnit')
    knittedMarkdown = await knitRmd(md, workspace.path, {
      onProgress: (idx, total) => { knittingProgress.value = `${idx + 1}/${total}` },
    })
    await doRender()
  } catch (e) {
    console.error('Knit failed:', e)
  } finally {
    knitting.value = false
    knittingProgress.value = ''
  }
}

watch(
  () => filesStore.fileContents[sourcePath.value],
  () => {
    // On edits, clear knitted cache (stale) and re-render preprocessed
    knittedMarkdown = null
    clearTimeout(renderTimer)
    renderTimer = setTimeout(doRender, 300)
  }
)

// Re-render when citation style changes
watch(() => referencesStore.citationStyle, doRender)

onMounted(async () => {
  // Ensure content is loaded
  let content = filesStore.fileContents[sourcePath.value]
  if (content === undefined) {
    content = await filesStore.readFile(sourcePath.value)
  }

  if (isRmd.value) {
    // For .Rmd: auto-knit on open (execute chunks, show outputs)
    await doKnit()
  } else {
    doRender()
  }
})

function handleClick(e) {
  // Wiki link navigation
  const wikiLink = e.target.closest('.md-preview-wikilink')
  if (wikiLink) {
    const target = wikiLink.dataset.target
    if (target) {
      const resolved = linksStore.resolveLink(target, sourcePath.value)
      if (resolved) {
        editorStore.openFile(resolved.path)
      }
    }
    e.preventDefault()
    return
  }

  // Citation click → open reference detail
  const citation = e.target.closest('.md-preview-citation')
  if (citation) {
    const keys = citation.dataset.keys?.split(',')
    if (keys?.[0]) {
      referencesStore.activeKey = keys[0]
      editorStore.openFile(`ref:@${keys[0]}`)
    }
    e.preventDefault()
    return
  }
}
</script>

<style scoped>
.md-preview-container {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
  background: var(--bg-primary);
  color: var(--fg-primary);
}

.md-preview-content {
  max-width: 800px;
  margin: 0 auto;
  line-height: 1.7;
  font-family: 'Geist', var(--font-sans);
  font-size: var(--editor-font-size, 14px);
}

.md-preview-knitting {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  margin-bottom: 12px;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  font-size: 12px;
  color: var(--fg-muted);
  background: var(--bg-secondary);
  border-radius: 6px;
  border: 1px solid var(--border);
}
.md-preview-knitting-dots {
  display: flex;
  gap: 3px;
}
</style>

<style>
/* Prose styles for markdown preview — must be global to reach v-html content */
.md-preview-content h1,
.md-preview-content h2,
.md-preview-content h3,
.md-preview-content h4,
.md-preview-content h5,
.md-preview-content h6 {
  color: var(--hl-heading, var(--fg-primary));
  font-family: var(--font-sans, system-ui, sans-serif);
  margin: 1.5em 0 0.5em;
  line-height: 1.3;
}
.md-preview-content h1 { font-size: 2em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
.md-preview-content h2 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.2em; }
.md-preview-content h3 { font-size: 1.25em; }
.md-preview-content h4 { font-size: 1.1em; }

.md-preview-content p {
  margin: 0.8em 0;
}

.md-preview-content a {
  color: var(--accent);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.md-preview-content a:hover {
  opacity: 0.8;
}

.md-preview-content strong {
  font-weight: 700;
  color: var(--fg-primary);
}

.md-preview-content em {
  font-style: italic;
}

.md-preview-content del {
  text-decoration: line-through;
  opacity: 0.6;
}

.md-preview-content code {
  font-family: var(--font-mono, 'SF Mono', 'Fira Code', monospace);
  font-size: 0.9em;
  padding: 0.15em 0.4em;
  border-radius: 3px;
  background: var(--bg-secondary);
  color: var(--hl-string, #e9967a);
}

.md-preview-content pre {
  margin: 1em 0;
  padding: 12px 16px;
  border-radius: 6px;
  background: var(--bg-secondary);
  overflow-x: auto;
  border: 1px solid var(--border);
}
.md-preview-content pre code {
  padding: 0;
  background: none;
  font-size: 0.85em;
  color: var(--fg-primary);
}

.md-preview-content blockquote {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 3px solid var(--accent);
  background: var(--bg-secondary);
  border-radius: 0 4px 4px 0;
  color: var(--fg-secondary, var(--fg-muted));
}
.md-preview-content blockquote p {
  margin: 0.4em 0;
}

.md-preview-content ul,
.md-preview-content ol {
  padding-left: 1.5em;
  margin: 0.8em 0;
}
.md-preview-content li {
  margin: 0.25em 0;
}
.md-preview-content li > p {
  margin: 0.4em 0;
}

.md-preview-content hr {
  border: none;
  border-top: 1px solid var(--border);
  margin: 2em 0;
}

.md-preview-content table {
  border-collapse: collapse;
  width: 100%;
  margin: 1em 0;
}
.md-preview-content th,
.md-preview-content td {
  border: 1px solid var(--border);
  padding: 6px 12px;
  text-align: left;
}
.md-preview-content th {
  background: var(--bg-secondary);
  font-weight: 600;
}

.md-preview-content img {
  max-width: 100%;
  border-radius: 4px;
  margin: 1em 0;
}

/* Wiki links */
.md-preview-content .md-preview-wikilink {
  color: var(--accent);
  cursor: pointer;
  text-decoration: none;
  border-bottom: 1px dashed var(--accent);
}
.md-preview-content .md-preview-wikilink:hover {
  opacity: 0.8;
}

/* Citations */
.md-preview-content .md-preview-citation {
  color: var(--accent);
  cursor: pointer;
  font-style: italic;
}
.md-preview-content .md-preview-citation:hover {
  text-decoration: underline;
}

/* Footnotes */
.md-preview-content .footnotes {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid var(--border);
  font-size: 0.9em;
}

/* Highlight.js theme mapping — uses existing editor CSS vars */
.md-preview-content .hljs { color: var(--fg-primary); }
.md-preview-content .hljs-keyword { color: var(--hl-keyword, #c678dd); }
.md-preview-content .hljs-string { color: var(--hl-string, #e9967a); }
.md-preview-content .hljs-number { color: var(--hl-number, #d19a66); }
.md-preview-content .hljs-comment { color: var(--hl-comment, #5c6370); font-style: italic; }
.md-preview-content .hljs-function { color: var(--hl-function, #61afef); }
.md-preview-content .hljs-title { color: var(--hl-function, #61afef); }
.md-preview-content .hljs-title.function_ { color: var(--hl-function, #61afef); }
.md-preview-content .hljs-params { color: var(--hl-variable, #e06c75); }
.md-preview-content .hljs-type { color: var(--hl-type, #e5c07b); }
.md-preview-content .hljs-built_in { color: var(--hl-builtin, #56b6c2); }
.md-preview-content .hljs-literal { color: var(--hl-constant, #d19a66); }
.md-preview-content .hljs-attr { color: var(--hl-property, #d19a66); }
.md-preview-content .hljs-attribute { color: var(--hl-property, #d19a66); }
.md-preview-content .hljs-selector-tag { color: var(--hl-keyword, #c678dd); }
.md-preview-content .hljs-selector-class { color: var(--hl-type, #e5c07b); }
.md-preview-content .hljs-meta { color: var(--hl-meta, #abb2bf); }
.md-preview-content .hljs-variable { color: var(--hl-variable, #e06c75); }
.md-preview-content .hljs-name { color: var(--hl-tag, #e06c75); }
.md-preview-content .hljs-tag { color: var(--fg-muted); }
.md-preview-content .hljs-deletion { color: var(--error, #e06c75); }
.md-preview-content .hljs-addition { color: var(--success, #98c379); }

/* KaTeX styles */
.md-preview-content .katex-display {
  margin: 1em 0;
  overflow-x: auto;
  overflow-y: hidden;
}
.md-preview-content .katex {
  font-size: 1.1em;
}

/* Task list checkboxes */
.md-preview-content input[type="checkbox"] {
  margin-right: 6px;
  accent-color: var(--accent);
}
</style>
