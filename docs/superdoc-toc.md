# SuperDoc Documentation — Table of Contents

Local copy of [docs.superdoc.dev](https://docs.superdoc.dev). Navigation derived from Mintlify `docs.json`.

---

## Getting Started
- [Introduction](getting-started/introduction.mdx)
- [AI Agents](getting-started/ai-agents.mdx)
- [Installation](getting-started/installation.mdx)
- **Frameworks**
  - [React](getting-started/frameworks/react.mdx)
  - [Vue](getting-started/frameworks/vue.mdx)
  - [Angular](getting-started/frameworks/angular.mdx)
  - [Vanilla JS](getting-started/frameworks/vanilla-js.mdx)
- [Import & Export](getting-started/import-export.mdx)
- [Fonts](getting-started/fonts.mdx)

## Core

### SuperDoc (top-level class)
- [Overview](core/superdoc/overview.mdx)
- [Configuration](core/superdoc/configuration.mdx) — all config options
- [Methods & Properties](core/superdoc/methods.mdx) — `destroy()`, `export()`, `setDocumentMode()`, `addCommentsList()`, etc.
- [Events](core/superdoc/events.mdx) — `ready`, `editor-update`, `comments-update`, etc.

### SuperEditor (ProseMirror-based editor)
- [Overview](core/supereditor/overview.mdx)
- [Configuration](core/supereditor/configuration.mdx) — `editorExtensions`, `user`, `documentMode`, etc.
- [Methods](core/supereditor/methods.mdx) — `commands.*`, `isActive()`, `getJSON()`, etc.
- [Events](core/supereditor/events.mdx) — `update`, `selectionUpdate`, `commentsUpdate`, etc.

## Document API (alpha)
- [Overview](document-api/overview.mdx) — `comments.*`, `trackedChanges.*` operations

## Modules

### Comments (most relevant to us)
- [Comments Module](modules/comments.mdx) — config, commands (`addComment`, `addCommentReply`, `removeComment`, `resolveComment`, `setActiveComment`), events, data structure, export

### Other Modules
- [Overview](modules/overview.mdx)
- [Toolbar](modules/toolbar.mdx)
- [Context Menu](modules/context-menu.mdx)

## Extensions

### Key Extensions (frequently used)
- [Comments](extensions/comments.mdx) — `addComment`, `insertComment`, `removeComment`, `setActiveComment`, `setCursorById`
- [Track Changes](extensions/track-changes.mdx) — accept/reject, tracked change marks
- [Link](extensions/link.mdx) — link marks, `superdoc-link-click` event, `sanitizeHref`
- [Bold](extensions/bold.mdx) / [Italic](extensions/italic.mdx) / [Underline](extensions/underline.mdx)
- [History](extensions/history.mdx) — undo/redo
- [Search](extensions/search.mdx)
- [Image](extensions/image.mdx)
- [Table](extensions/table.mdx) / [Table Cell](extensions/table-cell.mdx) / [Table Row](extensions/table-row.mdx)

### Formatting & Text
- [Color](extensions/color.mdx) / [Highlight](extensions/highlight.mdx) / [Strike](extensions/strike.mdx)
- [Font Family](extensions/font-family.mdx) / [Font Size](extensions/font-size.mdx)
- [Text Align](extensions/text-align.mdx) / [Text Indent](extensions/text-indent.mdx) / [Line Height](extensions/line-height.mdx)
- [Text Style](extensions/text-style.mdx) / [Text Transform](extensions/text-transform.mdx)
- [Format Commands](extensions/format-commands.mdx) — `clearFormatting`, `unsetAllMarks`, etc.

### Structure & Layout
- [Paragraph](extensions/paragraph.mdx) / [Heading](extensions/heading.mdx) / [Line Break](extensions/line-break.mdx)
- [Bullet List](extensions/bullet-list.mdx) / [Ordered List](extensions/ordered-list.mdx) / [List Item](extensions/list-item.mdx)
- [Document](extensions/document.mdx) / [Document Section](extensions/document-section.mdx)
- [Block Node](extensions/block-node.mdx) / [Content Block](extensions/content-block.mdx) / [Structured Content](extensions/structured-content.mdx)
- [Run Item](extensions/run-item.mdx) — OOXML run wrapper
- [Tab](extensions/tab.mdx) / [Page Number](extensions/page-number.mdx)
- [Footnote](extensions/footnote.mdx) / [Bookmarks](extensions/bookmarks.mdx) / [Table of Contents](extensions/table-of-contents.mdx)

### Advanced
- [Creating Extensions](extensions/creating-extensions.mdx) — `addPmPlugins()`, NOT `addProseMirrorPlugins()`
- [Custom Selection](extensions/custom-selection.mdx) / [Dropcursor](extensions/dropcursor.mdx) / [Gapcursor](extensions/gapcursor.mdx)
- [Popover Plugin](extensions/popover-plugin.mdx)
- [Shape Container](extensions/shape-container.mdx) / [Shape Textbox](extensions/shape-textbox.mdx)
- [Slash Menu](extensions/slash-menu.mdx) / [Mention](extensions/mention.mdx) / [Placeholder](extensions/placeholder.mdx)
- [Permission Ranges](extensions/permission-ranges.mdx) / [Linked Styles](extensions/linked-styles.mdx)
- [Field Annotation](extensions/field-annotation.mdx) / [Document Index](extensions/document-index.mdx)
- [Node Resizer](extensions/noderesizer.mdx)

## AI
- [Overview](ai/ai-actions/overview.mdx)
- [Configuration](ai/ai-actions/configuration.mdx)
- [Methods](ai/ai-actions/methods.mdx) — `literalReplace()`, `insertText()`, `deleteText()`, etc.
- [Hooks](ai/ai-actions/hooks.mdx)
- [AI Builder](ai/ai-builder/overview.mdx)

## Guides
- [ProseMirror Migration](guides/migration/prosemirror.mdx) — key differences from TipTap
- [Breaking Changes v1](guides/migration/breaking-changes-v1.mdx)
- [TypeScript Migration](guides/migration/typescript-migration.mdx)
