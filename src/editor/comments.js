import { StateField, StateEffect, RangeSet } from '@codemirror/state'
import { EditorView, Decoration, gutter, GutterMarker } from '@codemirror/view'

// ── Effects ──────────────────────────────────────────────────────
export const addComment = StateEffect.define()
export const removeComment = StateEffect.define()
export const updateComment = StateEffect.define()
export const setActiveComment = StateEffect.define()

// ── Gutter marker ────────────────────────────────────────────────
class CommentGutterMarker extends GutterMarker {
  constructor(comment) {
    super()
    this.comment = comment
  }

  toDOM() {
    const el = document.createElement('div')
    el.className = 'comment-gutter-dot'
    el.dataset.commentId = this.comment.id
    el.title = this.comment.author || 'Comment'
    // Inline SVG speech-bubble icon (14x14, fits the gutter)
    el.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">' +
      '<path d="M3 2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2.586l1.707 1.707a1 1 0 0 0 1.414 0L10.414 11H13a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3Z"/>' +
      '</svg>'
    return el
  }

  eq(other) {
    return (
      this.comment.id === other.comment.id &&
      this.comment.status === other.comment.status
    )
  }
}

// ── State field ──────────────────────────────────────────────────
export const commentField = StateField.define({
  create() {
    return { comments: [], activeId: null }
  },

  update(value, tr) {
    let { comments, activeId } = value

    // Map positions through document changes
    if (tr.docChanged) {
      const oldLen = tr.startState.doc.length
      comments = comments.map((c) => {
        // Clamp stale positions to old doc length BEFORE mapping —
        // persisted comments or external file changes can exceed the
        // changeset range, which makes mapPos throw a RangeError.
        const clampedFrom = Math.min(c.from, oldLen)
        const clampedTo = Math.min(c.to, oldLen)
        const from = tr.changes.mapPos(clampedFrom, -1)
        const to = tr.changes.mapPos(clampedTo, 1)
        return {
          ...c,
          from: Math.min(from, to),
          to: Math.max(from, to),
        }
      })
    }

    // Process effects in order
    for (const effect of tr.effects) {
      if (effect.is(addComment)) {
        const { id, from, to, status, author } = effect.value
        comments = [...comments, { id, from, to, status: status || 'open', author: author || '' }]
      }
      if (effect.is(removeComment)) {
        comments = comments.filter((c) => c.id !== effect.value)
      }
      if (effect.is(updateComment)) {
        comments = comments.map((c) =>
          c.id === effect.value.id ? { ...c, ...effect.value } : c
        )
      }
      if (effect.is(setActiveComment)) {
        activeId = effect.value
      }
    }

    return { comments, activeId }
  },
})

// ── Gutter ───────────────────────────────────────────────────────
const commentGutterExtension = gutter({
  class: 'comment-gutter',
  markers: (view) => {
    const { comments } = view.state.field(commentField)
    const markers = []

    for (const c of comments) {
      if (c.status === 'resolved') continue
      const line = view.state.doc.lineAt(c.from)
      markers.push(new CommentGutterMarker(c).range(line.from))
    }

    return RangeSet.of(markers.sort((a, b) => a.from - b.from))
  },
  // Gutter clicks — EditorView.domEventHandlers only covers the
  // content area, so gutter dots need their own handler here.
  domEventHandlers: {
    click(view, line, event) {
      const target = event.target.closest?.('.comment-gutter-dot') || event.target
      if (target.classList?.contains('comment-gutter-dot') || target.closest?.('.comment-gutter-dot')) {
        const dot = target.classList.contains('comment-gutter-dot') ? target : target.closest('.comment-gutter-dot')
        const commentId = dot?.dataset?.commentId
        if (commentId) {
          view.dom.dispatchEvent(
            new CustomEvent('comment-click', {
              detail: { commentId },
              bubbles: true,
            })
          )
        }
        return true
      }
      return false
    },
  },
})

// ── Range highlights ─────────────────────────────────────────────
const commentHighlights = EditorView.decorations.compute(
  [commentField],
  (state) => {
    const { comments, activeId } = state.field(commentField)
    const decorations = comments
      .filter((c) => c.status !== 'resolved' && c.from < c.to)
      .map((c) => {
        const isActive = c.id === activeId
        return Decoration.mark({
          class: isActive ? 'comment-range comment-range-active' : 'comment-range',
        }).range(c.from, c.to)
      })

    return Decoration.set(decorations.sort((a, b) => a.from - b.from))
  }
)

// ── Click handler for highlighted ranges in the content area ─────
const commentRangeClick = EditorView.domEventHandlers({
  click(event, view) {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
    if (pos === null) return false

    const { comments } = view.state.field(commentField)
    const clicked = comments.find(
      (c) => c.status !== 'resolved' && c.from < c.to && pos >= c.from && pos <= c.to
    )
    if (clicked) {
      view.dom.dispatchEvent(
        new CustomEvent('comment-click', {
          detail: { commentId: clicked.id },
          bubbles: true,
        })
      )
      // Don't consume the event — allow normal cursor placement
    }

    return false
  },
})

// ── Public extension ─────────────────────────────────────────────
/**
 * Create the comments extension for CodeMirror 6.
 *
 * Provides:
 * - State field tracking comment anchors (position-mapped through edits)
 * - Gutter markers (speech bubble icons) with click handlers
 * - Range highlight decorations (subtle for inactive, stronger for active)
 * - Content-area click handler dispatching `comment-click` CustomEvents
 */
export function commentsExtension() {
  return [commentField, commentGutterExtension, commentHighlights, commentRangeClick]
}
