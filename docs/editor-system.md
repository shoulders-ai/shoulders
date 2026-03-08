# Editor System

The editor is built on CodeMirror 6 with custom extensions. The pane/tab layout mirrors VS Code's split editor model.

## Relevant Files

| File | Role |
|---|---|
| `src/editor/setup.js` | Extension assembly, auto-save, cursor tracking, word count, soft wrap compartment |
| `src/editor/theme.js` | CodeMirror theme (Tokyo Night) + syntax highlighting |
| `src/editor/ghostSuggestion.js` | Ghost text inline completions (see [ai-system.md](ai-system.md)) |
| `src/editor/diffOverlay.js` | Inline diff rendering (see [review-system.md](review-system.md)) |
| `src/editor/comments.js` | Comment gutter markers + anchor highlights (see [ai-system.md](ai-system.md)) |
| `src/editor/livePreview.js` | Semi-WYSIWYG: hides markdown syntax when cursor is elsewhere, renders tables as HTML widgets |
| `src/editor/wikiLinks.js` | `[[wiki link]]` decorations, click nav, autocomplete (see [wiki-links.md](wiki-links.md)) |
| `src/stores/editor.js` | Pane tree data structure, tab management, editor view registry |
| `src/components/editor/TextEditor.vue` | CodeMirror instance lifecycle (all text files) |
| `src/components/editor/PdfViewer.vue` | PDF display via embedded Firefox PDF.js viewer (full-featured: sidebar, annotations, text selection, search) |
| `src/components/editor/CsvEditor.vue` | CSV/TSV editing (Handsontable) |
| `src/components/editor/ImageViewer.vue` | Image display with zoom/pan |
| `src/components/editor/DocxEditor.vue` | DOCX editing (SuperDoc) |
| `src/utils/fileTypes.js` | File type detection, viewer routing, icon mapping |
| `src/components/editor/EditorContextMenu.vue` | Right-click context menu (Ask AI, Add Comment, clipboard) |
| `src/components/editor/EditorPane.vue` | Pane container with TabBar |
| `src/components/editor/PaneContainer.vue` | Recursive pane renderer |
| `src/components/editor/TabBar.vue` | Tab bar with drag reorder |
| `src/components/editor/SplitHandle.vue` | Drag handle between panes |

## Pane Tree Data Structure

The editor uses a **recursive tree** stored in `editorStore.paneTree`. Each node is either:

**Leaf node** (has tabs):
```js
{
  type: 'leaf',
  id: 'pane-root',      // or 'pane-{nanoid}'
  tabs: ['/path/to/file.md', ...],
  activeTab: '/path/to/file.md'  // or null
}
```

**Split node** (has two children):
```js
{
  type: 'split',
  direction: 'horizontal' | 'vertical',
  ratio: 0.5,           // 0.15 to 0.85
  children: [node, node]
}
```

### Split Operation
When a pane splits (`editorStore.splitPane(direction)`):
1. The current leaf's data is cloned into a new leaf (keeps the original ID)
2. A new empty leaf is created with a fresh ID
3. The original node is **mutated in-place** to become a split node with two children
4. Focus moves to the new pane

This in-place mutation pattern means the same object reference stays in the tree; Vue reactivity picks up the property changes.

### Collapse Operation
When a pane with no tabs is collapsed (`editorStore.collapsePane(id)`):
1. Find the parent split node
2. Find the sibling
3. Replace the parent's properties with the sibling's properties (in-place mutation again)
4. Update `activePaneId` if needed

### Important: `findPane()` and `findParent()`
These are recursive tree traversal methods on the editor store. They search the pane tree for a node by ID. Used extensively throughout the editor components.

## Editor State Persistence

The pane tree, open tabs, active tabs, split ratios, and active pane are persisted to `.shoulders/editor-state.json` so the layout survives restarts and refreshes.

### Relevant Files

| File | Role |
|---|---|
| `src/services/editorPersistence.js` | Serialization, disk I/O, parallel tab validation |
| `src/stores/editor.js` | Thin wrappers: `saveEditorState()`, `restoreEditorState()` |
| `src/App.vue` | Calls restore after workspace loads, save before workspace closes |

### How It Works

**Saving** — Every action that mutates the pane tree or active pane (`openFile`, `closeTab`, `splitPane`, `collapsePane`, `setActivePane`, `setSplitRatio`, `reorderTabs`, `updateFilePath`, `openChat`) calls `saveEditorState()`, which is debounced at 500ms. Before workspace close, `saveEditorStateImmediate()` flushes synchronously.

**Restoring (optimistic)** — On workspace open, after chat sessions and references are loaded (needed for tab validation):
1. `loadState()` reads the JSON file from disk
2. The raw pane tree is assigned to `this.paneTree` **immediately** — UI renders instantly
3. `findInvalidTabs()` fires all `path_exists` checks in **parallel** via `Promise.all`
4. Any invalid tabs are pruned after the fact via `closeFileFromAllPanes()`

This means the user sees their full layout the moment the workspace opens. If a file was deleted since last session, its tab quietly disappears a moment later.

### Tab Validation

Each tab type is validated differently (`isTabValid()` in `editorPersistence.js`):

| Tab type | Example | Validation |
|---|---|---|
| Regular file | `/path/to/file.md` | `invoke('path_exists')` |
| Chat session | `chat:abc123` | Check `.shoulders/chats/abc123.json` exists |
| Reference | `ref:@authorYear` | `referencesStore.getByKey()` returns non-null |
| Preview | `preview:/path/to/file.md` | Underlying file `path_exists` |
| NewTab | `newtab:xK2mN4pQ` | Always valid (virtual, ephemeral) |

### Edge Cases

- **State file missing** (first run) → empty editor, no error
- **State file corrupt** (invalid JSON) → empty editor, logged to console
- **All tabs in a pane gone** → pane shows empty state (NewTab screen)
- **Split with both children empty** → tabs close normally, panes show empty state
- **`activePaneId` references invalid pane** → falls back to `findFirstLeaf()`
- **Rapid mutations** → 500ms debounce coalesces writes

### Data Format

```json
{
  "version": 1,
  "paneTree": {
    "type": "split",
    "direction": "vertical",
    "ratio": 0.5,
    "children": [
      { "type": "leaf", "id": "pane-root", "tabs": ["/path/file.md"], "activeTab": "/path/file.md" },
      { "type": "leaf", "id": "pane-xK2mN4pQ", "tabs": ["chat:abc123"], "activeTab": "chat:abc123" }
    ]
  },
  "activePaneId": "pane-root"
}
```

## Editor View Registry

`editorStore.editorViews` is a plain object mapping `"paneId:filePath"` → `EditorView` instance. This allows any code to access a specific editor's CodeMirror view:

```js
editorStore.registerEditorView(paneId, path, view)   // MarkdownEditor onMounted
editorStore.unregisterEditorView(paneId, path)        // MarkdownEditor onUnmounted
editorStore.getEditorView(paneId, path)               // used by App.vue for comments
```

**Important:** These view objects are **not reactive** and not serializable. They're stored outside Pinia's reactive system (as a plain property on the store). This is intentional - EditorView instances are heavy and shouldn't be tracked by Vue.

## Extension Assembly (`setup.js`)

`createEditorExtensions()` assembles the full extension list:

1. **Soft wrap** - via a `Compartment` (`wrapCompartment`). Reconfigured dynamically when the user toggles soft wrap in the footer.
2. **Core CM6** - line numbers, active line, history, fold gutter, bracket matching, etc.
3. **Markdown** - `@codemirror/lang-markdown` with code language support via `@codemirror/language-data`
4. **Theme** - `shouldersTheme` + `shouldersHighlighting`
5. **Keymaps** - default, search, history, fold, indent with tab, close brackets
6. **Auto-save** - `EditorView.updateListener` with 1-second debounce after last edit
7. **Cursor tracking** - emits `{line, col}` on selection/doc changes
8. **Word count** - emits word count on doc changes
9. **Extra extensions** - passed in by MarkdownEditor: ghost suggestions, diff overlay, comments, wiki links

### Auto-Save Flow
```
User types → docChanged → 1s debounce → onSave(content) → files.saveFile(path, content) → invoke('write_file')
```

## TextEditor.vue Lifecycle

### Mount
1. Read file content from `files.fileContents` cache (or load via `files.readFile()`)
2. Build extensions via `createEditorExtensions()` with ghost, diff, and comment extensions
3. Create `EditorState` and `EditorView`
4. Register view in `editorStore.editorViews`
5. Load initial pending edits into the diff overlay

### Watchers
- **Pending edits**: When `reviews.editsForFile(filePath)` changes, dispatch `setPendingEdits` effect to update diff overlays
- **External file changes**: When `files.fileContents[filePath]` changes (e.g., from file watcher or AI edit), applies a **surgical diff** via `computeMinimalChange()` (`src/utils/textDiff.js`) — only the changed span is dispatched, preserving comment/annotation positions. A full-document swap would destroy all `mapPos`-tracked ranges (see [gotchas.md](gotchas.md)).
- **Soft wrap**: When `workspace.softWrap` toggles, reconfigure the wrap compartment

### Unmount
Unregister the editor view and destroy the CodeMirror instance.

## File Tree Drag & Drop

Dragging files from the file tree sidebar into a text editor inserts markdown/LaTeX syntax at the drop position.

- **Images** → `![name](relative-path)` (markdown) or `\includegraphics{path}` (LaTeX)
- **Other files** → `[name](relative-path)` (markdown) or `\input{path}` (LaTeX)
- **Plain text files** → inserts the relative path

### How it works

FileTree.vue dispatches `filetree-drag-start` (with `{ paths }`) and `filetree-drag-end` custom window events. TextEditor.vue listens for these and creates a transparent overlay (`position:absolute;inset:0`) over the editor that:

1. **Blocks CM6 mouse events** — prevents text selection while dragging
2. **Shows a drop cursor** — 2px accent-colored line at the insertion position (via `view.posAtCoords` + `view.coordsAtPos`)
3. **Handles the drop** — on mouseup, inserts the formatted text at the cursor position

Relative paths are computed by `relativePath()` in `src/utils/fileTypes.js`. The overlay is removed on `filetree-drag-end`.

### Relevant Files

| File | Role |
|---|---|
| `src/utils/fileTypes.js` | `isImage()`, `relativePath()` utilities |
| `src/components/sidebar/FileTree.vue` | Dispatches `filetree-drag-start`/`filetree-drag-end` events |
| `src/components/editor/TextEditor.vue` | Overlay creation, drop cursor, text insertion |

## Tab Behavior

- Tabs show the filename (last path segment)
- An unsaved indicator dot appears for dirty files (tracked in `editorStore.dirtyFiles`)
- Middle-click closes a tab
- Tabs are drag-reorderable within a pane (mouse-based, not native DnD — more reliable in WebKit/Tauri)
- **Cross-pane drag**: Tabs can be dragged between panes. DOM queries via `data-tab-bar`, `data-pane-id`, `data-tabs-area`, `data-tab-el` attributes identify the target pane and insert position. A remote drop indicator is dynamically injected into the target TabBar during drag. Escape cancels the drag. Moving the last tab from a non-root pane collapses it.
- **"+" button**: A "+" button after the tab list creates a new NewTab page in the current pane (emits `new-tab` event → `editorStore.openNewTab(paneId)`)
- Tab bar also has split vertical, split horizontal, and close pane buttons

### NewTab as a First-Class Tab

The NewTab page (Start page with recent files, file creation, suggestions, and chat input) is a proper tab with the virtual path `newtab:{nanoid}`. It appears in the TabBar with a "+" icon and "New Tab" label, is draggable between panes like any other tab, and persists across restarts. The Start page has five tabs: Start (curated mix with section headers), Files (recent files), Create (new file by type), Chats (chat history), and Suggested (context-aware AI prompts).

- **Cmd+T** opens a NewTab tab in the active pane (like a browser new tab)
- **Cmd+N** is context-aware: in a document → new file of same type; in a chat → new chat; in NewTab or no tab → new `.md`
- **Tab replacement**: When you open a file or chat while a NewTab is the active tab, it replaces the NewTab (like Chrome replacing a blank tab on navigation)
- **`isNewTab(path)`** in `fileTypes.js` detects the `newtab:` prefix; `getViewerType()` returns `'newtab'`
- **EditorPane.vue** routes `newtab` viewer type to `<NewTab>` component; the `v-else` fallback still handles panes with zero tabs

### Smart Chat Routing

When the active pane's active tab is a chat and the user opens a file (from sidebar, chat message link, tool call, etc.), the file is routed *away* from the chat pane so the conversation isn't buried:

1. **File already open in another pane?** → Switch that pane to show it
2. **Another non-chat pane exists?** → Open the file there (replaces NewTab if present)
3. **Only one pane (the chat pane)?** → Auto-split vertically, file appears beside the chat

Focus moves to the file pane in all cases (so Cmd+W closes the file, not the chat). The helper `_findNonChatPane()` walks the pane tree to find the first leaf whose `activeTab` is not a chat tab.

### Cmd+W on Empty Panes

When Cmd+W is pressed and the active pane has no tabs (`activeTab` is null), the pane is collapsed if it's not the root. This prevents "dead" empty panes from accumulating after closing all tabs.

## Spell Check

Native macOS spell checking integrated into the editor via `NSSpellChecker`. No WASM, no network, no extra packages — uses the same engine as Safari with the user's system language preferences.

### Architecture (three layers)

1. **Rust `enable_macos_spellcheck()`** — called before webview init, sets `WebContinuousSpellCheckingEnabled = true` via `NSUserDefaults`. Without this, WKWebView doesn't show red underlines even with `spellcheck="true"` on the DOM element.

2. **CM6 `spellCheckCompartment`** — sets `spellcheck: "true"` on the contenteditable div via `EditorView.contentAttributes`. Toggleable at runtime. Only enabled for markdown files.

3. **Rust `spell_suggest(word)`** — calls `NSSpellChecker.checkSpellingOfString` + `guessesForWordRange` to check a word and return suggestions. Called from the context menu on right-click.

### Context Menu Integration

The custom right-click menu (`EditorContextMenu.vue`) blocks the native context menu, which would normally show spell suggestions. Instead:

1. On right-click, `getWordAt()` extracts the word at the click position (using a regex word boundary scanner that handles Unicode/accented characters)
2. The word is sent to `spell_suggest` (Rust) which returns suggestions via `NSSpellChecker`
3. If the word is misspelled, up to 5 suggestions appear at the top of our custom context menu in accent color
4. Clicking a suggestion replaces the word in the editor via `view.dispatch({ changes })`

This preserves our custom menu items (Ask AI, Add Comment, clipboard) while adding spell corrections inline.

### Relevant Files

| File | Role |
|---|---|
| `src-tauri/src/lib.rs` | `enable_macos_spellcheck()`, `spell_suggest()`, `open_spelling_panel()` |
| `src/editor/setup.js` | `spellCheckCompartment` (CM6 Compartment) |
| `src/components/editor/TextEditor.vue` | Passes `spellcheck` to extensions, watches toggle |
| `src/components/editor/EditorContextMenu.vue` | Fetches suggestions on open, shows inline |
| `src/stores/workspace.js` | `spellcheck` state + `toggleSpellcheck()` action |
| `src/components/settings/SettingsEditor.vue` | Toggle in Settings > Editor |

### Limitations

- **macOS only** — `NSSpellChecker` is an AppKit API. On Windows/Linux, `spell_suggest` returns empty (graceful fallback — underlines may still show via WebView2/WebKitGTK native spellcheck).
- **Markdown files only** — code files don't get spellcheck (controlled by `isMd && workspace.spellcheck` guard).

## Live Preview (Semi-WYSIWYG)

`src/editor/livePreview.js` provides a semi-WYSIWYG mode that hides markdown syntax when the cursor is not on that line. Toggled via Settings > Editor > "Hide Markup". Markdown files only.

### Inline Elements (ViewPlugin)

When cursor is **not** on the line, syntax characters are hidden and styling is applied:

| Element | Hidden | Styled |
|---|---|---|
| `**bold**` | `**` marks | `.cm-lp-bold` (font-weight: bold) |
| `*italic*` | `*` marks | `.cm-lp-italic` |
| `~~strike~~` | `~~` marks | `.cm-lp-strike` (line-through) |
| `` `code` `` | backticks | (just hidden, code styling remains) |
| `[text](url)` | `[` and `](url)` | `.cm-lp-link` (accent underline) |
| `# Heading` | — | `#` marks dimmed (0.25 opacity, 0.7em) |
| `> Quote` | `>` mark | Left border line decoration |
| `---` | Entire line | Replaced with styled `<hr>` widget |
| `![alt](src)` | Entire syntax | Replaced with rendered `<img>` widget |

Uses `Decoration.mark()` for hiding/styling and `Decoration.replace()` with widgets for HRs and images. Cursor detection builds a `Set<lineNumber>` from all selection ranges.

### Images (ViewPlugin)

`ImageWidget` replaces `![alt](path)` with a rendered `<img>`. Local images are loaded async via `invoke('read_file_base64')` and cached in a module-level `Map`; remote URLs (`http(s)://`) are used directly. Relative paths resolve against the markdown file's directory. The `livePreviewExtension` receives a `getFilePath` closure from `TextEditor.vue` for path resolution.

### Tables (StateField)

Tables use a **separate `StateField`** because CM6 prohibits block-level and cross-line replace decorations from `ViewPlugin`s.

When cursor is **not** on any line of the table, the entire raw markdown table is replaced with a rendered HTML `<table>` widget (`TableWidget`). Clicking the widget or arrow-keying into it moves the cursor inside, which removes the widget and shows raw markdown for editing.

**Key implementation details:**

- `parseMarkdownTable(text)` — splits rows on unescaped `|`, detects column alignment from the delimiter row (`:---` left, `:---:` center, `---:` right), returns `{ headers, alignments, rows }`
- `TableWidget.toDOM()` — builds `<div class="cm-lp-table-wrap"><table>` with `<thead>`/`<tbody>`, uses `textContent` (no innerHTML) for XSS safety. Inline markdown in cells appears as raw text.
- Range alignment — `fromLine.from` to `toLine.to` ensures the replace range is at exact line boundaries (required for `block: true`)
- Arrow key navigation — `Prec.high` keymap intercepts ArrowUp/ArrowDown adjacent to a widget-rendered table and moves the cursor into it (first line from above, last line from below). Returns `false` (pass-through) when cursor is already inside a table or no table is adjacent.

**CSS classes:** `.cm-lp-table-wrap`, `.cm-lp-table`, `.cm-lp-table th`, `.cm-lp-table td` — all themed via CSS variables (`--bg-secondary`, `--border`, `--fg-primary`, `--fg-secondary`, `--bg-hover`).

**CM6 constraint learned:** `ViewPlugin` decorations cannot use `block: true` or span line breaks. These require a `StateField` with `provide: f => EditorView.decorations.from(f)`. The `HrWidget` works from a ViewPlugin only because its replace range is within a single line.

## Soft Wrap Toggle

Uses a CodeMirror `Compartment`:
```js
export const wrapCompartment = new Compartment()
// Initial: wrapCompartment.of(softWrap ? EditorView.lineWrapping : [])
// Toggle:  wrapCompartment.reconfigure(wrap ? EditorView.lineWrapping : [])
```

The toggle button is in `Footer.vue`. State is in `workspace.softWrap`.

### Wrap Column Width

A second compartment (`columnWidthCompartment`) constrains `.cm-content` to a `max-width` in `ch` units. Settings > Editor offers presets: Narrow (60), Medium (80), Wide (100), Full width (0 = window edge, default). State is in `workspace.wrapColumn`, persisted to localStorage.

## File-Type Routing

`EditorPane.vue` uses `getViewerType()` from `src/utils/fileTypes.js` to select the viewer component:

| Viewer | File Types / Path Prefix | Key Features |
|---|---|---|
| `TextEditor` | `.md`, `.js`, `.py`, `.rs`, etc. | CodeMirror 6, ghost suggestions (`.md` only), wiki links (`.md` only), merge view, comments |
| `PdfViewer` | `.pdf` | Embeds the Firefox PDF.js viewer app via iframe (blob URL). Full-featured: thumbnails sidebar, page navigation, text selection, Cmd+F search, annotations, highlights, zoom. Theme follows app (dark/light). |
| `CsvEditor` | `.csv`, `.tsv` | Handsontable grid, auto-save on debounce |
| `ImageViewer` | `.png`, `.jpg`, `.gif`, `.svg`, etc. | Opens at 1:1 (actual size), zoom/pan with mouse, Fit button and double-click reset to 1:1 |
| `DocxEditor` | `.docx` | SuperDoc (ProseMirror-based), see [superdoc-system.md](superdoc-system.md) |
| `NewTab` | `newtab:` prefix | Recent files, recent chats, chat input, quick file creation |
| `ChatPanel` | `chat:` prefix | AI chat session |

## PDF Viewer

Embeds the official Firefox PDF.js viewer app (`public/pdfjs-viewer/web/viewer.html`) in a same-origin `<iframe>`. The PDF is read via `read_file_base64`, converted to a blob URL, and passed as the `file` query parameter.

### Static Assets (`public/pdfjs-viewer/`)

Downloaded from the PDF.js v5 GitHub release distribution (matches the `pdfjs-dist` npm package version):

- **`build/pdf.mjs`** + **`pdf.worker.mjs`** — core library and worker thread
- **`web/viewer.html`** + **`viewer.mjs`** + **`viewer.css`** — the viewer app
- **`web/images/`** (78 SVGs) — toolbar icons
- **`web/standard_fonts/`** — Liberation/Foxit fonts for PDFs without embedded fonts
- **`web/cmaps/`** — character maps for CJK and complex scripts
- **`web/wasm/`** — JBIG2, OpenJPEG, QCMS decoders for special image formats
- **`web/locale/en-US/`**, **`en-GB/`**, **`en-CA/`** — UI strings (Fluent)

### Features

The viewer app provides the full Firefox/Mozilla PDF.js feature set out of the box: thumbnail sidebar, page navigation, text selection, Cmd+F search, highlight/annotation tools, zoom, and print. No custom rendering code.

### Theme Syncing

After the viewer fires its `webviewerloaded` event (initialization complete), `applyTheme()` sets `color-scheme: dark` or `color-scheme: light` on the iframe's root element. The viewer CSS uses `light-dark()` throughout, so this cascades to the full UI instantly. A `watch(isDark)` re-applies on app theme changes without reloading the iframe. Light themes: `light`, `one-light`, `humane`, `solarized` — everything else is dark.

### API Access

Because the viewer is same-origin, the parent frame has full access to its internals after load:

```js
const app = iframeRef.value.contentWindow.PDFViewerApplication
app.page          // current page
app.pagesCount    // total pages
app.eventBus.on('pagechanging', ...)
iframeRef.value.contentWindow.getSelection().toString()  // selected text
app.pdfDocument.annotationStorage.serializable           // all annotations/highlights
```

### Reload on Recompile

`PdfViewer.vue` listens for the `pdf-updated` custom event. On receipt it revokes the old blob URL, re-reads the file via `read_file_base64`, creates a new blob URL, and updates `viewerSrc` — the iframe reloads with the new PDF.
