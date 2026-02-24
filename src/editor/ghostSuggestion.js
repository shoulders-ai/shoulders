import { StateField, StateEffect, Annotation, Prec } from '@codemirror/state'
import { EditorView, Decoration, WidgetType } from '@codemirror/view'
import { getGhostSuggestions } from '../services/ai'
import { useToastStore } from '../stores/toast'

// One-per-session toast tracking (reset on page reload)
const shownToasts = new Set()
function showOnce(key, msg, opts = {}) {
  if (shownToasts.has(key)) return
  shownToasts.add(key)
  useToastStore().show(msg, { type: 'error', duration: 5000, ...opts })
}

// Effects
const setGhostState = StateEffect.define()
const clearGhost = StateEffect.define()
const cycleGhost = StateEffect.define()

// Ghost text widget
class GhostTextWidget extends WidgetType {
  constructor(text, index, total) {
    super()
    this.text = text
    this.index = index
    this.total = total
  }

  toDOM() {
    const wrapper = document.createElement('span')
    wrapper.className = 'ghost-text'
    wrapper.textContent = this.text

    if (this.total > 1) {
      const badge = document.createElement('span')
      badge.className = 'ghost-badge'
      badge.textContent = `${this.index + 1}/${this.total}`
      wrapper.appendChild(badge)
    }

    return wrapper
  }

  eq(other) {
    return this.text === other.text && this.index === other.index
  }
}

// Spinner widget
class SpinnerWidget extends WidgetType {
  toDOM() {
    const wrap = document.createElement('span')
    const spacer = document.createElement('span')
    spacer.style.cssText = 'display:inline-block;width:6px'
    wrap.appendChild(spacer)
    const dots = document.createElement('span')
    dots.style.cssText = 'display:inline-flex;align-items:center;gap:3px;vertical-align:baseline; margin-bottom: -4px;'
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span')
      dot.className = 'ghost-dot'
      dot.style.animationDelay = `${i * 160}ms`
      dots.appendChild(dot)
    }
    wrap.appendChild(dots)
    return wrap
  }

  eq() {
    return true
  }
}

// State field
const ghostField = StateField.define({
  create() {
    return {
      active: false,
      loading: false,
      suggestions: [],
      activeIndex: 0,
      pos: 0,
    }
  },

  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGhostState)) {
        return { ...value, ...effect.value }
      }
      if (effect.is(clearGhost)) {
        return { active: false, loading: false, suggestions: [], activeIndex: 0, pos: 0 }
      }
      if (effect.is(cycleGhost)) {
        if (!value.active || value.suggestions.length === 0) return value
        const newIndex =
          (value.activeIndex + effect.value + value.suggestions.length) %
          value.suggestions.length
        return { ...value, activeIndex: newIndex }
      }
    }

    // If doc changed by user (not by accepting ghost), dismiss everything
    if (tr.docChanged && (value.active || value.loading) && !tr.annotation(ghostAcceptAnnotation)) {
      return { active: false, loading: false, suggestions: [], activeIndex: 0, pos: 0 }
    }

    // Map position through changes
    if (tr.changes && value.pos > 0) {
      return { ...value, pos: tr.changes.mapPos(value.pos) }
    }

    return value
  },
})

// Annotation to mark ghost acceptance transactions
const ghostAcceptAnnotation = Annotation.define()

// Decoration provider
const ghostDecorations = EditorView.decorations.compute([ghostField], (state) => {
  const ghost = state.field(ghostField)

  if (ghost.loading) {
    const widget = Decoration.widget({
      widget: new SpinnerWidget(),
      side: 1,
    })
    return Decoration.set([widget.range(ghost.pos)])
  }

  if (ghost.active && ghost.suggestions.length > 0) {
    const text = ghost.suggestions[ghost.activeIndex]
    const widget = Decoration.widget({
      widget: new GhostTextWidget(text, ghost.activeIndex, ghost.suggestions.length),
      side: 1,
    })
    return Decoration.set([widget.range(ghost.pos)])
  }

  return Decoration.none
})

// Generation counter - incremented on each trigger, checked when API returns
let currentGeneration = 0

/**
 * Trigger ghost suggestions API call.
 */
async function triggerGhostSuggestion(view, pos, getWorkspace, getSystemPrompt, getInstructions) {
  // Budget gate — silent block at 100%
  const { useUsageStore } = await import('../stores/usage')
  if (useUsageStore().isOverBudget) return

  const doc = view.state.doc.toString()
  const gen = ++currentGeneration

  // Extract context
  const before = doc.slice(Math.max(0, pos - 5000), pos)
  const after = doc.slice(pos, Math.min(doc.length, pos + 1000))

  // Set loading state
  view.dispatch({
    effects: setGhostState.of({ loading: true, pos, active: false, suggestions: [], activeIndex: 0 }),
  })

  try {
    const workspace = getWorkspace()
    const systemPrompt = getSystemPrompt()
    const instructions = getInstructions ? getInstructions() : ''

    const result = await getGhostSuggestions(before, after, systemPrompt, workspace, instructions)
    const { suggestions, usage, provider, modelId, noAccess, networkError } = result

    if (networkError) {
      if (gen !== currentGeneration) return
      view.dispatch({ effects: clearGhost.of(null) })
      showOnce('offline', 'Offline — ghost suggestions need an internet connection')
      return
    }

    if (noAccess) {
      if (gen !== currentGeneration) return
      view.dispatch({ effects: clearGhost.of(null) })
      showOnce('noAccess', 'No API key configured — add one in Settings (Cmd+,)')
      return
    }

    if (usage) {
      import('../stores/usage').then(({ useUsageStore }) => {
        useUsageStore().record({ usage, feature: 'ghost', provider, modelId })
      })
    }

    // If cancelled (generation changed or ghost cleared while loading), discard results
    if (gen !== currentGeneration) return
    const ghost = view.state.field(ghostField)
    if (!ghost.loading) return

    if (suggestions && suggestions.length > 0) {
      view.dispatch({
        effects: setGhostState.of({
          active: true,
          loading: false,
          suggestions,
          activeIndex: 0,
          pos,
        }),
      })
    } else {
      view.dispatch({ effects: clearGhost.of(null) })
    }
  } catch (e) {
    if (gen !== currentGeneration) return
    const isTimeout = /timed out/i.test(String(e))
    view.dispatch({ effects: clearGhost.of(null) })
    const errStr = String(e)
    if (/402|balance|depleted/i.test(errStr)) {
      showOnce('balance', 'AI balance depleted. Subscribe at shoulde.rs/subscribe to continue.')
    } else if (isTimeout) {
      showOnce('timeout', 'Ghost suggestion timed out — model may be slow or unreachable')
    } else {
      showOnce('error', 'Ghost suggestion failed — check your connection or API keys')
    }
  }
}

/**
 * Accept the current ghost suggestion.
 */
function acceptGhostSuggestion(view) {
  const ghost = view.state.field(ghostField)
  if (!ghost.active || ghost.suggestions.length === 0) return

  const text = ghost.suggestions[ghost.activeIndex]
  // Place cursor at end of meaningful content, not trailing whitespace
  const cursorOffset = text.trimEnd().length
  const endPos = ghost.pos + cursorOffset

  view.dispatch({
    changes: { from: ghost.pos, insert: text },
    selection: { anchor: endPos },
    effects: clearGhost.of(null),
    annotations: ghostAcceptAnnotation.of(true),
  })
}

/**
 * Create the ghost suggestion extension.
 * @param {Function} getWorkspace - Returns the workspace store instance
 * @param {Function} getSystemPrompt - Returns the system prompt
 * @param {Object} [options]
 * @param {Function} [options.isEnabled] - Returns whether ghost suggestions are enabled (default: () => true)
 * @param {Function} [options.getInstructions] - Returns user instructions from _instructions.md
 */
export function ghostSuggestionExtension(getWorkspace, getSystemPrompt, options = {}) {
  const getInstructions = options.getInstructions || (() => '')
  const isEnabled = options.isEnabled || (() => true)
  let lastPlusTime = 0

  return [
    ghostField,
    ghostDecorations,

    Prec.highest(EditorView.domEventHandlers({
      mousedown(event, view) {
        const ghost = view.state.field(ghostField)
        if (ghost.active || ghost.loading) {
          currentGeneration++
          view.dispatch({ effects: clearGhost.of(null) })
          lastPlusTime = 0
        }
        return false // always let the click through
      },
      keydown(event, view) {
        const ghost = view.state.field(ghostField)

        // Handle keys when ghost suggestions are showing
        if (ghost.active) {
          // Accept: Tab, Enter, ArrowRight
          if (event.key === 'Tab' || event.key === 'Enter' || event.key === 'ArrowRight') {
            event.preventDefault()
            acceptGhostSuggestion(view)
            return true
          }
          // Cycle: ArrowUp / ArrowDown
          if (event.key === 'ArrowUp') {
            event.preventDefault()
            view.dispatch({ effects: cycleGhost.of(-1) })
            return true
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault()
            view.dispatch({ effects: cycleGhost.of(1) })
            return true
          }
          // Cancel: Escape, ArrowLeft, or any other key
          event.preventDefault()
          view.dispatch({ effects: clearGhost.of(null) })
          // Only consume the event for Escape/ArrowLeft; let other keys pass through
          // so the character still gets typed (which will also dismiss via docChanged)
          if (event.key === 'Escape' || event.key === 'ArrowLeft') {
            return true
          }
          // For typing keys, clear ghost but don't consume - let the character insert
          // We already cleared ghost above; now let the event propagate
          return false
        }

        // Any key during loading cancels the pending request
        if (ghost.loading) {
          currentGeneration++ // invalidate the in-flight request
          view.dispatch({ effects: clearGhost.of(null) })
          // Escape is fully consumed; other keys pass through normally
          if (event.key === 'Escape') {
            event.preventDefault()
            return true
          }
          // Reset plus timer so ++ during loading doesn't re-trigger
          lastPlusTime = 0
          return false
        }

        // Detect ++ trigger (only when not loading or active and enabled)
        if (event.key === '+' && !event.ctrlKey && !event.metaKey && !event.altKey) {
          if (!isEnabled()) return false
          const now = Date.now()
          if (now - lastPlusTime < 300) {
            // Double plus detected
            event.preventDefault()
            lastPlusTime = 0
            const pos = view.state.selection.main.head
            // Delete the first + that was already inserted
            view.dispatch({
              changes: { from: pos - 1, to: pos },
            })
            // Trigger ghost suggestion
            triggerGhostSuggestion(view, pos - 1, getWorkspace, getSystemPrompt, getInstructions)
            return true
          } else {
            lastPlusTime = now
          }
        }

        return false
      },
    })),
  ]
}
