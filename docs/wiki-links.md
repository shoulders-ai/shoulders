# Wiki Links & Backlinks

Obsidian-style `[[wiki links]]` with autocomplete, click-to-navigate, backlinks panel, and automatic link updates on file rename.

## Relevant Files

| File | Role |
|---|---|
| `src/stores/links.js` | Link index store: forward links, backlinks, name map, headings |
| `src/editor/wikiLinks.js` | CodeMirror 6 extension: decorations, click handler, autocomplete |
| `src/components/right/Backlinks.vue` | Backlinks panel in right sidebar |

## Link Syntax

| Syntax | Meaning |
|---|---|
| `[[filename]]` | Link to `filename.md` (`.md` is implicit) |
| `[[filename\|display text]]` | Link with custom display text |
| `[[filename#Heading]]` | Link to a specific heading in a file |
| `[[filename#Heading\|display]]` | Heading link with custom display |

## Link Resolution

Resolution order:

1. **Exact filename match** - Case-insensitive, `.md` stripped
2. **Normalized match** - Treats `-`, `_`, spaces as equivalent (`normalizeName()`)
3. **Path disambiguation** - If link contains `/`, match against relative paths
4. **Ambiguity resolution** - If 2+ files share a name: prefer same directory, then shortest path

### Why File Moves Don't Break Links

Links are `[[filename]]` not `[[path/to/filename]]`. Resolution searches all files by name. Only when names collide do you need `[[folder/filename]]` for disambiguation. **Renames** do update all references across the workspace.

## Link Index Store (`links.js`)

### State

| Field | Type | Purpose |
|---|---|---|
| `forwardLinks` | `{path: link[]}` | All wiki links found in each file |
| `backlinks` | `{path: backlink[]}` | Files that link TO each file |
| `nameMap` | `{normalized: path[]}` | File name → path lookup (for resolution) |
| `headings` | `{path: string[]}` | All headings per file |
| `initialized` | `boolean` | Whether fullScan has completed |

### Key Actions

- `fullScan()` - Called on workspace open. Reads all `.md` files, builds all indices. Also caches content into `filesStore.fileContents` so citation detection works immediately.
- `updateFile(path)` - Incremental re-index after a file is saved or changed externally.
- `handleRename(oldPath, newPath)` - Rewrites `[[oldName]]` → `[[newName]]` across all files in the workspace, then re-indexes.
- `handleDelete(path)` - Removes file from all indices.
- `resolveLink(target, fromPath)` - Returns `{path, heading}` or `null`.

### Pure Helpers (exported)

- `parseWikiLinks(content)` - Regex extraction of all `[[...]]` with position info
- `parseHeadings(content)` - Extracts `# Heading` lines
- `normalizeName(name)` - Lowercases, normalizes `-_\s` to spaces

## CodeMirror Extension (`wikiLinks.js`)

Three sub-components bundled into `wikiLinksExtension()`:

### 1. Decorations ViewPlugin

Scans visible ranges (with 200-char buffer) for `[[...]]` matches. Applies CSS classes:

| Class | Appearance | When |
|---|---|---|
| `.cm-wikilink` | Teal text | Resolved link text |
| `.cm-wikilink-broken` | Red wavy underline | Unresolved link |
| `.cm-wikilink-bracket` | Dimmed, smaller | `[[` and `]]` brackets |
| `.cm-wikilink-target` | Dimmed, smaller | Target in `[[target\|display]]` |
| `.cm-wikilink-display` | Teal | Display text in `[[target\|display]]` |
| `.cm-wikilink-pipe` | Dimmed | The `|` separator |

Skips matches inside code blocks and inline code (checks Lezer syntax tree via `syntaxTree()`).

### 2. Click Handler (in MarkdownEditor.vue)

Plain click on a wiki link (no modifier key needed):
- **Resolved link** → opens the target file via `editorStore.openFile()`
- **Broken link** → creates a new `.md` file in the same directory, then opens it

Note: Click navigation is handled via a native DOM listener on the editor container (not via CM6 `domEventHandlers`), because CM6's internal event routing can consume click events before extension handlers fire.

### 3. Autocomplete Source

Uses `@codemirror/autocomplete`. Activates when cursor is between `[[` and `]]`:
- Shows all file names from `linksStore.nameMap`
- After typing `#` inside a link → switches to heading completions for the resolved file
- `apply` function handles the auto-closed `]]` from `closeBrackets()` — detects existing `]]` after cursor and replaces through it
- `validFor: /^[^|\]#]*$/` — stops completing after pipe or hash

## Integration Points

### files.js Hooks

The files store calls into links store at these points:
- `saveFile()` → `linksStore.updateFile(path)` (incremental re-index)
- `renamePath()` → `linksStore.handleRename(oldPath, newPath)` (rewrites all references)
- `deletePath()` → `linksStore.handleDelete(path)` (removes from indices)
- `startWatching()` fs-change handler → `linksStore.updateFile()` for changed `.md` files

### App.vue

`openWorkspace()` calls `linksStore.fullScan()` after `filesStore.loadFileTree()`.

### MarkdownEditor.vue

Adds `wikiLinksExtension()` to the extra extensions with callbacks:
- `resolveLink` → delegates to `linksStore.resolveLink()`
- `getFiles` → `linksStore.allFileNames`
- `getHeadings` → resolves target, then returns `linksStore.headingsForFile()`
- `currentFilePath` → current file path (for disambiguation)

Click navigation is handled separately via a native DOM `click` listener on `editorContainer` (not part of the CM6 extension).

### RightPanel.vue

Backlinks tab is conditionally visible — only shown when the active file has backlinks (`backlinkCount > 0`). When visible, shows a count badge from `linksStore.backlinksForFile()`. If the user is on the Backlinks tab and switches to a file with no backlinks, the panel falls back to Chat.

## Backlinks Panel

Shows all files that link to the currently active file. Each entry shows:
- Source file name (in accent color)
- Line number
- Context snippet (the full line containing the link)

Click navigates to the source file. Empty state: "No other files link to this file."

## Rename Propagation Flow

```
User renames file in FileTree
  → files.renamePath(oldPath, newPath)
    → Rust rename_path command
    → linksStore.handleRename(oldPath, newPath)
      → For each .md file in workspace:
        → Parse wiki links
        → Find links where normalizeName(target) === normalizeName(oldName)
        → Replace [[oldName]] with [[newName]] (preserving #heading and |display)
        → Save updated file
      → Re-index the renamed file
      → Rebuild all backlinks
```

