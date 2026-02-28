/**
 * Canvas AI context assembly.
 *
 * Walks the directed graph (edges: source→target) backward from a prompt node
 * to the root, assembling conversation history for the API.
 */

/**
 * Walk edges backward from nodeId to roots, returning the ordered path.
 * Returns an array of node objects from root to the given node.
 */
export function collectDagPath(nodeId, nodes, edges) {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  // Build reverse adjacency: target → [source1, source2, ...]
  const reverseAdj = new Map()
  for (const edge of edges) {
    if (!reverseAdj.has(edge.target)) reverseAdj.set(edge.target, [])
    reverseAdj.get(edge.target).push(edge.source)
  }

  // BFS backward to collect all ancestors, then topologically sort
  const visited = new Set()
  const queue = [nodeId]
  const pathIds = []

  while (queue.length > 0) {
    const current = queue.shift()
    if (visited.has(current)) continue
    visited.add(current)
    pathIds.push(current)

    const parents = reverseAdj.get(current) || []
    for (const parentId of parents) {
      if (!visited.has(parentId)) {
        queue.push(parentId)
      }
    }
  }

  // Reverse to get root-first order
  pathIds.reverse()

  // Convert to node objects
  return pathIds.map(id => nodeMap.get(id)).filter(Boolean)
}

/**
 * Build API messages array from a DAG path.
 * Text nodes → user or assistant messages based on aiGenerated flag.
 * Prompt nodes → user messages.
 * File nodes → user messages with file content reference.
 */
export function buildApiMessagesFromDag(pathNodes, allNodes, aiState) {
  const messages = []

  for (const node of pathNodes) {
    if (node.type === 'text') {
      if (!node.data.content) continue

      // Check aiState first, then fall back to node data
      const stateMsg = aiState?.messages?.[node.id]
      if (stateMsg) {
        messages.push({
          role: stateMsg.role,
          content: stateMsg.content,
        })
      } else if (node.data.aiGenerated) {
        messages.push({
          role: 'assistant',
          content: node.data.content,
        })
      } else {
        messages.push({
          role: 'user',
          content: node.data.content,
        })
      }
    } else if (node.type === 'prompt') {
      if (!node.data.content) continue
      messages.push({
        role: 'user',
        content: node.data.content,
      })
    } else if (node.type === 'file') {
      if (!node.data.filePath) continue
      const preview = node.data.preview || node.data.filePath
      messages.push({
        role: 'user',
        content: `[File: ${node.data.filePath}]\n${preview}`,
      })
    }
  }

  // Ensure messages alternate properly (user/assistant/user/...)
  // Merge consecutive same-role messages
  const merged = []
  for (const msg of messages) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].content += '\n\n' + msg.content
    } else {
      merged.push({ ...msg })
    }
  }

  // Ensure first message is 'user' (required by most APIs)
  if (merged.length > 0 && merged[0].role !== 'user') {
    merged.unshift({ role: 'user', content: '(Context from canvas)' })
  }

  return merged
}

/**
 * Build a compact text summary of the full graph structure.
 * Gives AI awareness of what else exists on the canvas.
 */
export function buildGraphSummary(nodes, edges) {
  if (nodes.length === 0) return ''

  const lines = [`The canvas has ${nodes.length} nodes and ${edges.length} connections.`]

  // Group by type
  const textNodes = nodes.filter(n => n.type === 'text')
  const promptNodes = nodes.filter(n => n.type === 'prompt')
  const fileNodes = nodes.filter(n => n.type === 'file')

  if (textNodes.length > 0) {
    lines.push(`\nText nodes (${textNodes.length}):`)
    for (const n of textNodes.slice(0, 20)) {
      const title = n.data.title || n.data.content?.slice(0, 60)?.replace(/\n/g, ' ') || '(empty)'
      const tag = n.data.aiGenerated ? ' [AI]' : ''
      lines.push(`- ${n.id}: "${title}"${tag}`)
    }
    if (textNodes.length > 20) lines.push(`  ... and ${textNodes.length - 20} more`)
  }

  if (promptNodes.length > 0) {
    lines.push(`\nPrompt nodes (${promptNodes.length}):`)
    for (const n of promptNodes.slice(0, 10)) {
      const q = n.data.content?.slice(0, 60)?.replace(/\n/g, ' ') || '(empty)'
      lines.push(`- ${n.id}: "${q}" (${n.data.runCount || 0} runs)`)
    }
  }

  if (fileNodes.length > 0) {
    lines.push(`\nFile references (${fileNodes.length}):`)
    for (const n of fileNodes) {
      lines.push(`- ${n.data.filePath}`)
    }
  }

  return lines.join('\n')
}

/**
 * Get the list of node IDs in the context path for a prompt node.
 * Used for visual highlighting.
 */
export function getContextPath(promptNodeId, nodes, edges) {
  const path = collectDagPath(promptNodeId, nodes, edges)
  return path.map(n => n.id)
}
