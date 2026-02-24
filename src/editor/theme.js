import { EditorView } from '@codemirror/view'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

export const shouldersTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--fg-primary)',
    },
    '.cm-content': {
      caretColor: 'var(--accent)',
      fontFamily: "var(--font-mono)",
      padding: '16px 0',
      lineHeight: '1.6',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)',
      borderLeftWidth: '2px',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--editor-active-line)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--editor-selection) !important',
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--fg-muted)',
      border: 'none',
      paddingLeft: '8px',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'transparent',
      color: 'var(--fg-secondary)',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      padding: '0 8px 0 4px',
      minWidth: '32px',
    },
    '.cm-foldGutter .cm-gutterElement': {
      padding: '0 4px',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'var(--editor-bracket-match)',
      outline: '1px solid var(--editor-bracket-border)',
    },
    '.cm-searchMatch': {
      backgroundColor: 'var(--editor-search-match)',
    },
    '.cm-searchMatch.cm-searchMatch-selected': {
      backgroundColor: 'var(--editor-search-match)',
      outline: '1px solid var(--accent)',
    },
    '.cm-panels': {
      backgroundColor: 'var(--bg-secondary)',
      color: 'var(--fg-primary)',
    },
    '.cm-panels.cm-panels-top': {
      borderBottom: '1px solid var(--border)',
    },
    '.cm-panels.cm-panels-bottom': {
      borderTop: '1px solid var(--border)',
    },
    '.cm-button': {
      backgroundColor: 'var(--bg-tertiary)',
      color: 'var(--fg-primary)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '2px 8px',
      cursor: 'pointer',
    },
    '.cm-textfield': {
      backgroundColor: 'var(--bg-primary)',
      color: 'var(--fg-primary)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
    },
    '.cm-tooltip': {
      backgroundColor: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      color: 'var(--fg-primary)',
    },
    '.cm-tooltip-autocomplete': {
      '& > ul > li': {
        padding: '4px 8px',
      },
      '& > ul > li[aria-selected]': {
        backgroundColor: 'var(--bg-hover)',
        color: 'var(--fg-primary)',
      },
    },
  },
  { dark: true }
)

export const shouldersHighlightStyle = HighlightStyle.define([
  // ── Markdown / prose ──────────────────────────────────
  { tag: tags.heading1, color: 'var(--hl-heading)', fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading2, color: 'var(--hl-heading)', fontWeight: 'bold', fontSize: '1.25em' },
  { tag: tags.heading3, color: 'var(--hl-heading)', fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading4, color: 'var(--hl-heading-minor)', fontWeight: 'bold' },
  { tag: tags.heading5, color: 'var(--hl-heading-minor)', fontWeight: 'bold' },
  { tag: tags.heading6, color: 'var(--hl-heading-minor)', fontWeight: 'bold' },
  { tag: tags.emphasis, color: 'var(--hl-emphasis)', fontStyle: 'italic' },
  { tag: tags.strong, color: 'var(--fg-primary)', fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through', color: 'var(--fg-muted)' },
  { tag: tags.link, color: 'var(--hl-link)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--hl-link)' },
  { tag: tags.monospace, color: 'var(--hl-code)', fontFamily: "var(--font-mono)" },
  { tag: tags.quote, color: 'var(--fg-secondary)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--hl-list)' },
  { tag: tags.contentSeparator, color: 'var(--fg-muted)' },

  // ── Comments ──────────────────────────────────────────
  { tag: tags.comment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: tags.lineComment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: tags.blockComment, color: 'var(--hl-comment)', fontStyle: 'italic' },
  { tag: tags.docComment, color: 'var(--hl-comment)', fontStyle: 'italic' },

  // ── Strings & literals ────────────────────────────────
  { tag: tags.string, color: 'var(--hl-string)' },
  { tag: tags.docString, color: 'var(--hl-string)', fontStyle: 'italic' },
  { tag: tags.character, color: 'var(--hl-string)' },
  { tag: tags.special(tags.string), color: 'var(--hl-string)' },
  { tag: tags.regexp, color: 'var(--hl-regexp)' },
  { tag: tags.escape, color: 'var(--hl-escape)', fontWeight: 'bold' },
  { tag: tags.number, color: 'var(--hl-number)' },
  { tag: tags.integer, color: 'var(--hl-number)' },
  { tag: tags.float, color: 'var(--hl-number)' },
  { tag: tags.bool, color: 'var(--hl-constant)' },
  { tag: tags.null, color: 'var(--hl-constant)' },
  { tag: tags.atom, color: 'var(--hl-constant)' },

  // ── Keywords (differentiated) ─────────────────────────
  { tag: tags.keyword, color: 'var(--hl-keyword)' },
  { tag: tags.controlKeyword, color: 'var(--hl-ctrl-keyword)' },
  { tag: tags.definitionKeyword, color: 'var(--hl-def-keyword)' },
  { tag: tags.moduleKeyword, color: 'var(--hl-module-keyword)' },
  { tag: tags.operatorKeyword, color: 'var(--hl-keyword)' },
  { tag: tags.modifier, color: 'var(--hl-keyword)' },
  { tag: tags.self, color: 'var(--hl-self)' },
  { tag: tags.unit, color: 'var(--hl-number)' },

  // ── Names ─────────────────────────────────────────────
  { tag: tags.variableName, color: 'var(--fg-primary)' },
  { tag: tags.definition(tags.variableName), color: 'var(--fg-primary)' },
  { tag: tags.function(tags.variableName), color: 'var(--hl-function)' },
  { tag: tags.function(tags.definition(tags.variableName)), color: 'var(--hl-function)' },
  { tag: tags.constant(tags.variableName), color: 'var(--hl-constant)' },
  { tag: tags.standard(tags.variableName), color: 'var(--hl-function)' },
  { tag: tags.local(tags.variableName), color: 'var(--fg-primary)' },
  { tag: tags.special(tags.variableName), color: 'var(--hl-constant)' },

  // ── Types & classes ───────────────────────────────────
  { tag: tags.typeName, color: 'var(--hl-type)' },
  { tag: tags.className, color: 'var(--hl-class)' },
  { tag: tags.definition(tags.className), color: 'var(--hl-class)' },
  { tag: tags.definition(tags.typeName), color: 'var(--hl-type)' },
  { tag: tags.standard(tags.typeName), color: 'var(--hl-type)' },
  { tag: tags.namespace, color: 'var(--hl-type)' },
  { tag: tags.macroName, color: 'var(--hl-decorator)' },

  // ── Properties & attributes ───────────────────────────
  { tag: tags.propertyName, color: 'var(--hl-property)' },
  { tag: tags.function(tags.propertyName), color: 'var(--hl-function)' },
  { tag: tags.definition(tags.propertyName), color: 'var(--hl-property)' },
  { tag: tags.special(tags.propertyName), color: 'var(--hl-property)' },
  { tag: tags.attributeName, color: 'var(--hl-attribute)' },
  { tag: tags.attributeValue, color: 'var(--hl-string)' },

  // ── HTML / XML tags ───────────────────────────────────
  { tag: tags.tagName, color: 'var(--hl-tag)' },
  { tag: tags.standard(tags.tagName), color: 'var(--hl-tag)' },
  { tag: tags.angleBracket, color: 'var(--hl-punctuation)' },

  // ── Operators ─────────────────────────────────────────
  { tag: tags.operator, color: 'var(--hl-operator)' },
  { tag: tags.arithmeticOperator, color: 'var(--hl-operator)' },
  { tag: tags.logicOperator, color: 'var(--hl-operator)' },
  { tag: tags.bitwiseOperator, color: 'var(--hl-operator)' },
  { tag: tags.compareOperator, color: 'var(--hl-operator)' },
  { tag: tags.updateOperator, color: 'var(--hl-operator)' },
  { tag: tags.definitionOperator, color: 'var(--hl-operator)' },
  { tag: tags.typeOperator, color: 'var(--hl-operator)' },
  { tag: tags.derefOperator, color: 'var(--hl-punctuation)' },

  // ── Punctuation & brackets ────────────────────────────
  { tag: tags.punctuation, color: 'var(--hl-punctuation)' },
  { tag: tags.separator, color: 'var(--hl-punctuation)' },
  { tag: tags.bracket, color: 'var(--hl-bracket)' },
  { tag: tags.paren, color: 'var(--hl-bracket)' },
  { tag: tags.squareBracket, color: 'var(--hl-bracket)' },
  { tag: tags.brace, color: 'var(--hl-bracket)' },

  // ── Meta & decorators ─────────────────────────────────
  { tag: tags.meta, color: 'var(--hl-decorator)' },
  { tag: tags.annotation, color: 'var(--hl-decorator)' },
  { tag: tags.processingInstruction, color: 'var(--fg-muted)' },
  { tag: tags.labelName, color: 'var(--hl-heading-minor)' },

  // ── CSS-specific ──────────────────────────────────────
  { tag: tags.color, color: 'var(--hl-constant)' },

  // ── Diff ──────────────────────────────────────────────
  { tag: tags.inserted, color: 'var(--success)' },
  { tag: tags.deleted, color: 'var(--error)' },
  { tag: tags.changed, color: 'var(--warning)' },

  // ── Invalid ───────────────────────────────────────────
  { tag: tags.invalid, color: 'var(--error)', textDecoration: 'underline wavy' },
])

export const shouldersHighlighting = syntaxHighlighting(shouldersHighlightStyle)
