/**
 * Editor state persistence: save/restore pane tree to .shoulders/editor-state.json
 *
 * Optimistic restore: sets the pane tree immediately for instant UI, then validates
 * tabs in parallel and prunes invalid ones after the fact.
 */
import { invoke } from '@tauri-apps/api/core'
import { isChatTab, getChatSessionId, isReferencePath, referenceKeyFromPath, isPreviewPath } from '../utils/fileTypes'

const STATE_FILE = 'editor-state.json'
const STATE_VERSION = 1

/**
 * Recursively serialize a pane tree to a plain JSON-safe object.
 */
function serializePaneTree(node) {
  if (!node) return null
  if (node.type === 'leaf') {
    const tabs = (node.tabs || []).filter(t => t && typeof t === 'string')
    return { type: 'leaf', id: node.id, tabs, activeTab: node.activeTab || null }
  }
  if (node.type === 'split' && Array.isArray(node.children)) {
    const children = node.children.map(c => serializePaneTree(c)).filter(Boolean)
    if (children.length < 2) return children[0] || null
    return { type: 'split', direction: node.direction, ratio: node.ratio, children }
  }
  return null
}

/**
 * Save the pane tree + active pane to disk.
 */
export async function saveState(shouldersDir, paneTree, activePaneId) {
  if (!shouldersDir) return
  try {
    const state = {
      version: STATE_VERSION,
      paneTree: serializePaneTree(paneTree),
      activePaneId,
    }
    await invoke('write_file', {
      path: `${shouldersDir}/${STATE_FILE}`,
      content: JSON.stringify(state, null, 2),
    })
  } catch (e) {
    console.error('[editorPersistence] Failed to save:', e)
  }
}

/**
 * Load raw state from disk. Returns null if file missing/corrupt.
 */
export async function loadState(shouldersDir) {
  if (!shouldersDir) return null
  try {
    const filePath = `${shouldersDir}/${STATE_FILE}`
    const exists = await invoke('path_exists', { path: filePath })
    if (!exists) return null

    const content = await invoke('read_file', { path: filePath })
    const state = JSON.parse(content)
    if (!state || state.version !== STATE_VERSION || !state.paneTree) return null
    return state
  } catch (e) {
    console.error('[editorPersistence] Failed to load:', e)
    return null
  }
}

/**
 * Collect all tab paths from a pane tree.
 */
function collectAllTabs(node) {
  if (!node) return []
  if (node.type === 'leaf') return [...(node.tabs || [])]
  if (node.type === 'split' && Array.isArray(node.children)) {
    return node.children.flatMap(c => collectAllTabs(c))
  }
  return []
}

/**
 * Validate all tabs in parallel. Returns a Set of invalid tab paths.
 */
export async function findInvalidTabs(shouldersDir, paneTree) {
  const allTabs = collectAllTabs(paneTree)
  if (allTabs.length === 0) return new Set()

  const results = await Promise.all(
    allTabs.map(async (tab) => {
      const valid = await isTabValid(tab, shouldersDir)
      return { tab, valid }
    })
  )

  const invalid = new Set()
  for (const { tab, valid } of results) {
    if (!valid) invalid.add(tab)
  }
  return invalid
}

/**
 * Check if a single tab path points to something that still exists.
 */
async function isTabValid(tab, shouldersDir) {
  if (!tab || typeof tab !== 'string') return false

  // Chat tabs: check if session file exists on disk
  if (isChatTab(tab)) {
    const sessionId = getChatSessionId(tab)
    if (!sessionId || !shouldersDir) return false
    try {
      return await invoke('path_exists', { path: `${shouldersDir}/chats/${sessionId}.json` })
    } catch { return false }
  }

  // Reference tabs: check if key exists in loaded library
  if (isReferencePath(tab)) {
    const key = referenceKeyFromPath(tab)
    if (!key) return false
    try {
      const { useReferencesStore } = await import('../stores/references')
      return useReferencesStore().getByKey(key) !== null
    } catch { return false }
  }

  // Preview tabs: validate the underlying file path
  if (isPreviewPath(tab)) {
    const underlyingPath = tab.slice(8) // strip 'preview:'
    if (!underlyingPath) return false
    try {
      return await invoke('path_exists', { path: underlyingPath })
    } catch { return false }
  }

  // Regular file paths: check existence on disk
  try {
    return await invoke('path_exists', { path: tab })
  } catch { return false }
}
