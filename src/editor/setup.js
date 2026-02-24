import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { bracketMatching, indentOnInput, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'
import { closeBrackets, closeBracketsKeymap } from '@codemirror/autocomplete'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { shouldersTheme, shouldersHighlighting } from './theme'

// Shared compartment for line wrapping - reconfigured when user toggles soft wrap
export const wrapCompartment = new Compartment()

// Shared compartment for spellcheck - reconfigured when user toggles spell check
export const spellCheckCompartment = new Compartment()

// Shared compartment for wrap column width - constrains content to N characters
export const columnWidthCompartment = new Compartment()

export function columnWidthExtension(col) {
  if (col > 0) {
    return EditorView.theme({ '.cm-content': { maxWidth: col + 'ch' } })
  }
  return []
}

/**
 * Create a debounced auto-save extension.
 * Calls `onSave(content)` 1 second after the last edit.
 */
function autoSaveExtension(onSave) {
  let timeout = null

  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        const content = update.view.state.doc.toString()
        onSave(content)
      }, 1000)
    }
  })
}

/**
 * Create cursor position listener extension.
 * Calls `onCursorChange({ line, col })` when cursor moves.
 */
function cursorPositionExtension(onCursorChange) {
  return EditorView.updateListener.of((update) => {
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head
      const line = update.state.doc.lineAt(pos)
      onCursorChange({
        line: line.number,
        col: pos - line.from + 1,
        offset: pos,
      })
    }
  })
}

/**
 * Create editor stats listener extension.
 * Reports word count, char count, and selection stats.
 */
function editorStatsExtension(onStats) {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged || update.selectionSet || update.startState === update.state) {
      const text = update.state.doc.toString()
      const words = text.trim() ? text.trim().split(/\s+/).length : 0
      const chars = text.replace(/\s/g, '').length

      const sel = update.state.selection.main
      let selWords = 0
      let selChars = 0
      if (sel.from !== sel.to) {
        const selText = update.state.sliceDoc(sel.from, sel.to)
        selWords = selText.trim() ? selText.trim().split(/\s+/).length : 0
        selChars = selText.replace(/\s/g, '').length
      }

      onStats({ words, chars, selWords, selChars })
    }
  })
}

/**
 * Create the full set of CodeMirror extensions.
 * Pass a languageExtension for syntax highlighting (or null for plain text).
 */
export function createEditorExtensions({ onSave, onCursorChange, onStats, softWrap = true, wrapColumn = 0, spellcheck = false, languageExtension = null, extraExtensions = [] }) {
  return [
    // Soft wrap (toggleable via compartment)
    wrapCompartment.of(softWrap ? EditorView.lineWrapping : []),

    // Wrap column width (constrains content to N chars when > 0)
    columnWidthCompartment.of(columnWidthExtension(wrapColumn)),

    // Spellcheck (toggleable via compartment)
    spellCheckCompartment.of(spellcheck ? EditorView.contentAttributes.of({ spellcheck: 'true' }) : []),

    // Core
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    history(),
    foldGutter(),
    drawSelection(),
    dropCursor(),
    indentOnInput(),
    bracketMatching(),
    closeBrackets(),
    rectangularSelection(),
    crosshairCursor(),
    highlightSelectionMatches(),

    // Language (dynamic — passed by caller)
    ...(languageExtension ? [languageExtension] : []),

    // Theme
    shouldersTheme,
    shouldersHighlighting,

    // Keymaps
    keymap.of([
      indentWithTab,
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...searchKeymap,
      ...historyKeymap,
      ...foldKeymap,
    ]),

    // Auto-save
    ...(onSave ? [autoSaveExtension(onSave)] : []),

    // Cursor tracking
    ...(onCursorChange ? [cursorPositionExtension(onCursorChange)] : []),

    // Editor stats (word count, char count, selection)
    ...(onStats ? [editorStatsExtension(onStats)] : []),

    // Extra extensions (ghost suggestions, diff overlays, tasks, etc.)
    ...extraExtensions,
  ]
}

/**
 * Create a new CodeMirror EditorState with the given content and extensions.
 */
export function createEditorState(content, extensions) {
  return EditorState.create({
    doc: content,
    extensions,
  })
}
