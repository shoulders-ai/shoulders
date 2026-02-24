/**
 * Citation Style Registry — dispatch layer.
 *
 * Provides a unified API for all citation formatting. For the 5 handwritten
 * styles (APA, Chicago, IEEE, Harvard, Vancouver), returns instant sync
 * formatters from citationFormatter.js. For everything else, lazy-loads
 * citeproc-js and the .csl XML file.
 */

import {
  formatReference as fastFormatReference,
  formatInlineCitation as fastFormatInline,
  formatBibliography as fastFormatBib,
} from './citationFormatter'

// --- Built-in style catalogue ---

const BUILTIN_STYLES = [
  // Fast-path (handwritten, zero deps)
  { id: 'apa', name: 'APA 7th Edition', category: 'Author-date', fast: true },
  { id: 'chicago', name: 'Chicago Author-Date', category: 'Author-date', fast: true },
  { id: 'harvard', name: 'Harvard', category: 'Author-date', fast: true },
  { id: 'ieee', name: 'IEEE', category: 'Numeric', fast: true },
  { id: 'vancouver', name: 'Vancouver', category: 'Numeric', fast: true },

  // CSL-driven (lazy-loaded via citeproc-js)
  { id: 'apa-6th-edition', name: 'APA 6th Edition', category: 'Author-date', fast: false },
  { id: 'american-sociological-association', name: 'American Sociological Association', category: 'Author-date', fast: false },
  { id: 'chicago-note-bibliography', name: 'Chicago Notes & Bibliography', category: 'Note', fast: false },
  { id: 'modern-language-association', name: 'MLA 9th Edition', category: 'Note', fast: false },
  // Turabian ≈ Chicago Notes, JAMA ≈ AMA — dependent styles, use parent directly
  { id: 'nature', name: 'Nature', category: 'Numeric', fast: false },
  { id: 'science', name: 'Science', category: 'Numeric', fast: false },
  { id: 'cell', name: 'Cell', category: 'Numeric', fast: false },
  { id: 'plos-one', name: 'PLOS ONE', category: 'Numeric', fast: false },
  { id: 'springer-lecture-notes-in-computer-science', name: 'Springer LNCS', category: 'Numeric', fast: false },
  { id: 'american-chemical-society', name: 'ACS', category: 'Numeric', fast: false },
  { id: 'american-medical-association', name: 'AMA', category: 'Numeric', fast: false },
  { id: 'annual-reviews', name: 'Annual Reviews', category: 'Numeric', fast: false },
  { id: 'royal-society-of-chemistry', name: 'Royal Society of Chemistry', category: 'Numeric', fast: false },
  { id: 'elsevier-with-titles', name: 'Elsevier (with titles)', category: 'Numeric', fast: false },
  { id: 'elsevier-harvard', name: 'Elsevier Harvard', category: 'Author-date', fast: false },
  { id: 'harvard-cite-them-right', name: 'Harvard Cite Them Right', category: 'Author-date', fast: false },
  { id: 'the-lancet', name: 'The Lancet', category: 'Numeric', fast: false },
  { id: 'bmj', name: 'BMJ', category: 'Numeric', fast: false },
  { id: 'proceedings-of-the-national-academy-of-sciences', name: 'PNAS', category: 'Numeric', fast: false },
  { id: 'american-institute-of-physics', name: 'AIP', category: 'Numeric', fast: false },
  { id: 'american-mathematical-society', name: 'AMS', category: 'Numeric', fast: false },
  { id: 'din-1505-2', name: 'DIN 1505-2', category: 'Author-date', fast: false },
  { id: 'china-national-standard-gb-t-7714-2015-author-date', name: 'GB/T 7714-2015 (Author-date)', category: 'Author-date', fast: false },
  { id: 'china-national-standard-gb-t-7714-2015-numeric', name: 'GB/T 7714-2015 (Numeric)', category: 'Numeric', fast: false },
  { id: 'oscola', name: 'OSCOLA', category: 'Note', fast: false },
  { id: 'bluebook-law-review', name: 'Bluebook', category: 'Note', fast: false },
  { id: 'modern-humanities-research-association', name: 'MHRA', category: 'Note', fast: false },
]

// User-added styles (loaded from .project/styles/)
let userStyles = []

/**
 * Get all available styles (built-in + user).
 */
export function getAvailableStyles() {
  return [...BUILTIN_STYLES, ...userStyles]
}

/**
 * Find a style by ID.
 */
export function getStyleInfo(id) {
  return BUILTIN_STYLES.find(s => s.id === id) || userStyles.find(s => s.id === id) || null
}

/**
 * Register user-added styles (called from workspace init).
 */
export function setUserStyles(styles) {
  userStyles = styles.map(s => ({ ...s, fast: false, isCustom: true }))
}

/**
 * Get a formatter for a given style ID.
 * For fast-path styles, returns sync functions.
 * For CSL styles, returns async wrapper that lazy-loads citeproc-js.
 *
 * @returns {{ formatReference, formatInlineCitation, formatBibliography, isAsync: boolean }}
 */
export function getFormatter(styleId) {
  const info = getStyleInfo(styleId)

  // Fast path: built-in handwritten styles
  if (!info || info.fast) {
    const id = info?.id || styleId
    return {
      formatReference: (csl, num) => fastFormatReference(csl, id, num),
      formatInlineCitation: (csl, num) => fastFormatInline(csl, id, num),
      formatBibliography: (cslArray) => fastFormatBib(cslArray, id),
      isAsync: false,
    }
  }

  // CSL path: lazy-load citeproc-js
  return {
    formatReference: async (csl, num) => {
      const { formatWithCSL } = await import('./citationFormatterCSL')
      return formatWithCSL(styleId, 'reference', [csl], num)
    },
    formatInlineCitation: async (csl, num) => {
      const { formatWithCSL } = await import('./citationFormatterCSL')
      return formatWithCSL(styleId, 'inline', [csl], num)
    },
    formatBibliography: async (cslArray) => {
      const { formatWithCSL } = await import('./citationFormatterCSL')
      return formatWithCSL(styleId, 'bibliography', cslArray)
    },
    isAsync: true,
  }
}

/**
 * Get the display name for a style ID.
 */
export function getStyleName(id) {
  const info = getStyleInfo(id)
  return info?.name || id
}

/**
 * Check whether a style uses the fast path (sync, no citeproc-js).
 */
export function isFastPath(id) {
  const info = getStyleInfo(id)
  return !info || info.fast
}
