import { EditorView, Decoration, ViewPlugin, WidgetType } from '@codemirror/view'

/**
 * All supported LaTeX citation commands (natbib + biblatex + capitalized variants).
 * Shared between the decoration regex, the trigger plugin, and references.js citedIn getter.
 */
const CITE_CMDS = 'cite[tp]?|citealp|citealt|citeauthor|citeyear|autocite|textcite|parencite|nocite|footcite|fullcite|supercite|smartcite|Cite[tp]?|Parencite|Textcite|Autocite|Smartcite|Footcite|Fullcite'

/**
 * Matches LaTeX citation commands: \cite{key}, \citep{key1, key2}, \citet{key}, etc.
 * Captures the command name and the keys inside braces.
 */
const LATEX_CITE_RE = new RegExp(`\\\\(${CITE_CMDS})\\{([^}]*)\\}`, 'g')

/**
 * Matches individual citation keys inside braces (comma-separated).
 */
const KEY_RE = /([a-zA-Z][\w.-]*)/g

/**
 * ViewPlugin that decorates \cite{} commands in the viewport.
 */
function latexCitationDecorations(getByKey) {
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

        LATEX_CITE_RE.lastIndex = 0
        let match
        while ((match = LATEX_CITE_RE.exec(text)) !== null) {
          const matchFrom = start + match.index
          const matchTo = matchFrom + match[0].length
          const cmdName = match[1]
          const keysStr = match[2]

          // Decorate the \cite command
          const cmdEnd = matchFrom + cmdName.length + 1 // backslash + command name
          decorations.push(
            Decoration.mark({ class: 'cm-latex-cite-cmd' }).range(matchFrom, cmdEnd)
          )

          // Decorate braces
          decorations.push(
            Decoration.mark({ class: 'cm-latex-cite-brace' }).range(cmdEnd, cmdEnd + 1)
          )
          decorations.push(
            Decoration.mark({ class: 'cm-latex-cite-brace' }).range(matchTo - 1, matchTo)
          )

          // Decorate individual keys
          const keysStart = cmdEnd + 1
          KEY_RE.lastIndex = 0
          let keyMatch
          while ((keyMatch = KEY_RE.exec(keysStr)) !== null) {
            const keyFrom = keysStart + keyMatch.index
            const keyTo = keyFrom + keyMatch[0].length
            const key = keyMatch[1]
            const ref = getByKey(key)

            let cls = 'cm-latex-cite-key'
            if (!ref) cls = 'cm-latex-cite-key-broken'
            else if (ref._needsReview) cls = 'cm-latex-cite-key-review'

            decorations.push(Decoration.mark({ class: cls }).range(keyFrom, keyTo))
          }

          // Add inline annotation after closing brace showing formatted citation
          const keys = keysStr.split(',').map(k => k.trim()).filter(Boolean)
          const labels = keys.map(k => {
            const ref = getByKey(k)
            if (!ref) return k
            const author = ref.author?.[0]?.family || ''
            const year = ref.issued?.['date-parts']?.[0]?.[0] || ''
            return `${author} ${year}`.trim()
          })
          if (labels.length > 0) {
            decorations.push(
              Decoration.widget({
                widget: new CiteAnnotation(labels.join('; ')),
                side: 1,
              }).range(matchTo)
            )
          }
        }

        return Decoration.set(decorations.sort((a, b) => a.from - b.from))
      }
    },
    { decorations: (v) => v.decorations }
  )
}

/**
 * Inline widget showing "(Author Year)" after \cite{} commands.
 */
class CiteAnnotation extends WidgetType {
  constructor(text) {
    super()
    this.text = text
  }

  eq(other) {
    return this.text === other.text
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-latex-cite-annotation'
    span.textContent = ` (${this.text})`
    return span
  }

  ignoreEvent() {
    return true
  }
}

/**
 * Trigger plugin: detects \cite{query typing and notifies CitationPalette.
 * Uses isOpen callback to avoid stale active flags.
 */
function latexCitationTriggerPlugin(callbacks) {
  const triggerRe = new RegExp(`\\\\(${CITE_CMDS})\\{([^}]*)$`)

  return ViewPlugin.fromClass(
    class {
      update(vu) {
        if (!vu.docChanged && !vu.selectionSet) return

        const pos = vu.state.selection.main.head
        const line = vu.state.doc.lineAt(pos)
        const textBefore = line.text.substring(0, pos - line.from)

        const isOpen = callbacks.isOpen?.() || false

        const match = textBefore.match(triggerRe)
        if (!match) {
          if (isOpen) callbacks.onDismiss?.()
          return
        }

        const cmdName = match[1]
        const insideBraces = match[2]
        // Get text after last comma (for multi-key \citep{key1, query})
        const lastComma = insideBraces.lastIndexOf(',')
        const query = lastComma >= 0
          ? insideBraces.substring(lastComma + 1).trim()
          : insideBraces.trim()

        // triggerFrom: position of \ (start of entire command)
        const cmdStart = line.from + textBefore.lastIndexOf('\\' + cmdName)
        const insideExisting = lastComma >= 0 // adding to existing multi-key

        if (!isOpen) {
          // Only open on typing, not clicks — click-to-edit handled separately
          if (!vu.docChanged) return
          // Defer layout read — CM6 forbids coordsAtPos during update()
          const triggerFrom = insideExisting ? (pos - query.length) : cmdStart
          vu.view.requestMeasure({
            key: 'latex-citation-trigger',
            read: (view) => view.coordsAtPos(pos),
            write(coords) {
              if (coords && !callbacks.isOpen?.()) {
                callbacks.onOpen?.({
                  x: coords.left,
                  y: coords.bottom,
                  query,
                  triggerFrom,
                  triggerTo: pos,
                  insideBrackets: insideExisting,
                  latexCommand: cmdName,
                })
              }
            }
          })
        } else {
          callbacks.onQueryChange?.(query, pos, insideExisting ? (pos - query.length) : cmdStart)
        }
      }
    }
  )
}

/**
 * Create the LaTeX citations extension bundle.
 *
 * @param {Object} referencesStore - Pinia references store
 * @param {Object} [callbacks] - Trigger callbacks for CitationPalette:
 *   { onOpen, onQueryChange, onDismiss }
 */
export function latexCitationsExtension(referencesStore, callbacks) {
  const extensions = [
    latexCitationDecorations((key) => referencesStore.getByKey(key)),
  ]
  if (callbacks) {
    extensions.push(latexCitationTriggerPlugin(callbacks))
  }
  return { extensions }
}

export { LATEX_CITE_RE, CITE_CMDS }
