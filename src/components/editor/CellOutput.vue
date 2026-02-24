<template>
  <div class="cell-output" v-if="outputs && outputs.length > 0">
    <div v-for="(output, i) in outputs" :key="i" class="output-item">
      <!-- stream (stdout/stderr) -->
      <pre v-if="output.output_type === 'stream'"
        class="output-stream"
        :class="output.name === 'stderr' ? 'output-stderr' : 'output-stdout'"
        v-html="ansiToHtml(joinText(output.text))"></pre>

      <!-- display_data / execute_result -->
      <template v-else-if="output.output_type === 'display_data' || output.output_type === 'execute_result'">
        <!-- HTML output -->
        <div v-if="hasData(output, 'text/html')"
          class="output-html"
          v-html="DOMPurify.sanitize(joinText(output.data['text/html']))"></div>
        <!-- PNG image -->
        <img v-else-if="hasData(output, 'image/png')"
          :src="'data:image/png;base64,' + joinText(output.data['image/png']).trim()"
          class="output-image" />
        <!-- SVG image -->
        <div v-else-if="hasData(output, 'image/svg+xml')"
          class="output-svg"
          v-html="DOMPurify.sanitize(joinText(output.data['image/svg+xml']))"></div>
        <!-- JPEG image -->
        <img v-else-if="hasData(output, 'image/jpeg')"
          :src="'data:image/jpeg;base64,' + joinText(output.data['image/jpeg']).trim()"
          class="output-image" />
        <!-- LaTeX (rendered as text for now) -->
        <pre v-else-if="hasData(output, 'text/latex')"
          class="output-stream output-stdout">{{ joinText(output.data['text/latex']) }}</pre>
        <!-- Plain text fallback -->
        <pre v-else-if="hasData(output, 'text/plain')"
          class="output-stream output-stdout">{{ joinText(output.data['text/plain']) }}</pre>
      </template>

      <!-- error -->
      <pre v-else-if="output.output_type === 'error'"
        class="output-error"
        v-html="formatError(output)"></pre>
    </div>
  </div>
</template>

<script setup>
import DOMPurify from 'dompurify'

defineProps({
  outputs: { type: Array, default: () => [] },
})

function joinText(val) {
  if (!val) return ''
  return Array.isArray(val) ? val.join('') : String(val)
}

function hasData(output, mimeType) {
  return output.data && output.data[mimeType] != null
}

function formatError(output) {
  if (output.traceback && output.traceback.length > 0) {
    return ansiToHtml(output.traceback.join('\n'))
  }
  const name = output.ename || 'Error'
  const value = output.evalue || ''
  return `<span class="error-name">${escapeHtml(name)}</span>: ${escapeHtml(value)}`
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Convert ANSI escape codes to HTML spans.
 * Handles standard 16 colors + bold/italic/underline + reset.
 */
function ansiToHtml(text) {
  if (!text) return ''
  const escaped = escapeHtml(text)

  // ANSI color map (foreground)
  const fgColors = {
    30: '#545454', 31: '#ff5555', 32: '#50fa7b', 33: '#f1fa8c',
    34: '#bd93f9', 35: '#ff79c6', 36: '#8be9fd', 37: '#f8f8f2',
    90: '#6272a4', 91: '#ff6e6e', 92: '#69ff94', 93: '#ffffa5',
    94: '#d6acff', 95: '#ff92df', 96: '#a4ffff', 97: '#ffffff',
  }

  let result = ''
  let openSpans = 0
  const parts = escaped.split(/\x1b\[/)

  for (let i = 0; i < parts.length; i++) {
    if (i === 0) {
      result += parts[i]
      continue
    }

    const mIdx = parts[i].indexOf('m')
    if (mIdx === -1) {
      result += parts[i]
      continue
    }

    const codes = parts[i].slice(0, mIdx).split(';').map(Number)
    const rest = parts[i].slice(mIdx + 1)

    let styles = []
    for (const code of codes) {
      if (code === 0) {
        // Reset
        while (openSpans > 0) { result += '</span>'; openSpans-- }
      } else if (code === 1) {
        styles.push('font-weight:bold')
      } else if (code === 3) {
        styles.push('font-style:italic')
      } else if (code === 4) {
        styles.push('text-decoration:underline')
      } else if (fgColors[code]) {
        styles.push(`color:${fgColors[code]}`)
      }
    }

    if (styles.length > 0) {
      result += `<span style="${styles.join(';')}">`
      openSpans++
    }
    result += rest
  }

  while (openSpans > 0) { result += '</span>'; openSpans-- }
  return result
}
</script>

<style scoped>
.cell-output {
  border-top: 1px solid var(--border);
  padding: 6px 0 2px 0;
  font-size: 13px;
  overflow-x: auto;
}

.output-item + .output-item {
  margin-top: 4px;
}

.output-stream {
  margin: 0;
  padding: 4px 8px;
  font-family: var(--font-mono, 'SF Mono', 'Menlo', monospace);
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--fg-primary);
}

.output-stderr {
  color: var(--error, #ff5555);
  background: rgba(255, 85, 85, 0.05);
}

.output-error {
  margin: 0;
  padding: 6px 8px;
  font-family: var(--font-mono, 'SF Mono', 'Menlo', monospace);
  font-size: 12px;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-all;
  background: rgba(255, 85, 85, 0.06);
  border-left: 3px solid var(--error, #ff5555);
  color: var(--fg-primary);
}

.output-error :deep(.error-name) {
  color: var(--error, #ff5555);
  font-weight: bold;
}

.output-html {
  padding: 4px 8px;
  overflow-x: auto;
  color: var(--fg-primary);
}

.output-html :deep(table) {
  border-collapse: collapse;
  font-size: 12px;
}

.output-html :deep(th),
.output-html :deep(td) {
  border: 1px solid var(--border);
  padding: 3px 8px;
  text-align: left;
}

.output-html :deep(th) {
  background: var(--bg-secondary);
  font-weight: 600;
}

.output-image {
  max-width: 100%;
  height: auto;
  padding: 4px 8px;
  background: white;
  border-radius: 4px;
}

.output-svg {
  padding: 4px 8px;
  overflow-x: auto;
}

.output-svg :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
