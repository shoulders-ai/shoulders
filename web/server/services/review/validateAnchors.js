export function validateAnchors(comments, plainText) {
  const valid = []
  const invalid = []

  for (const comment of comments) {
    if (!comment.text_snippet) {
      invalid.push({ ...comment, reason: 'Missing text_snippet' })
      continue
    }

    const snippet = comment.text_snippet.trim()
    if (snippet.length < 5) {
      invalid.push({ ...comment, reason: 'Snippet too short (< 5 chars)' })
      continue
    }

    if (plainText.includes(snippet)) {
      valid.push(comment)
    } else {
      const normalizedText = plainText.replace(/\s+/g, ' ')
      const normalizedSnippet = snippet.replace(/\s+/g, ' ')
      if (normalizedText.includes(normalizedSnippet)) {
        valid.push({ ...comment, text_snippet: normalizedSnippet })
      } else {
        invalid.push({ ...comment, reason: 'Snippet not found in document' })
      }
    }
  }

  return { valid, invalid }
}
