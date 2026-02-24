/**
 * Parse metadata from a CSL XML file.
 * Lightweight — uses DOMParser to extract a few fields from <info>.
 */

/**
 * Extract metadata from CSL XML string.
 * @param {string} xml - Raw CSL XML content
 * @returns {{ id: string, title: string, category: string|null }}
 */
export function parseCslMetadata(xml) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const info = doc.querySelector('info')
  const title = info?.querySelector('title')?.textContent?.trim() || 'Unknown Style'
  const id = info?.querySelector('id')?.textContent?.trim() || ''

  // Category: <category citation-format="author-date"/> or "numeric" or "note"
  const categoryEl = info?.querySelector('category[citation-format]')
  const citationFormat = categoryEl?.getAttribute('citation-format') || null

  // Map CSL citation-format values to display categories
  const categoryMap = {
    'author-date': 'Author-date',
    'numeric': 'Numeric',
    'note': 'Note',
    'author': 'Author',
    'label': 'Label',
  }

  return {
    id,
    title,
    category: categoryMap[citationFormat] || citationFormat,
  }
}

/**
 * Derive a short style ID from a CSL <id> URL or title.
 * e.g. "http://www.zotero.org/styles/nature" → "nature"
 */
export function deriveStyleId(cslId, title) {
  if (cslId) {
    const match = cslId.match(/\/([^/]+)$/)
    if (match) return match[1]
  }
  // Fallback: slugify the title
  return (title || 'custom')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
