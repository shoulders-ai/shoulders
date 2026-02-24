/**
 * .ipynb (nbformat v4) parse/serialize utilities.
 */

/**
 * Parse an .ipynb JSON string into a normalized structure.
 */
export function parseNotebook(jsonStr) {
  const nb = JSON.parse(jsonStr)
  const cells = (nb.cells || []).map((cell, index) => ({
    id: cell.id || `cell-${index}-${Date.now()}`,
    type: cell.cell_type || 'code',
    source: Array.isArray(cell.source) ? cell.source.join('') : (cell.source || ''),
    outputs: cell.outputs || [],
    executionCount: cell.execution_count ?? null,
    metadata: cell.metadata || {},
  }))

  return {
    cells,
    metadata: nb.metadata || {},
    nbformat: nb.nbformat || 4,
    nbformat_minor: nb.nbformat_minor || 5,
  }
}

/**
 * Serialize back to .ipynb JSON string.
 * Source is stored as array of lines (Jupyter convention).
 */
export function serializeNotebook(cells, metadata, nbformat = 4, nbformat_minor = 5) {
  const nb = {
    cells: cells.map(cell => {
      // Split source into lines preserving newlines (Jupyter convention)
      const lines = cell.source.split('\n')
      const sourceLines = lines.map((line, i) =>
        i < lines.length - 1 ? line + '\n' : line
      ).filter((line, i, arr) => !(i === arr.length - 1 && line === ''))

      const base = {
        id: cell.id,
        cell_type: cell.type,
        source: sourceLines,
        metadata: cell.metadata || {},
      }
      if (cell.type === 'code') {
        base.outputs = cell.outputs || []
        base.execution_count = cell.executionCount ?? null
      }
      return base
    }),
    metadata,
    nbformat,
    nbformat_minor,
  }
  return JSON.stringify(nb, null, 1) + '\n'
}

/**
 * Generate a cell ID.
 */
export function generateCellId() {
  return `cell-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Get the kernel language from notebook metadata.
 */
export function getNotebookLanguage(metadata) {
  return metadata?.kernelspec?.language ||
    metadata?.language_info?.name ||
    'python'
}

/**
 * Format notebook cells as readable text (for AI tools).
 */
export function formatNotebookAsText(cells, path) {
  const lines = [`Notebook: ${(path || '').split('/').pop()} (${cells.length} cells)`, '']

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const execLabel = cell.type === 'code' && cell.executionCount != null
      ? ` [${cell.executionCount}]`
      : ''
    lines.push(`--- Cell ${i} [${cell.type}]${execLabel} ---`)

    const source = cell.source.length > 500
      ? cell.source.slice(0, 500) + '\n...(truncated)'
      : cell.source
    lines.push(source)

    if (cell.outputs && cell.outputs.length > 0) {
      lines.push('Output:')
      for (const out of cell.outputs) {
        if (out.output_type === 'stream') {
          const text = Array.isArray(out.text) ? out.text.join('') : (out.text || '')
          lines.push(text.length > 300 ? text.slice(0, 300) + '...' : text)
        } else if (out.output_type === 'execute_result' || out.output_type === 'display_data') {
          const plain = out.data?.['text/plain']
          if (plain) {
            const text = Array.isArray(plain) ? plain.join('') : plain
            lines.push(text.length > 300 ? text.slice(0, 300) + '...' : text)
          } else if (out.data?.['text/html']) {
            lines.push('[HTML output]')
          } else if (out.data?.['image/png']) {
            lines.push('[Image output]')
          }
        } else if (out.output_type === 'error') {
          lines.push(`ERROR: ${out.ename || 'Error'}: ${out.evalue || ''}`)
          if (out.traceback?.length) {
            // Strip ANSI codes for text representation
            const tb = out.traceback.join('\n').replace(/\x1b\[[0-9;]*m/g, '')
            lines.push(tb.length > 500 ? tb.slice(0, 500) + '...' : tb)
          }
        }
      }
    }
    lines.push('')
  }
  return lines.join('\n')
}
