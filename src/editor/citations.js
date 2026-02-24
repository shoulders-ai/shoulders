import { EditorView, Decoration, ViewPlugin } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
// CitationPalette replaces old CM6 autocomplete — trigger plugin notifies Vue

/**
 * Check if a position is inside a code block or inline code.
 * (Same as wikiLinks.js)
 */
function isInCodeContext(state, from, to) {
  let inCode = false
  syntaxTree(state).iterate({
    from,
    to,
    enter(node) {
      const name = node.type.name
      if (
        name === 'CodeBlock' || name === 'FencedCode' || name === 'CodeText' ||
        name === 'InlineCode' || name === 'CodeMark' || name === 'CodeInfo'
      ) {
        inCode = true
        return false
      }
    },
  })
  return inCode
}

// Matches citation groups: [@key], [@key1; @key2], [see @key, p. 42]
const CITATION_GROUP_RE = /\[([^\[\]]*@[a-zA-Z][\w]*[^\[\]]*)\]/g

// Matches individual @key inside a group
const CITE_KEY_RE = /@([a-zA-Z][\w]*)/g

/**
 * ViewPlugin that decorates citation groups in the viewport.
 */
function citationDecorations(getByKey) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = this.build(view)
      }

      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.build(update.view)
        }
      }

      build(view) {
        const decorations = []
        const { from, to } = view.viewport

        const start = Math.max(0, from - 200)
        const end = Math.min(view.state.doc.length, to + 200)
        const text = view.state.doc.sliceString(start, end)

        CITATION_GROUP_RE.lastIndex = 0
        let match
        while ((match = CITATION_GROUP_RE.exec(text)) !== null) {
          const matchFrom = start + match.index
          const matchTo = matchFrom + match[0].length

          if (isInCodeContext(view.state, matchFrom, matchTo)) continue

          const inner = match[1]
          const innerStart = matchFrom + 1

          // Opening bracket [
          decorations.push(
            Decoration.mark({ class: 'cm-citation-bracket' }).range(matchFrom, matchFrom + 1)
          )

          // Closing bracket ]
          decorations.push(
            Decoration.mark({ class: 'cm-citation-bracket' }).range(matchTo - 1, matchTo)
          )

          // Decorate each @key inside
          CITE_KEY_RE.lastIndex = 0
          let keyMatch
          while ((keyMatch = CITE_KEY_RE.exec(inner)) !== null) {
            const keyFrom = innerStart + keyMatch.index
            const keyTo = keyFrom + keyMatch[0].length
            const key = keyMatch[1]
            const ref = getByKey(key)

            let cls = 'cm-citation-key'
            if (!ref) {
              cls = 'cm-citation-key-broken'
            } else if (ref._needsReview) {
              cls = 'cm-citation-key-review'
            }

            decorations.push(Decoration.mark({ class: cls }).range(keyFrom, keyTo))
          }

          // Decorate non-key text (prefixes, locators, semicolons)
          let lastEnd = 0
          CITE_KEY_RE.lastIndex = 0
          while ((keyMatch = CITE_KEY_RE.exec(inner)) !== null) {
            const keyStart = keyMatch.index
            if (keyStart > lastEnd) {
              const textFrom = innerStart + lastEnd
              const textTo = innerStart + keyStart
              if (textTo > textFrom) {
                decorations.push(
                  Decoration.mark({ class: 'cm-citation-text' }).range(textFrom, textTo)
                )
              }
            }
            lastEnd = keyMatch.index + keyMatch[0].length
          }
          // Trailing text after last key
          if (lastEnd < inner.length) {
            const textFrom = innerStart + lastEnd
            const textTo = innerStart + inner.length
            if (textTo > textFrom) {
              decorations.push(
                Decoration.mark({ class: 'cm-citation-text' }).range(textFrom, textTo)
              )
            }
          }
        }

        return Decoration.set(decorations.sort((a, b) => a.from - b.from))
      }
    },
    { decorations: (v) => v.decorations }
  )
}

/**
 * ViewPlugin that detects `[@` typing and notifies the CitationPalette.
 *
 * Replaces the old CM6 autocomplete source. The palette is a Vue component
 * positioned at the cursor — it reads the query from the editor text and
 * handles its own keyboard events.
 *
 * Uses an `isOpen` callback instead of internal state to avoid stale flags
 * when the palette is closed externally (Escape / outside click).
 *
 * @param {Object} callbacks - { isOpen, onOpen, onQueryChange, onDismiss }
 */
function citationTriggerPlugin(callbacks) {
  return ViewPlugin.fromClass(
    class {
      update(vu) {
        if (!vu.docChanged && !vu.selectionSet) return

        const pos = vu.state.selection.main.head
        const line = vu.state.doc.lineAt(pos)
        const textBefore = line.text.substring(0, pos - line.from)

        // Case 1: Inside existing brackets — e.g. [@key1; @query
        const lastBracket = textBefore.lastIndexOf('[')
        let insideBrackets = false
        if (lastBracket !== -1) {
          const afterBracket = textBefore.substring(lastBracket + 1)
          if (!afterBracket.includes(']') && afterBracket.includes('@')) {
            insideBrackets = true
          }
        }

        // Find the active @ we're typing after
        let atIdx = -1
        if (insideBrackets) {
          const afterBracket = textBefore.substring(lastBracket + 1)
          const lastAt = afterBracket.lastIndexOf('@')
          if (lastAt !== -1) atIdx = lastBracket + 1 + lastAt
        } else {
          // Bare @ or [@
          const lastAt = textBefore.lastIndexOf('@')
          if (lastAt !== -1) {
            // Must be preceded by [ or whitespace or SOL (not mid-word like email)
            if (lastAt === 0 || textBefore[lastAt - 1] === '[' || /\s/.test(textBefore[lastAt - 1])) {
              // Skip if this @ is inside a completed [...] group (] exists between @ and cursor)
              if (!textBefore.substring(lastAt).includes(']')) {
                atIdx = lastAt
              }
            }
          }
        }

        const isOpen = callbacks.isOpen?.() || false

        if (atIdx === -1) {
          if (isOpen) callbacks.onDismiss?.()
          return
        }

        // Query = text after @ to cursor (allow spaces for multi-word search)
        const query = textBefore.substring(atIdx + 1)
        const absAt = line.from + atIdx

        // Check we're not in a code block
        if (isInCodeContext(vu.state, absAt, pos)) {
          if (isOpen) callbacks.onDismiss?.()
          return
        }

        if (!isOpen) {
          // Only open palette on actual typing, not clicks/cursor movement.
          // Click-to-edit is handled by handleCitationClick in TextEditor.vue.
          if (!vu.docChanged) return

          // triggerFrom: if inside existing brackets, replace from @; else from [
          const hasBracketBefore = atIdx > 0 && textBefore[atIdx - 1] === '['
          const triggerFrom = insideBrackets
            ? absAt                           // inside brackets: replace @query
            : (hasBracketBefore ? absAt - 1 : absAt)  // new citation: replace [@query or @query

          // Defer layout read — CM6 forbids coordsAtPos during update()
          vu.view.requestMeasure({
            key: 'citation-trigger',
            read: (view) => view.coordsAtPos(absAt),
            write(coords) {
              if (coords && !callbacks.isOpen?.()) {
                callbacks.onOpen?.({
                  x: coords.left,
                  y: coords.bottom,
                  query,
                  triggerFrom,
                  triggerTo: pos,
                  insideBrackets,
                })
              }
            }
          })
        } else {
          callbacks.onQueryChange?.(query, pos)
        }
      }
    }
  )
}

/**
 * Create the citations extension bundle.
 *
 * @param {Object} referencesStore - Pinia references store
 * @param {Object} [callbacks] - Trigger callbacks for CitationPalette:
 *   { onOpen, onQueryChange, onDismiss }
 */
export function citationsExtension(referencesStore, callbacks) {
  const extensions = [
    citationDecorations((key) => referencesStore.getByKey(key)),
  ]
  if (callbacks) {
    extensions.push(citationTriggerPlugin(callbacks))
  }
  return { extensions }
}

/**
 * Exported regex for use by click handler in TextEditor.vue.
 */
export { CITATION_GROUP_RE, CITE_KEY_RE }
