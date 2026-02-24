/** Extract cursor context for ghost suggestions */
export function extractCursorContext(state, maxBefore = 5000, maxAfter = 1000) {
  const { from } = state.selection
  const before = state.doc.textBetween(0, from, '\n', ' ')
  const after = state.doc.textBetween(from, state.doc.content.size, '\n', ' ')
  return { before: before.slice(-maxBefore), after: after.slice(0, maxAfter), pos: from }
}

/** Full document text for AI (chat tools, @file refs) */
export function extractDocumentText(state) {
  return state.doc.textBetween(0, state.doc.content.size, '\n', ' ')
}

/** Selected text */
export function extractSelection(state) {
  const { from, to, empty } = state.selection
  if (empty) return { text: '', from, to }
  return { text: state.doc.textBetween(from, to, '\n', ' '), from, to }
}

/**
 * Find exact text in a ProseMirror doc and return { from, to } positions.
 * Searches textblock by textblock — handles inline marks correctly.
 */
export function findTextInPmDoc(doc, searchText) {
  let result = null
  doc.descendants((node, pos) => {
    if (result) return false
    if (node.isTextblock) {
      const blockText = node.textContent
      const idx = blockText.indexOf(searchText)
      if (idx !== -1) {
        // pos+1 = start of block content; marks don't affect positions
        result = { from: pos + 1 + idx, to: pos + 1 + idx + searchText.length }
        return false
      }
    }
  })
  return result
}
