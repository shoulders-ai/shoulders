import { StateField, StateEffect, RangeSet } from '@codemirror/state'
import { EditorView, Decoration, gutter, GutterMarker } from '@codemirror/view'

// Effects
export const addTask = StateEffect.define()
export const removeTask = StateEffect.define()
export const updateTask = StateEffect.define()

// Task gutter marker
class TaskGutterMarker extends GutterMarker {
  constructor(task) {
    super()
    this.task = task
  }

  toDOM() {
    const dot = document.createElement('div')
    // Map thread status to CSS class
    const cssStatus = this.task.status === 'streaming' ? 'streaming'
      : this.task.status === 'error' ? 'error'
      : 'idle'
    dot.className = `task-dot task-${cssStatus}`
    const firstMsg = this.task.messages?.[0]?.content || ''
    dot.title = firstMsg.length > 60 ? firstMsg.slice(0, 60) + '...' : firstMsg
    dot.dataset.taskId = this.task.id
    return dot
  }

  eq(other) {
    return (
      this.task.id === other.task.id &&
      this.task.status === other.task.status
    )
  }
}

// State field for tasks
export const taskField = StateField.define({
  create() {
    return []
  },

  update(value, tr) {
    // Map positions through document changes
    let mapped = value
    if (tr.docChanged) {
      const oldLen = tr.startState.doc.length
      mapped = value.map((task) => {
        // Clamp to old doc length before mapping — stale positions from
        // persisted tasks or external file changes can exceed the
        // changeset range, which makes mapPos throw a RangeError.
        const clampedFrom = Math.min(task.range.from, oldLen)
        const clampedTo = Math.min(task.range.to, oldLen)
        const from = tr.changes.mapPos(clampedFrom, -1)
        const to = tr.changes.mapPos(clampedTo, 1)
        return {
          ...task,
          range: { from: Math.min(from, to), to: Math.max(from, to) },
        }
      })
    }

    for (const effect of tr.effects) {
      if (effect.is(addTask)) {
        mapped = [...mapped, effect.value]
      }
      if (effect.is(removeTask)) {
        mapped = mapped.filter((c) => c.id !== effect.value)
      }
      if (effect.is(updateTask)) {
        mapped = mapped.map((c) =>
          c.id === effect.value.id ? { ...c, ...effect.value } : c
        )
      }
    }

    return mapped
  },
})

// Task gutter
const taskGutterExtension = gutter({
  class: 'task-gutter',
  markers: (view) => {
    const tasks = view.state.field(taskField)
    const markers = []

    for (const task of tasks) {
      if (task.status === 'resolved') continue
      const line = view.state.doc.lineAt(task.range.from)
      markers.push(new TaskGutterMarker(task).range(line.from))
    }

    return RangeSet.of(markers.sort((a, b) => a.from - b.from))
  },
  // Gutter clicks — EditorView.domEventHandlers only covers the content area,
  // so gutter dots need their own handler here.
  domEventHandlers: {
    click(view, line, event) {
      const target = event.target
      if (target.classList?.contains('task-dot')) {
        const taskId = target.dataset.taskId
        if (taskId) {
          view.dom.dispatchEvent(
            new CustomEvent('task-click', {
              detail: { taskId },
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

// Task range highlighting
const taskHighlights = EditorView.decorations.compute(
  [taskField],
  (state) => {
    const tasks = state.field(taskField)
    const decorations = tasks
      .filter((c) => c.status !== 'resolved' && c.range.from < c.range.to)
      .map((c) => {
        const cssStatus = c.status === 'streaming' ? 'streaming'
          : c.status === 'error' ? 'error'
          : 'idle'
        return Decoration.mark({
          class: `task-range task-range-${cssStatus}`,
        }).range(c.range.from, c.range.to)
      })

    return Decoration.set(decorations.sort((a, b) => a.from - b.from))
  }
)

// Click handler for highlighted task ranges in the content area
const taskRangeClick = EditorView.domEventHandlers({
  click(event, view) {
    const target = event.target
    if (target.closest?.('.task-range') || target.classList?.contains('task-range')) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY })
      if (pos !== null) {
        const tasks = view.state.field(taskField)
        const clicked = tasks.find(c =>
          c.status !== 'resolved' && pos >= c.range.from && pos <= c.range.to
        )
        if (clicked) {
          view.dom.dispatchEvent(
            new CustomEvent('task-click', {
              detail: { taskId: clicked.id },
              bubbles: true,
            })
          )
          return true
        }
      }
    }

    return false
  },
})

/**
 * Create the tasks extension.
 */
export function tasksExtension() {
  return [taskField, taskGutterExtension, taskHighlights, taskRangeClick]
}
