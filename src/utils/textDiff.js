/**
 * Compute the minimal change between two strings by finding common prefix and suffix.
 * Returns a CodeMirror-compatible change object { from, to, insert } or null if identical.
 */
export function computeMinimalChange(oldText, newText) {
  if (oldText === newText) return null

  const minLen = Math.min(oldText.length, newText.length)
  let prefixLen = 0
  while (prefixLen < minLen && oldText.charCodeAt(prefixLen) === newText.charCodeAt(prefixLen)) {
    prefixLen++
  }

  let suffixLen = 0
  const maxSuffix = minLen - prefixLen
  while (
    suffixLen < maxSuffix &&
    oldText.charCodeAt(oldText.length - 1 - suffixLen) === newText.charCodeAt(newText.length - 1 - suffixLen)
  ) {
    suffixLen++
  }

  return {
    from: prefixLen,
    to: oldText.length - suffixLen,
    insert: newText.slice(prefixLen, newText.length - suffixLen),
  }
}
