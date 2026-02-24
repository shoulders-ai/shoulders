/**
 * DOCX Citation Importer
 *
 * Two-phase process for importing Zotero citations from DOCX files:
 *
 * Phase 1 (pre-scan): Before SuperDoc loads, parse the DOCX ZIP and extract
 *   all Zotero citation metadata from field codes (ADDIN ZOTERO_ITEM).
 *
 * Phase 2 (post-process): After SuperDoc loads the document, scan the ProseMirror
 *   document for citation display text and replace with citation nodes.
 *
 * This approach requires ZERO modifications to SuperDoc's source code.
 */

import JSZip from 'jszip'
import { Extensions } from 'superdoc/super-editor'
import { formatInlineCitation, formatReference, formatReferenceRich, formatBibliography } from './citationFormatter'

const { Extension, Plugin, PluginKey } = Extensions
const citationGuardKey = new PluginKey('citationMarkGuard')

/**
 * Phase 1: Pre-scan a DOCX file for Zotero citation data.
 *
 * Parses the DOCX ZIP, reads word/document.xml, and extracts all
 * ADDIN ZOTERO_ITEM CSL_CITATION field code payloads.
 *
 * @param {ArrayBuffer|Uint8Array} docxData - Raw DOCX file bytes
 * @returns {Promise<{citations: Array, bibliography: Object|null, prefs: Object|null}>}
 *   citations: Array of { displayText, cslCitation } objects (document order)
 *   bibliography: ZOTERO_BIBL JSON (or null)
 *   prefs: Zotero document preferences (or null)
 */
export async function prescanDocxForZotero(docxData) {
  const citations = []
  let bibliography = null
  let prefs = null

  try {
    const zip = await JSZip.loadAsync(docxData)
    const docXml = await zip.file('word/document.xml')?.async('string')
    if (!docXml) return { citations, bibliography, prefs }

    // Extract Zotero prefs from custom properties
    const customXml = await zip.file('docProps/custom.xml')?.async('string')
    if (customXml) {
      prefs = extractZoteroPrefs(customXml)
    }

    // Parse field codes from document.xml
    // We use regex-based extraction because it's simpler and more robust
    // than full XML DOM parsing for this specific task.
    const fieldCodes = extractFieldCodes(docXml)

    for (const field of fieldCodes) {
      if (field.instruction.includes('ZOTERO_ITEM') && field.instruction.includes('CSL_CITATION')) {
        const json = extractCslJson(field.instruction)
        if (json) {
          citations.push({
            displayText: field.displayText,
            cslCitation: json,
          })
        }
      } else if (field.instruction.includes('ZOTERO_BIBL') && field.instruction.includes('CSL_BIBLIOGRAPHY')) {
        const match = field.instruction.match(/CSL_BIBLIOGRAPHY\s*$/)
        if (match) {
          const jsonStr = field.instruction.replace(/.*ZOTERO_BIBL\s*/, '').replace(/\s*CSL_BIBLIOGRAPHY\s*$/, '')
          try { bibliography = JSON.parse(jsonStr) } catch {}
        }
      }
    }
  } catch (e) {
    console.warn('[docxCitationImporter] Pre-scan failed:', e)
  }

  return { citations, bibliography, prefs }
}

/**
 * Extract field codes from DOCX XML string.
 *
 * Finds all begin...instrText...separate...displayText...end sequences.
 * Returns array of { instruction, displayText } in document order.
 */
function extractFieldCodes(xml) {
  const results = []

  // State machine: walk through fldChar markers
  // We use a simple approach: find all fldChar elements and track state
  const fldCharPattern = /w:fldCharType="(begin|separate|end)"/g
  const instrTextPattern = /<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>/g
  const textPattern = /<w:t[^>]*>([\s\S]*?)<\/w:t>/g

  // Split XML into segments at fldChar boundaries
  let state = 'idle' // idle | collecting-instr | collecting-display
  let instrParts = []
  let displayParts = []
  let depth = 0

  // Tokenize: extract all relevant elements in order
  const tokenPattern = /<w:fldChar[^/]*w:fldCharType="(begin|separate|end)"[^/]*\/?>|<w:instrText[^>]*>([\s\S]*?)<\/w:instrText>|<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g
  let match

  while ((match = tokenPattern.exec(xml)) !== null) {
    const fldType = match[1]
    const instrText = match[2]
    const displayTextPart = match[3]

    if (fldType === 'begin') {
      depth++
      if (depth === 1) {
        state = 'collecting-instr'
        instrParts = []
        displayParts = []
      }
    } else if (fldType === 'separate' && depth === 1) {
      state = 'collecting-display'
    } else if (fldType === 'end') {
      if (depth === 1) {
        const instruction = instrParts.join('')
        const displayText = displayParts.join('')
        if (instruction.trim()) {
          results.push({ instruction, displayText })
        }
        state = 'idle'
      }
      depth = Math.max(0, depth - 1)
    } else if (instrText !== undefined && state === 'collecting-instr' && depth === 1) {
      instrParts.push(instrText)
    } else if (displayTextPart !== undefined && state === 'collecting-display' && depth === 1) {
      displayParts.push(displayTextPart)
    }
  }

  return results
}

/**
 * Extract CSL_CITATION JSON from an ADDIN ZOTERO_ITEM instruction string.
 * Uses brace-counting instead of regex for robustness with split instrText elements.
 */
function extractCslJson(instrText) {
  // Decode XML entities FIRST — the regex-based extraction preserves them,
  // and the brace counter needs real " chars to track string boundaries.
  instrText = instrText
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&') // &amp; last — avoids double-decoding

  // instruction format: " ADDIN ZOTERO_ITEM CSL_CITATION {json...}"
  const marker = instrText.indexOf('CSL_CITATION')
  if (marker === -1) return null

  const start = instrText.indexOf('{', marker)
  if (start === -1) return null

  // Find the matching closing brace via depth counting
  let depth = 0
  let end = -1
  let inString = false
  let escape = false

  for (let i = start; i < instrText.length; i++) {
    const ch = instrText[i]

    if (escape) { escape = false; continue }
    if (ch === '\\' && inString) { escape = true; continue }
    if (ch === '"' && !escape) { inString = !inString; continue }

    if (!inString) {
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) { end = i; break }
      }
    }
  }

  if (end === -1) {
    console.warn('[docxCitationImporter] Unmatched braces in CSL JSON. instrText length:', instrText.length,
      'start:', start, 'depth at end:', depth)
    return null
  }

  try {
    return JSON.parse(instrText.slice(start, end + 1))
  } catch (e) {
    console.warn('[docxCitationImporter] Failed to parse CSL JSON:', e)
    console.warn('[docxCitationImporter] JSON (first 300):', instrText.slice(start, start + 300))
    return null
  }
}

/**
 * Extract Zotero document preferences from docProps/custom.xml.
 */
function extractZoteroPrefs(customXml) {
  // Look for ZOTERO_PREF_n properties and concatenate them
  const prefPattern = /name="ZOTERO_PREF_\d+"[\s\S]*?<vt:lpwstr>([\s\S]*?)<\/vt:lpwstr>/g
  const parts = []
  let match
  while ((match = prefPattern.exec(customXml)) !== null) {
    parts.push(match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
    )
  }
  if (!parts.length) return null

  const prefsXml = parts.join('')
  // Extract key fields
  const result = {}
  const styleMatch = prefsXml.match(/style id="([^"]*)"/)
  if (styleMatch) result.styleId = styleMatch[1]
  const localeMatch = prefsXml.match(/locale="([^"]*)"/)
  if (localeMatch) result.locale = localeMatch[1]
  const fieldTypeMatch = prefsXml.match(/fieldType" value="([^"]*)"/)
  if (fieldTypeMatch) result.fieldType = fieldTypeMatch[1]

  return result
}

/**
 * Phase 2: Post-process a loaded SuperDoc document.
 *
 * Scans the ProseMirror document for text matching Zotero citation display
 * strings and replaces them with citation nodes.
 *
 * @param {Object} editor - SuperDoc editor instance
 * @param {Array} citations - From prescanDocxForZotero().citations
 * @param {Object} referencesStore - The Pinia references store
 * @returns {number} Number of citations successfully replaced
 */
export function postProcessCitations(editor, citations, referencesStore) {
  if (!citations.length || !editor?.view) return 0

  const { state } = editor.view
  const { schema, doc } = state

  // Check that our citation node type exists in the schema
  if (!schema.nodes.citation) {
    console.warn('[docxCitationImporter] citation node type not in schema')
    return 0
  }

  // First, import any unknown references into the library
  const importedKeys = importZoteroReferences(citations, referencesStore)

  // Build a list of replacements: find display text in document, replace with citation nodes
  const replacements = []

  for (const citation of citations) {
    const { displayText, cslCitation } = citation
    if (!displayText?.trim() || !cslCitation?.citationItems?.length) continue

    // Build cites array from CSL citationItems
    const cites = cslCitation.citationItems.map(item => {
      const key = findMatchingKey(item, importedKeys, referencesStore)
      return {
        key: key || `unknown-${item.id}`,
        locator: item.locator || '',
        prefix: item.prefix || '',
        suffix: item.suffix || '',
        suppressAuthor: item['suppress-author'] || false,
      }
    })

    // Find the display text in the document
    const textPos = findTextInDoc(doc, displayText.trim())
    if (textPos) {
      replacements.push({
        from: textPos.from,
        to: textPos.to,
        cites,
        citationId: cslCitation.citationID || Math.random().toString(36).slice(2, 10),
        zoteroData: cslCitation,
      })
    }
  }

  if (!replacements.length) return 0

  // Apply replacements in reverse order (to preserve positions)
  const tr = state.tr
  const sorted = replacements.sort((a, b) => b.from - a.from)

  for (const r of sorted) {
    const citationNode = schema.nodes.citation.create({
      citationId: r.citationId,
      cites: r.cites,
      mode: 'normal',
      zoteroData: r.zoteroData,
    })
    tr.replaceWith(r.from, r.to, citationNode)
  }

  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)

  return sorted.length
}

/**
 * Import Zotero CSL-JSON references into the references store.
 * Returns a Map of zoteroUri → libraryKey for matching.
 */
function importZoteroReferences(citations, referencesStore) {
  const keyMap = new Map() // zoteroUri → our library key

  for (const citation of citations) {
    const items = citation.cslCitation?.citationItems || []
    for (const item of items) {
      const uri = item.uris?.[0] || item.uri?.[0]
      if (uri && keyMap.has(uri)) continue // Already processed

      const itemData = item.itemData
      if (!itemData) continue

      // Check if this reference already exists in our library (by DOI or title)
      let existing = null
      if (itemData.DOI) {
        existing = referencesStore.library.find(r => r.DOI === itemData.DOI)
      }
      if (!existing && itemData.title) {
        existing = referencesStore.library.find(r =>
          r.title?.toLowerCase() === itemData.title?.toLowerCase()
        )
      }

      if (existing) {
        const key = existing._key || existing.id
        if (uri) keyMap.set(uri, key)
        // Also map by numeric ID
        keyMap.set(String(item.id), key)
      } else {
        // Import as new reference
        const newRef = { ...itemData }
        // Generate a citation key from author + year
        const author = itemData.author?.[0]?.family || 'unknown'
        const year = itemData.issued?.['date-parts']?.[0]?.[0] || 'nd'
        const baseKey = `${author.toLowerCase()}${year}`

        // Add to library (the store will handle key uniqueness)
        try {
          const result = referencesStore.addReference({
            ...newRef,
            _key: baseKey,
            _source: 'zotero-import',
            _zoteroUri: uri,
          })
          const key = result?.key || baseKey
          if (uri) keyMap.set(uri, key)
          keyMap.set(String(item.id), key)
        } catch (e) {
          console.warn('[docxCitationImporter] Failed to import reference:', e)
        }
      }
    }
  }

  return keyMap
}

/**
 * Find a matching reference library key for a Zotero citation item.
 */
function findMatchingKey(item, importedKeys, referencesStore) {
  // Try by Zotero URI first
  const uri = item.uris?.[0] || item.uri?.[0]
  if (uri && importedKeys.has(uri)) return importedKeys.get(uri)

  // Try by numeric ID
  if (importedKeys.has(String(item.id))) return importedKeys.get(String(item.id))

  // Try by DOI
  if (item.itemData?.DOI) {
    const match = referencesStore.library.find(r => r.DOI === item.itemData.DOI)
    if (match) return match._key || match.id
  }

  // Try by title
  if (item.itemData?.title) {
    const match = referencesStore.library.find(r =>
      r.title?.toLowerCase() === item.itemData.title?.toLowerCase()
    )
    if (match) return match._key || match.id
  }

  return null
}

/**
 * Find exact text match in a ProseMirror document.
 * Returns { from, to } or null.
 *
 * Searches for the text string across text nodes, handling runs and paragraphs.
 */
function findTextInDoc(doc, searchText) {
  if (!searchText) return null

  // Collect all text with position mapping
  const textRanges = []
  doc.descendants((node, pos) => {
    if (node.isText) {
      textRanges.push({ text: node.text, from: pos, to: pos + node.nodeSize })
    }
  })

  // Build a flat text string with position offsets
  // We need to handle text that might span multiple runs
  let flatText = ''
  const posMap = [] // flatText index → doc position

  for (const range of textRanges) {
    for (let i = 0; i < range.text.length; i++) {
      posMap.push(range.from + i)
      flatText += range.text[i]
    }
    // Don't add separators between adjacent text nodes in the same run
  }

  // Search for the citation text
  const idx = flatText.indexOf(searchText)
  if (idx === -1) return null

  const from = posMap[idx]
  const to = posMap[idx + searchText.length - 1] + 1

  // Mark this range as "consumed" to prevent duplicate matches
  // We do this by returning the match and letting the caller track it
  return { from, to }
}

/**
 * Find all citation display text occurrences in document order.
 * Handles the case where multiple citations have the same display text
 * by matching them in document order (same as field code order in DOCX).
 */
export function findAllCitationTextPositions(doc, citations) {
  const results = []
  const consumed = new Set()

  // Collect full flat text with position mapping
  const textRanges = []
  doc.descendants((node, pos) => {
    if (node.isText) {
      textRanges.push({ text: node.text, from: pos, to: pos + node.nodeSize })
    }
  })

  let flatText = ''
  const posMap = []
  for (const range of textRanges) {
    for (let i = 0; i < range.text.length; i++) {
      posMap.push(range.from + i)
      flatText += range.text[i]
    }
  }

  // For each citation, find the next occurrence of its display text
  let searchFrom = 0
  for (const citation of citations) {
    const displayText = citation.displayText?.trim()
    if (!displayText) continue

    const idx = flatText.indexOf(displayText, searchFrom)
    if (idx === -1) continue

    const from = posMap[idx]
    const to = posMap[idx + displayText.length - 1] + 1

    results.push({ from, to, citation })
    searchFrom = idx + displayText.length // advance past this match
  }

  return results
}

/**
 * Expand a text match range to include surrounding field code atoms.
 *
 * DOCX field codes have this ProseMirror structure:
 *   [atoms: fldChar begin + instrText + fldChar separate] [text: display] [atoms: fldChar end]
 *
 * If we only replace the display text, the field code markers remain and SuperDoc
 * regenerates the display text. We must replace the ENTIRE field code structure.
 *
 * Strategy: walk backward/forward from the text match using $pos.nodeBefore/nodeAfter
 * to absorb all adjacent non-text inline nodes. If the text is inside a wrapper (run),
 * try one level up to find the field code atoms.
 */
function expandToFieldBoundary(doc, from, to) {
  let expandedFrom = from
  let expandedTo = to

  // Walk backward through non-text inline nodes at the same depth
  let pos = from
  while (pos > 0) {
    const $p = doc.resolve(pos)
    const nb = $p.nodeBefore
    if (!nb) break
    if (nb.isText) break
    if (!nb.isInline) break
    pos -= nb.nodeSize
    expandedFrom = pos
  }

  // Walk forward through non-text inline nodes
  pos = to
  while (pos < doc.content.size) {
    const $p = doc.resolve(pos)
    const na = $p.nodeAfter
    if (!na) break
    if (na.isText) break
    if (!na.isInline) break
    pos += na.nodeSize
    expandedTo = pos
  }

  // If no expansion at the text level, try one depth up.
  // The text might be inside a run wrapper, with field atoms as siblings of the run.
  if (expandedFrom === from && expandedTo === to) {
    const $from = doc.resolve(from)
    if ($from.depth >= 2) {
      const parentDepth = $from.depth - 1
      const parent = $from.node(parentDepth)
      const parentStart = $from.start(parentDepth)

      // Find the child at this depth that contains 'from'
      let childPos = parentStart
      for (let i = 0; i < parent.childCount; i++) {
        const child = parent.child(i)
        const childEnd = childPos + child.nodeSize

        if (from >= childPos && from < childEnd) {
          // This child (likely a run) contains our text. Check siblings.
          let startI = i
          while (startI > 0) {
            const prev = parent.child(startI - 1)
            // Stop at siblings that contain user-visible text (regular runs)
            if (prev.isText || (prev.textContent?.trim().length > 0 && !prev.isAtom)) break
            startI--
          }

          let endI = i
          // Also find the child containing 'to'
          let tempPos = childPos
          for (let j = i; j < parent.childCount; j++) {
            const c = parent.child(j)
            const cEnd = tempPos + c.nodeSize
            if (to > tempPos && to <= cEnd) { endI = j; break }
            tempPos = cEnd
          }
          while (endI < parent.childCount - 1) {
            const next = parent.child(endI + 1)
            if (next.isText || (next.textContent?.trim().length > 0 && !next.isAtom)) break
            endI++
          }

          // Calculate expanded positions
          if (startI < i || endI > i) {
            let eFrom = parentStart
            for (let j = 0; j < startI; j++) eFrom += parent.child(j).nodeSize
            let eTo = parentStart
            for (let j = 0; j <= endI; j++) eTo += parent.child(j).nodeSize

            expandedFrom = eFrom
            expandedTo = eTo
          }
          break
        }

        childPos = childEnd
      }
    }
  }

  return { from: expandedFrom, to: expandedTo }
}

// ─── Citation href helpers ────────────────────────────────────
// SuperDoc's DomPainter only allows DEFAULT_ALLOWED_PROTOCOLS (http, https, mailto, tel, sms).
// The `cite:` scheme is blocked (rendered as <span>, no click events).
// Solution: use https://cite.local/{id} — passes validation, renders as <a>, we intercept clicks.

export const CITE_HREF_PREFIX = 'https://cite.local/'
export function citationHref(id) { return CITE_HREF_PREFIX + id }
export function isCitationHref(href) { return href?.startsWith(CITE_HREF_PREFIX) }
export function citationIdFromHref(href) { return href?.slice(CITE_HREF_PREFIX.length) || null }

// ─── Citation metadata ────────────────────────────────────────
// Stored separately from the document — the link mark only carries the citationId.

const citationMetaMap = new Map()

export function setCitationMeta(id, data) {
  citationMetaMap.set(id, data)
}

export function getCitationMeta(id) {
  return citationMetaMap.get(id)
}

export function getAllCitationIds() {
  return [...citationMetaMap.keys()]
}

/** Persist all citation metadata to localStorage for a given file path. */
export function persistCitationMeta(filePath) {
  try {
    const all = {}
    citationMetaMap.forEach((v, k) => { all[k] = v })
    localStorage.setItem(`hm-cite-meta:${filePath}`, JSON.stringify(all))
  } catch {}
}

/** Load citation metadata from localStorage. Clears existing map first. */
export function loadCitationMeta(filePath) {
  try {
    citationMetaMap.clear()
    const saved = localStorage.getItem(`hm-cite-meta:${filePath}`)
    if (saved) {
      const all = JSON.parse(saved)
      for (const [k, v] of Object.entries(all)) {
        citationMetaMap.set(k, v)
      }
    }
  } catch {}
}

// ─── Citation link helpers ────────────────────────────────────

/**
 * Find the text range of a citation link mark in the document.
 * Returns { from, to } or null.
 */
export function findCitationLinkRange(doc, citationId) {
  const href = citationHref(citationId)
  let from = null, to = null
  doc.descendants((node, pos) => {
    if (node.isText) {
      const linkMark = node.marks.find(m =>
        m.type.name === 'link' && m.attrs.href === href
      )
      if (linkMark) {
        if (from === null) from = pos
        to = pos + node.nodeSize
      } else if (from !== null) {
        return false // past the end of the marked range
      }
    }
  })
  return from !== null ? { from, to } : null
}

/**
 * Update the display text of a citation link in the document.
 * Keeps the link mark with the same href.
 */
export function updateCitationText(editor, citationId, newText) {
  const { state } = editor.view
  const { doc, schema } = state
  const range = findCitationLinkRange(doc, citationId)
  if (!range) return false

  const linkMark = schema.marks.link.create({ href: citationHref(citationId) })
  const textNode = schema.text(newText, [linkMark])
  const tr = state.tr
  tr.replaceWith(range.from, range.to, textNode)
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  return true
}

/**
 * Remove a citation link (revert to plain text).
 */
export function removeCitationLink(editor, citationId) {
  const { state } = editor.view
  const { doc, schema } = state
  const range = findCitationLinkRange(doc, citationId)
  if (!range) return false

  const tr = state.tr
  tr.removeMark(range.from, range.to, schema.marks.link)
  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)
  citationMetaMap.delete(citationId)
  return true
}

/**
 * Insert a new citation at a position in the document.
 *
 * @param {Object} editor - SuperDoc activeEditor
 * @param {string} key - Reference key
 * @param {number} from - Start of range to replace (use cursor pos for pure insert)
 * @param {number} to - End of range to replace (same as from for pure insert)
 * @param {Object} referencesStore - Pinia references store
 * @returns {string} The citationId of the new citation
 */
export function insertNewCitation(editor, key, from, to, referencesStore) {
  const { state } = editor.view
  const { schema } = state

  const citationId = Math.random().toString(36).slice(2, 10)
  const cites = [{ key, locator: '', prefix: '', suffix: '', suppressAuthor: false }]

  // Store metadata
  setCitationMeta(citationId, { cites })

  // Format display text (placeholder — reformatAllCitations will fix numbering)
  const r = referencesStore.getByKey(key)
  const placeholder = r ? `(${key})` : `(${key})`

  const linkMark = schema.marks.link.create({ href: citationHref(citationId) })
  const textNode = schema.text(placeholder, [linkMark])
  const tr = state.tr.replaceWith(from, to, textNode)
  editor.view.dispatch(tr)

  // Reformat all citations to get correct display text and numbering
  const style = referencesStore.citationStyle || 'apa'
  reformatAllCitations(editor, style, referencesStore)

  // Position cursor at end of citation text (inside the run).
  // The citationMarkGuard plugin's handleTextInput will intercept the next
  // keystroke and split the run, inserting typed text in a clean run without
  // the link's blue/underline runProperties.
  const afterState = editor.view.state
  const range = findCitationLinkRange(afterState.doc, citationId)
  if (range) {
    const TextSelection = afterState.selection.constructor
    const moveTr = afterState.tr
      .setSelection(TextSelection.create(afterState.doc, range.to))
      .setStoredMarks([])
    editor.view.dispatch(moveTr)
  }

  return citationId
}

/**
 * Find all citation link IDs in document order.
 * Returns array of { citationId, from } sorted by position.
 */
export function findAllCitationLinksInOrder(doc) {
  const results = []
  doc.descendants((node, pos) => {
    if (node.isText) {
      const linkMark = node.marks.find(m =>
        m.type.name === 'link' && isCitationHref(m.attrs.href)
      )
      if (linkMark) {
        const id = citationIdFromHref(linkMark.attrs.href)
        // Only record first text node of each citation (avoids duplicates for multi-node links)
        if (id && !results.some(r => r.citationId === id)) {
          results.push({ citationId: id, from: pos })
        }
      }
    }
  })
  return results.sort((a, b) => a.from - b.from)
}

/**
 * Reformat all citation display text in the document for a new style.
 * Walks all citation links, looks up metadata, formats per style, and updates text.
 *
 * For numbered styles (IEEE/Vancouver), assigns numbers by first-appearance order.
 */
export function reformatAllCitations(editor, style, referencesStore) {
  const { doc } = editor.view.state
  const ordered = findAllCitationLinksInOrder(doc)
  if (!ordered.length) return 0

  const isNumbered = style === 'ieee' || style === 'vancouver'

  // For numbered styles, build first-appearance key → number map
  const keyNumberMap = new Map()
  if (isNumbered) {
    let num = 1
    for (const { citationId } of ordered) {
      const meta = getCitationMeta(citationId)
      if (!meta?.cites) continue
      for (const c of meta.cites) {
        if (!keyNumberMap.has(c.key)) {
          keyNumberMap.set(c.key, num++)
        }
      }
    }
  }

  // Update each citation's display text (reverse order to preserve positions)
  let updated = 0
  const reversed = [...ordered].reverse()
  for (const { citationId } of reversed) {
    const meta = getCitationMeta(citationId)
    if (!meta?.cites?.length) continue

    const parts = meta.cites.map(c => {
      const r = referencesStore.getByKey(c.key)
      if (!r) return c.key
      const num = keyNumberMap.get(c.key)
      const inline = formatInlineCitation(r, style, num)
      return inline.replace(/^\(/, '').replace(/\)$/, '').replace(/^\[/, '').replace(/\]$/, '')
    })

    const sep = isNumbered ? ', ' : '; '
    const text = isNumbered ? `[${parts.join(sep)}]` : `(${parts.join(sep)})`

    if (updateCitationText(editor, citationId, text)) updated++
  }

  return updated
}

/**
 * Get all unique cited reference keys across all citations, in document order.
 */
export function getAllCitedKeys(doc) {
  const ordered = findAllCitationLinksInOrder(doc)
  const seen = new Set()
  const keys = []
  for (const { citationId } of ordered) {
    const meta = getCitationMeta(citationId)
    if (!meta?.cites) continue
    for (const c of meta.cites) {
      if (!seen.has(c.key)) {
        seen.add(c.key)
        keys.push(c.key)
      }
    }
  }
  return keys
}

/**
 * Improved Phase 2: Post-process using ordered matching.
 *
 * Strategy: replace field code structures with link-marked text.
 * Uses the native `link` mark so SuperDoc's layout engine renders citations
 * as clickable inline elements (like hyperlinks) with no DOM injection.
 */
export function postProcessCitationsOrdered(editor, citations, referencesStore) {
  if (!citations.length || !editor?.view) return 0

  const { state } = editor.view
  const { schema, doc } = state

  if (!schema.marks.link) {
    console.warn('[Phase2] link mark not available in schema')
    return 0
  }

  // Import references first
  const importedKeys = importZoteroReferences(citations, referencesStore)

  // Find all citation text positions in document order
  const matches = findAllCitationTextPositions(doc, citations)
  if (!matches.length) return 0

  // Build replacement list with field boundary expansion
  const replacements = matches.map(({ from, to, citation }) => {
    const cites = (citation.cslCitation?.citationItems || []).map(item => {
      const key = findMatchingKey(item, importedKeys, referencesStore)
      return {
        key: key || `unknown-${item.id}`,
        locator: item.locator || '',
        prefix: item.prefix || '',
        suffix: item.suffix || '',
        suppressAuthor: item['suppress-author'] || false,
      }
    })

    const expanded = expandToFieldBoundary(doc, from, to)

    return {
      from: expanded.from,
      to: expanded.to,
      displayText: citation.displayText?.trim(),
      cites,
      citationId: citation.cslCitation?.citationID || Math.random().toString(36).slice(2, 10),
      zoteroData: citation.cslCitation,
    }
  })

  // Apply in reverse order (preserves positions for lower matches)
  const tr = state.tr
  const sorted = [...replacements].sort((a, b) => b.from - a.from)

  for (const r of sorted) {
    // Create text node with link mark (cite: prefix identifies it as a citation)
    const linkMark = schema.marks.link.create({ href: citationHref(r.citationId) })
    const textNode = schema.text(r.displayText, [linkMark])

    try {
      tr.replaceWith(r.from, r.to, textNode)
      // Store citation metadata for popover / style switching
      setCitationMeta(r.citationId, { cites: r.cites, zoteroData: r.zoteroData })
    } catch (e) {
      console.error(`[Phase2:replace] FAILED at ${r.from}-${r.to}:`, e.message)
    }
  }

  tr.setMeta('addToHistory', false)
  editor.view.dispatch(tr)

  return sorted.length
}

// ─── Citation run-split guard ─────────────────────────────────
// In SuperDoc's OOXML model, text inside a run inherits the run's formatting
// properties (color, underline, rStyle). When the user types at the end of a
// citation, the new text enters the SAME run and gets the hyperlink's blue
// color + underline from runProperties.
//
// The link mark is correctly bounded (the <a> ends at the closing bracket).
// But the <span> for typed text still gets blue styling from the run.
//
// Fix: appendTransaction detects text AFTER a citation link range that shares
// the same run, then splits the run so the bleed text moves to a clean run
// with link-related properties stripped. Same technique as docxGhost.js.

/** Walk up the resolved position to find the depth of the nearest run ancestor. */
function findRunDepth($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'run') return d
  }
  return 0
}

/** Strip hyperlink-related properties from a runProperties object (deep clone). */
function cleanRunProperties(runProps) {
  if (!runProps) return {}
  const clean = JSON.parse(JSON.stringify(runProps))
  // Standard OOXML hyperlink properties
  delete clean.color      // <w:color> (blue)
  delete clean.underline  // might be stored this way
  delete clean.u          // <w:u> (underline)
  delete clean.rStyle     // <w:rStyle> e.g. "Hyperlink" character style
  return clean
}

export function createCitationMarkGuardExtension() {
  return Extension.create({
    name: 'citationMarkGuard',

    addPmPlugins() {
      return [
        new Plugin({
          key: citationGuardKey,

          // Detect text in the same run as a citation (after the closing
          // bracket) and split it into a separate run with clean properties.
          appendTransaction(transactions, oldState, newState) {
            if (!transactions.some(tr => tr.docChanged)) return null
            const { doc, schema } = newState
            if (!schema.marks.link || !schema.nodes.run) return null

            const citIds = getAllCitationIds()
            if (!citIds.length) return null

            // Process one bleed per cycle (positions shift after split;
            // next cycle handles remaining if any)
            for (const id of citIds) {
              const range = findCitationLinkRange(doc, id)
              if (!range) continue

              // Verify the citation text ends with a closing bracket
              const citText = doc.textBetween(range.from, range.to)
              if (!citText.endsWith(')') && !citText.endsWith(']')) continue

              // Check if there's text AFTER the citation in the same run
              const $end = doc.resolve(range.to)
              const runDepth = findRunDepth($end)
              if (!runDepth) continue

              const runNode = $end.node(runDepth)
              const runStart = $end.before(runDepth)
              const runEnd = $end.after(runDepth)
              const offsetInRun = range.to - runStart - 1 // -1 for run open token

              // If citation fills the entire run content, no bleed
              if (offsetInRun >= runNode.content.size) continue

              // There IS content after the citation in the same run — split it
              const runContent = runNode.content
              const FragmentClass = runContent.constructor
              const cleanProps = cleanRunProperties(runNode.attrs.runProperties)

              const pieces = []

              // Part 1: citation text stays in original run (keeps link styling)
              pieces.push(schema.nodes.run.create(
                runNode.attrs,
                runContent.cut(0, offsetInRun)
              ))

              // Part 2: bleed text moves to a clean run (no link styling)
              pieces.push(schema.nodes.run.create(
                { ...runNode.attrs, runProperties: cleanProps },
                runContent.cut(offsetInRun)
              ))

              const tr = newState.tr
              tr.replaceWith(runStart, runEnd, FragmentClass.from(pieces))
              tr.setMeta('addToHistory', false)
              return tr
            }

            return null
          },
        }),
      ]
    },
  })
}

// ─── Bibliography helpers ─────────────────────────────────────

const BIB_SENTINEL_ID = '__bib__'

/**
 * Check if a bibliography sentinel exists in the document.
 */
export function hasBibliography(doc) {
  const href = citationHref(BIB_SENTINEL_ID)
  let found = false
  doc.descendants((node) => {
    if (found) return false
    if (node.isText) {
      if (node.marks.some(m => m.type.name === 'link' && m.attrs.href === href)) {
        found = true
        return false
      }
    }
  })
  return found
}

/**
 * Find the sentinel position and the range of the entire bibliography block
 * (from sentinel paragraph through all following paragraphs until end of doc
 * or next heading).
 */
function findBibliographyRange(doc) {
  const href = citationHref(BIB_SENTINEL_ID)
  let sentinelPos = null
  let headingPos = null

  doc.descendants((node, pos) => {
    if (sentinelPos !== null && headingPos !== null) return false
    if (node.isText) {
      if (sentinelPos === null && node.marks.some(m => m.type.name === 'link' && m.attrs.href === href)) {
        sentinelPos = pos
      }
    }
  })

  if (sentinelPos === null) return null

  // Find the top-level block containing the sentinel
  const $sentinel = doc.resolve(sentinelPos)
  const sentinelBlockStart = $sentinel.before($sentinel.depth > 0 ? 1 : 0)

  // Walk forward from the sentinel block to find the bibliography extent.
  // Also find the heading block BEFORE the sentinel (the "References" heading).
  let headingStart = null
  let bibEnd = doc.content.size

  // Find the "References" heading — it's the block just before the sentinel block
  doc.forEach((child, offset) => {
    const childEnd = offset + child.nodeSize
    if (childEnd <= sentinelBlockStart) {
      // This block ends before or at the sentinel block — could be the heading
      if (child.type.name === 'heading' || (child.isTextblock && child.textContent === 'References')) {
        headingStart = offset
      }
    }
    if (offset > sentinelBlockStart) {
      // Blocks after sentinel — stop at next heading
      if (child.type.name === 'heading' && bibEnd === doc.content.size) {
        bibEnd = offset
      }
    }
  })

  const rangeStart = headingStart !== null ? headingStart : sentinelBlockStart
  return { from: rangeStart, to: bibEnd }
}

/**
 * Build bibliography paragraph nodes (heading + sentinel + entries).
 */
function buildBibliographyNodes(schema, style, referencesStore, citedKeys) {
  const isNumbered = style === 'ieee' || style === 'vancouver'
  const refs = citedKeys.map(k => referencesStore.getByKey(k)).filter(Boolean)
  if (!isNumbered) {
    refs.sort((a, b) => (a.author?.[0]?.family || '').localeCompare(b.author?.[0]?.family || ''))
  }

  const nodes = []
  const hasItalic = !!schema.marks.italic

  // Paragraph attrs for bibliography entries: hanging indent + spacing
  const entryAttrs = {
    paragraphProperties: {
      indent: { left: 36, hanging: 36 },  // 0.5in hanging indent
      spacing: { after: 8 },              // 8px between entries
    },
  }

  // "References" heading
  if (schema.nodes.heading) {
    nodes.push(schema.nodes.heading.create({ level: 2 }, schema.text('References')))
  } else {
    const boldMark = schema.marks.bold?.create()
    nodes.push(schema.nodes.paragraph.create({}, schema.text('References', boldMark ? [boldMark] : [])))
  }

  // Sentinel paragraph — invisible link mark so we can find & update later
  const sentinelMark = schema.marks.link.create({ href: citationHref(BIB_SENTINEL_ID) })
  nodes.push(schema.nodes.paragraph.create({}, schema.text('\u200B', [sentinelMark])))

  // One paragraph per reference entry with rich formatting
  refs.forEach((r, i) => {
    const segments = formatReferenceRich(r, style, isNumbered ? i + 1 : undefined)
    const textNodes = segments
      .filter(s => s.text) // skip empty segments
      .map(s => {
        const marks = (s.italic && hasItalic) ? [schema.marks.italic.create()] : []
        return schema.text(s.text, marks)
      })

    if (textNodes.length) {
      nodes.push(schema.nodes.paragraph.create(entryAttrs, textNodes))
    } else {
      // Fallback to plain text if rich formatting produced nothing
      const text = formatReference(r, style, isNumbered ? i + 1 : undefined)
      nodes.push(schema.nodes.paragraph.create(entryAttrs, schema.text(text)))
    }
  })

  return nodes
}

/**
 * Insert a bibliography at the cursor position.
 */
export function insertBibliography(editor, style, referencesStore) {
  if (!editor?.view) return false
  const { state } = editor.view
  const { doc, schema } = state

  const citedKeys = getAllCitedKeys(doc)
  if (!citedKeys.length) return false

  const nodes = buildBibliographyNodes(schema, style, referencesStore, citedKeys)
  const { from } = state.selection
  const $pos = doc.resolve(from)
  const insertPos = $pos.after($pos.depth > 0 ? 1 : 0)

  const tr = state.tr
  for (let i = nodes.length - 1; i >= 0; i--) {
    tr.insert(insertPos, nodes[i])
  }
  editor.view.dispatch(tr)
  return true
}

/**
 * Refresh an existing bibliography — delete old content and re-insert.
 */
export function refreshBibliography(editor, style, referencesStore) {
  if (!editor?.view) return false
  const { state } = editor.view
  const { doc, schema } = state

  const range = findBibliographyRange(doc)
  if (!range) return insertBibliography(editor, style, referencesStore)

  const citedKeys = getAllCitedKeys(doc)
  if (!citedKeys.length) return false

  const nodes = buildBibliographyNodes(schema, style, referencesStore, citedKeys)

  const tr = state.tr
  // Delete old bibliography range
  tr.delete(range.from, range.to)
  // Insert new nodes at the same position
  for (let i = nodes.length - 1; i >= 0; i--) {
    tr.insert(range.from, nodes[i])
  }
  editor.view.dispatch(tr)
  return true
}
