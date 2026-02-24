# State Management

Seven Pinia stores. All defined using the Options API pattern (`defineStore('name', { state, getters, actions })`).

## Relevant Files

| File | Store Name | Purpose |
|---|---|---|
| `src/stores/workspace.js` | `workspace` | Root store: workspace path, API keys, models config, sidebar state |
| `src/stores/files.js` | `files` | File tree data, content cache |
| `src/stores/editor.js` | `editor` | Pane tree, tab management, editor views |
| `src/stores/chat.js` | `chat` | AI chat sessions, streaming, persistence |
| `src/stores/reviews.js` | `reviews` | Edit review queue |
| `src/stores/tasks.js` | `tasks` | AI task threads |
| `src/stores/links.js` | `links` | Wiki link index, backlinks, rename propagation |
| `src/stores/utils.js` | (not a store) | `nanoid()` helper |

## Store: workspace

**Dependencies**: None

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `path` | `string \| null` | `null` | Absolute path to workspace folder |
| `settings` | `object` | `{}` | (currently unused - reserved) |
| `systemPrompt` | `string` | `''` | Content of `.shoulders/system.md` (internal base prompt) |
| `instructions` | `string` | `''` | Content of `_instructions.md` at workspace root (HTML comments stripped, hot-reloads) |
| `apiKey` | `string` | `''` | Anthropic API key (backwards-compat alias) |
| `apiKeys` | `object` | `{}` | All API keys from `~/.shoulders/keys.env` (`{ANTHROPIC_API_KEY, OPENAI_API_KEY, ...}`) |
| `modelsConfig` | `object\|null` | `null` | Parsed `.shoulders/models.json` (models + providers) |
| `gitAutoCommitInterval` | `number` | `300000` | 5 minutes in ms |
| `gitAutoCommitTimer` | `number \| null` | `null` | `setInterval` handle |
| `leftSidebarOpen` | `boolean` | `true` | Left sidebar visibility |
| `rightSidebarOpen` | `boolean` | `false` | Right sidebar visibility |
| `leftSidebarWidth` | `number` | `240` | Pixels |
| `rightSidebarWidth` | `number` | `360` | Pixels |
| `ghostEnabled` | `boolean` | `true` | Ghost suggestions (`++`) enabled, persisted in localStorage |
| `softWrap` | `boolean` | `true` | Editor line wrapping |
| `editorFontSize` | `number` | `14` | Editor font size (px), zoomable |
| `uiFontSize` | `number` | `13` | UI font size (px), zoomable |
| `theme` | `string` | `'default'` | Active theme name, persisted in localStorage |
| `disabledTools` | `array` | `[]` | Tool names disabled by user, persisted in `.shoulders/tools.json` |

### Getters
- `isOpen` - `!!path`
- `shouldersDir` - `${path}/.shoulders` or null
- `claudeDir` - `${path}/.claude` or null

### Key Actions
- `openWorkspace(path)` - Sets path, inits .shoulders/, loads settings, starts watcher + auto-commit, saves to localStorage
- `initShouldersDir()` - Creates `.shoulders/`, `notes/`, `system.md`, `.env`, `pending-edits.json`, `_instructions.md` (at root) if missing
- `loadSettings()` - Reads system.md, loads _instructions.md, parses ALL KEY=VALUE from .env into apiKeys, loads models.json, loads tool permissions
- `loadInstructions()` - Reads `_instructions.md` from workspace root, strips HTML comment lines, hot-reloads via file watcher
- `openInstructionsFile()` - Creates _instructions.md if missing, opens in editor (used by chat UI button)
- `autoCommit()` - Git add + commit (creates repo if needed)
- `setTheme(name)` - Switches theme: updates state, localStorage, toggles class on `<html>`
- `restoreTheme()` - Applies saved theme class on startup
- `zoomIn()` / `zoomOut()` / `resetZoom()` - Adjusts font sizes via CSS vars
- `loadToolPermissions()` - Reads `.shoulders/tools.json`, sets `disabledTools`
- `saveToolPermissions()` - Writes deny-list to `.shoulders/tools.json`
- `toggleTool(name)` - Adds/removes from `disabledTools`, saves immediately
- `setGhostEnabled(val)` - Toggles ghost suggestions, persists to localStorage
- `cleanup()` - Stops auto-commit, does final commit, unwatches directory

## Store: files

**Dependencies**: workspace (for path)

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `tree` | `FileEntry[]` | `[]` | Recursive file tree from Rust |
| `expandedDirs` | `Set<string>` | `new Set()` | Expanded directory paths |
| `activeFilePath` | `string \| null` | `null` | (legacy - mostly superseded by editor.activeTab) |
| `fileContents` | `object` | `{}` | Cache: absolute path → content string |
| `unlisten` | `function \| null` | `null` | fs-change event unsubscriber |

### Getters
- `flatFiles` - Flattened list of all non-directory entries (recursive walk of tree). Used by header search (SearchResults.vue).

### Key Actions
- `loadFileTree()` - Calls `read_dir_recursive` and stores result
- `startWatching()` - Listens for `fs-change`, debounces at 300ms, reloads tree + changed files
- `readFile(path)` - Reads via Rust, caches in `fileContents`
- `saveFile(path, content)` - Writes via Rust, updates cache
- `createFile(dirPath, name)` - Creates file with `# Title\n\n` header, reloads tree
- `createFolder(dirPath, name)` - Creates directory, reloads tree, auto-expands
- `renamePath(oldPath, newPath)` - Renames, reloads tree, updates activeFilePath/expandedDirs
- `deletePath(path)` - Deletes, reloads tree, clears cache/activeFilePath

## Store: editor

**Dependencies**: None (uses `nanoid` from utils.js)

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `paneTree` | `object` | Root leaf node | Recursive pane tree (see [editor-system.md](editor-system.md)) |
| `activePaneId` | `string` | `'pane-root'` | Currently focused pane |
| `dirtyFiles` | `Set<string>` | `new Set()` | Files with unsaved changes |
| `editorViews` | `object` | `{}` | `"paneId:path"` → EditorView (non-reactive) |
| `cursorOffset` | `number` | `0` | Cursor byte offset in active editor (used by OutlinePanel for heading highlight) |
| `pdfViewerStates` | `object` | `{}` | `filePath` → `{ zoom, currentPage }` — persists PDF viewer state across remounts |

### Getters
- `activePane` - Finds the leaf node matching `activePaneId`
- `activeTab` - The active pane's activeTab
- `allOpenFiles` - Set of all file paths open in any tab in any pane

### Key Actions
- `findPane(node, id)` - Recursive tree search for leaf by ID
- `findParent(node, id)` - Find parent of a node by ID
- `openFile(path)` - Opens file in active pane (adds tab or switches to existing)
- `closeTab(paneId, path)` - Removes tab, selects adjacent, collapses empty non-root panes
- `collapsePane(paneId)` - Replaces parent split with sibling
- `splitPane(direction)` - Splits active pane into two
- `reorderTabs(paneId, fromIdx, toIdx)` - Drag reorder
- `registerEditorView/unregisterEditorView/getEditorView` - EditorView instance management
- `setPdfViewerState(filePath, state)` - Merge zoom/currentPage into `pdfViewerStates[filePath]`
- `getPdfViewerState(filePath)` - Read saved PDF viewer state (returns `null` if none)

## Store: chat

**Dependencies**: workspace (API keys, models config), and tool execution accesses files, reviews, editor stores via extracted services

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `sessions` | `array` | `[]` | Active chat session objects (in-memory) |
| `activeSessionId` | `string\|null` | `null` | Currently displayed session |
| `allSessionsMeta` | `array` | `[]` | `[{id, label, updatedAt, messageCount}]` — index of ALL persisted sessions |

### Session Object
```javascript
{
  id: 'abc123',
  label: 'Chat 1',
  modelId: 'sonnet',
  messages: [/* Message objects */],
  status: 'idle' | 'streaming',
  createdAt: '2026-...',
  updatedAt: '2026-...',
  // Runtime-only (stripped on save):
  _unlistenChunk, _unlistenDone, _unlistenError, _sseBuffer, _currentToolInputJson
}
```

### Message Object
```javascript
{
  id: 'msg-xxx',
  role: 'user' | 'assistant',
  content: 'text',
  fileRefs: [{ path, content }],       // user: @-referenced files
  context: { file, selection, text },   // user: editor selection
  toolCalls: [{ id, name, input, output, status }],  // assistant: tool requests + results
  thinking: null | 'thinking text',           // concatenated thinking text (displayed in UI)
  _thinkingBlocks: [{ type, thinking, signature }],  // structured blocks (sent back to API)
  status: 'complete' | 'streaming' | 'error' | 'aborted',
  _isToolResult: bool,                  // synthetic user message with tool results
  _toolResults: [/* tool_result blocks */],
}
```

### Getters
- `activeSession` — find session by activeSessionId
- `streamingCount` — count of sessions with status `'streaming'`

### Key Actions
- `createSession(modelId?)` — creates with nanoid, sets active
- `closeSession(id)` — saves, removes from memory, keeps file on disk
- `deleteSession(id)` — removes from memory AND deletes file from disk
- `reopenSession(id)` — loads closed session from disk back into memory
- `sendMessage(sessionId, {text, fileRefs, context})` — creates user msg, calls `_streamResponse`
- `abortSession(sessionId)` — invokes `chat_abort` via Rust
- `loadSessions()` — clears sessions (prevents HMR duplication), scans `.shoulders/chats/`, loads all
- `saveSession(id)` — writes to `.shoulders/chats/{id}.json`, updates allSessionsMeta inline
- `loadAllSessionsMeta()` — full disk scan of chats dir for lightweight index

### Extracted Services (called by store)
- `chatTools.js` → `getToolDefinitions(workspace)` (filters disabled tools), `executeSingleTool(name, input, workspace)` (guards disabled), `TOOL_CATEGORIES`, `EXTERNAL_TOOLS`, `TASK_TOOL_NAMES`
- `chatMessages.js` → `await buildApiMessages(session)`, `await buildApiMessagesWithToolResults(session)` (async — calls `buildWorkspaceMeta`)
- `chatModels.js` → `resolveModel(modelId, workspace)`, `getContextWindow(modelId, workspace)`
- `workspaceMeta.js` → `buildWorkspaceMeta(workspacePath)` (open tabs, git diff)
- `tokenEstimator.js` → `estimateConversationTokens()`, `truncateToFitBudget()`

## Store: reviews

**Dependencies**: workspace (for .shoulders path)

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `pendingEdits` | `array` | `[]` | Edit records from pending-edits.json |
| `directMode` | `boolean` | `false` | Whether edit interception is bypassed |
| `unlisten` | `function \| null` | `null` | fs-change event unsubscriber |

### Getters
- `editsForFile(filePath)` - Filter pending edits for a specific file
- `pendingCount` - Count of edits with status `'pending'`
- `filesWithEdits` - Unique list of file paths with pending edits

### Key Actions
- `startWatching()` - Loads edits, watches for pending-edits.json changes via fs-change
- `loadPendingEdits()` - Reads and parses pending-edits.json
- `savePendingEdits()` - Writes pendingEdits array back to the JSON file
- `acceptEdit(editId)` - Marks as accepted, saves
- `rejectEdit(editId)` - Reverts the file change, marks as rejected, saves
- `acceptAll()` - Accepts all pending edits
- `toggleDirectMode()` - Creates/deletes `.shoulders/.direct-mode` flag file

## Store: tasks

**Dependencies**: workspace (API keys, models config, system prompt), files (fileContents cache), editor (openFile), reviews (pendingEdits, direct mode), chatProvider + chatModels (reused services)

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `threads` | `array` | `[]` | Task thread objects (see data model in [ai-system.md](ai-system.md)) |
| `activeThreadId` | `string\|null` | `null` | Currently displayed thread in the right panel |

### Getters
- `threadsForFile(filePath)` — Filter threads for a specific file (used by TextEditor.vue for CM sync)
- `activeThread` — Find thread by activeThreadId
- `streamingCount` — Count of threads with status `'streaming'`

### Key Actions
- `createThread(fileId, range, selectedText, modelId?)` — Creates thread, sets active, returns ID
- `sendMessage(threadId, { text, fileRefs })` — Pushes user msg, calls `_streamResponse`
- `abortThread(threadId)` — Invokes `chat_abort` via Rust
- `resolveThread(threadId)` — Sets status to `'resolved'`, clears active, saves. Gutter dot/underline hidden.
- `removeThread(threadId)` — Aborts if streaming, cleans up Rust session, splices from array, saves
- `setActiveThread(threadId)` — Sets activeThreadId (controls list vs detail mode in UI)
- `updateRange(threadId, from, to)` — Updates text range (called by CM position mapping on doc changes)
- `applyProposedEdit(threadId, toolCallId)` — Read → replace → write → update filesStore cache → record pending edit → merge view. See [ai-system.md](ai-system.md).
- `loadThreads()` — Reads `.shoulders/tasks.json`, restores runtime fields. Called from `App.vue:openWorkspace()`.
- `saveThreads()` — Strips runtime `_` fields, writes `.shoulders/tasks.json`. Called after each completed turn.

### Internal Actions (streaming orchestration, mirrors chat.js)
- `_streamResponse(thread, apiMessages)` — SSE via `chat_stream`, token estimation + truncation, `parseSSEChunk`, `interpretEvent`
- `_executeToolCalls(thread)` — `propose_edit` handled locally; other tools route through `executeSingleTool()` from `chatTools.js` (respects tool permissions)
- `await _buildApiMessages(thread)` — Async: workspace meta injection, selection context in first user msg, clean file-ref dedup
- `await _buildApiMessagesWithToolResults(thread)` — Async: workspace meta, `_isToolResult` synthetic messages
- `_cleanupListeners(thread)` — Unsubscribes Tauri event listeners

## Store: links

**Dependencies**: workspace (for path), files (for flatFiles, fileContents, saveFile)

Full documentation: [wiki-links.md](wiki-links.md)

### State
| Field | Type | Default | Purpose |
|---|---|---|---|
| `forwardLinks` | `object` | `{}` | `path → link[]` — all wiki links found in each file |
| `backlinks` | `object` | `{}` | `path → backlink[]` — files that link TO each file |
| `nameMap` | `object` | `{}` | `normalizedName → path[]` — for link resolution |
| `headings` | `object` | `{}` | `path → {text, level, offset}[]` — structured headings per file |
| `initialized` | `boolean` | `false` | Whether fullScan has completed |

### Getters
- `backlinksForFile(filePath)` — backlinks for a specific file
- `headingsForFile(filePath)` — heading text strings (for wiki link autocomplete)
- `structuredHeadingsForFile(filePath)` — `[{text, level, offset}]` (for OutlinePanel)
- `allFileNames` — `[{name, path, normalized}]` for autocomplete

### Key Actions
- `fullScan()` — On workspace open, reads all .md files, builds all indices. Also caches content into `filesStore.fileContents` so citation detection (`references.citedIn`) works immediately.
- `updateFile(path)` — Incremental re-index after save or external change
- `handleRename(oldPath, newPath)` — Rewrites `[[oldName]]` → `[[newName]]` across all files
- `handleDelete(path)` — Removes from all indices
- `resolveLink(target, fromPath)` — Returns `{path, heading}` or `null`

## Cross-Store Interactions

1. **App.vue** uses all 7 stores. Orchestrates startup (incl. `chatStore.loadSessions()`, `tasks.loadThreads()`), keyboard shortcuts (`Cmd+Shift+L` → chat, `Cmd+Shift+C` → task), task creation.
2. **TextEditor.vue** uses files (content), editor (view registration), workspace (softWrap), reviews (pending edits → merge view), tasks (threadsForFile → CM sync, updateRange), links (wiki link extension).
3. **FileTree.vue** uses files (tree), editor (openFile), workspace (path).
4. **FileTreeItem.vue** uses files (expand), editor (activeTab), reviews (filesWithEdits badge).
5. **Footer.vue** uses workspace (softWrap toggle), reviews (pending count, direct mode toggle).
6. **RightPanel.vue** uses chat (sessions, streaming count, history), tasks (streamingCount), links (backlink count), editor (activeTab).
7. **ChatInput.vue** uses workspace (modelsConfig, apiKeys), editor (activePane selection context).
8. **TaskInput.vue** uses workspace (modelsConfig, apiKeys) for model picker.
9. **TaskThread.vue** uses tasks (sendMessage, abortThread, applyProposedEdit, resolveThread, removeThread), editor (openFile, getEditorView for navigate-to-selection).
10. **chatTools.js** (service) uses reviews (directMode, pendingEdits), files (fileContents cache), editor (openFile). Critical: updates `filesStore.fileContents` before recording pending edits.
11. **tasks.js** (store) uses workspace (API keys, system prompt), files (fileContents cache), editor (openFile), reviews (pendingEdits, directMode). Same race-condition-aware edit recording as chatTools.js.
12. **files.js** calls into links store: `saveFile()` → `updateFile()`, `renamePath()` → `handleRename()`.
13. **OutlinePanel.vue** uses links (`structuredHeadingsForFile`), editor (`activeTab`, `cursorOffset`, `getEditorView`, `getAnySuperdoc`), files (`fileContents`).
