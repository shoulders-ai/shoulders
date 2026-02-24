/**
 * CSL citation formatter — lazy-loaded wrapper around citeproc-js.
 *
 * This module is only imported dynamically when a non-fast-path style is selected.
 * It loads citeproc-js (~500KB), the requested .csl file, and locale XML,
 * then formats citations/bibliographies via the CSL engine.
 */

// Cache CSL engine instances by style ID
const engineCache = new Map()

// Cache loaded CSL XML strings
const cslCache = new Map()

// Locale cache
let localeXml = null

/**
 * Load a CSL style XML. Tries bundled public/csl/ first,
 * then falls back to .project/styles/ for user-added styles.
 */
async function loadStyleXml(styleId) {
  if (cslCache.has(styleId)) return cslCache.get(styleId)

  // Try bundled styles first
  const url = `/csl/${styleId}.csl`
  const resp = await fetch(url)
  if (resp.ok) {
    const xml = await resp.text()
    cslCache.set(styleId, xml)
    return xml
  }

  // Fallback: try user styles in .project/styles/
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const { useWorkspaceStore } = await import('../stores/workspace')
    const workspace = useWorkspaceStore()
    if (workspace.projectDir) {
      const userPath = `${workspace.projectDir}/styles/${styleId}.csl`
      const xml = await invoke('read_file', { path: userPath })
      cslCache.set(styleId, xml)
      return xml
    }
  } catch { /* not found in user styles either */ }

  throw new Error(`CSL style not found: ${styleId}`)
}

/**
 * Load the en-GB locale XML (default locale).
 */
async function loadLocale() {
  if (localeXml) return localeXml
  const resp = await fetch('/csl/locales-en-GB.xml')
  if (!resp.ok) throw new Error('Failed to load CSL locale')
  localeXml = await resp.text()
  return localeXml
}

/**
 * Get or create a CSL.Engine for the given style.
 */
async function getEngine(styleId, items) {
  // Build item lookup
  const itemLookup = {}
  for (const item of items) {
    const id = item._key || item.id || `item-${Math.random().toString(36).slice(2)}`
    itemLookup[id] = { ...item, id }
  }

  const styleXml = await loadStyleXml(styleId)
  const locale = await loadLocale()
  const CSL = (await import('citeproc')).default || (await import('citeproc'))

  const sys = {
    retrieveLocale: () => locale,
    retrieveItem: (id) => itemLookup[id] || null,
  }

  const engine = new CSL.Engine(sys, styleXml, 'en-GB')
  engine.updateItems(Object.keys(itemLookup))
  return { engine, itemLookup }
}

/**
 * Format citations using citeproc-js.
 *
 * @param {string} styleId - CSL style identifier
 * @param {string} mode - 'reference' | 'inline' | 'bibliography'
 * @param {Array} cslItems - Array of CSL-JSON objects
 * @param {number} [num] - Citation number (for numbered styles in single-item mode)
 * @returns {string} Formatted text
 */
export async function formatWithCSL(styleId, mode, cslItems, num) {
  if (!cslItems || cslItems.length === 0) return ''

  try {
    const { engine, itemLookup } = await getEngine(styleId, cslItems)
    const ids = Object.keys(itemLookup)

    if (mode === 'bibliography') {
      const bibResult = engine.makeBibliography()
      if (!bibResult || !bibResult[1]) return ''
      // bibResult[1] is an array of formatted entries (HTML strings)
      // Strip HTML tags for plain text output
      return bibResult[1].map(entry => stripHtml(entry).trim()).join('\n\n')
    }

    if (mode === 'inline') {
      // Format a single inline citation
      const cite = engine.makeCitationCluster(ids.map(id => ({ id })))
      return stripHtml(cite)
    }

    if (mode === 'reference') {
      // Format a single bibliography entry
      const bibResult = engine.makeBibliography()
      if (!bibResult || !bibResult[1] || !bibResult[1][0]) return ''
      return stripHtml(bibResult[1][0]).trim()
    }
  } catch (e) {
    console.warn(`CSL formatting failed for style "${styleId}":`, e)
    // Fallback: return a basic representation
    const item = cslItems[0]
    if (!item) return ''
    const author = item.author?.[0]?.family || 'Unknown'
    const year = item.issued?.['date-parts']?.[0]?.[0] || 'n.d.'
    const title = item.title || ''
    return `${author} (${year}). ${title}.`
  }

  return ''
}

/**
 * Strip HTML tags from a string (citeproc outputs HTML).
 */
function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&#60;/g, '<')
    .replace(/&#62;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#38;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}
