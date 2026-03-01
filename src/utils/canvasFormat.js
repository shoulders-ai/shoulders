/**
 * Canvas file format: parse, serialize, validate, and migrate .canvas JSON.
 */

const CURRENT_VERSION = 1

const DEFAULT_CANVAS = {
  version: CURRENT_VERSION,
  viewport: { x: 0, y: 0, zoom: 1 },
  nodes: [],
  edges: [],
  aiState: { messages: {} },
}

const DEFAULT_TEXT_DATA = {
  content: '',
  title: null,
  color: null,
  borderWidth: 'thin',
  fontSize: 'medium',
  aiGenerated: false,
}

const DEFAULT_PROMPT_DATA = {
  content: '',
  title: null,
  modelId: null,
  runCount: 0,
}

const DEFAULT_FILE_DATA = {
  filePath: '',
  preview: '',
}

const DEFAULT_LABEL_DATA = {
  content: '',
  fontSize: 'large',
  color: null,
  textAlign: 'left',
}

const DEFAULT_GROUP_DATA = {
  title: 'Group',
  color: null,
}

/**
 * Parse a .canvas JSON string into a validated object with defaults applied.
 */
export function parseCanvas(jsonString) {
  if (!jsonString || !jsonString.trim()) {
    return structuredClone(DEFAULT_CANVAS)
  }

  let data
  try {
    data = JSON.parse(jsonString)
  } catch {
    return structuredClone(DEFAULT_CANVAS)
  }

  // Version migration (future-proof)
  if (data.version && data.version > CURRENT_VERSION) {
    console.warn(`Canvas version ${data.version} is newer than supported (${CURRENT_VERSION})`)
  }

  const canvas = {
    version: data.version || CURRENT_VERSION,
    viewport: {
      x: data.viewport?.x ?? 0,
      y: data.viewport?.y ?? 0,
      zoom: data.viewport?.zoom ?? 1,
    },
    nodes: [],
    edges: [],
    aiState: { messages: data.aiState?.messages || {} },
  }

  // Validate and normalize nodes
  if (Array.isArray(data.nodes)) {
    for (const node of data.nodes) {
      if (!node.id || !node.type) continue

      const normalized = {
        id: node.id,
        type: node.type,
        position: {
          x: node.position?.x ?? 0,
          y: node.position?.y ?? 0,
        },
        dimensions: {
          width: node.dimensions?.width ?? null,
          height: node.dimensions?.height ?? null,
        },
        data: {},
      }

      // Apply type-specific defaults
      if (node.type === 'text') {
        normalized.data = { ...DEFAULT_TEXT_DATA, ...node.data }
      } else if (node.type === 'prompt') {
        normalized.data = { ...DEFAULT_PROMPT_DATA, ...node.data }
      } else if (node.type === 'file') {
        normalized.data = { ...DEFAULT_FILE_DATA, ...node.data }
      } else if (node.type === 'label') {
        normalized.data = { ...DEFAULT_LABEL_DATA, ...node.data }
      } else if (node.type === 'group') {
        normalized.data = { ...DEFAULT_GROUP_DATA, ...node.data }
      } else {
        normalized.data = node.data || {}
      }

      canvas.nodes.push(normalized)
    }
  }

  // Validate and normalize edges
  if (Array.isArray(data.edges)) {
    for (const edge of data.edges) {
      if (!edge.id || !edge.source || !edge.target) continue
      canvas.edges.push({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edge.type || 'smoothstep',
      })
    }
  }

  return canvas
}

/**
 * Serialize canvas state to a JSON string for disk persistence.
 */
export function serializeCanvas(nodes, edges, viewport, aiState) {
  const data = {
    version: CURRENT_VERSION,
    viewport: {
      x: viewport?.x ?? 0,
      y: viewport?.y ?? 0,
      zoom: viewport?.zoom ?? 1,
    },
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: { x: n.position.x, y: n.position.y },
      dimensions: {
        width: n.dimensions?.width ?? n.style?.width ?? null,
        height: n.dimensions?.height ?? n.style?.height ?? null,
      },
      data: { ...n.data },
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || 'smoothstep',
    })),
    aiState: aiState || { messages: {} },
  }

  return JSON.stringify(data, null, 2) + '\n'
}
