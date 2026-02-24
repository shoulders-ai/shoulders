# UI Layout & Components

## Overall Layout

Two states based on whether a workspace is open:

### Workspace Open
```
┌─────────────────────────────────────────────────────────┐
│ Header (38px, ≡ menu + search + sidebar toggles)        │
├──────┬──┬───────────────────────────┬──┬────────────────┤
│      │  │    ReviewBar (if edits)    │  │                │
│      │  ├───────────────────────────┤  │                │
│ Left │R │                           │R │   Right        │
│ Side │e │    PaneContainer          │e │   Panel        │
│ bar  │s │    (recursive editor      │s │   (Chat, Terms │
│      │i │     panes with tabs)      │i │    Tasks)      │
│Explr │z │                           │z │                │
│Outln │e │                           │e │                │
│ Refs │  │                           │  │                │
├──────┴──┴───────────────────────────┴──┴────────────────┤
│ Footer (24px, status bar)                                │
└─────────────────────────────────────────────────────────┘
```

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
| `src/App.vue` | Root layout, keyboard shortcuts, workspace init, launcher/editor toggle |
| `src/components/Launcher.vue` | Empty state: logo, Open Folder, Clone Repository, recent workspaces |
| `src/components/layout/Header.vue` | Titlebar: hamburger menu + inline search bar + sidebar toggles |
| `src/components/SearchResults.vue` | Search dropdown (file/content/reference results) |
| `src/components/layout/Footer.vue` | Status bar |
| `src/components/layout/ResizeHandle.vue` | Sidebar resize dividers |
| `src/components/sidebar/LeftSidebar.vue` | Three collapsible panels: Explorer, References, Outline |
| `src/components/sidebar/FileTree.vue` | Explorer panel content |
| `src/components/sidebar/OutlinePanel.vue` | Document outline (headings for .md/.tex/.docx/.ipynb) |
| `src/components/sidebar/FileTreeItem.vue` | Tree nodes |
| `src/components/sidebar/ContextMenu.vue` | Right-click menu |
| `src/components/editor/PaneContainer.vue` | Recursive pane layout |
| `src/components/editor/EditorPane.vue` | Individual pane |
| `src/components/editor/TabBar.vue` | Pane tab bar |
| `src/components/editor/MarkdownEditor.vue` | CodeMirror instance |
| `src/components/editor/SplitHandle.vue` | Split pane divider |
| `src/components/editor/ReviewBar.vue` | Pending edits banner |
| `src/components/right/RightPanel.vue` | Right sidebar: Chat/Terminals/Tasks tabs (+ Backlinks when active file has backlinks) + sub-tab management + history |
| `src/components/right/ChatSession.vue` | Per-session message list with auto-scroll, turn spacing, empty state (prompt starters + recent sessions) |
| `src/components/right/ChatMessage.vue` | Message renderer: user bubbles (right-aligned, clamped), assistant (full-width, marked+DOMPurify markdown), compact tool calls, context cards |
| `src/utils/chatMarkdown.js` | Shared markdown pipeline: `renderMarkdown()`, `TOOL_LABELS`, `getToolContext()`, `getToolIcon()` |
| `src/components/right/ChatInput.vue` | Input container: file chips, textarea, bottom action row (@ button, model picker, send/stop). Popovers Teleported to `<body>`. |
| `src/components/right/FileRefPopover.vue` | @mention file search list. No own positioning — parent handles via Teleport wrapper. Exposes `selectNext/selectPrev/confirmSelection` for keyboard nav. |
| `src/components/right/Terminal.vue` | Terminal instance |
| `src/components/right/TaskThreads.vue` | Task list |
| `src/components/right/TaskThread.vue` | Individual thread |
| `src/components/VersionHistory.vue` | Git history modal |

## Header (`Header.vue`)

- Height: 38px
- Layout: CSS grid `1fr auto 1fr` (centers search bar regardless of icon zone width)
- Left padding: 78px (to avoid macOS traffic light buttons)
- `data-tauri-drag-region` on the header and right icon zone (enables window dragging)
- **Left cell**: Hamburger menu button (`IconMenu2`, Teleported dropdown)
- **Center cell**: Inline search input (`<input>`, not a button). Styled as inset field (`bg-primary` against `bg-secondary` header). Shows `Cmd+P` kbd badge when idle. Placeholder: "Go to file..."
- **Right cell**: Three icon buttons — left sidebar toggle, right sidebar toggle, settings cog

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

- Height: 24px
- **Left section**:
  - Git branch name (with branch icon, polled every 10s)
  - Pending changes count (yellow, clickable)
  - Direct/Review mode toggle (click to switch)
- **Right section**:
  - Soft wrap toggle button (blue when active)
  - Save feedback message (green, auto-fading after 2s)
  - Word count
  - Cursor position (Ln X, Col Y)

### Exposed Methods (called by App.vue)
- `setWordCount(count)` - Updates word count display
- `setCursorPos({line, col})` - Updates cursor position display
- `showSaveMessage(msg)` - Shows a message that fades after 2 seconds

## Sidebar Resizing

### Left Sidebar
- `v-if` controlled (fully removed from DOM when closed)
- Width: `workspace.leftSidebarWidth` (default 240px, min 160px, max 500px)
- `ResizeHandle` emits `resize` events with `{x}` position
- `onLeftResize`: clamps `e.x` to [160, 500]
- `data-sidebar="left"` attribute for Cmd+F focus detection
- **Three collapsible panels** (`LeftSidebar.vue`): Explorer (flex-1, always fills remaining space), References (fixed height), Outline (fixed height, collapsed by default). Collapse states + heights persisted in localStorage.
- **Resize handles** appear between adjacent expanded panels. When refs is collapsed, a handle shows between explorer and outline (preserving two-panel behavior).
- **File tree filter**: Cmd+F (when tree focused) or search icon opens inline filter. See [file-system.md](file-system.md#file-tree-filter)
- **Outline panel**: Shows headings for the active file (.md/.tex/.docx/.ipynb). Click to navigate. Current heading highlighted for CM6 files. Uses `linksStore.structuredHeadingsForFile` for markdown, regex for LaTeX, ProseMirror doc traversal for DOCX. DOCX outline reactively updates while typing — reads `filesStore.fileContents[path]` as a dependency (written by `DocxEditor.updateTextCache()`).

### Right Sidebar
- `v-show` controlled (kept in DOM to preserve running terminals)
- Width: `workspace.rightSidebarWidth` (default 360px, min 200px, max 80% of window)
- Double-click resize handle: snaps to 50% window width (or back to previous width)
- `rightSidebarPreSnapWidth` remembers the width before snap for toggling back

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

**With selection:** Ask AI (`Cmd+Shift+L`), Add Task (`Cmd+Shift+C`), separator, Cut, Copy, Paste.
**Without selection:** Paste, Select All.

"Ask AI" dispatches `chat-with-selection` window event (captured text + ~200 chars before/after) and opens the right sidebar chat.

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
