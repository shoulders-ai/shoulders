import { keymap } from '@codemirror/view'

/**
 * Toggle wrapper characters around the selection (e.g., **bold**, *italic*).
 * If the selection already has the wrapper, remove it. Otherwise, add it.
 */
function toggleWrap(view, wrapper) {
  const { state } = view
  const { from, to } = state.selection.main
  const wLen = wrapper.length

  // Check if selection is already wrapped
  if (from >= wLen && to + wLen <= state.doc.length) {
    const before = state.doc.sliceString(from - wLen, from)
    const after = state.doc.sliceString(to, to + wLen)
    if (before === wrapper && after === wrapper) {
      // Remove wrapper
      view.dispatch({
        changes: [
          { from: from - wLen, to: from, insert: '' },
          { from: to, to: to + wLen, insert: '' },
        ],
        selection: { anchor: from - wLen, head: to - wLen },
      })
      return true
    }
  }

  // Add wrapper
  const selected = state.doc.sliceString(from, to)
  view.dispatch({
    changes: { from, to, insert: wrapper + selected + wrapper },
    selection: { anchor: from + wLen, head: to + wLen },
  })
  return true
}

/**
 * Toggle a line prefix (e.g., "> ", "- ", "1. ").
 */
function toggleLinePrefix(view, prefix) {
  const { state } = view
  const { from, to } = state.selection.main
  const startLine = state.doc.lineAt(from)
  const endLine = state.doc.lineAt(to)

  const changes = []
  let selShift = 0

  for (let lineNum = startLine.number; lineNum <= endLine.number; lineNum++) {
    const line = state.doc.line(lineNum)
    const text = line.text

    if (prefix === '1. ') {
      // Ordered list: check for any `N. ` prefix
      const olMatch = text.match(/^(\d+)\.\s/)
      if (olMatch) {
        changes.push({ from: line.from, to: line.from + olMatch[0].length, insert: '' })
        if (lineNum === startLine.number) selShift = -olMatch[0].length
      } else {
        const num = lineNum - startLine.number + 1
        const insert = `${num}. `
        changes.push({ from: line.from, to: line.from, insert })
        if (lineNum === startLine.number) selShift = insert.length
      }
    } else {
      if (text.startsWith(prefix)) {
        changes.push({ from: line.from, to: line.from + prefix.length, insert: '' })
        if (lineNum === startLine.number) selShift = -prefix.length
      } else {
        changes.push({ from: line.from, to: line.from, insert: prefix })
        if (lineNum === startLine.number) selShift = prefix.length
      }
    }
  }

  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: { anchor: from + selShift },
    })
  }
  return true
}

/**
 * Insert a markdown link around the selection.
 * If text is selected: [selected](url) with "url" selected for replacement.
 * If no selection: [](url) with cursor inside [].
 */
function insertLink(view) {
  const { state } = view
  const { from, to } = state.selection.main
  const selected = state.doc.sliceString(from, to)

  if (selected) {
    const insert = `[${selected}](url)`
    view.dispatch({
      changes: { from, to, insert },
      // Select "url" for easy replacement
      selection: { anchor: from + selected.length + 3, head: from + selected.length + 6 },
    })
  } else {
    const insert = '[](url)'
    view.dispatch({
      changes: { from, to: from, insert },
      // Place cursor inside [] for typing link text
      selection: { anchor: from + 1 },
    })
  }
  return true
}

/**
 * Markdown formatting keyboard shortcuts.
 */
export function markdownShortcuts() {
  return keymap.of([
    { key: 'Mod-b', run: (v) => toggleWrap(v, '**') },
    { key: 'Mod-i', run: (v) => toggleWrap(v, '*') },
    { key: 'Mod-Shift-x', run: (v) => toggleWrap(v, '~~') },
    { key: 'Mod-e', run: (v) => toggleWrap(v, '`') },
    { key: 'Mod-k', run: (v) => insertLink(v) },
    { key: 'Mod-Shift-.', run: (v) => toggleLinePrefix(v, '> ') },
    { key: 'Mod-Shift-7', run: (v) => toggleLinePrefix(v, '1. ') },
    { key: 'Mod-Shift-8', run: (v) => toggleLinePrefix(v, '- ') },
  ])
}
