# Notebook System

Jupyter notebook (.ipynb) editing with kernel execution, AI tool integration, cell tasks, and edit review.

## Relevant Files

| File | Role |
|---|---|
| `src/components/editor/NotebookEditor.vue` | Main notebook component: cell list, toolbar, kernel lifecycle, auto-save, cell tasks, review integration |
| `src/components/editor/NotebookCell.vue` | Single cell: CodeMirror editor, toolbar, run/delete/move/toggle, ghost suggestions, merge view for reviews |
| `src/components/editor/CellOutput.vue` | Output renderer: stream, display_data, execute_result, error, ANSI colors, images, HTML, LaTeX |
| `src/components/editor/NotebookReviewBar.vue` | "N cell changes" bar with Accept All / Reject All |
| `src/stores/kernel.js` | Pinia store wrapping Rust kernel commands |
| `src/stores/environment.js` | Language/Jupyter detection, kernel installation |
| `src/utils/notebookFormat.js` | .ipynb v4 JSON parse/serialize, cell ID generation |
| `src-tauri/src/kernel.rs` | Jupyter wire protocol (ZeroMQ), kernel discovery/launch/execute/interrupt/shutdown |
| `src/services/chatTools.js` | AI tools: `read_notebook`, `edit_cell`, `run_cell`, `run_all_cells`, `add_cell`, `delete_cell` |

## Architecture

```
NotebookEditor.vue                    kernel.rs (Rust)
  ├── NotebookCell.vue ×N               ├── kernel_discover()  → jupyter kernelspec list
  │     ├── CodeMirror 6 editor          ├── kernel_launch()   → spawn process, write connection file
  │     ├── CellOutput.vue               ├── kernel_execute()  → ZeroMQ DEALER socket
  │     └── ghost suggestion ext         ├── kernel_interrupt() → SIGINT (Unix) / taskkill (Windows)
  ├── kernel store (Pinia)               ├── kernel_shutdown() → kill + cleanup
  │     └── invoke('kernel_*')  ──────►  ├── kernel_complete() → code completion
  └── environment store                  └── IOPub listener    → tokio task, SubSocket
        └── detect languages                   → emits kernel-output-{id}-{msgId}
                                               → emits kernel-status-{id}
                                               → emits kernel-done-{id}-{msgId}
```

## Notebook Format (`notebookFormat.js`)

### Parsing
`parseNotebook(jsonStr)` normalizes .ipynb v4 JSON into:
```javascript
{
  cells: [{ id, type, source, outputs, executionCount, metadata }],
  metadata: {},    // kernelspec, language_info, etc.
  nbformat: 4,
  nbformat_minor: 5
}
```
- `source` is joined from array to string (Jupyter stores as `["line1\n", "line2\n"]`)
- `id` is preserved if present, otherwise generated via `generateCellId()`
- `type` normalized to `'code'` or `'markdown'`

### Serialization
`serializeNotebook(cells, metadata, nbformat, nbformat_minor)` converts back to .ipynb JSON. Source is split back into line arrays per Jupyter convention.

### Other Exports
- `generateCellId()` — random ID: `cell-<8 hex chars>`
- `getNotebookLanguage(metadata)` — extracts from `metadata.kernelspec.language` (fallback: `'python'`)
- `formatNotebookAsText(cells, path)` — human-readable text for AI tools (truncates long cells)

## Environment Detection (`environment.js`)

On notebook open, `envStore.detect()` probes the system for:
- **Languages**: Python, R, Julia — binary path, version, kernel availability
- **Jupyter**: `jupyter` command presence and version

### State
```javascript
{
  languages: {
    python: { found, path, version, hasKernel, kernelName },
    r:      { found, path, version, hasKernel, kernelName },
    julia:  { found, path, version, hasKernel, kernelName },
  },
  jupyter: { found, path, version },
  detected: false,
  detecting: false,
  installing: null,
  installOutput: '',
  installError: '',
}
```

### Key Getters
- `capability(lang)` — returns `'jupyter'` if kernel available, `'none'` otherwise
- `statusLabel(lang)` — e.g. "Python 3.10.2" or "R found — no Jupyter kernel"
- `installHint(lang)` — platform-specific instructions
- `installCommand(lang)` — one-line install command for the UI button

## Kernel Store (`kernel.js`)

### State
```javascript
{
  kernelspecs: [{ name, display_name, language, path }],
  kernels: { [kernelId]: { specName, displayName, language, status } },
  cellOutputs: { [`${kernelId}::${msgId}`]: [...outputs] },
  cellStatus: { [`${kernelId}::${msgId}`]: 'running' | 'done' | 'error' },
}
```

### Lifecycle
1. `discover()` — calls `kernel_discover` (Rust), populates `kernelspecs`
2. `launch(specName)` — calls `kernel_launch`, sets up Tauri event listeners for IOPub messages, returns kernel ID
3. `execute(kernelId, code)` — sends `execute_request`, collects outputs until `kernel-done` event, returns `{ outputs, success }`
4. `interrupt(kernelId)` — sends interrupt signal
5. `shutdown(kernelId)` — kills process, cleans up listeners and state

### Event Flow (execution)
```
kernel_execute (Rust)
  → ZeroMQ execute_request on DEALER socket
  → IOPub listener receives messages:
      stream         → kernel-output-{id}-{msgId} event
      display_data   → kernel-output-{id}-{msgId} event
      execute_result → kernel-output-{id}-{msgId} event
      error          → kernel-output-{id}-{msgId} event
      status: idle   → kernel-done-{id}-{msgId} event
  → kernel.js listener collects outputs, resolves Promise
```

## Kernel Backend (`kernel.rs`)

### Jupyter Wire Protocol
Messages use ZeroMQ with HMAC-SHA256 signing:
```
<zmq_id> | <delimiter "<IDS|MSG>"> | <HMAC signature> | <header JSON> | <parent_header JSON> | <metadata JSON> | <content JSON>
```
`create_message()` builds this format. `parse_message()` decodes it.

### Kernel Discovery
`kernel_discover()`:
1. Tries `jupyter kernelspec list --json` (preferred)
2. Falls back to scanning standard directories:
   - macOS: `~/Library/Jupyter/kernels`, `~/Library/Python/3.*/share/jupyter/kernels`, conda/miniforge paths
   - Linux: `~/.local/share/jupyter/kernels`, `/usr/local/share/jupyter/kernels`, `/usr/share/jupyter/kernels`
   - Windows: `%APPDATA%\jupyter\kernels`, `%ProgramData%\jupyter\kernels`

### Python Resolution
`find_python_with_ipykernel()` probes candidates in order: bare command → pyenv → conda → Homebrew → macOS per-version → system → Linux per-version → user-local → Windows (py launcher, AppData, Conda, Scoop). Each is checked with `Path::exists()` then `python -m ipykernel_launcher --version`.

### Cross-Platform
- `get_home_dir()` — `HOME` with `USERPROFILE` fallback (Windows)
- `jupyter_runtime_dir()` — `#[cfg(target_os)]` branches for macOS/Linux/Windows
- `kernel_interrupt()` — `libc::kill(SIGINT)` on Unix, `taskkill /PID` on Windows
- `libc` is a Unix-only dependency (`[target.'cfg(unix)'.dependencies]` in Cargo.toml)

## NotebookEditor Component

### Toolbar
Status chip showing kernel state (clickable popover with kernel picker, re-detect, install). Run All / Restart / Clear buttons. Cell count + save indicator.

### Setup Prompt
When `mode === 'none'` (no kernel detected): shows step-by-step install instructions with one-click install button. Uses `envStore.installCommand(language)`.

### Cell List
Iterates `displayCells` computed (not raw `cells`) — this merges real cells with phantom add-cells and annotates each with review state. See [Review Integration](#review-integration) below.

### Auto-Save
Debounced at 1.5s (`scheduleSave()`). When pending reviews exist, uses **surgical save**: reads disk, updates only non-pending cells by ID match, writes back. This lets users keep editing while reviews are outstanding without corrupting the review system's ground truth.

### Cell Operations
- `addCell(index, type)` — insert + focus + save
- `deleteCell(index)` — remove (min 1 cell) + save
- `moveCell(index, direction)` — splice + reinsert + save
- `toggleCellType(index)` — code ↔ markdown + clear outputs + save
- `updateCellSource(index, source)` — update + save
- `clearAllOutputs()` — clear all code cell outputs + save

### Cell Execution
`runCell(index)`:
1. Checks cell is code + non-empty + kernel available
2. Calls `ensureKernel()` (launches if needed)
3. Calls `kernelStore.execute(kernelId, source)`
4. Normalizes outputs, increments execution counter, saves

### External Event Listeners
For AI tool integration (window custom events):
- `run-notebook-cell` → `runCell()` → emits `cell-execution-complete`
- `run-all-notebook-cells` → `runAllCells()` → emits `all-cells-execution-complete`
- `notebook-cell-task` → creates task thread on active cell
- `notebook-scroll-to-cell` → scrolls to cell by ID
- `notebook-pending-edit` → review system notification
- `notebook-review-resolved` → reloads notebook from disk

### File Watcher
Watches `filesStore.fileContents[filePath]` for external changes (e.g., AI direct-mode edits). Compares cell sources; if different, replaces the reactive cells array.

## NotebookCell Component

### Props
| Prop | Type | Description |
|---|---|---|
| `cell` | Object | `{ id, type, source, outputs, executionCount, metadata }` |
| `index` | Number | Position in cell list |
| `active` | Boolean | Currently selected cell |
| `running` | Boolean | Cell is executing |
| `language` | String | Notebook language (for syntax highlighting) |
| `taskCount` | Number | Number of task threads on this cell |
| `pendingEdit` | Object | Pending edit_cell review (has `old_source`, `new_source`) |
| `pendingDelete` | Boolean | Cell marked for deletion (pending review) |
| `pendingAdd` | Boolean | Phantom cell from add_cell review |
| `editId` | String | Review edit ID for accept/reject |

### Keyboard Shortcuts
- **Shift+Enter / Cmd+Enter** — run cell
- **Escape** — exit markdown edit mode (syncs content, switches to rendered view)

### CodeMirror Setup
Each cell gets its own CodeMirror 6 instance with:
- Dynamic language extension via `@codemirror/language-data`
- Ghost suggestion extension (`++` trigger)
- Merge view extension (activated when `pendingEdit` is set)
- Content sync on blur

### Merge View (Review)
When `pendingEdit` is set:
1. Editor content is replaced with `new_source`
2. `reconfigureMergeView(view, old_source)` activates the unified diff view
3. Accept/reject buttons appear in the review action bar
4. Toolbar buttons (run, delete, move, etc.) are hidden

### Visual States
- `.cell-pending-add` — green border, subtle green background
- `.cell-pending-delete` — red border, dimmed opacity
- `.cell-pending-edit` — warning border, subtle yellow background

### Task Indicator
Inline in `.cell-toolbar-left`, between exec count and type badge. Shows speech bubble icon + count. Click opens task thread in right panel.

## CellOutput Component

Renders output objects by `output_type`:
- **stream** — `<pre>` with ANSI → HTML color conversion. Stderr in dimmed text.
- **display_data / execute_result** — priority: HTML > image (PNG/JPEG/SVG as base64 `<img>`) > LaTeX > plain text
- **error** — `<pre>` with traceback, ANSI colors, error name/value header

ANSI conversion supports 16 standard colors + bold/italic/underline.

## AI Chat Tools

Six notebook tools available to the AI chat:

| Tool | Input | Behavior |
|---|---|---|
| `read_notebook` | `path` | Returns formatted text (50KB max) |
| `edit_cell` | `path`, `index`, `new_source` | Review mode: queues pending edit. Direct mode: writes immediately |
| `add_cell` | `path`, `index?`, `type?`, `source?` | Review mode: queues phantom cell. Direct mode: writes immediately |
| `delete_cell` | `path`, `index` | Review mode: queues deletion. Direct mode: writes immediately |
| `run_cell` | `path`, `index` | Dispatches event to open notebook, awaits result (60s timeout) |
| `run_all_cells` | `path` | Dispatches event, awaits all results (5 min timeout) |

`run_cell` and `run_all_cells` use window custom events to communicate with the open `NotebookEditor` — the notebook must be open with a kernel connected.

## Review Integration

See also: [review-system.md](review-system.md#notebook-cell-review)

### How It Works
1. AI tool (e.g., `edit_cell`) checks `reviews.directMode`
2. If review mode: records pending edit in `reviews.pendingEdits`, dispatches `notebook-pending-edit`
3. `NotebookEditor.displayCells` computed reacts — annotates cells with review state, inserts phantoms for add_cell
4. `NotebookCell` renders visual state (border color, merge view, action bar)
5. User clicks Accept → `reviews.acceptNotebookEdit()` reads .ipynb from disk, applies change, writes back
6. User clicks Reject → `reviews.rejectNotebookEdit()` marks as rejected (no disk change — edit was never written)
7. `notebook-review-resolved` event fires → `NotebookEditor` reloads from disk

### Pending Edit Formats
```
NotebookEditCell:   { tool, file_path, cell_id, cell_index, old_source, new_source, status }
NotebookAddCell:    { tool, file_path, cell_id, cell_index, cell_type, cell_source, status }
NotebookDeleteCell: { tool, file_path, cell_id, cell_index, cell_source, cell_type, status }
```

### Edge Cases
- Multiple edits to same cell while pending: second edit rejected with error
- Notebook closed during review: pending edits persist, `displayCells` recomputes on reopen
- Auto-save during review: surgical save updates only non-pending cells (reads disk, patches by cell ID)

## Important Notes

1. **Kernel spec resolution**: `kernel.json` often lists bare `python` which may not have ipykernel. `find_python_with_ipykernel()` probes many paths. See [gotchas.md](gotchas.md).
2. **Cell IDs are stable UUIDs** from the .ipynb file. Tasks, reviews, and scroll-to-cell all use cell ID (not index).
3. **Ghost suggestions work per-cell**. Each CodeMirror instance gets its own `ghostSuggestionExtension`. No multi-cell stitching needed.
4. **`run_cell`/`run_all_cells` require the notebook to be open**. They dispatch window events that only `NotebookEditor` listens for. If the notebook isn't open, the tool times out after 60s / 5min.
5. **Jupyter runtime dir is platform-specific**: macOS `~/Library/Jupyter/runtime`, Linux `$XDG_RUNTIME_DIR/jupyter`, Windows `%APPDATA%\jupyter\runtime`.
