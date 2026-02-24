/**
 * Citation node extension for SuperDoc (DOCX editor).
 *
 * Creates an inline, atomic ProseMirror node that stores reference keys
 * and renders formatted citation text based on the current citation style.
 *
 * Architecture:
 * - Node: `citation` (inline, atom, selectable)
 * - NodeView: CitationNodeView (renders formatted text, handles click)
 * - Plugin: handles click-on-node events
 * - Commands: insertCitation, updateCitation, removeCitationItem, refreshAllCitations
 *
 * Style switching: all NodeViews are tracked in `activeViews` set.
 * Call `refreshAllCitations()` command or `citationExt._refreshAll()` to re-render.
 */
import { Extensions } from 'superdoc/super-editor'
import { formatInlineCitation } from '../services/citationFormatter'

const { Node, Plugin, PluginKey, Attribute } = Extensions

export const citationPluginKey = new PluginKey('docxCitation')

/**
 * Format citation display text from node attrs.
 * Exported for use by the strip/restore save cycle.
 */
export function formatCitationDisplayText(attrs, getReferences, getCitationStyle) {
  const refs = getReferences?.()
  const style = getCitationStyle?.() || 'apa'
  const cites = attrs.cites || []

  if (!cites.length) return '[?]'

  // For numbered styles (IEEE, Vancouver), we'd need document-order numbering.
  // For now, use the inline format which handles author-date styles well.
  const isNumbered = style === 'ieee' || style === 'vancouver'

  const parts = cites.map(cite => {
    const ref = refs?.getByKey?.(cite.key)
    if (!ref) return cite.key

    const inline = formatInlineCitation(ref, style)
    // Strip outer parentheses/brackets — we add them around the group
    return inline.replace(/^\(/, '').replace(/\)$/, '').replace(/^\[/, '').replace(/\]$/, '')
  })

  const separator = isNumbered ? ', ' : '; '
  const joined = parts.join(separator)
  return isNumbered ? `[${joined}]` : `(${joined})`
}

/**
 * Create the DOCX citation extension.
 *
 * @param {Object} options
 * @param {Function} options.getReferences - Returns the references store (has getByKey getter)
 * @param {Function} options.getCitationStyle - Returns current style string ('apa', 'chicago', etc.)
 * @param {Function} options.onCitationClick - Called when a citation is clicked (node, pos, event)
 */
export function createDocxCitationExtension({ getReferences, getCitationStyle, onCitationClick }) {
  // Track all live NodeViews for bulk re-render on style change
  const activeViews = new Set()

  function formatText(attrs) {
    return formatCitationDisplayText(attrs, getReferences, getCitationStyle)
  }

  const citationNode = Node.create({
    name: 'citation',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addOptions() {
      return {
        htmlAttributes: { class: 'docx-citation' },
      }
    },

    addAttributes() {
      return {
        citationId: {
          default: null,
          parseDOM: el => el.getAttribute('data-citation-id'),
          renderDOM: attrs => attrs.citationId ? { 'data-citation-id': attrs.citationId } : {},
        },
        cites: {
          default: [],
          parseDOM: el => {
            try { return JSON.parse(el.getAttribute('data-cites') || '[]') }
            catch { return [] }
          },
          renderDOM: attrs => ({ 'data-cites': JSON.stringify(attrs.cites || []) }),
        },
        mode: {
          default: 'normal',
          parseDOM: el => el.getAttribute('data-mode') || 'normal',
          renderDOM: attrs => ({ 'data-mode': attrs.mode || 'normal' }),
        },
        // Preserve original Zotero CSL_CITATION JSON for round-trip export
        zoteroData: {
          default: null,
          rendered: false,
        },
      }
    },

    parseDOM() {
      return [
        { tag: 'span.docx-citation', priority: 70 },
        { tag: 'cite[data-cites]', priority: 60 },
      ]
    },

    renderDOM({ node, htmlAttributes }) {
      const text = formatText(node.attrs)
      return [
        'span',
        Attribute.mergeAttributes(this.options.htmlAttributes, htmlAttributes),
        text,
      ]
    },

    addCommands() {
      return {
        /**
         * Insert a citation at the cursor (or given position).
         * If the cursor is right after an existing citation, merges into it.
         */
        insertCitation: (key, options = {}) => ({ state, tr, dispatch }) => {
          if (!dispatch) return true
          const pos = options.pos ?? state.selection.from

          // Check if cursor is adjacent to an existing citation — merge
          const $pos = state.doc.resolve(pos)
          const nodeBefore = $pos.nodeBefore
          if (nodeBefore?.type.name === 'citation') {
            const existingCites = nodeBefore.attrs.cites || []
            if (existingCites.some(c => c.key === key)) return true // already cited
            const updated = [...existingCites, { key, locator: '', prefix: '', suffix: '', suppressAuthor: false }]
            const nodePos = pos - nodeBefore.nodeSize
            tr.setNodeMarkup(nodePos, null, { ...nodeBefore.attrs, cites: updated })
            return true
          }

          // Create new citation node
          const citationId = Math.random().toString(36).slice(2, 10)
          const node = state.schema.nodes.citation.create({
            citationId,
            cites: [{ key, locator: '', prefix: '', suffix: '', suppressAuthor: false }],
            mode: options.mode || 'normal',
          })
          tr.insert(pos, node)
          return true
        },

        /**
         * Update citation attributes at a given position.
         */
        updateCitation: (pos, attrs) => ({ tr, dispatch }) => {
          if (!dispatch) return true
          const node = tr.doc.nodeAt(pos)
          if (node?.type.name !== 'citation') return false
          tr.setNodeMarkup(pos, null, { ...node.attrs, ...attrs })
          return true
        },

        /**
         * Remove a single item from a citation group. If last item, removes the node.
         */
        removeCitationItem: (pos, key) => ({ tr, dispatch }) => {
          if (!dispatch) return true
          const node = tr.doc.nodeAt(pos)
          if (node?.type.name !== 'citation') return false
          const cites = (node.attrs.cites || []).filter(c => c.key !== key)
          if (cites.length === 0) {
            tr.delete(pos, pos + node.nodeSize)
          } else {
            tr.setNodeMarkup(pos, null, { ...node.attrs, cites })
          }
          return true
        },

        /**
         * Re-render all citation NodeViews (call after style change).
         */
        refreshAllCitations: () => ({ dispatch }) => {
          if (!dispatch) return true
          activeViews.forEach(view => view.updateText())
          return true
        },
      }
    },

    addNodeView() {
      return (props) => {
        const view = new CitationNodeView({
          ...props,
          formatText,
          onCitationClick,
          activeViews,
        })
        activeViews.add(view)
        return view
      }
    },

    addPmPlugins() {
      return [
        new Plugin({
          key: citationPluginKey,
          props: {
            handleClickOn(view, pos, node, nodePos, event) {
              if (node.type.name === 'citation') {
                onCitationClick?.(node, nodePos, event)
                return true
              }
              return false
            },
          },
        }),
      ]
    },
  })

  // Public method: refresh all citation displays (for style switching from outside)
  citationNode._refreshAll = () => {
    activeViews.forEach(v => v.updateText())
  }
  citationNode._activeViews = activeViews

  return citationNode
}

/**
 * NodeView for citation nodes.
 *
 * Creates a <span class="docx-citation"> that displays formatted citation text.
 * Handles click events to open the citation editor popover.
 */
class CitationNodeView {
  constructor({ node, editor, getPos, formatText, onCitationClick, activeViews }) {
    this.node = node
    this.editor = editor
    this.getPos = getPos
    this.formatText = formatText
    this.onCitationClick = onCitationClick
    this.activeViews = activeViews

    this.dom = document.createElement('span')
    this.dom.className = 'docx-citation'
    this.dom.style.cssText = 'cursor: pointer; color: inherit;'
    this.dom.setAttribute('data-cites', JSON.stringify(node.attrs.cites || []))
    if (node.attrs.citationId) {
      this.dom.setAttribute('data-citation-id', node.attrs.citationId)
    }

    this.updateText()
    this.dom.addEventListener('click', this._onClick)
  }

  _onClick = (event) => {
    event.preventDefault()
    event.stopPropagation()
    this.onCitationClick?.(this.node, this.getPos(), event)
  }

  updateText() {
    const text = this.formatText(this.node.attrs)
    this.dom.textContent = text
  }

  update(node) {
    if (node.type.name !== 'citation') return false
    this.node = node
    this.dom.setAttribute('data-cites', JSON.stringify(node.attrs.cites || []))
    this.updateText()
    return true
  }

  stopEvent() { return false }
  ignoreMutation() { return true }

  destroy() {
    this.dom.removeEventListener('click', this._onClick)
    this.activeViews?.delete(this)
  }
}

/**
 * Find all citation nodes in a ProseMirror document.
 * Returns array of { node, pos } objects.
 */
export function findAllCitations(doc) {
  const results = []
  doc.descendants((node, pos) => {
    if (node.type.name === 'citation') {
      results.push({ node, pos })
    }
  })
  return results
}
