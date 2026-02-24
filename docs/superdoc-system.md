# SuperDoc System (DOCX Editing)

SuperDoc is a ProseMirror-based DOCX editor. It is the **only** way we render and edit `.docx` files. This document captures everything learned through investigation of the SuperDoc source code — it is designed to prevent future developers (human or AI) from repeating costly trial-and-error.

**License:** AGPLv3. Kept on private branch until resolved.
**bun packages:** `superdoc` (v1.11.0), `@superdoc-dev/ai` (v0.1.6)

---

## The #1 Thing You Must Understand: Hidden-Host Architecture

**SuperDoc does NOT render ProseMirror's EditorView to the user.**

This is the single most important fact about SuperDoc. It will save you hours (or days) of debugging.

### How it works

SuperDoc has a **two-layer rendering system**:

1. **Hidden ProseMirror layer** — The actual ProseMirror `EditorView` is mounted inside a `<div class="presentation-editor__hidden-host">` that is positioned at `position: fixed; left: -9999px; opacity: 0; pointer-events: none; z-index: -1; user-select: none`. This is the "semantic" layer — it handles input, selection, undo/redo, and the ProseMirror document model.

2. **Visible painted layer** — A separate layout engine converts the ProseMirror document into FlowBlocks, calculates pagination and line breaks, and a DOM painter renders the result into visible `<div class="superdoc-page">` elements. This is what the user sees and interacts with.

### What this means for you

| What you want to do | Will it work? | Why / Alternative |
|---|---|---|
| Add a ProseMirror `Decoration.widget()` | **NO** | Widget is rendered in hidden DOM at x:-9999. Invisible. |
| Add a ProseMirror `Decoration.inline()` with marks | **Partially** | Inline marks that map to CSS classes MAY appear in the painted DOM, because SuperDoc's painter copies text marks. But this is unreliable for custom marks. |
| Read/write ProseMirror document state | **YES** | `editor.state.doc`, `editor.view.state.tr`, `editor.view.dispatch()` — all work normally. |
| Handle keyboard events via ProseMirror plugin | **YES** | `Plugin.props.handleKeyDown()` receives events before any other handler. Works perfectly in hidden view. |
| Use ProseMirror plugin state (`Plugin.state`) | **YES** | State management is fully functional. `init()`, `apply()`, `tr.getMeta()`, `tr.setMeta()` all work. |
| Position UI at the cursor | **Use visible caret** | Find `.presentation-editor__selection-caret` in the visible DOM and position a floating overlay relative to it. |

### The visible caret

SuperDoc renders the cursor as a separate overlay element:
- **Local caret:** `.presentation-editor__selection-caret`
- **Remote caret:** `.presentation-editor__remote-caret`
- **Selection rectangles:** `.presentation-editor__selection-rect`
- **Selection layer:** `.presentation-editor__selection-layer--local`

These are the visible cursor elements. When you need to position UI at the cursor, query for `.presentation-editor__selection-caret` and use its `getBoundingClientRect()`.

---

## SuperDoc is NOT TipTap

SuperDoc uses ProseMirror directly. It has **zero** `@tiptap` dependencies. Do not:
- Import anything from `@tiptap/core`, `@tiptap/pm/*`, etc.
- Use TipTap method names like `addProseMirrorPlugins()` (SuperDoc uses `addPmPlugins()`)
- Reference TipTap documentation when building SuperDoc extensions
- Assume TipTap's Extension API applies (it doesn't — similar structure, different details)

### Extension API comparison

| Concept | TipTap | SuperDoc | ProseMirror (raw) |
|---|---|---|---|
| Import | `import { Extension } from '@tiptap/core'` | `import { Extensions } from 'superdoc/super-editor'` then `Extensions.Extension.create()` | `import { Plugin } from 'prosemirror-state'` |
| Define extension | `Extension.create({ ... })` | `Extension.create({ ... })` (same shape) | N/A (just plugins) |
| Add plugins | `addProseMirrorPlugins() { return [...] }` | `addPmPlugins() { return [...] }` | Direct plugin creation |
| Plugin class | `import { Plugin } from '@tiptap/pm/state'` | `Extensions.Plugin` | `import { Plugin } from 'prosemirror-state'` |
| PluginKey | `import { PluginKey } from '@tiptap/pm/state'` | `Extensions.PluginKey` | `import { PluginKey } from 'prosemirror-state'` |
| Decoration | `import { Decoration } from '@tiptap/pm/view'` | `Extensions.Decoration` | `import { Decoration } from 'prosemirror-view'` |
| Config key | `extensions: [...]` | `editorExtensions: [...]` | N/A |
| Configure | `Extension.configure({ opts })` | Factory function pattern (no `.configure()`) | N/A |
| `this.editor` | TipTap Editor wrapper | SuperDoc's editor wrapper (has `.view`, `.state`) | N/A |
| Lifecycle hooks | `onCreate`, `onUpdate`, `onSelectionUpdate`, `onDestroy` | `onUpdate({ editor })` (same shape) | Plugin `view()` method |

### Correct import pattern

```javascript
import { Extensions } from 'superdoc/super-editor'
const { Extension, Plugin, PluginKey, Decoration, DecorationSet } = Extensions

// Create extension with factory function (no .configure())
export function createMyExtension(options) {
  return Extension.create({
    name: 'myExtension',

    addPmPlugins() {            // NOT addProseMirrorPlugins
      return [
        new Plugin({
          key: new PluginKey('myPlugin'),
          state: {
            init() { return initialState },
            apply(tr, prev) { /* handle meta */ return newState },
          },
          props: {
            handleKeyDown(view, event) { /* return true to consume */ },
          },
          view() {
            return {
              update(view) { /* called after every state update */ },
              destroy() { /* cleanup */ },
            }
          },
        }),
      ]
    },

    onUpdate({ editor }) {
      // Called on document changes
      // editor.state = current ProseMirror state
      // editor.view = ProseMirror EditorView (in hidden host!)
    },
  })
}
```

### SuperDoc constructor

```javascript
import { SuperDoc } from 'superdoc'
import 'superdoc/style.css'

const superdoc = new SuperDoc({
  selector: '#editor-container',     // CSS selector, NOT a DOM element
  toolbar: '#toolbar-container',     // CSS selector, NOT a DOM element
  document: fileObject,              // File object (from base64ToFile)
  documentMode: 'editing',          // 'editing' | 'suggesting' | 'viewing'
  editorExtensions: [myExtension],  // NOT 'extensions' — this is the key name
})
```

**Critical:** The config key is `editorExtensions`, not `extensions`. Using `extensions` silently does nothing.

---

## Visible DOM Structure

The painted pages that the user actually sees:

```
.presentation-editor__viewport
  .presentation-editor__pages (painter host)
    .superdoc-layout (flex container, pages centered)
      .superdoc-page (position: relative, explicit width/height, overflow: hidden)
        [data-page-index="0", data-page-number="1"]
        .superdoc-fragment (position: absolute, left/top/width pre-calculated)
          .superdoc-line (position: relative, white-space: pre)
            <span>text runs with inline styles</span>
        .superdoc-page-header (position: absolute, z-index: 1)
        .superdoc-page-footer (position: absolute, z-index: 1)
      .superdoc-page (next page...)
  .presentation-editor__selection-layer--local
    .presentation-editor__selection-caret (THE visible cursor)
    .presentation-editor__selection-rect (selection highlight)
```

### Page margin model

There is **no CSS margin/padding box** for content area. Margins are baked into the layout engine:
- `.superdoc-page` has explicit `width` and `height` (full page dimensions)
- `.superdoc-fragment` elements are positioned absolutely with `left`, `top`, `width` that already account for page margins
- To find the "content area" bounds, read the fragment's `getBoundingClientRect()`
- Header/footer containers do use explicit `left: marginLeft` and `width: calc(100% - marginLeft - marginRight)`

### Finding page geometry

```javascript
// Find which page the caret is in (by coordinate overlap)
const pages = container.querySelectorAll('.superdoc-page')
for (const page of pages) {
  const rect = page.getBoundingClientRect()
  if (caretRect.top >= rect.top && caretRect.top <= rect.bottom) {
    // This is the page
  }
}

// Find the content area (fragment) containing the caret line
const fragments = page.querySelectorAll(':scope > .superdoc-fragment')
for (const frag of fragments) {
  const rect = frag.getBoundingClientRect()
  if (caretRect.top >= rect.top - 4 && caretRect.top <= rect.bottom + 4) {
    // frag.left = content left edge (margin already applied)
    // frag.width = content area width
  }
}

// Read font from the closest line
const lines = fragment.querySelectorAll('.superdoc-line')
const computedStyle = getComputedStyle(closestLine)
// computedStyle.fontFamily, .fontSize, .lineHeight
```

---

## Rendering Custom Content: Two Approaches

### Approach 1: Standalone run with runProperties (preferred for text)

Create a run node with the desired styling baked into `runProperties`. The painter reads `runProperties` directly (via `encodeCSSFromRPr`), so the styling is visible immediately. Also apply a `textStyle` mark to the text node for programmatic detection (e.g. `findGhostRange()`).

**Critical**: `insertText()` + `addMark()` does NOT reliably produce visible styling. The text goes into the existing run (inheriting its `runProperties`), and the mark only affects the hidden PM DOM. The painter reads `runProperties`, not marks. See [ghost-work.md](ghost-work.md) for the full analysis.

```javascript
// Color format: OOXML runProperties uses hex WITHOUT # prefix
const ghostMark = schema.marks.textStyle.create({ color: '#B0B0B0' })
const textNode = schema.text('ghost text here', [ghostMark])
const runProperties = { color: { val: 'B0B0B0' } }  // no # prefix!
const ghostRun = schema.nodes.run.create({ runProperties }, textNode)

// If inside an existing run, split into [before][ghost][after]:
const pieces = [beforeRun, ghostRun, afterRun]
tr.replaceWith(runStart, runEnd, FragmentClass.from(pieces))
tr.setMeta('addToHistory', false)  // Don't pollute undo stack
```

On accept: delete the ghost run, re-insert as plain text (inherits context formatting).
On dismiss: delete the entire ghost run (not just text — prevents empty orphan runs).

### Approach 2: Floating overlays (for non-text UI)

Since ProseMirror decorations are invisible, non-text UI (buttons, badges, loading indicators) must use **floating overlays** positioned relative to the visible caret or other painted DOM elements.

### Rules for overlays

1. **Overlay must be a SIBLING of the SuperDoc container, not a child.** SuperDoc manages its container's DOM. If Vue tries to patch children inside SuperDoc's mount point, you get `parent.insertBefore` errors. Wrap both in a relative container:

```html
<div style="position: relative;" class="flex-1 overflow-auto">
  <!-- SuperDoc owns this div completely -->
  <div :id="editorId" class="absolute inset-0"></div>
  <!-- Vue owns this overlay — sibling, not child -->
  <div v-if="showOverlay" class="my-overlay" :style="overlayPos">
    ...content...
  </div>
</div>
```

2. **Position relative to visible caret, not ProseMirror position.** The ProseMirror `coordsAtPos()` returns coordinates in the hidden host (x:-9999). Instead, find `.presentation-editor__selection-caret` and use its `getBoundingClientRect()`.

3. **Account for scroll.** The wrapper div scrolls. Include `container.scrollTop` when calculating absolute position within the wrapper.

4. **Read font from `.superdoc-line` elements.** To match document typography in overlays, read `getComputedStyle()` from the nearest visible line element.

---

## SuperDoc Events and API

### Events

```javascript
superdoc.on('ready', () => {
  // activeEditor is now available
  // Safe to wire editor.on('update', ...) etc.
})

const editor = superdoc.activeEditor   // SuperDoc's editor wrapper
editor.on('update', () => { /* document changed */ })
editor.on('selectionUpdate', () => { /* cursor moved */ })
```

**Important:** `superdoc.activeEditor` may be `null` immediately after construction. Wait for the `'ready'` event. Small documents may set it synchronously — check both.

### Document mode

```javascript
superdoc.setDocumentMode('editing')    // Normal editing
superdoc.setDocumentMode('suggesting') // Track changes mode
superdoc.setDocumentMode('viewing')    // Read-only
```

### Export

```javascript
const blob = await superdoc.export({ exportType: 'docx', triggerDownload: false })
// blob is a Blob — convert to base64 for Rust: blobToBase64(blob)
```

### ProseMirror access

```javascript
const pmState = superdoc.activeEditor.state      // ProseMirror EditorState
const pmView = superdoc.activeEditor.view        // ProseMirror EditorView (in hidden host!)
const doc = pmState.doc                          // ProseMirror Node (document root)
const text = doc.textContent                     // Plain text
const textBetween = doc.textBetween(from, to, '\n', ' ')  // Text with separators
const { from, to } = pmState.selection           // Cursor position
```

### @superdoc-dev/ai (AIActions)

```javascript
import { AIActions } from '@superdoc-dev/ai'

const ai = new AIActions(superdoc, {
  user: { displayName: 'Name', userId: 'id' },
  provider: customProvider,  // { getCompletion(), streamCompletion() }
})
await ai.waitUntilReady()

// Find-and-replace with tracked changes
const result = await ai.action.literalReplace(oldString, newString, {
  caseSensitive: true,
  trackChanges: true,   // Creates tracked change (visible in Word)
})
// result.success: boolean
```

---

## Relevant Files in This Project

| File | Purpose |
|---|---|
| `src/components/editor/DocxEditor.vue` | SuperDoc wrapper: load, render, save, ghost overlay, toolbar, native comment input |
| `src/components/editor/DocxToolbar.vue` | DOCX formatting toolbar: responsive overflow (ResizeObserver collapses low-priority groups into `...` popover) |
| `src/components/editor/DocxContextMenu.vue` | Right-click context menu: clipboard, formatting, comments, AI, citations, track changes |
| `src/components/VersionHistory.vue` | Read-only SuperDoc preview for docx version history (`documentMode: 'viewing'`) |
| `src/components/editor/DocxReviewBar.vue` | Tracked changes bar (Accept All / Reject All) |
| `src/editor/docxGhost.js` | ProseMirror ghost suggestion plugin (standalone run insertion, state + keyboard) |
| `src/editor/docxTaskPositions.js` | ProseMirror plugin: maps task thread ranges through edits |
| `src/editor/docxTasks.js` | `DocxTaskBridge`: applies proposed edits via `ai.action.literalReplace()` |
| `src/components/editor/DocxTaskIndicators.vue` | Floating overlay dots in DOCX margin (text-search positioning) |
| `src/services/docxContext.js` | Text extraction utilities for ProseMirror docs |
| `src/services/docxProvider.js` | AI provider adapter for @superdoc-dev/ai |
| `src/utils/docxBridge.js` | Binary conversion: base64 <-> Blob <-> File |
| `src/utils/fileTypes.js` | `getViewerType()` returns `'docx'` for `.docx` files |
| `src/stores/editor.js` | `superdocInstances` registry (SuperDoc + AIActions per pane) |
| `src/services/chatTools.js` | DOCX-aware `read_file` and `edit_file` chat tools |

### Data flow

```
Load:     invoke('read_file_base64') → base64ToFile() → new SuperDoc({ document: file })
Save:     superdoc.export() → blobToBase64() → invoke('write_file_base64')
Text:     editor.state.doc.textContent → filesStore.fileContents[path]  (for search/chat)
Edit:     ai.action.literalReplace(old, new)  (tracked change in DOCX)
Read:     extractDocumentText(editor.state)   (for chat tools)
History:  gitShowBase64() → base64ToFile() → new SuperDoc({ documentMode: 'viewing' })
Restore:  gitShowBase64() → invoke('write_file_base64') → close/reopen tab to remount
```

### Auto-save

1.5s debounce after `editor.on('update')`. Manual save via Cmd+S (captured by DocxEditor's keydown handler with `stopPropagation()`). Force-save for git commit via `window.dispatchEvent(new CustomEvent('docx-save-now'))`.

---

## Text Styling Marks

SuperDoc's ProseMirror schema has these marks relevant to custom rendering:

| Mark | Attribute | Purpose |
|---|---|---|
| `textStyle` | `color` | Foreground text color (via `Color` extension's `addGlobalAttributes`) |
| `textStyle` | `fontFamily` | Font family (via `FontFamily` extension) |
| `textStyle` | `fontSize` | Font size (via `FontSize` extension) |
| `highlight` | `color` | Background color (renders as `<mark>`) |
| `trackInsert` | `id`, `author`, `date` | Tracked change insertion |
| `trackDelete` | `id`, `author`, `date` | Tracked change deletion |

### Applying text color

```javascript
// Via commands
editor.commands.setColor('#ff0000')
editor.commands.unsetColor()

// Via raw ProseMirror transaction
const mark = schema.marks.textStyle.create({ color: 'rgba(0,0,0,0.3)' })
tr.addMark(from, to, mark)           // Add color to range
tr.removeMark(from, to, schema.marks.textStyle)  // Remove all textStyle

// Create text node with marks pre-applied
const textNode = schema.text('hello', [mark])
tr.insert(pos, textNode)
```

**Important:** `addMark` with the same mark type REPLACES the existing instance. If text has `textStyle { fontFamily: 'Times' }` and you `addMark(textStyle { color: '#999' })`, the fontFamily is lost. To preserve attributes, read existing marks first and merge.

### Transaction history control

```javascript
tr.setMeta('addToHistory', false)  // Prevents this transaction from appearing in undo stack
```

Transactions marked `addToHistory: false` are NOT in the undo stack but ARE used for position mapping. This is essential for ghost suggestions — the ghost insert/delete shouldn't be undoable, but the final accept should be.

---

## Known Issues and Open Work

### Ghost suggestions (standalone run approach)
- `++` detection deletes trigger, calls API, inserts ghost text as a **standalone run** with `runProperties: { color: { val: 'B0B0B0' } }`
- Ancestor run is split into [before][ghost][after] via `replaceWith` — painter sees correct color immediately
- `textStyle` mark also applied to text node for `findGhostRange()` detection
- Tab accepts (delete ghost run, re-insert as plain text), Escape dismisses (delete entire ghost run)
- All ghost mutations are `addToHistory: false` except accept
- Loading dots use a floating overlay at the caret
- Auto-save and text cache suppressed while ghost is active (checks `ghostPluginKey.getState()` directly, not Vue ref)
- See [ghost-work.md](ghost-work.md) for full implementation details and SuperDoc internals

### AI task indicators (floating overlay dots)
- AI task threads on DOCX files show margin dots via `DocxTaskIndicators.vue` — a floating overlay (same pattern as ghost loading dots)
- Position calculated by text-searching visible `.superdoc-line` elements for `thread.selectedText`
- Fallback: estimate position from `range.from / docSize` ratio when text not found (shown as dashed outline dot)
- `docxTaskPositions.js`: SuperDoc extension (PM plugin) that maps `thread.range.from/to` through transactions via `tr.mapping.map()`
- Recalc triggers: scroll (RAF), resize (ResizeObserver), thread changes (watcher), content edits (`docx-content-changed` custom event)
- Click dot → `tasksStore.setActiveThread()` + `open-tasks` event → right panel opens
- Gutter left position read from first `.superdoc-fragment`'s `getBoundingClientRect()` minus 20px

### Native comments (right-click → Comment)
- Uses SuperDoc's public `ed.commands.addComment()` API — NOT the internal sidebar/`showAddComment()` flow
- Context menu emits `add-comment` → `DocxEditor.vue` shows a Teleported input dialog → user types → `submitComment()` restores PM selection and calls `addComment({ content, author, authorEmail })`
- `addComment` adds a ProseMirror comment mark at the selection AND emits `commentsUpdate` on the editor → SuperDoc.vue's `onEditorCommentsUpdate` adds the comment to the internal store
- SuperDoc's built-in comment sidebar (`.superdoc__right-sidebar`, 320px flex sibling) is NOT used — it overflows the `absolute inset-0` container and gets clipped. See gotchas.md for details.
- Right-click collapses PM selection — saved in capture-phase `mousedown` handler (`handleRightMouseDown`), restored before API call
- SuperDoc's native floating tools panel (`.superdoc__tools`) is hidden via CSS (`display: none !important`)

### Task bridge
- `DocxTaskBridge` in `src/editor/docxTasks.js` handles `applyProposedEdit` for DOCX files
- Uses `ai.action.literalReplace()` — the official SuperDoc API for atomic find-and-replace
- Registered via `editorStore.registerSuperdoc()` after `superdoc.on('ready')`

### Scrolling the visible painted layer
- PM `tr.setSelection()` + `scrollIntoView()` and `editor.commands.scrollIntoView()` only scroll the hidden view (x:-9999)
- `presentationEditor.scrollToPosition(pos)` exists but returns `false` in our embedded setup (viewport host resolution issue) — do NOT rely on it
- **Working approach:** text-search `.superdoc-line` elements for target text, then `line.scrollIntoView({ block: 'center' })`. Fallback: wait ~100ms for painter, scroll `.presentation-editor__selection-caret`
- See `TaskThread.vue:navigateDocx()` (task jump-to) and `OutlinePanel.vue:navigateToHeading()` (outline click)
- **Cross-file navigation** needs brute-force 4x retry (0ms, 500ms, 1000ms, 1500ms) because `editorStore.openFile()` may need to mount SuperDoc first
- **Auto-scroll on type:** `DocxEditor.vue` selectionUpdate handler checks caret visibility in `requestAnimationFrame`, scrolls with `behavior: 'auto', block: 'nearest'`

### Tracked changes
- `ai.action.literalReplace()` works with `trackChanges: true`
- DocxReviewBar exists but Accept All / Reject All not connected to SuperDoc API

---

## Debugging Tips

### "I added a decoration but it's invisible"
It's in the hidden host at x:-9999. ProseMirror decorations (widget or inline) render in the hidden EditorView. Use the overlay pattern instead.

### "My extension's plugins aren't being registered"
Check three things:
1. Method name is `addPmPlugins()` (not `addProseMirrorPlugins()`)
2. Config key is `editorExtensions: [ext]` (not `extensions: [ext]`)
3. Extension imported from `superdoc/super-editor` (not `@tiptap/core`)

### "I get `parent.insertBefore` errors"
Your Vue overlay is a child of the SuperDoc container. Make it a sibling.

### "Cursor coordinates are at x:-9999"
You're reading from ProseMirror's `coordsAtPos()` which returns hidden host coordinates. Use `.presentation-editor__selection-caret`'s `getBoundingClientRect()` instead.

### "Document text extraction returns empty or wrong content"
Use `editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n', ' ')` with the newline and space separators. Plain `doc.textContent` concatenates all text without spaces between blocks.

### Diagnostic: verify extension is loaded
Add `console.log('[myExt] addPmPlugins called')` at the top of `addPmPlugins()`. If it doesn't fire, the extension isn't registered (check `editorExtensions` key).

### Diagnostic: verify keyboard handler works
In `handleKeyDown(view, event)`, log the event. Keyboard events always reach the hidden ProseMirror view even though it's offscreen.
