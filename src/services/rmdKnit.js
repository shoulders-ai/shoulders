// Knits .Rmd/.qmd content → clean markdown with executed outputs embedded.
// Used by MarkdownPreview (HTML images) and PDF export (file images for Typst).

import { invoke } from '@tauri-apps/api/core'
import { ChunkKernelBridge } from './chunkKernelBridge'

const CHUNK_RE = /^```\{(r|python|julia)(?:[,\s].*?)?\}\s*$/i
const FENCE_END_RE = /^```\s*$/

function stripYaml(content) {
  if (!content.startsWith('---')) return { yaml: '', body: content }
  const endIdx = content.indexOf('\n---', 3)
  if (endIdx < 0) return { yaml: '', body: content }
  const yamlEnd = endIdx + 4
  return { yaml: content.substring(0, yamlEnd), body: content.substring(yamlEnd) }
}

export function preprocessRmd(content) {
  const { body } = stripYaml(content)
  return body.replace(/^```\{(r|python|julia)(?:[,\s].*?)?\}\s*$/gim, '```$1')
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Save base64 image to disk, return the file path.
 */
async function saveImage(b64, ext, imageDir, imageIdx) {
  const cleaned = b64.replace(/\s/g, '')
  const filename = `_chunk_img_${imageIdx}.${ext}`
  const path = `${imageDir}/${filename}`
  // Write base64 to a temp file, decode with shell
  const b64Path = `${path}.b64`
  await invoke('write_file', { path: b64Path, content: cleaned })
  await invoke('run_shell_command', {
    cwd: imageDir,
    command: `base64 -d < '${b64Path}' > '${path}' && rm '${b64Path}'`,
  })
  return { path, filename }
}

/**
 * Format output to markdown.
 * @param {object} output - nbformat output object
 * @param {string|null} imageDir - If set, save images to files (for Typst PDF)
 * @param {number} imageIdx - Counter for unique image filenames
 * @returns {Promise<{md: string, imageIdx: number}>}
 */
async function outputToMarkdown(output, imageDir, imageIdx) {
  const forPdf = !!imageDir

  if (output.output_type === 'stream') {
    const text = output.text?.trim()
    if (!text) return { md: '', imageIdx }
    if (output.name === 'stderr') {
      if (forPdf) {
        return { md: `\n\`\`\`\n${text}\n\`\`\`\n`, imageIdx }
      }
      return { md: `\n<pre style="color: var(--error); background: var(--bg-secondary); padding: 8px; border-radius: 4px; font-size: 0.85em;">${escapeHtml(text)}</pre>\n`, imageIdx }
    }
    return { md: `\n\`\`\`\n${text}\n\`\`\`\n`, imageIdx }
  }

  if (output.output_type === 'display_data' || output.output_type === 'execute_result') {
    const data = output.data || {}

    // PNG image
    if (data['image/png']) {
      if (imageDir) {
        const { filename } = await saveImage(data['image/png'], 'png', imageDir, imageIdx)
        return { md: `\n![output](${filename})\n`, imageIdx: imageIdx + 1 }
      }
      const b64 = (typeof data['image/png'] === 'string' ? data['image/png'] : '').replace(/\s/g, '')
      return { md: `\n<img src="data:image/png;base64,${b64}" style="max-width:100%">\n`, imageIdx }
    }

    // JPEG image
    if (data['image/jpeg']) {
      if (imageDir) {
        const { filename } = await saveImage(data['image/jpeg'], 'jpg', imageDir, imageIdx)
        return { md: `\n![output](${filename})\n`, imageIdx: imageIdx + 1 }
      }
      const b64 = (typeof data['image/jpeg'] === 'string' ? data['image/jpeg'] : '').replace(/\s/g, '')
      return { md: `\n<img src="data:image/jpeg;base64,${b64}" style="max-width:100%">\n`, imageIdx }
    }

    // SVG — save to file for PDF (Typst renders SVG natively), inline for preview
    if (data['image/svg+xml']) {
      if (forPdf) {
        const filename = `_chunk_img_${imageIdx}.svg`
        const path = `${imageDir}/${filename}`
        await invoke('write_file', { path, content: data['image/svg+xml'] })
        return { md: `\n![output](${filename})\n`, imageIdx: imageIdx + 1 }
      }
      return { md: `\n${data['image/svg+xml']}\n`, imageIdx }
    }

    // HTML — downgrade to text/plain for PDF (HTML is dropped by Typst), inline for preview
    if (data['text/html']) {
      if (forPdf && data['text/plain']) {
        const text = data['text/plain'].trim()
        return text ? { md: `\n\`\`\`\n${text}\n\`\`\`\n`, imageIdx } : { md: '', imageIdx }
      }
      if (forPdf) {
        return { md: '', imageIdx }
      }
      return { md: `\n${data['text/html']}\n`, imageIdx }
    }

    if (data['text/plain']) {
      const text = data['text/plain'].trim()
      if (text) return { md: `\n\`\`\`\n${text}\n\`\`\`\n`, imageIdx }
    }
    return { md: '', imageIdx }
  }

  if (output.output_type === 'error') {
    const msg = output.evalue || output.ename || 'Error'
    if (forPdf) {
      return { md: `\n\`\`\`\nError: ${msg}\n\`\`\`\n`, imageIdx }
    }
    return { md: `\n<pre style="color: var(--error); background: var(--bg-secondary); padding: 8px; border-radius: 4px; font-size: 0.85em;">Error: ${escapeHtml(msg)}</pre>\n`, imageIdx }
  }

  return { md: '', imageIdx }
}

/**
 * Knit .Rmd content: execute all chunks and produce clean markdown with outputs.
 * @param {string} content - Raw .Rmd file content
 * @param {string} workspacePath - Workspace root
 * @param {object} opts - Options
 * @param {function} opts.onProgress - Optional callback(chunkIndex, totalChunks)
 * @param {string} opts.imageDir - If set, save images to this directory (for PDF export)
 * @returns {Promise<string>} Clean markdown with outputs embedded
 */
export async function knitRmd(content, workspacePath, opts = {}) {
  const { onProgress, imageDir } = opts
  const { body } = stripYaml(content)
  const lines = body.split('\n')

  // Parse chunks
  const chunks = []
  let inChunk = false
  let current = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (!inChunk) {
      const match = CHUNK_RE.exec(line.trimEnd())
      if (match) {
        inChunk = true
        current = { language: match[1].toLowerCase(), headerIdx: i, contentLines: [], endIdx: null }
      }
    } else {
      if (FENCE_END_RE.test(line.trimEnd())) {
        current.endIdx = i
        chunks.push(current)
        inChunk = false
        current = null
      } else {
        current.contentLines.push(line)
      }
    }
  }

  const bridge = new ChunkKernelBridge(workspacePath)
  const result = []
  let lastEnd = 0
  let imageIdx = 0

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci]
    if (onProgress) onProgress(ci, chunks.length)

    for (let i = lastEnd; i < chunk.headerIdx; i++) {
      result.push(lines[i])
    }

    const code = chunk.contentLines.join('\n').trim()
    result.push('```' + chunk.language)
    result.push(...chunk.contentLines)
    result.push('```')

    if (code) {
      try {
        const output = await bridge.execute(code, chunk.language)
        if (output?.outputs) {
          for (const o of output.outputs) {
            const { md, imageIdx: newIdx } = await outputToMarkdown(o, imageDir, imageIdx)
            imageIdx = newIdx
            if (md) result.push(md)
          }
        }
      } catch (e) {
        result.push(`\n\`\`\`\nError: ${e.message || e}\n\`\`\`\n`)
      }
    }

    lastEnd = (chunk.endIdx ?? chunk.headerIdx) + 1
  }

  for (let i = lastEnd; i < lines.length; i++) {
    result.push(lines[i])
  }

  await bridge.shutdown()
  return result.join('\n')
}
