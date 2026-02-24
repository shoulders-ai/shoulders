import { EditorView, Decoration, ViewPlugin } from '@codemirror/view'
import { syntaxTree } from '@codemirror/language'
// autocompletion is combined in TextEditor.vue — we just export the raw source

/**
 * Check if a position is inside a code block or inline code using the Lezer syntax tree.
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

// Wiki link regex
const WIKILINK_RE = /\[\[([^\]]+)\]\]/g

/**
 * ViewPlugin that scans visible ranges and decorates wiki links.
 */
function wikiLinkDecorations(resolveLink, currentFilePath) {
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

        // Get text in viewport range (with some buffer)
        const start = Math.max(0, from - 200)
        const end = Math.min(view.state.doc.length, to + 200)
        const text = view.state.doc.sliceString(start, end)

        WIKILINK_RE.lastIndex = 0
        let match
        while ((match = WIKILINK_RE.exec(text)) !== null) {
          const matchFrom = start + match.index
          const matchTo = matchFrom + match[0].length
          const raw = match[1]

          // Skip if inside code
          if (isInCodeContext(view.state, matchFrom, matchTo)) continue

          // Parse target|display
          let target = raw
          let display = null
          const pipeIdx = raw.indexOf('|')
          if (pipeIdx !== -1) {
            target = raw.substring(0, pipeIdx)
            display = raw.substring(pipeIdx + 1)
          }

          // Strip heading for resolution
          const hashIdx = target.indexOf('#')
          const linkTarget = hashIdx !== -1 ? target.substring(0, hashIdx) : target

          // Resolve
          const filePath = currentFilePath()
          const resolved = linkTarget.trim() ? resolveLink(linkTarget.trim(), filePath) : null

          // Bracket positions: [[ and ]]
          const openEnd = matchFrom + 2
          const closeStart = matchTo - 2

          if (display !== null) {
            // [[target|display]] format
            const targetEnd = matchFrom + 2 + target.length
            const pipePos = targetEnd
            const displayStart = pipePos + 1

            // [[ brackets
            decorations.push(
              Decoration.mark({ class: 'cm-wikilink-bracket' }).range(matchFrom, openEnd)
            )
            // target part (dimmed) - skip if empty
            if (openEnd < targetEnd) {
              decorations.push(
                Decoration.mark({ class: 'cm-wikilink-target' }).range(openEnd, targetEnd)
              )
            }
            // pipe
            decorations.push(
              Decoration.mark({ class: 'cm-wikilink-pipe' }).range(pipePos, displayStart)
            )
            // display text - skip if empty
            if (displayStart < closeStart) {
              const displayClass = resolved ? 'cm-wikilink-display' : 'cm-wikilink-broken'
              decorations.push(
                Decoration.mark({ class: displayClass }).range(displayStart, closeStart)
              )
            }
            // ]] brackets
            decorations.push(
              Decoration.mark({ class: 'cm-wikilink-bracket' }).range(closeStart, matchTo)
            )
          } else {
            // [[target]] format - simple
            // [[ brackets
            decorations.push(
              Decoration.mark({ class: 'cm-wikilink-bracket' }).range(matchFrom, openEnd)
            )
            // link text
            const linkClass = resolved ? 'cm-wikilink' : 'cm-wikilink-broken'
            decorations.push(
              Decoration.mark({ class: linkClass }).range(openEnd, closeStart)
            )
            // ]] brackets
            decorations.push(
              Decoration.mark({ class: 'cm-wikilink-bracket' }).range(closeStart, matchTo)
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
 * Autocomplete source for wiki links.
 * Activates when cursor is between [[ and ]].
 */
function wikiLinkCompletionSource(getFiles, getHeadings) {
  return (context) => {
        // Check if we're inside [[ ... ]]
        const { state, pos } = context
        const line = state.doc.lineAt(pos)
        const textBefore = line.text.substring(0, pos - line.from)

        // Find last [[ that isn't closed
        const lastOpen = textBefore.lastIndexOf('[[')
        if (lastOpen === -1) return null

        // Check it's not already closed before cursor
        const afterOpen = textBefore.substring(lastOpen + 2)
        if (afterOpen.includes(']]')) return null

        const linkStart = lastOpen + 2
        const typed = afterOpen

        // Check if we're after a # (heading completion)
        const hashIdx = typed.indexOf('#')
        if (hashIdx !== -1) {
          const target = typed.substring(0, hashIdx).trim()
          const headingPrefix = typed.substring(hashIdx + 1)
          const headings = getHeadings(target)

          if (!headings) return null

          const from = line.from + linkStart + hashIdx + 1
          return {
            from,
            options: headings
              .filter(h => h.toLowerCase().includes(headingPrefix.toLowerCase()))
              .map(h => ({
                label: h,
                apply: (view, completion, from, to) => {
                  // Find existing ]] after cursor
                  const afterCursor = view.state.doc.sliceString(to, Math.min(to + 10, view.state.doc.length))
                  const closingIdx = afterCursor.indexOf(']]')
                  const endPos = closingIdx !== -1 ? to + closingIdx : to
                  view.dispatch({
                    changes: { from, to: endPos, insert: h },
                    selection: { anchor: from + h.length + (closingIdx !== -1 ? 2 : 0) },
                  })
                },
              })),
            validFor: /^[^|\]]*$/,
          }
        }

        // File name completion
        const files = getFiles()
        const from = line.from + linkStart
        const filter = typed.toLowerCase()

        const options = []

        // Shared apply function for file/alias completions
        function applyCompletion(view, completion, from, to) {
          const afterCursor = view.state.doc.sliceString(to, Math.min(to + 10, view.state.doc.length))
          const closingIdx = afterCursor.indexOf(']]')
          const endPos = closingIdx !== -1 ? to + closingIdx + 2 : to
          const insert = completion.label + ']]'
          view.dispatch({
            changes: { from, to: endPos, insert },
            selection: { anchor: from + insert.length },
          })
        }

        // Add file names
        for (const f of files) {
          if (filter && !f.name.toLowerCase().includes(filter) && !f.normalized.includes(filter)) continue
          options.push({
            label: f.name,
            detail: f.path.split('/').slice(-2, -1)[0] || '',
            apply: applyCompletion,
          })
        }

        if (options.length === 0) return null

        return {
          from,
          options,
          validFor: /^[^|\]#]*$/,
        }
  }
}

/**
 * Create the wiki links extension bundle.
 * Click navigation is handled natively in MarkdownEditor.vue (not via CM6 events).
 *
 * @param {Object} opts
 * @param {Function} opts.resolveLink - (target, fromPath) → {path, heading} | null
 * @param {Function} opts.getFiles - () → [{name, path, normalized}]
 * @param {Function} opts.getHeadings - (target) → [heading, ...] | null
 * @param {Function} opts.currentFilePath - () → string
 */
export function wikiLinksExtension({ resolveLink, getFiles, getHeadings, currentFilePath }) {
  return {
    extensions: [wikiLinkDecorations(resolveLink, currentFilePath)],
    completionSource: wikiLinkCompletionSource(getFiles, getHeadings),
  }
}

/**
 * Regex for wiki link matching - exported for use by click handler in MarkdownEditor.
 */
export { WIKILINK_RE }
