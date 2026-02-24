# File System

All file operations go through custom Rust commands. The Tauri fs plugin is NOT used.

## Relevant Files

| File | Role |
|---|---|
| `src-tauri/src/fs_commands.rs` | Rust: all file I/O commands, tree building, watching, content search |
| `src/stores/files.js` | Frontend: file tree state, content cache, CRUD wrappers |
| `src/components/sidebar/FileTree.vue` | Explorer panel UI |
| `src/components/sidebar/FileTreeItem.vue` | Recursive tree node |
| `src/components/sidebar/ContextMenu.vue` | Right-click menu |

## Rust Commands

| Command | Signature | Purpose |
|---|---|---|
| `read_dir_recursive` | `(path: String) → Vec<FileEntry>` | Build full file tree |
| `read_file` | `(path: String) → String` | Read file content |
| `write_file` | `(path: String, content: String) → ()` | Write/overwrite file |
| `create_file` | `(path: String, content: String) → ()` | Create new file (fails if exists) |
| `create_dir` | `(path: String) → ()` | Create directory (recursive) |
| `rename_path` | `(old_path: String, new_path: String) → ()` | Rename file or directory |
| `delete_path` | `(path: String) → ()` | Delete file or directory (recursive) |
| `copy_file` | `(src: String, dest: String) → ()` | Copy a single file |
| `copy_dir` | `(src: String, dest: String) → ()` | Recursively copy a directory |
| `is_directory` | `(path: String) → bool` | Check if path is a directory |
| `path_exists` | `(path: String) → bool` | Check if path exists |
| `search_file_contents` | `(dir: String, query: String, max_results: usize) → Vec<SearchResult>` | Search inside .md/.txt files |

## File Tree Building

`build_file_tree()` (`fs_commands.rs:30-75`) builds a `Vec<FileEntry>` recursively.

### FileEntry Structure
```rust
pub struct FileEntry {
    pub name: String,
    pub path: String,      // Absolute path
    pub is_dir: bool,
    pub children: Option<Vec<FileEntry>>,
}
```

### Filtering Rules
Hidden entries are filtered as follows:
- **Hidden directories** (starting with `.`) are **skipped**, EXCEPT `.shoulders` and `.claude`
- **Hidden files** (starting with `.`) are **shown** (e.g., `.env`, `.gitignore`)
- `node_modules` and `target` directories are always skipped

### Sorting
Directories first, then alphabetical (case-insensitive).

## Content Search

`search_file_contents()` (`fs_commands.rs:236-293`) does a recursive case-insensitive text search:
- Only searches `.md` and `.txt` files
- Skips hidden dirs (except `.shoulders`), `node_modules`, `target`
- Returns `SearchResult { path, name, line, text }` up to `max_results`
- Used by `SearchResults.vue` (header search dropdown) for content search (Cmd+P with 2+ character query)

## File Watching

Three layers ensure the file tree stays in sync with the filesystem:

### Layer 1: Notify Watcher (event-driven)
`watch_directory()` (`fs_commands.rs`):
- Uses the `notify` crate v6 with `RecommendedWatcher` (FSEvents on macOS)
- Watches recursively from the workspace root
- Emits `"fs-change"` Tauri events with `{ kind: "...", paths: [...] }`
- Only one watcher at a time (stored in `WatcherState`)
- Errors are logged to stderr (`[fs-watch] error:`) for debugging
- `unwatch_directory()` drops the watcher

`files.startWatching()` (`files.js`):
- Listens for `"fs-change"` events
- **Debounced at 300ms** — rapid events are coalesced
- Reloads the entire file tree on any change
- Checks if any open files were among the changed paths; if so, reloads their content
- Logs events to console (`[fs-watch]`) for debugging

**Important**: The debounce prevents auto-save from triggering an infinite loop (write file → fs-change → reload → might appear changed → etc.).

### Layer 2: Periodic Poll (fallback)
`files.startWatching()` also starts a **5-second interval** that calls `read_dir_recursive` and compares the result to the current tree via `JSON.stringify`. The reactive `this.tree` is only updated when the tree actually changed, avoiding unnecessary Vue re-renders.

This catches files created by processes where the notify watcher may miss events (e.g., R/Python scripts saving output in the embedded terminal).

Cleaned up in `files.cleanup()`.

### Layer 3: Window Focus (immediate)
`App.vue` listens for `visibilitychange` events. When the user switches back to Shoulders from another app (e.g., Finder after copy-pasting a file), the file tree reloads immediately with a 2-second cooldown.

## File Content Cache

`files.fileContents` is a reactive object mapping absolute path → content string.

- **Read**: `files.readFile(path)` loads content via Rust and caches it
- **Save**: `files.saveFile(path, content)` writes via Rust and updates cache
- **External change**: `files.reloadFile(path)` re-reads from disk and updates cache
- **Delete**: `files.deletePath(path)` removes from cache

The editor watches `files.fileContents[filePath]` and updates the CodeMirror document if the content changes externally (but only if it actually differs from the current editor content, preventing unnecessary dispatches).

## Inline Create & Rename

The file tree supports inline editing (VS Code style):

### Create Flow (Typed)
1. User clicks "+ New" dropdown (header) or right-click → selects a file type (Markdown, Word, LaTeX, etc.)
2. `createTypedFile(dir, ext)` expands the target directory and generates a unique name (`Untitled.md`, `Untitled 2.md`, etc.)
3. `files.createFile()` writes the file with type-specific templates:
   - `.md` → `# Title\n\n`
   - `.docx` → valid OOXML binary template (base64-embedded in `files.js`)
   - `.ipynb` → JSON notebook with one empty code cell
   - `.tex` → `\documentclass{article}` + `\maketitle` starter
   - Other extensions → empty file
4. File opens in editor, `await nextTick()` ensures the tree renders the new item, then inline rename starts
5. `autoExtension` is preserved — if user omits extension during rename, it's re-appended
6. **Collision**: if name already exists, shows a toast error and returns `null` (no file created)

### Create Flow (Generic)
1. "New File..." or "New Folder" from the menu → `startInlineCreate(dir, isDir)`
2. Parent directory is expanded
3. An inline `<input>` appears in the tree (via `FileTreeItem.vue`)
4. On Enter/blur: `finishRename()` calls `files.createFile()` or `files.createFolder()`

### Rename Flow
1. Context menu → Rename → `FileTree.vue:handleRename(entry)`
2. The tree item switches to an inline input showing the current name
3. On Enter/blur: `finishRename()` calls `files.renamePath(oldPath, newPath)`
4. **Collision**: if destination already exists, shows a toast error and aborts (no overwrite)
5. If the renamed file was active, `files.activeFilePath` is updated
6. If the renamed dir was expanded, `files.expandedDirs` is updated

### Move (Drag-and-Drop)
`files.movePath(srcPath, destDir)` — used when dragging files between folders.
- **Collision**: if destination name exists, auto-renames with numeric suffix (`file 2.md`, `file 3.md`) — same pattern as `copyExternalFile` and `duplicatePath`

## File Tree Filter

In-place filtering that narrows the visible tree while preserving folder hierarchy.

### Activation
- `Cmd+F` when the tree container is focused
- Click the search icon (magnifying glass) in the Explorer header
- `App.vue` routes `Cmd+F` based on focus: if `document.activeElement` is inside `[data-sidebar="left"]`, it calls `fileTreeRef.activateFilter()`; otherwise falls through to CodeMirror's built-in search

### Algorithm
Case-insensitive substring match on **filename**. If query contains `/`, matches on relative path instead.

```
filterTree(entries, query):
  for each entry:
    if dir && name matches → keep with ALL children
    if dir && name !match → recurse; keep if any descendant matches
    if file && name matches → keep
```

Ancestor directories of matching files are **force-expanded** via the `forceExpand` prop on `FileTreeItem`, which overrides `files.isDirExpanded()`.

### UI
- Filter input bar appears below Explorer header with: search icon, text input, match count badge, close (×) button
- Matching substring highlighted in accent color (`var(--accent)`)
- Keyboard-selected match gets `bg-[var(--bg-hover)]` background via `filterHighlightPath` prop
- "No matches" message for zero-result queries

### Keyboard Navigation
| Key | Action |
|---|---|
| `Cmd+F` (tree focused) | Open filter |
| Typing | Live filter |
| `↑` / `↓` | Navigate flat list of matching files |
| `Enter` | Open keyboard-selected file |
| `Escape` | Close filter, restore original tree |

### Implementation
- **FileTree.vue**: `filterActive`, `filterQuery`, `filterSelectedIdx` state. `filteredTree`, `filterMatches`, `displayTree`, `filterHighlightPath` computeds. `activateFilter()`, `closeFilter()`, `handleFilterKeydown()`, `openFilteredMatch()` methods
- **FileTreeItem.vue**: 3 new props (`filterQuery`, `forceExpand`, `filterHighlightPath`). `nameSegments` computed splits name into `[{text, match}]` for highlight rendering. `isFilterHighlighted` computed for active-match background
- **App.vue**: `data-sidebar="left"` attribute on sidebar div. `Cmd+F` handler checks focus location before routing

## Duplicate
- `files.duplicatePath(path)` copies file/folder with macOS-style naming: `name copy.ext`, `name copy 2.ext`, etc.
- Uses Rust `copy_file` or `copy_dir` commands
- Opens the duplicate in editor and starts inline rename

## Delete
- Confirmation via native dialog (`ask()` from `@tauri-apps/plugin-dialog`)
- Calls `files.deletePath(path)` → Rust `delete_path`
- **Auto-closes all tabs** for the deleted file across every pane (`editor.closeFileFromAllPanes(path)`)
- Removes from file contents cache and wiki link index
