# UI Layout & Components

## Overall Layout

Two states based on whether a workspace is open:

### Workspace Open
```
┌─────────────────────────────────────────────────────────┐
│ Header (38px, ≡ menu + search + toggles + settings)     │
├──────┬──┬───────────────────────────┬──┬────────────────┤
│      │  │                           │  │                │
│ Left │R │    PaneContainer          │R │   Right        │
│ Side │e │    (recursive editor      │e │   Panel        │
│ bar  │s │     panes with tabs,      │s │   (Outline,    │
│      │i │     incl. chat tabs)      │i │    Terminal,   │
│Explr │z │                           │z │    Backlinks)  │
│ Refs │e │    [ReviewBar per pane]   │e │                │
│      │  │                           │  │                │
│      │  ├───────────────────────────┤  │                │
│      │  │ BottomPanel (terminals)   │  │                │
├──────┴──┴───────────────────────────┴──┴────────────────┤
│ Footer (30px, status bar)                                │
└─────────────────────────────────────────────────────────┘
```

Notes:
- ReviewBar appears **per pane** (above the editor, below the tab bar) when that file has pending edits, not as a global horizontal bar.
- Chat sessions are opened as `chat:*` tabs in the editor pane system, not in the right panel.
- The BottomPanel sits below the PaneContainer in the center column. It hosts multi-tab terminals with drag-reorder, rename, and language REPL support. Toggled via the header terminal button. The right panel also retains a Terminal tab for quick access.

### No Workspace (Launcher)
```
┌─────────────────────────────────────────────────────────┐
│ Header (38px, ≡ menu + search + sidebar toggles)        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│                    [S] Shoulders                         │
│           Writing, references, and AI...                │
│                                                         │
│            [Open Folder] [Clone Repository]             │
│                                                         │
│                    RECENT                                │
│                    📁 thesis  ~/Documents/...            │
│                    📁 paper   ~/Desktop/...              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

No sidebars, no footer. Header is always visible (hamburger menu works in both states).

## Relevant Files

| File | Role |
|---|---|
| **Root layout** | |
| `src/App.vue` | Root layout, keyboard shortcuts, workspace init, launcher/editor toggle |
| `src/components/Launcher.vue` | Empty state: logo, Open Folder, Clone Repository, recent workspaces |
| `src/components/layout/Header.vue` | Titlebar: hamburger menu + inline search bar + sidebar toggles + settings |
| `src/components/SearchResults.vue` | Search dropdown (file/content/reference/chat results) |
| `src/components/layout/Footer.vue` | Status bar: word count, sync status, zoom, billing |
| `src/components/layout/ResizeHandle.vue` | Sidebar resize dividers |
| `src/components/layout/SnapshotDialog.vue` | Named snapshot input dialog (Cmd+S → "Name this version") |
| `src/components/layout/SyncPopover.vue` | GitHub sync status popover (from Footer) |
| `src/components/layout/ToastContainer.vue` | Fixed bottom-right toast stack |
| **Left sidebar** | |
| `src/components/sidebar/LeftSidebar.vue` | Two collapsible panels: Explorer and References |
| `src/components/sidebar/FileTree.vue` | Explorer panel content |
| `src/components/sidebar/FileTreeItem.vue` | Tree nodes |
| `src/components/sidebar/ContextMenu.vue` | Right-click menu |
| **Editor panes** | |
| `src/components/editor/PaneContainer.vue` | Recursive pane layout |
| `src/components/editor/EditorPane.vue` | Individual pane: TabBar + ReviewBar + viewer component routing |
| `src/components/editor/TabBar.vue` | Pane tab bar with drag reorder |
| `src/components/editor/SplitHandle.vue` | Split pane divider |
| `src/components/editor/TextEditor.vue` | CodeMirror instance (all text files) |
| `src/components/editor/ChatPanel.vue` | Chat session rendered as an editor tab (`chat:*` paths) |
| `src/components/editor/NewTab.vue` | Empty pane state: recent files, quick actions |
| `src/components/editor/ReviewBar.vue` | Pending edits banner (text files) |
| `src/components/editor/DocxReviewBar.vue` | Pending edits banner (DOCX files) |
| `src/components/editor/NotebookReviewBar.vue` | Pending edits banner (notebooks) |
| `src/components/editor/EditorContextMenu.vue` | Right-click: Ask AI, Add Comment, clipboard, spell suggestions |
| `src/components/editor/DocxContextMenu.vue` | Right-click context menu for DOCX editor |
| **Right panel** | |
| `src/components/right/RightPanel.vue` | Right sidebar: Outline / Terminal / Backlinks tabs |
| `src/components/layout/BottomPanel.vue` | Bottom panel: multi-tab terminals (primary terminal location), language REPLs |
| `src/components/sidebar/OutlinePanel.vue` | Document outline (headings for .md/.tex/.docx/.ipynb), rendered in RightPanel |
| `src/components/right/ChatMessage.vue` | Message renderer (shared by ChatPanel) |
| `src/utils/chatMarkdown.js` | Shared markdown pipeline: `renderMarkdown()`, `TOOL_LABELS`, `getToolContext()`, `getToolIcon()` |
| `src/components/right/ChatInput.vue` | Chat input with @file refs, model picker, context chips (used by ChatPanel) |
| `src/components/right/FileRefPopover.vue` | @mention file search list |
| `src/components/right/Terminal.vue` | Terminal instance (xterm.js) |
| `src/components/comments/CommentMargin.vue` | 200px editor side panel with comment cards |
| `src/components/comments/CommentPanel.vue` | Floating overlay for comment details |
| `src/components/right/Backlinks.vue` | Files linking to active file |
| **Modals** | |
| `src/components/VersionHistory.vue` | Git history modal |
| `src/components/settings/Settings.vue` | Settings modal shell (7 section components) |
| `src/components/SetupWizard.vue` | First-run wizard (AI provider setup + theme picker) |

## What Persists Across Restarts

Two storage mechanisms: **localStorage** for global UI preferences, **`.shoulders/` files** for per-workspace state.

### Persisted (survives restart)

| State | Storage | Key / Path |
|---|---|---|
| Pane tree (splits, tabs, active tab per pane) | `.shoulders/editor-state.json` | See [editor-system.md](editor-system.md#editor-state-persistence) |
| Active pane ID | `.shoulders/editor-state.json` | — |
| Left sidebar open/closed | localStorage | `leftSidebarOpen` |
| Right sidebar open/closed | localStorage | `rightSidebarOpen` |
| Left sidebar width | localStorage | `leftSidebarWidth` |
| Right sidebar width | localStorage | `rightSidebarWidth` |
| Right panel active tab (outline/terminal/backlinks) | localStorage | `rightPanelTab` |
| Bottom panel open/closed | localStorage | `bottomPanelOpen` |
| Bottom panel height | localStorage | `bottomPanelHeight` |
| Explorer/Refs collapse states | localStorage | `explorerCollapsed`, `refsCollapsed` |
| Theme | localStorage | `theme` |
| Font sizes (editor + UI) | localStorage | `editorFontSize`, `uiFontSize` |
| Soft wrap, spell check, wrap column | localStorage | `softWrap`, `spellcheck`, `wrapColumn` |
| Prose font (for .md files) | localStorage | `proseFont` |
| Ghost/live preview enabled | localStorage | `ghostEnabled`, `livePreviewEnabled` |
| Last model selections | localStorage | `lastModelId`, `ghostModelId` |
| Recent files (per workspace) | localStorage | `recentFiles:{workspacePath}` |
| Chat sessions | `.shoulders/chats/{id}.json` | Full message history |
| Document comments | `.shoulders/comments.json` | All comments + replies |
| Last workspace | localStorage | `lastWorkspace` |

### Not Persisted (session-only)

| State | Reason |
|---|---|
| Terminal processes | Cannot survive process exit |
| Editor view instances (CodeMirror, SuperDoc) | Recreated when components mount |
| Cursor positions | Marginal value for the complexity |
| Dirty files set | Transient; auto-save handles it |
| PDF viewer zoom/page | Session-only convenience state |

### Coordination: Where Layout State Lives

The layout is coordinated across multiple stores and components:

- **`workspace` store** — sidebar open/closed, sidebar widths, bottom panel state. Reads from localStorage on init.
- **`editor` store** — pane tree, active pane, recent files. Reads from `.shoulders/editor-state.json` on workspace open.
- **`RightPanel.vue`** — right panel active tab (outline/terminal/backlinks). Reads from localStorage on mount, writes on tab switch.
- **`BottomPanel.vue`** — bottom terminal panel. Lazy-initialized on first open. Terminal processes preserved via `v-show`.
- **`LeftSidebar.vue`** — explorer/refs collapse states, panel heights. Reads from localStorage on mount.
- **`App.vue`** — orchestrates startup: opens workspace → loads stores → restores editor state. Orchestrates shutdown: saves editor state → cleans up stores.

## Header (`Header.vue`)

- Height: 38px
- Layout: CSS grid `1fr auto 1fr` (centers search bar regardless of icon zone width)
- Left padding: 78px (to avoid macOS traffic light buttons)
- `data-tauri-drag-region` on the header and right icon zone (enables window dragging)
- **Left cell**: Hamburger menu button (`IconMenu2`, Teleported dropdown)
- **Center cell**: Inline search input (`<input>`, not a button). Styled as inset field (`bg-primary` against `bg-secondary` header). Shows `Cmd+P` kbd badge when idle. Placeholder: "Go to file..."
- **Right cell**: Four icon buttons — left sidebar toggle, right sidebar toggle, bottom panel/terminal toggle (`IconTerminal2`), settings cog

### Hamburger Menu
Teleported to `<body>`, positioned below the ≡ button via `getBoundingClientRect()`. Click-outside closes via document `mousedown` listener (excludes the button and dropdown refs).

| Item | Shortcut | Visibility |
|---|---|---|
| Open Folder... | `Cmd+O` | Always |
| Recent (section) | — | When recents exist (up to 5) |
| Close Folder | — | When workspace is open |
| Settings... | `Cmd+,` | Always |

Uses `.context-menu` / `.context-menu-item` / `.context-menu-separator` / `.context-menu-section` global classes for consistency with file tree context menus.

### Search Bar
`Cmd+P` focuses the input (via `headerRef.focusSearch()` in App.vue). When focused or has text, `SearchResults.vue` renders as a dropdown anchored below. Escape clears and blurs. Arrow keys and Enter delegate to SearchResults via template ref.

### Sidebar Toggle Icons
Uses Tabler filled variants for active state:
- Sidebar open: `IconLayoutSidebarFilled` / `IconLayoutSidebarRightFilled` (solid) + `fg-primary` color
- Sidebar closed: `IconLayoutSidebar` / `IconLayoutSidebarRight` (outline) + `fg-muted` color

### Titlebar Configuration
The overlay titlebar requires these tauri.conf.json settings:
```json
"titleBarStyle": "Overlay",
"hiddenTitle": true
```
Plus the capability `"core:window:allow-start-dragging"` in `capabilities/default.json`.

## Footer (`Footer.vue`)

- Height: 30px
- Layout: CSS grid `1fr auto 1fr` (same pattern as Header — centers the middle section)
- **Left section** (writing stats + sync):
  - Word count + char count (fixed-width number spans with `tabular-nums`, accent-colored when selection active)
  - Separator (only when GitHub connected)
  - GitHub sync status icon (cloud variants: synced/syncing/error/idle, clickable → `SyncPopover`) + contextual label: "Backed up" / "Saving..." / "Sync issue". Entire cluster hidden when GitHub not configured.
  - Pending changes count (yellow, clickable)
- **Center section** (crossfade between three layers):
  - **Default**: Zoom controls (−, percentage, +). Percentage is accent-colored when ≠ 100%. Click percentage → zoom popover.
  - **Save confirmation**: "Saved ✓" + "Name this version?" link (8s window after Cmd+S, opens `SnapshotDialog`)
  - **Transient message**: e.g., "All saved (no changes)" (auto-fading)
- **Right section** (tools + billing):
  - Keyboard shortcuts button (popover with full shortcut reference)
  - Soft wrap toggle button (accent when active)
  - Billing context display (Shoulders balance or estimated monthly cost, when enabled)

### Exposed Methods (called by App.vue)
- `setCursorPos({line, col})` — accepted but no longer rendered (kept for call-site compatibility)
- `setEditorStats(stats)` — Updates word/char/selection counts
- `showSaveMessage(msg)` — Shows a transient right-side message (fades after 2s)
- `showCenterMessage(msg)` — Shows a transient center message (fades after 2s)
- `beginSaveConfirmation()` — Shows "Saved" + "Name this version?" for 8s, returns the name (or null)

## Sidebar Resizing

### Left Sidebar
- `v-if` controlled (fully removed from DOM when closed)
- Width: `workspace.leftSidebarWidth` (default 240px, min 160px, max 500px)
- `ResizeHandle` emits `resize` events with `{x}` position
- `onLeftResize`: clamps `e.x` to [160, 500]
- `data-sidebar="left"` attribute for Cmd+F focus detection
- **Two collapsible panels** (`LeftSidebar.vue`): Explorer (flex-1, always fills remaining space) and References (fixed height). Outline moved to the right panel. Collapse states + heights persisted in localStorage.
- **Resize handle** appears between explorer and references when both are expanded.
- **File tree filter**: Cmd+F (when tree focused) or search icon opens inline filter. See [file-system.md](file-system.md#file-tree-filter)

### Right Panel (`RightPanel.vue`)
- `v-show` controlled (kept in DOM to preserve running terminal processes)
- Width: `workspace.rightSidebarWidth` (default 360px, min 200px, max 80% of window)
- Double-click resize handle: snaps to 50% window width (or back to previous width)
- `rightSidebarPreSnapWidth` remembers the width before snap for toggling back
- **Three tabs**: Outline, Terminal, Backlinks (Backlinks only shown when active file has backlinks)
- Active tab persisted in localStorage (`rightPanelTab`)
- **Outline**: Document headings (`.md`/`.tex`/`.docx`/`.ipynb`), click to navigate. Tracks a `documentTab` computed that falls back to last non-chat tab when a chat is focused. Uses `OutlinePanel` from `src/components/sidebar/`.
- **Terminal**: Multi-tab xterm.js terminals with drag-reorder, rename, language REPL support (R/Python/Julia). Terminal processes preserved via `v-show`. Note: the right panel still has a Terminal tab, but the primary terminal experience is now in the **BottomPanel** (see below).
- **Backlinks**: Files linking to the active document via `[[wiki links]]`.

### Bottom Panel (`BottomPanel.vue`)
- Sits below the PaneContainer in the center column (between the editor area and footer)
- Height: `workspace.bottomPanelHeight` (default varies, min 100px, max 600px)
- `v-if` + `v-show` controlled: `hasEverOpened` gates the initial mount (lazy), `workspace.bottomPanelOpen` toggles visibility
- Toggled via the terminal icon button in the Header
- **Multi-tab terminals**: same capabilities as the right panel terminal tab — drag-reorder, rename (double-click), close, language REPL support (R/Python/Julia)
- Terminal processes preserved via `v-show` (all terminals stay mounted, only active one visible)
- Closing the last terminal tab hides the panel
- This is the **primary terminal location** — toggled by the Header's terminal button and `workspace.toggleBottomPanel()`

## ResizeHandle Component

Generic draggable divider. Props: `direction` ('vertical' or 'horizontal').

Behavior:
1. `mousedown` starts drag: sets `document.body.style.cursor` and `userSelect`
2. `mousemove` emits `resize` with `{dx, dy, x, y}` (absolute cursor position)
3. `mouseup` cleans up
4. `dblclick` emits for snap behavior (used by right sidebar)

Visual: 3px wide/tall, transparent by default, accent color on hover/drag.

## Search Results Dropdown (`SearchResults.vue`)

Rendered below the header search input when focused or has text. Not teleported — positioned absolutely from the header's center cell (no clipping ancestors at the top of the viewport).

### Three Search Modes
1. **Title matching** (instant): Fuzzy search across `files.flatFiles`. All query chars must appear in order in the filename, OR the full path contains the query. Results sorted by: exact match > starts-with > other.
2. **Content matching** (debounced 200ms): Calls `invoke('search_file_contents')` when query >= 2 chars. Returns matching lines from text files.
3. **Reference matching**: Searches reference library when query >= 2 chars. Selecting inserts `[@key]` citation.

### Props & Events
- Receives `query` prop from Header (no own input)
- Emits `select-file(path)` and `select-citation(key)`
- Exposes `moveSelection(delta)` and `confirmSelection()` for keyboard nav (called by Header's keydown handler)

### Navigation
- Up/Down arrows move selection (delegated from Header input)
- Enter opens the selected file or inserts citation
- Escape clears query and blurs input (handled by Header)
- Click (`@mousedown.prevent`) selects without blurring input

## Version History Modal (`VersionHistory.vue`)

Triggered from sidebar context menu → "Version History". Teleported to `<body>`.

### Layout
- Left panel (280px): Commit list from `gitLog()`
- Right panel: Read-only CodeMirror preview of file at selected commit

### Actions
- **Copy**: Copies historical content to clipboard with visual feedback
- **Restore**: Writes historical content to current file (with confirmation dialog)

## Launcher (`Launcher.vue`)

Shown when `workspace.isOpen` is false (no workspace loaded). Replaces the entire content area — sidebars and footer are hidden.

### Layout
Centered vertically and horizontally. Fixed width 360px.

- **Hero**: "S" logo (48px rounded square, accent bg) + "Shoulders" title + tagline
- **Actions**: Two buttons side by side:
  - "Open Folder" (primary, accent fill) — emits `open-folder` → App.vue opens native folder picker (`Cmd+O` also works)
  - "Clone Repository" (secondary, outlined) — expands inline URL input
- **Clone form**: monospace URL input + Clone/Cancel buttons. Runs `git clone` via `run_shell_command` after user picks parent directory. Shows error inline on failure.
- **Recent workspaces**: list of up to 10 entries from `workspace.getRecentWorkspaces()`. Each shows folder name + shortened path (home dir → `~`). Hover reveals × button to remove from recents.

### Workspace Lifecycle
- **Startup**: App.vue tries to restore `lastWorkspace` from localStorage. If it exists and the path is valid, opens it. Otherwise, launcher shows.
- **Open**: `pickWorkspace()` or clicking a recent entry → `openWorkspace(path)` in App.vue initializes all stores.
- **Close**: Hamburger menu "Close Folder" → `closeWorkspace()` cleans up stores, sets `workspace.path = null`, removes `lastWorkspace` from localStorage → launcher reappears.
- **Switch**: Opening a folder while one is already open closes the current workspace first.
- **Recent tracking**: `workspace.addRecent(path)` called on every open. Max 10 entries, most recent first. Persisted in localStorage.

## Chat System (Editor Tabs)

Chat sessions live in the **editor pane system** as `chat:{sessionId}` tabs — not in the right panel. `ChatPanel.vue` renders the session (message list + input) and is mounted by `EditorPane.vue` when `viewerType === 'chat'`. Each chat tab is a full session with history, streaming, and tool calls.

- **Open chat**: `Cmd+J` opens a chat tab beside the current editor via `editorStore.openChatBeside()`. Routes to the last active chat/newtab pane (`lastChatPaneId`), replacing a NewTab if present, or splits to create a new pane as last resort.
- **`Cmd+Shift+L`**: Same, but captures the current selection as context (`{ selection }`)
- **Right-click "Ask AI"**: Same as `Cmd+Shift+L` — calls `openChatBeside({ selection })` directly
- **Session management**: Sessions persist to `.shoulders/chats/{id}.json`. Open sessions show in the tab bar like files.
- **Components**: `ChatPanel.vue` (tab container) → `ChatSession.vue` (message list) + `ChatInput.vue` (input)

## Chat Input (`ChatInput.vue`)

### Layout
```
┌──────────────────────────────────┐
│ [file.md ×] [other.js ×]        │  ← file chips (conditional)
│ ["The results suggest..." ×]      │  ← editor context chip (conditional, dashed accent border)
│                                  │
│ Message... (@ to attach files)   │  ← borderless textarea
│                                  │
│ [@] Model Name ▾          [Send] │  ← bottom action row
└──────────────────────────────────┘
```

- Container: rounded border, accent glow on focus. **No `overflow-hidden`** — popovers are Teleported instead.
- File chips show above textarea, inside the container. X button to remove.
- Editor context chip (dashed accent border): shows first ~50 chars of selected text in quotes (e.g., `"The results suggest..."`). Set via `Cmd+Shift+L` or right-click "Ask AI". Includes ~200 chars of surrounding context (before/after) sent to the AI. Dismissible.
- Textarea: transparent background, no border. Auto-grows up to 120px.
- Bottom row: @ button (left), model picker (left), spacer, send/stop button (right, rectangular).

### @ File Reference Flow
1. User types `@` (preceded by space/newline/start-of-input) → popover opens
2. Continued typing filters the file list inline (no separate search input)
3. Arrow Up/Down navigates, Enter/Tab confirms selection, Escape dismisses
4. On confirm: `@filter` text removed from textarea, file chip added, content loaded via Rust
5. @ button in action row inserts `@` at cursor and opens popover programmatically

### Teleport Pattern (NON-OBVIOUS)
Both the file popover and model dropdown are **Teleported to `<body>`** with `position: fixed`. This is required because RightPanel has two `overflow-hidden` ancestors (lines 35 and 160 of `RightPanel.vue`) that clip absolutely-positioned children. Without Teleport, popovers render but are invisible.

Position is calculated from `getBoundingClientRect()` on the anchor element when the popover opens:
- File popover: anchored to `textareaWrapperRef`, same width
- Model dropdown: anchored to `modelButtonRef`, left-aligned

### FileRefPopover
- No search input — filtering driven by textarea text after `@`
- No own positioning — parent wraps it in a fixed-position Teleported div
- Exposes `selectNext()`, `selectPrev()`, `confirmSelection()` for keyboard navigation from ChatInput's `onKeydown` handler
- `@mousedown.prevent` on wrapper prevents textarea blur when clicking file items

## Editor Context Menu (`EditorContextMenu.vue`)

Teleported to `<body>`. Shown on right-click in TextEditor. Viewport-clamped (same pattern as `DocxContextMenu.vue`).

**With selection:** Ask AI, Add Comment (`Cmd+Shift+L`), separator, Cut, Copy, Paste.
**Without selection:** Paste, Select All.

"Ask AI" calls `editorStore.openChatBeside({ selection })` with the captured text + ~200 chars before/after context. `openChatBeside` routes to `lastChatPaneId` (the last pane the user viewed that had a chat or newtab), falling back to any visible chat/newtab pane, or splitting to create a new one. NewTab panes are replaced by the chat.

## File Tree Header

Three icon buttons in the Explorer header row:
- **Collapse All** (codicon collapse-all) — clears all expanded directories
- **Filter** (search icon) — opens Cmd+F inline filter
- **+ New** (text button) — opens a dropdown with typed file creation options

### "+ New" Dropdown
Same menu used by both the header button and the right-click context menu (on folders/empty space):
| Item | Extension | Template |
|---|---|---|
| New Folder | — | directory |
| New File... | — | inline rename, user types name+extension |
| Markdown | `.md` | `# Title\n\n` |
| Word | `.docx` | valid OOXML binary |
| LaTeX | `.tex` | `\documentclass` starter |
| R Script | `.R` | empty |
| Python | `.py` | empty |
| Notebook | `.ipynb` | JSON with one code cell |

## File Tree Context Menu (`ContextMenu.vue`)

Teleported to `<body>`. Shown on right-click in the file tree. Content varies by target:

### Right-click on folder or empty space
- Full "+ New" file type menu (see above)
- Separator
- Rename, Duplicate, Delete (if entry)
- Reveal in Finder / Show in Explorer (if entry)

### Right-click on file
- Rename
- Duplicate
- Delete (red/danger style)
- Version History
- Reveal in Finder / Show in Explorer

### Right-click with multi-selection
- Delete N Selected (red/danger style)

Closes on click outside or on selecting an action. Menu is viewport-clamped.
