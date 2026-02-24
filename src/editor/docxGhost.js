import { Extensions } from 'superdoc/super-editor'
import { getGhostSuggestions } from '../services/ai'
import { useToastStore } from '../stores/toast'

const { Extension, Plugin, PluginKey } = Extensions

// One-per-session toast tracking (reset on page reload)
const shownToasts = new Set()
function showOnce(key, msg, opts = {}) {
  if (shownToasts.has(key)) return
  shownToasts.add(key)
  useToastStore().show(msg, { type: 'error', duration: 5000, ...opts })
}

export const ghostPluginKey = new PluginKey('docxGhostSuggestion')

// Hex format required — SuperDoc's painter prepends '#' to runProperties color values.
// rgba/rgb formats produce invalid CSS in the painted DOM (e.g. "#RGBA(0,0,0,0.3)").
const GHOST_COLOR = '#B0B0B0'
const GHOST_COLOR_VAL = 'B0B0B0' // OOXML runProperties format (no # prefix)

/**
 * Find ghost text in the document by its textStyle color mark.
 * Returns { from, to } or null. More reliable than position tracking because
 * wrapTextInRunsPlugin shifts positions when wrapping bare text in runs.
 */
function findGhostRange(doc) {
  let from = null, to = null
  const target = GHOST_COLOR.toUpperCase()
  doc.descendants((node, pos) => {
    if (node.isText && node.marks.some(m =>
      m.type.name === 'textStyle' && m.attrs.color?.toUpperCase() === target
    )) {
      if (from === null) from = pos
      to = pos + node.nodeSize
    }
  })
  return from !== null ? { from, to } : null
}

/** Walk up the resolved position to find the nearest run ancestor. */
function findAncestorRun($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'run') return $pos.node(d)
  }
  return null
}

/** Walk up the resolved position to find the depth of the nearest run ancestor. */
function findRunDepth($pos) {
  for (let d = $pos.depth; d > 0; d--) {
    if ($pos.node(d).type.name === 'run') return d
  }
  return null
}

/**
 * Ghost suggestion extension for SuperDoc (DOCX editor).
 *
 * Ghost text is inserted as a STANDALONE RUN with the ghost color baked into
 * runProperties. This ensures the painter (which reads runProperties, not marks)
 * renders the text gray immediately, without relying on calculateInlineRunPropertiesPlugin
 * to split the run after the fact.
 *
 * The textStyle mark is ALSO applied to the text node so that findGhostRange()
 * can locate ghost text by scanning marks (more reliable than position tracking).
 */
export function createDocxGhostExtension({ getWorkspace, getSystemPrompt, getInstructions, maxChars = 5000, onGhostStateChange, isEnabled }) {
  let generation = 0

  const EMPTY = { type: null, suggestions: [], activeIndex: 0 }

  function notifyChange(state) {
    onGhostStateChange?.(state?.type ? { ...state } : null)
  }

  /**
   * Remove ghost text from the document. If the ghost occupies its own run,
   * deletes the entire run (prevents empty orphan runs). Returns the range.
   */
  function removeGhost(view) {
    const range = findGhostRange(view.state.doc)
    if (range) {
      const $start = view.state.doc.resolve(range.from)
      const runDepth = findRunDepth($start)

      let deleteFrom = range.from
      let deleteTo = range.to

      // If ghost fills its entire run, delete the run node too
      if (runDepth) {
        const run = $start.node(runDepth)
        if (run.content.size === range.to - range.from) {
          deleteFrom = $start.before(runDepth)
          deleteTo = $start.after(runDepth)
        }
      }

      const tr = view.state.tr
        .delete(deleteFrom, deleteTo)
        .setMeta('addToHistory', false)
        .setMeta(ghostPluginKey, { type: 'clear' })
      view.dispatch(tr)
    } else {
      view.dispatch(view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
    }
    return range
  }

  /**
   * Accept ghost text: keep the text but remove ghost styling.
   * If ghost is in its own run, delete the run and re-insert as plain text
   * (which inherits normal run formatting). Otherwise just swap text in place.
   */
  function acceptGhost(view, text) {
    const range = findGhostRange(view.state.doc)
    if (!range) return

    const $start = view.state.doc.resolve(range.from)
    const runDepth = findRunDepth($start)
    const tr = view.state.tr

    if (runDepth) {
      const run = $start.node(runDepth)
      if (run.content.size === range.to - range.from) {
        // Ghost fills its own run — delete run, insert plain text
        // Plain text will be adopted by adjacent run or wrapped by wrapTextInRunsPlugin
        const runStart = $start.before(runDepth)
        const runEnd = $start.after(runDepth)
        tr.delete(runStart, runEnd)
        tr.insertText(text, tr.mapping.map(runStart))
        tr.setMeta(ghostPluginKey, { type: 'clear' })
        view.dispatch(tr)
        return
      }
    }

    // Ghost in a shared run — just replace text content, remove ghost mark
    tr.delete(range.from, range.to)
    tr.insertText(text, range.from)
    tr.setMeta(ghostPluginKey, { type: 'clear' })
    view.dispatch(tr)
  }

  /**
   * Insert ghost text as a standalone run with ghost color in runProperties.
   *
   * Strategy:
   * 1. Find the ancestor run at the insert position
   * 2. Split that run's content at the cursor offset into [before | after]
   * 3. Create three runs: [before-run] [ghost-run] [after-run]
   * 4. Replace the original run with the three-piece sequence
   *
   * This ensures the painter sees the ghost color immediately (no reliance on
   * calculateInlineRunPropertiesPlugin to propagate marks → runProperties).
   */
  function insertGhostText(view, text, suggestions, activeIndex) {
    const range = findGhostRange(view.state.doc)

    const schema = view.state.schema
    const badge = suggestions.length > 1 ? `  [${activeIndex + 1}/${suggestions.length}]` : ''
    const displayText = text + badge

    const tr = view.state.tr

    // Delete old ghost text (for cycling or re-insertion)
    if (range) {
      const $ghostStart = view.state.doc.resolve(range.from)
      const ghostRunDepth = findRunDepth($ghostStart)
      if (ghostRunDepth) {
        const ghostRun = $ghostStart.node(ghostRunDepth)
        if (ghostRun.content.size === range.to - range.from) {
          // Ghost fills its own run — delete the whole run
          tr.delete($ghostStart.before(ghostRunDepth), $ghostStart.after(ghostRunDepth))
        } else {
          tr.delete(range.from, range.to)
        }
      } else {
        tr.delete(range.from, range.to)
      }
    }

    const insertPos = range ? tr.mapping.map(range.from) : view.state.selection.from
    const $pos = tr.doc.resolve(insertPos)

    // Build ghost mark (for findGhostRange detection via mark scanning)
    const existingTextStyle = $pos.marks().find(m => m.type.name === 'textStyle')
    const mergedAttrs = { ...(existingTextStyle?.attrs || {}), color: GHOST_COLOR }
    const ghostMark = schema.marks.textStyle.create(mergedAttrs)

    // Build runProperties: inherit font/size/etc from context, override color for painter
    const ancestorRun = findAncestorRun($pos)
    const baseProps = ancestorRun?.attrs?.runProperties
      ? JSON.parse(JSON.stringify(ancestorRun.attrs.runProperties))
      : {}
    baseProps.color = { val: GHOST_COLOR_VAL }

    // Create ghost text node (with mark) inside a ghost run (with runProperties)
    const textNode = schema.text(displayText, [ghostMark])

    if (schema.nodes.run) {
      const ghostRun = schema.nodes.run.create({ runProperties: baseProps }, textNode)

      if (ancestorRun) {
        // Inside a run — split into [before][ghost][after]
        const runDepth = findRunDepth($pos)
        const runStart = $pos.before(runDepth)
        const runEnd = $pos.after(runDepth)
        const offsetInRun = insertPos - runStart - 1 // -1 for run node open token
        const runContent = $pos.node(runDepth).content
        const FragmentClass = runContent.constructor

        const pieces = []

        // Before-ghost piece (original run properties, content before cursor)
        if (offsetInRun > 0) {
          pieces.push(schema.nodes.run.create(
            $pos.node(runDepth).attrs,
            runContent.cut(0, offsetInRun)
          ))
        }

        // Ghost piece
        pieces.push(ghostRun)

        // After-ghost piece (original run properties, content after cursor)
        if (offsetInRun < runContent.size) {
          pieces.push(schema.nodes.run.create(
            $pos.node(runDepth).attrs,
            runContent.cut(offsetInRun)
          ))
        }

        tr.replaceWith(runStart, runEnd, FragmentClass.from(pieces))
      } else {
        // Not inside a run — just insert the ghost run directly
        tr.insert(insertPos, ghostRun)
      }
    } else {
      // Fallback: no run node in schema (shouldn't happen in DOCX, but be safe)
      tr.insertText(displayText, insertPos)
      const ghostEnd = insertPos + displayText.length
      tr.addMark(insertPos, ghostEnd, ghostMark)
    }

    // Place cursor before ghost text
    try {
      const TextSel = view.state.selection.constructor
      const newGhostRange = findGhostRange(tr.doc)
      if (newGhostRange) {
        tr.setSelection(TextSel.create(tr.doc, newGhostRange.from))
      }
    } catch (_) {}

    tr.setMeta('addToHistory', false)
    tr.setMeta(ghostPluginKey, {
      type: 'set',
      value: { type: 'suggestion', suggestions, activeIndex },
    })
    view.dispatch(tr)
  }

  async function triggerGhost(editor, pos) {
    // Budget gate — silent block at 100%
    const { useUsageStore } = await import('../stores/usage')
    if (useUsageStore().isOverBudget) return

    const gen = ++generation

    // Delete the ++ trigger characters immediately
    const triggerPos = pos - 2
    const tr = editor.view.state.tr
      .delete(triggerPos, pos)
      .setMeta('addToHistory', false)
      .setMeta(ghostPluginKey, {
        type: 'set',
        value: { type: 'loading', suggestions: [], activeIndex: 0 },
      })
    editor.view.dispatch(tr)

    // Extract context (positions are post-deletion)
    const state = editor.view.state
    const beforeText = state.doc.textBetween(0, triggerPos, '\n', ' ')
    const docEnd = state.doc.content.size
    const afterText = triggerPos < docEnd ? state.doc.textBetween(triggerPos, docEnd, '\n', ' ') : ''

    const workspace = getWorkspace()

    try {
      const result = await getGhostSuggestions(
        beforeText.slice(-maxChars),
        afterText.slice(0, maxChars),
        getSystemPrompt(),
        workspace,
        getInstructions ? getInstructions() : '',
      )
      const { suggestions, usage, provider, modelId, noAccess, networkError } = result

      if (gen !== generation) return

      if (networkError) {
        editor.view.dispatch(editor.view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
        showOnce('offline', 'Offline — ghost suggestions need an internet connection')
        return
      }

      if (noAccess) {
        editor.view.dispatch(editor.view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
        showOnce('noAccess', 'No API key configured — add one in Settings (Cmd+,)')
        return
      }

      if (usage) {
        import('../stores/usage').then(({ useUsageStore }) => {
          useUsageStore().record({ usage, feature: 'ghost', provider, modelId })
        })
      }

      if (ghostPluginKey.getState(editor.view.state)?.type !== 'loading') return

      if (suggestions?.length > 0) {
        if (!editor.view.state.schema.marks.textStyle) {
          console.warn('[ghost] textStyle mark not found in schema')
          editor.view.dispatch(editor.view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
          return
        }

        const text = suggestions[0].replace(/\n/g, ' ')
        insertGhostText(editor.view, text, suggestions, 0)

        // Diagnostic: verify ghost text is findable + run has correct color
        setTimeout(() => {
          const check = findGhostRange(editor.view.state.doc)
          if (!check) {
            console.warn('[ghost] Ghost text NOT findable after insert — mark may have been stripped')
          } else {
            // Ghost text inserted successfully
          }
        }, 200)
      } else {
        editor.view.dispatch(editor.view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
      }
    } catch (e) {
      if (gen !== generation) return
      console.error('[ghost] error:', e)
      editor.view.dispatch(editor.view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
      showOnce('error', 'Ghost suggestion failed — check your connection or API keys')
    }
  }

  return Extension.create({
    name: 'docxGhostSuggestion',

    addPmPlugins() {
      return [
        new Plugin({
          key: ghostPluginKey,

          state: {
            init: () => ({ ...EMPTY }),
            apply(tr, prev) {
              const meta = tr.getMeta(ghostPluginKey)
              if (meta) {
                if (meta.type === 'clear') return { ...EMPTY }
                if (meta.type === 'set') return { ...meta.value }
              }
              // Typing during loading dismisses spinner (matches CM6 behavior)
              if (prev.type === 'loading' && tr.docChanged) {
                generation++ // cancel pending API call
                return { ...EMPTY }
              }
              // Keep state alive through structural doc changes (e.g. wrapTextInRunsPlugin).
              // Ghost text is identified by its mark, not by tracked positions.
              // User-initiated dismissal is handled by handleKeyDown (explicit clear).
              return prev
            },
          },

          view() {
            return {
              update(view) {
                notifyChange(ghostPluginKey.getState(view.state))
              },
            }
          },

          props: {
            handleKeyDown(view, event) {
              const st = ghostPluginKey.getState(view.state)
              if (!st?.type) return false

              // ─── Suggestion visible (inline gray text in document) ───
              if (st.type === 'suggestion' && st.suggestions.length > 0) {

                // Accept: Tab / Enter / ArrowRight
                if (event.key === 'Tab' || event.key === 'Enter' || event.key === 'ArrowRight') {
                  event.preventDefault()
                  const text = st.suggestions[st.activeIndex].replace(/\n/g, ' ')
                  acceptGhost(view, text)
                  return true
                }

                // Cycle: ArrowUp / ArrowDown
                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                  if (st.suggestions.length < 2) return true
                  event.preventDefault()

                  const delta = event.key === 'ArrowUp' ? -1 : 1
                  const newIndex = (st.activeIndex + delta + st.suggestions.length) % st.suggestions.length
                  const newText = st.suggestions[newIndex].replace(/\n/g, ' ')
                  insertGhostText(view, newText, st.suggestions, newIndex)
                  return true
                }

                // Dismiss: Escape
                if (event.key === 'Escape') {
                  event.preventDefault()
                  removeGhost(view)
                  return true
                }

                // Any other key: dismiss ghost text, then let ProseMirror handle the key
                removeGhost(view)
                return false
              }

              // ─── Loading state ───
              if (st.type === 'loading') {
                generation++ // Cancel pending API call
                view.dispatch(view.state.tr.setMeta(ghostPluginKey, { type: 'clear' }))
                if (event.key === 'Escape') {
                  event.preventDefault()
                  return true
                }
                return false
              }

              return false
            },
          },
        }),
      ]
    },

    onUpdate({ editor }) {
      if (isEnabled && !isEnabled()) return

      const st = ghostPluginKey.getState(editor.state)
      if (st?.type) return // Ghost already active, don't re-trigger

      const pos = editor.state.selection.from
      if (pos < 2) return

      try {
        const textBefore = editor.state.doc.textBetween(pos - 2, pos, '', '')
        if (textBefore === '++') {
          triggerGhost(editor, pos)
        }
      } catch (e) {
        // Position at node boundary — ignore
      }
    },
  })
}
