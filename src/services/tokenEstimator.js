/**
 * Lightweight token estimation and conversation truncation.
 * Uses ~4 chars/token heuristic (good enough for budget awareness).
 */

export function estimateTokens(text) {
  if (!text) return 0
  if (typeof text !== 'string') text = JSON.stringify(text)
  return Math.ceil(text.length / 4)
}

export function estimateConversationTokens(system, apiMessages) {
  let total = estimateTokens(system)
  for (const msg of apiMessages) {
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content)
    } else if (Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (block.text) total += estimateTokens(block.text)
        if (block.content) total += estimateTokens(block.content)
        if (block.input) total += estimateTokens(JSON.stringify(block.input))
      }
    }
  }
  return total
}

/**
 * Sliding-window truncation: keeps first user message + last N messages.
 * Removes middle messages until under budget.
 */
export function truncateToFitBudget(apiMessages, maxTokens, system) {
  if (apiMessages.length <= 2) return apiMessages

  const systemTokens = estimateTokens(system)
  const budget = maxTokens - systemTokens

  // Keep first message (has workspace-meta) and try progressively removing from front
  let msgs = [...apiMessages]
  let est = estimateConversationTokens('', msgs)

  while (est > budget && msgs.length > 2) {
    // Remove second message (keep first, always keep last)
    msgs.splice(1, 1)
    est = estimateConversationTokens('', msgs)
  }

  return msgs
}
