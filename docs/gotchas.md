# Non-Obvious Lessons & Gotchas

Things that broke, confused, or wasted time. Read this before making changes.

---

## Tauri / WKWebView

### `window.confirm()` doesn't work
`confirm()`, `alert()`, and `prompt()` return immediately in Tauri's WKWebView without waiting for user input. Files get deleted before the user clicks Cancel.

**Use instead:** `ask()` from `@tauri-apps/plugin-dialog` — returns a proper `Promise<boolean>` via a native macOS dialog.

### WKWebView spellcheck needs NSUserDefaults
Setting `spellcheck="true"` on a contenteditable element is necessary but not sufficient. WKWebView doesn't show red underlines unless `WebContinuousSpellCheckingEnabled` is set to `true` in `NSUserDefaults` before webview initialization.

**Fix:** Call `NSUserDefaults.setBool_forKey(true, "WebContinuousSpellCheckingEnabled")` early in `lib.rs:run()`, before `tauri::Builder`. Uses `objc2-foundation` (already a transitive dep of tauri/wry).

### Custom context menu blocks native spell suggestions
`@contextmenu.prevent` on the editor container intercepts right-click entirely. The browser's native context menu (which shows spell corrections) never appears. There is no JS API to detect whether a word is misspelled by the browser.

**Fix:** On right-click, extract the word at cursor position in JS, send it to Rust `spell_suggest()` which checks via `NSSpellChecker`, and show suggestions at the top of our custom context menu. See `EditorContextMenu.vue`.

### CM6 search panel buttons are invisible in light themes
`src/editor/theme.js` sets `{ dark: true }` so CM6's internal defaults assume dark mode. When CSS vars flip to light colors, `.cm-button` and `.cm-textfield` in the search panel (Cmd+F) become unreadable.

**Fix:** Explicitly style `.cm-button` and `.cm-textfield` in the theme using CSS vars (`--bg-tertiary`, `--fg-primary`, `--border`). Works across all themes.

### CM6 ViewPlugin cannot provide block or cross-line decorations
`Decoration.replace({ block: true })` and replace decorations that span line breaks throw `RangeError` when provided via a `ViewPlugin`. This is a hard CM6 constraint.

**Fix:** Use a `StateField` with `provide: f => EditorView.decorations.from(f)` for any decoration that crosses line boundaries or uses `block: true`. The StateField doesn't have viewport access, but for sparse elements like tables this is fine. Single-line replacements (like `HrWidget` for `---`) work from a ViewPlugin because they don't cross line breaks.

**Applied in:** `livePreview.js` — table rendering uses a separate `StateField` while all inline decorations (bold, italic, links, etc.) stay in the `ViewPlugin`.

### Settings modal z-index is 10000
Any dropdown or popover inside the settings modal that uses `<Teleport to="body">` must use z-index > 10000. The ghost model picker dropdown uses 10001 (backdrop) and 10002 (menu).

### macOS autocomplete popups on utility inputs
macOS shows autocomplete/spelling suggestion popups on `<input>` elements by default. For search fields, rename inputs, filter inputs, and other utility controls, this is distracting.

**Fix:** Add `autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"` to all utility inputs. Applied to 13+ inputs across Header, FileTree, FileTreeItem, ReferenceList, CitationPalette, PdfViewer, RightPanel, SnapshotDialog, DocxToolbar. NOT applied to data entry fields (reference metadata, API keys) where OS suggestions may help.

### CORS blocks all API calls
The webview can't call `api.anthropic.com`, `api.openai.com`, CrossRef, etc. directly.

**Workaround:** All HTTP requests go through Rust's `proxy_api_call` command (reqwest). Streaming uses `chat_stream` with Tauri events.

### Titlebar drag requires three things
1. `titleBarStyle: "Overlay"` + `hiddenTitle: true` in `tauri.conf.json`
2. `data-tauri-drag-region` attribute on the header element
3. `"core:window:allow-start-dragging"` in capabilities

Missing any one of these silently breaks window dragging.

### HTML5 drag-and-drop is unreliable in WebKit
Native `@dragstart`/`@dragover`/`@drop` events behave inconsistently.

**Workaround:** All in-app drag operations (tabs, files, references) use manual mouse event tracking: `mousedown` → document `mousemove` → document `mouseup` with cleanup via `removeEventListener`. Native drag events are only used for OS-level file drops (via Tauri's `tauri://drag-drop` event).

---

## Vue / Pinia Reactivity

### Pinia loses reactivity after `array.push()`
After `this.sessions.push(newSession)`, the local `newSession` variable is the raw object, not the reactive proxy.

**Fix:** Re-acquire via `this.sessions[this.sessions.length - 1]` to get the reactive proxy. See `chat.js:245` and `tasks.js:160`.

### `editorStore.openFile()` is a tab switcher, not a file loader
It does NOT read content from disk. If you need updated content in the editor after a write, you must update `filesStore.fileContents[path]` explicitly before calling `openFile()`.

### HMR causes duplicate sessions
`loadSessions()` called multiple times during hot reload appends duplicates.

**Fix:** `this.sessions = []` at the start of `loadSessions()`.

---

## Layout & CSS

### `overflow-hidden` clips popovers
`RightPanel.vue` and most layout containers use `overflow-hidden`. Any dropdown, popover, or floating UI inside these containers is invisible if positioned with `position: absolute`.

**Fix:** Use `<Teleport to="body">` with `position: fixed` and coordinates from `getBoundingClientRect()`. There are 18+ instances of this pattern across the codebase.

### `v-show` not `v-if` for terminals and chat
Using `v-if` destroys xterm.js instances (killing terminal processes) and resets chat scroll position when switching tabs.

**Fix:** All right panel tab contents use `v-show` with absolute positioning. The right sidebar container itself uses `v-show` (not `v-if`) in `App.vue`.

### xterm.js needs hex colors, not CSS vars
xterm.js renders to a `<canvas>` element, so it can't resolve CSS custom properties.

**Fix:** `src/themes/terminal.js` maps theme names to JS objects with hex color values.

### Use `tabular-nums` on dynamic numbers
Without it, layout shifts when digits change width (e.g., token counter going from "1.2k" to "45.3k").

Applied in: footer stats, token counter, PDF zoom percentage.

---

## AI Integration

### AI file tools are sandboxed to the workspace
`resolvePath()` in `chatTools.js` normalizes paths and rejects anything outside `workspace.path`. Absolute paths and `../` traversal return `null` → error message to the AI. `run_command` is the exception — it still has unrestricted shell access via `bash -c`.

The Rust file commands (`fs_commands.rs`) are NOT sandboxed — they serve the file tree, settings panel, and global config. Don't confuse the two layers.

### Shoulders proxy must mirror local `chatProvider.js` logic
The server-side `providerProxy.js` translates Anthropic-format requests to OpenAI/Google format. It must stay in sync with the client-side `chatProvider.js`. Both now use the **Responses API** (`/v1/responses`) for all OpenAI calls (streaming and non-streaming). Key format differences from the old Chat Completions API: `input` not `messages`, `instructions` not system message, `max_output_tokens` not `max_completion_tokens`, flat tool format, `reasoning: { effort, summary }` not top-level `reasoning_effort`.

### OpenAI Responses API is used everywhere
All OpenAI calls (streaming, non-streaming, proxy) use the **Responses API** (`/v1/responses`). The old Chat Completions API (`/v1/chat/completions`) is no longer used.

The Responses API URL appears in **4 places** — if you only change one, the others override it:
1. `apiClient.js` `PROVIDER_URLS.openai` — the primary source for `resolveApiAccess()`
2. `chatProvider.js` `formatOpenAI()` — fallback URL for streaming (rarely reached since `apiClient` provides it)
3. `chatProvider.js` `formatNonStreamingRequest()` — fallback URL for non-streaming
4. `providerProxy.js` `getProviderUrl()` — server-side proxy

**Plus:** existing `~/.shoulders/models.json` files on disk may still have the old URL. `apiClient.js` has a migration check that rewrites `/v1/chat/completions` → `/v1/responses` at runtime.

### Proxy must emit `content_block_stop` + `input_json_delta` for tool calls
The client's `block_stop` handler is the **only** place where accumulated tool call JSON is parsed into `toolCall.input`. The proxy must emit these events for both OpenAI and Google translations — otherwise tools execute with `input: {}`.

**OpenAI (Responses API):** Tool args stream via `response.function_call_arguments.delta` events → proxy emits `input_json_delta`. `response.function_call_arguments.done` → proxy emits `content_block_stop`. Text-only responses get their `content_block_stop` from `response.completed`.

**Google:** Tool args arrive **complete** in `part.functionCall.args` (not streamed). Proxy must emit the full args as a single `input_json_delta` + `content_block_stop` immediately after `content_block_start`. Also, Google uses `finishReason: 'STOP'` for both text and tool responses — proxy must detect function calls in the chunk and emit `stop_reason: 'tool_use'` (not `'end_turn'`), otherwise `_executeToolCalls` never fires.

**Symptoms:** Tool calls arrive but arguments are empty `{}`. Direct API key works, Shoulders account doesn't.

### Responses API does NOT send `[DONE]`
The OpenAI Responses API SSE stream ends with `response.completed` (or `response.failed`/`response.incomplete`), then closes the connection. There is no `data: [DONE]` sentinel like Chat Completions. The proxy must emit `message_stop` in its stream `done` handler for OpenAI, not wait for `[DONE]`.

### OpenAI reasoning models consume output tokens for thinking
OpenAI reasoning models (gpt-5-mini, gpt-5) spend output tokens on internal reasoning BEFORE generating the actual response. With `max_output_tokens: 1024`, gpt-5-mini used all 1024 tokens on reasoning, returned `status: 'incomplete'`, and produced zero tool output. Non-streaming calls (ghost suggestions) must set `reasoning: { effort: 'low' }` and a higher `max_output_tokens` (4096+). The proxy does this in `handleNonStreaming` for all OpenAI calls; the client does it in `formatNonStreamingRequest`. Ghost suggestions now default to gpt-5-nano (non-reasoning) to avoid this entirely.

### Responses API `strict` defaults to `true`
The Responses API defaults `strict: true` on function tools, which requires all schema properties to be in `required` and `additionalProperties: false`. Our Anthropic-format tool schemas don't have `additionalProperties: false`. Must explicitly set `strict: false` on every tool definition sent to OpenAI — both client-side (`chatProvider.js`) and server-side (`providerProxy.js`).

### Proxy must forward `tool_choice` for Google
`translateRequestToGoogle()` must translate Anthropic `tool_choice: { type: 'tool', name: '...' }` to Google's `toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['...'] } }`. Without this, Google treats tool calls as optional and may generate partial tool arguments (e.g., omitting required fields like `suggestions`).

### Proxy must forward `reasoning` for OpenAI thinking
`translateRequestToOpenAI()` forwards `body.reasoning` (nested `{ effort, summary }` format) or converts `body.reasoning_effort` to this format. The Responses API uses `reasoning: { effort, summary }` — not the top-level `reasoning_effort` from Chat Completions.

### Proxy must handle `body.system` as string OR array
`formatNonStreamingRequest('shoulders')` always sends `system` as Anthropic-format array `[{type:'text', text:'...'}]`. Both `translateRequestToOpenAI()` and `translateRequestToGoogle()` must extract the text: `typeof body.system === 'string' ? body.system : body.system.map(b => b.text).join('\n')`.

### Google `thoughtSignature` must round-trip through proxy
Google thinking models attach `thoughtSignature` to function call parts. On multi-turn, Google **requires** this signature back on the `functionCall` in conversation history (400 error without it).

Round-trip path: Google response → proxy `translateGoogleChunk` (store as `_googleThoughtSignature` on `content_block_start`) → client `interpretAnthropic` (forward from event) → `chat.js` (store on tool call) → `chatMessages.js` (include on `tool_use` blocks) → proxy `translateRequestToGoogle` (forward as `thoughtSignature` on `functionCall`).

### `_googleThoughtSignature` must be stripped for Anthropic
When switching models mid-conversation (Google → Anthropic), `tool_use` blocks carry `_googleThoughtSignature`. Anthropic rejects extra fields with `"Extra inputs are not permitted"`.

**Fix:** Strip in `formatAnthropic()` (client-side, direct key) AND `stripExtraFields()` (server-side, proxy passthrough for Anthropic).

### Google streaming sends text + finishReason in the same chunk
Google's Gemini API can include `finishReason: 'STOP'` in the same SSE chunk that has text content. If the translator returns early after processing the text part, the stop signal is lost and the stream hangs. **Fix:** Collect all events (text deltas + stop) into an array per chunk, emit all of them.

### Google `thoughtSignature` splits SSE across TCP chunks
Google's `thoughtSignature` base64 blob can be thousands of characters, making the SSE `data:` line exceed a single TCP packet. If the proxy splits by `\n` and tries `JSON.parse` on each line without buffering, the split line fails silently (incomplete JSON), and the continuation chunk has no `data: ` prefix so it's skipped entirely. The `finishReason: 'STOP'` embedded in that same payload is lost — the client never gets the stop signal and the session hangs in "streaming" forever.

**Fix:** Buffer incomplete SSE lines across `pull()` calls in the proxy's `ReadableStream`. When the last line doesn't end with `\n`, carry it to the next chunk. This is the same `remainingBuffer` pattern the client-side `parseSSEChunk` uses.

### Anthropic API rejects extra fields in `tool_result`
Adding debugging fields like `_toolName` to tool_result blocks causes the API to reject the entire request.

**Fix:** Only include `type`, `tool_use_id`, `content`, and `is_error`.

### File write + merge view race condition
When AI tools write files, the merge view compares against `filesStore.fileContents`. If content isn't updated before recording the pending edit, the editor shows stale content and the diff is wrong.

**Fix:** Update `filesStore.fileContents[path]` synchronously BEFORE pushing to `reviews.pendingEdits`.

### `mapPos` assoc values are backwards from intuition
`ChangeSet.mapPos(pos, assoc)` with `assoc=1` moves the position **past** insertions at that point, and `assoc=-1` keeps it **before**. For mark decoration ranges, the convention is `from` uses `-1` (grow outward) and `to` uses `1` (grow outward). Swapping these causes the range to **collapse or invert** when a change spans it, and `Decoration.mark().range(from, to)` throws `RangeError: Mark decorations may not be empty`.

The `taskField` StateField in `tasks.js` had these reversed, which cascaded into: dispatches crashing silently (editor not updating), merge view not appearing, and reject buttons throwing.

**Fix:** Always use `mapPos(from, -1)` and `mapPos(to, 1)` for mark ranges. Add a `Math.min`/`Math.max` safety clamp and filter out `from >= to` before creating `Decoration.mark()`.

### Merge view accept doesn't change the document
CodeMirror's `unifiedMergeView` with `mergeControls: true` handles accept/reject differently. **Reject** replaces the current text with the original (document change). **Accept** only removes the old-text decoration (no document change — the new text is already there).

Any `ViewPlugin.update()` handler that guards on `update.docChanged` will miss accept events entirely. The `chunkWatcherPlugin` had this bug: `onAllResolved` never fired after accepts, so the pending edit stayed as `'pending'`, the banner never disappeared, and the diff came back on tab switch.

**Fix:** Check chunk count on every update, not just document changes.

### `buildApiMessages` is async
Building workspace meta requires async git operations, so all callers of `buildApiMessages()` must use `await`.

### Ghost suggestion staleness (generation counter)
A module-level `currentGeneration` counter is incremented on each trigger. When the API response arrives, it checks `gen !== currentGeneration` and discards stale results. Without this, slow responses overwrite newer suggestions.

### Git diff fallback for auto-commit users
`gitDiffSummary()` tries `git diff` first. If empty (everything committed), falls back to `git diff HEAD~1`. This handles the auto-commit-every-5-minutes workflow where there are rarely uncommitted changes.

### Full-document swap destroys all position-tracked annotations
When `TextEditor.vue`'s `fileContents` watcher dispatches `{ from: 0, to: doc.length, insert: newContent }`, CodeMirror's `mapPos` maps every tracked position to either `0` (bias -1) or `newContent.length` (bias +1). This expands every task range to cover the entire document and corrupts the store when `handleDocChanged()` writes the broken ranges back.

**Fix:** Use `computeMinimalChange()` from `src/utils/textDiff.js` to find the common prefix/suffix and dispatch only the changed span. This lets `mapPos` correctly shift annotations around the actual edit. Applied in `TextEditor.vue` and `NotebookCell.vue`.

### `EditorView.domEventHandlers` only covers the content area
`domEventHandlers` registers on `.cm-content`, not on `.cm-gutters`. Click handlers for gutter markers (like task dots) will never fire through this API. This can be masked if a decoration covers the full document — clicks near the gutter land on the content area highlight instead.

**Fix:** Use the `domEventHandlers` option inside the `gutter()` config. Note the different signature: `(view: EditorView, line: BlockInfo, event: Event) => boolean` (vs `(event, view)` for `EditorView.domEventHandlers`). See `tasks.js` task gutter.

---

## Typst / PDF Export

### Paragraph spacing: `#set par(spacing: ...)` not `#set block(spacing: ...)`
`#set block(spacing: X)` and `#show par: set block(spacing: X)` have **no visible effect** on paragraph spacing. Paragraphs in Typst are not block elements in the way `block()` targets.

**Fix:** Use `#set par(spacing: X)` — this directly controls the gap between paragraphs. `par(leading)` controls line spacing *within* a paragraph; `par(spacing)` controls the gap *between* paragraphs.

### Fonts in `public/fonts/` are webview-only
Vite serves `public/` files to the webview via the asset protocol, but external processes like Typst can't read them. Fonts must be copied to the real filesystem.

**Fix:** `bundle.resources` in `tauri.conf.json` copies fonts to the Tauri resource directory. `find_font_dir()` resolves the path (dev: `../public/fonts`, prod: resource dir), and `--font-path` is passed to Typst at compile time. System fonts (Times New Roman, Arial) still work — `--font-path` is additive.

---

## File Operations

### Name collision behaviors differ by operation
`createFile` and `renamePath` **block** (show a toast, abort). `movePath`, `copyExternalFile`, and `duplicatePath` **auto-rename** (append numeric suffix: `file 2.md`, `file 3.md`). Don't assume they behave the same — `movePath` uses `rename_path` (Rust `fs::rename`) which on macOS silently overwrites the destination, so the JS-side `path_exists` check is critical.

### Inline new-item input DOM order matters
In `FileTreeItem.vue`, the inline create input must appear AFTER the folder's `.tree-item` row and BEFORE the children `<template>`. Placing it before the row makes it render above the folder name.

---

## Binary Files

### Base64 bridge with chunked conversion
Large binary files (DOCX, images) transferred between Rust and JS via base64. JavaScript `String.fromCharCode()` is called in 8192-byte chunks to avoid call stack size limits.

Relevant commands: `read_file_base64`, `write_file_base64`.

### SuperDoc is code-split (3.2MB)
SuperDoc's bundle is loaded via `defineAsyncComponent` and dynamic `import('superdoc')` to avoid blocking initial page load.

### SuperDoc bundles a duplicate Vue runtime
Suppressed via `console.warn` filter in `src/main.js`. Harmless — dev-mode only.

### DOCX text cache
`filesStore.fileContents[path]` holds extracted text for .docx files (not binary), enabling search and chat tools to read content without parsing the binary each time.

---

## Terminal / Code Runner

### Multi-line code garbles in R/Python/Julia REPL
Sending multi-line code directly to the PTY via `pty_write` causes readline to echo and execute each line individually while remaining lines are still in the input buffer. Output interleaves with unprocessed input, producing garbled, duplicated, and truncated lines.

Bracketed paste (`\x1b[200~`...`\x1b[201~`) does NOT work — R's readline in the PTY context doesn't enable bracketed paste mode, so the escape sequences leak through as literal `00~`/`01~` text.

**Fix:** Write multi-line code to a temp file, then send a single-line `source()` / `exec()` / `include()` command to the REPL. See `RightPanel.vue:buildReplCommand()`.

---

## Keyboard Shortcuts

### CodeMirror `defaultKeymap` eats custom shortcuts
`defaultKeymap` from `@codemirror/commands` binds common combos like `Mod-Enter` (to `insertBlankLine`). Custom keymaps added via `extraExtensions` in `setup.js` are spread AFTER the default keymap, so they lose the priority race and never fire.

**Fix:** Wrap custom keymaps in `Prec.highest(keymap.of([...]))` (import `Prec` from `@codemirror/state`). This ensures they're checked before the defaults.

**Applied in:** `NotebookCell.vue` — Shift+Enter and Mod+Enter (run cell) are both wrapped in `Prec.highest` to beat `insertBlankLine`.

### Cmd+B conflict with SuperDoc bold
Global Cmd+B toggles the sidebar, but .docx files need it for bold formatting.

**Fix:** `App.vue` checks `editorStore.activeTab?.endsWith('.docx')` and returns early to let SuperDoc handle it.

### `mousedown.prevent` keeps textarea focused
Popover buttons near text inputs use `@mousedown.prevent` so clicking them doesn't blur the textarea.

---

## Cross-Component Communication

### Custom window events for decoupled components
When components can't share a direct parent-child relationship (editor gutter → right panel, citation click → reference detail), communication uses `window.dispatchEvent(new CustomEvent(...))`.

Events in use: `open-tasks`, `open-reference-detail`, `ref-drag-over`, `ref-drag-leave`, `ref-file-drop`, `filetree-drag-start` (detail: `{ paths }`), `filetree-drag-end`, `docx-save-now`, `docx-content-changed` (on wrapperEl, not window), `notebook-cell-task`, `notebook-scroll-to-cell`.

### `.shoulders/.direct-mode` is a flag file
Its existence (not content) toggles direct mode. Checked by both the frontend (reviews store) and the Claude Code shell hook.

---

## Notebooks (.ipynb)

### `kernel.json` bare `python` resolves to the wrong interpreter
Kernel specs often list `"python"` or `"python3"` as `argv[0]`, which resolves via PATH to whichever Python comes first — often Homebrew's latest (e.g. 3.14) which lacks ipykernel, instead of the user's system/venv Python where it's installed.

**Fix:** `kernel.rs:find_python_with_ipykernel()` probes candidate categories in priority order: bare command → pyenv → conda → Homebrew → macOS per-version → system → Linux per-version → user-local → Windows (py launcher, AppData paths, Conda, Scoop). Each candidate is checked with `Path::exists()` first (cheap), then `python -m ipykernel_launcher --version`.

### Jupyter runtime directory is platform-specific
macOS uses `~/Library/Jupyter/runtime`, Linux uses `$XDG_RUNTIME_DIR/jupyter` (or `~/.local/share/jupyter/runtime`), Windows uses `%APPDATA%\jupyter\runtime`.

**Fix:** `kernel.rs:jupyter_runtime_dir()` with `#[cfg(target_os)]` branches.

### Windows kernel support
`kernel.rs` uses `get_home_dir()` (falls back to `USERPROFILE`), `#[cfg(unix)]`/`#[cfg(windows)]` for `libc::kill` vs `taskkill`, and conditional `libc` dependency (`[target.'cfg(unix)'.dependencies]` in Cargo.toml). Shell commands use `bash -c` on Unix, `cmd /C` on Windows (`fs_commands.rs`). PTY prompt env vars (`PS1`/`PROMPT`) only set on Unix.

### Cell tasks anchor by cell ID, not character position
Notebook cells don't have a flat document offset. Task threads on cells use `cellId` (the stable UUID from .ipynb) instead of `range.from`/`range.to`. Navigation dispatches `notebook-scroll-to-cell` instead of CodeMirror selection.

### Ghost suggestions work per-cell
Each CodeMirror instance in `NotebookCell.vue` gets its own `ghostSuggestionExtension`. Context is automatically scoped to the cell's content — no multi-cell stitching needed.

---

## SuperDoc (DOCX Editing)

Full details in [superdoc-system.md](superdoc-system.md). Key traps:

### ProseMirror decorations are invisible
SuperDoc's ProseMirror EditorView is at `position: fixed; left: -9999px; opacity: 0`. Widget decorations render in hidden DOM. Use floating Vue overlays positioned at `.presentation-editor__selection-caret` instead.

### "Jump to" / `scrollIntoView` doesn't work for DOCX
PM `tr.scrollIntoView()` and `editor.commands.scrollIntoView()` only scroll the hidden view (x:-9999). The visible painted DOM has its own scroll container (the `overflow-auto` wrapper div). `presentationEditor.scrollToPosition()` exists but returns `false` in our embedded setup (viewport host resolution issue).

**Fix:** Text-search `.superdoc-line` elements in the visible DOM for the target text, then call `line.scrollIntoView({ behavior: 'smooth', block: 'center' })`. Fallback: wait ~100ms for the painter to update the visible caret (`.presentation-editor__selection-caret`), then scroll the caret. See `TaskThread.vue:navigateDocx()` and `OutlinePanel.vue:navigateToHeading()`.

When navigating from another file (editor not yet mounted), brute-force retry 4 times at 0ms, 500ms, 1000ms, 1500ms. See `TaskThread.vue:navigateToSelection()`.

### No auto-scroll while typing in DOCX
SuperDoc has no built-in "keep caret visible" mechanism. Unlike CodeMirror, the layout engine doesn't auto-scroll when the cursor moves past the viewport edge.

**Fix:** In DocxEditor's `selectionUpdate` handler, use `requestAnimationFrame` to check if `.presentation-editor__selection-caret` is within the wrapper's viewport bounds (with 20px margin). If outside, call `caret.scrollIntoView({ behavior: 'auto', block: 'nearest' })`. Use `'auto'` (not `'smooth'`) for instant response while typing.

### DOCX attribute-only changes don't trigger reactive updates
Changing paragraph style (e.g. Normal → Heading 1), font, color, or other attributes doesn't alter `doc.textContent`. If a computed property uses `filesStore.fileContents[path]` as its reactive trigger, it won't re-evaluate because the cached text is identical.

**Fix:** `editorStore.docxUpdateCount` is a reactive counter bumped on every DOCX editor `update` event (including attribute-only changes). Use `void editorStore.docxUpdateCount` as the reactive trigger instead of `filesStore.fileContents[path]` when you need to react to any document change, not just text changes. See `OutlinePanel.vue:headings` computed.

### DOCX gutter indicators must be floating overlays
No CM-style `gutter()` API exists for the painted DOM. Task dots use `DocxTaskIndicators.vue` — a floating overlay positioned by text-searching `.superdoc-line` elements for the thread's `selectedText`. Same sibling-overlay pattern as ghost loading dots. Fallback to `range.from / docSize` ratio when text not found.

### SuperDoc is NOT TipTap
Zero `@tiptap` dependencies. Import extensions from `superdoc/super-editor`, not `@tiptap/core`. Method is `addPmPlugins()` not `addProseMirrorPlugins()`. Config key is `editorExtensions` not `extensions`.

### Vue overlays must be siblings, not children
SuperDoc manages its container's DOM. Vue overlays inside the SuperDoc mount div cause `parent.insertBefore` errors. Make overlays siblings of the SuperDoc container, wrapped in a shared relative parent.

### `superdoc.activeEditor` may be null after construction
Wait for `superdoc.on('ready', ...)` before accessing `activeEditor`. Small docs may set it synchronously — check both.

### Page margins are not CSS
No padding/margin wrapper for content area. Margins are baked into `.superdoc-fragment` absolute positioning. Use fragment `getBoundingClientRect()` for content area bounds.

### Custom atom nodes cause layout bugs
SuperDoc's layout engine has a hardcoded `ATOMIC_INLINE_TYPES` set: `image`, `hardBreak`, `lineBreak`, `page-number`, `total-page-number`, `indexEntry`, `tab`, `footnoteReference`, `passthroughInline`, `bookmarkEnd`, `fieldAnnotation`. Custom atom nodes NOT in this set get incorrect positioning — cursor jumps, text reflows, and glitchy rendering. Don't create custom inline atom nodes.

### DOM overlay injection into painted layer is fragile
Injecting `<span>` elements as siblings of SuperDoc's leaf text runs (`[data-pm-start][data-pm-end]`) technically works for rendering, but:
- SuperDoc repaints on every edit, removing injected DOM — requires MutationObserver to re-inject, causing visible flicker
- SuperDoc's invisible editing surface sits on top of the painted layer — `e.target` on click is the surface, never the injected element. `document.elementsFromPoint()` can find buried elements but is unreliable
- `pointer-events: auto` + `z-index: 200000` on overlays still gets intercepted by SuperDoc's capture-phase handlers

**Verdict:** Only use for non-interactive indicators (task dots). For clickable inline elements, use the link mark approach.

### Link mark is the only reliable inline clickable element
SuperDoc's `link` is a PM Mark (not a Node). The layout engine renders it natively as `<a class="superdoc-link">` in the painted DOM. Clicks dispatch `superdoc-link-click` CustomEvent with `href`, `clientX`, `clientY` in `e.detail`. This is the ONLY inline element that gets reliable click handling through SuperDoc's dual-layer architecture.

### `sanitizeHref` blocks custom protocols (no config hook)
SuperDoc's DomPainter calls `sanitizeHref(link.href)` with NO config argument. Only `http`, `https`, `mailto`, `tel`, `sms` are allowed. Custom protocols like `cite:` return `null` → link is "blocked" → rendered as `<span>` (not `<a>`) with `data-link-blocked="true"` and `aria-label="Invalid link - not clickable"`. Blocked links never get the `superdoc-link` class and never dispatch `superdoc-link-click`.

The Tiptap Link Mark has a `protocols` option, but the DomPainter path is separate and has no external config.

**Fix:** Use `https://cite.local/{id}` — passes protocol validation, renders as a proper `<a>`, click events fire normally. Intercept in the `superdoc-link-click` handler by checking the href prefix.

### DOCX field codes span multiple PM depths
Zotero field codes in ProseMirror have display text inside a `run` node (depth=2) with field markers (`fldChar begin/instrText/separate/end`) as siblings at paragraph level (depth=1). Replacing only the display text range leaves the field markers intact — SuperDoc regenerates the original text.

**Fix:** `expandToFieldBoundary(doc, from, to)` walks backward/forward through non-text inline atoms at the text level, then falls back to parent (paragraph) level if the text is inside a `run` wrapper. Must absorb ALL surrounding field code atoms to fully remove the field structure.

### XML entities in DOCX field codes must be decoded before parsing
DOCX field code instruction text preserves XML entities (`&quot;` → `"`, `&amp;` → `&`). The brace-counting JSON parser for CSL_CITATION data fails if entities aren't decoded first. Decode order matters: `&amp;` must be last to avoid double-decoding.

---

## SuperDoc Citation System (SuperCite)

Architecture summary for the working Zotero citation import system:

1. **Phase 1** (pre-scan): Parse DOCX ZIP with JSZip, extract `ADDIN ZOTERO_ITEM CSL_CITATION` field codes
2. **Phase 2** (post-process): After SuperDoc loads, find display text in PM doc, expand to field boundaries, replace with link-marked text (`href: "https://cite.local/{id}"`)
3. **Metadata**: Citation data (cites array, Zotero JSON) stored in a separate `citationMetaMap`, persisted to localStorage — the link mark only carries the ID via href
4. **Click handling**: Listen for `superdoc-link-click` on wrapperEl (capture phase), check href prefix, open `DocxCitationPopover`
5. **Editing**: Popover updates metadata + replaces display text via `updateCitationText()` (finds link range, creates new text node with same link mark)
6. **Save**: No strip/restore needed — link marks export as DOCX hyperlinks natively

**Failed approaches** (in order):
1. Custom `citation` atom node + NodeView → not in `ATOMIC_INLINE_TYPES`, layout engine can't position it
2. Custom atom node + DOM overlay injection → flicker on every edit, clicks intercepted by editing surface
3. Link mark with `cite:` protocol → protocol blocked by `sanitizeHref`, rendered as inert `<span>`
4. Link mark with `https://cite.local/` protocol → **works** ✓

### SuperDoc's comment sidebar is unusable when embedded in a fixed container
SuperDoc renders its `CommentDialog` inside a 320px sidebar (`.superdoc__right-sidebar`) that's a flex sibling of the editor layers (`.superdoc__layers`). The root `.superdoc` div is `display: flex`. When embedding SuperDoc in a fixed-size container (`absolute inset-0`), this sidebar overflows the container and gets clipped — the dialog is in the DOM but invisible.

The native floating "+" button triggers `showAddComment()` (in `comments-store.js`) which sets `pendingComment` in the store → the sidebar renders via `v-if="showCommentsSidebar"` → `CommentDialog` mounts with `autoFocus: true`. This flow assumes SuperDoc controls its own flex layout and can grow to accommodate the sidebar. When embedded, it can't.

Additionally, `showAddComment` has a bug at line 406: `activeComment.value = pendingComment.value.commentID` uses uppercase `D`, but `useComment()` returns `commentId` (lowercase `d`). The native button recovers because `CommentDialog.onMounted → setFocus()` re-sets `activeComment` with the correct property.

**Fix:** Don't use the sidebar at all. Use `ed.commands.addComment()` — the public API documented at `docs.superdoc.dev/extensions/comments`. Show your own input dialog (Teleported to `<body>`), then call:
```js
ed.commands.addComment({ content: text, author: 'User', authorEmail: 'user@local' })
```
This adds the ProseMirror comment mark at the current selection AND emits `commentsUpdate` on the editor, which SuperDoc.vue's `onEditorCommentsUpdate` handler catches to add the comment to the store. No store manipulation, no sidebar, no layout issues. Comments are fully tracked (marks, highlighting, DOCX export).

**Key requirements:** The ProseMirror selection must be active (non-collapsed) when calling `addComment`. Right-click collapses the selection, so save it in a capture-phase `mousedown` handler and restore it before calling the API.

### Citation cursor bleed: styling comes from run properties, not marks
After inserting a citation, text typed immediately after inherits the hyperlink's blue color + underline. The link mark is correctly bounded (the `<a>` ends at the closing bracket), and the typed text renders in a separate `<span>` — but the `<span>` still has `color: rgb(5,99,193)` and `text-decoration: underline`.

**Root cause:** The typed text enters the same OOXML `run` node as the citation. The run's `runProperties` include hyperlink styling (color, underline, rStyle). SuperDoc's `calculateInlineRunPropertiesPlugin` applies these properties to ALL text in the run, regardless of ProseMirror marks.

**What doesn't work:**
- `setStoredMarks([])` — run properties override stored marks
- `removeMark()` in `appendTransaction` — the link mark was never on the bleed text; styling comes from `runProperties`, not marks
- `handleTextInput` plugin prop — SuperDoc intercepts input before ProseMirror's standard `handleTextInput` fires

**What works:**
1. **CSS** (immediate visual fix): `a.superdoc-link[href^="https://cite.local/"] + span` overrides the inherited blue/underline on sibling `<span>` elements painted by the DomPainter
2. **`appendTransaction` with run splitting** (fixes the model): Detect text after a citation link range that shares the same run (`findRunDepth` + `offsetInRun < runContent.size`), then split the run into `[citationRun | cleanRun]` with `cleanRunProperties()` stripping `color`, `underline`, `u`, and `rStyle`. Same run-splitting technique as `docxGhost.js`.
