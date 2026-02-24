# Architecture

## App Shell

Tauri v2 desktop app. Rust backend serves as a bridge between the Vue 3 webview and the operating system. The frontend never touches the filesystem or network directly - all I/O goes through Tauri `invoke()` calls to Rust `#[tauri::command]` functions.

```
┌──────────────────────────────────────────────────────┐
│                    Tauri Window                       │
│  ┌────────────────────────────────────────────────┐  │
│  │              Vue 3 Webview                      │  │
│  │  Pinia Stores ←→ Vue Components                 │  │
│  │       ↕              ↕                          │  │
│  │  Services         Editor Extensions             │  │
│  │       ↕                                         │  │
│  │  invoke() ─────────────────────────────────┐    │  │
│  └────────────────────────────────────────────│────┘  │
│                                               ↓       │
│  ┌────────────────────────────────────────────────┐  │
│  │              Rust Backend                       │  │
│  │  fs_commands.rs  │  pty.rs  │  chat.rs          │  │
│  │  (files, git,    │  (PTY    │  (AI chat         │  │
│  │   watch, API     │   terms) │   streaming)      │  │
│  │   proxy, search) │          │                   │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Data Flow Patterns

### Pattern 1: Frontend → Rust → OS
Most operations follow this pattern. Example: reading a file.
```
Vue component → store action → invoke('read_file', {path}) → Rust fs::read_to_string → result
```

### Pattern 2: Rust → Frontend Events
File watching and PTY output use Tauri events. Rust emits; frontend listens.
```
Rust notify watcher → app.emit("fs-change", payload) → frontend listen("fs-change") → store update
Rust PTY reader thread → app.emit("pty-output-{id}") → Terminal.vue listen → xterm.write()
```

### Pattern 3: Frontend → Rust → External API → Frontend
AI features proxy through Rust to avoid CORS. Two variants:

**Non-streaming (ghost suggestions, tasks):**
```
ai.js → invoke('proxy_api_call', {url, headers, body}) → Rust reqwest → API → response text → JSON.parse
```

**Streaming (AI chat):**
```
chat.js → invoke('chat_stream', {sessionId, request}) → Rust tokio::spawn → reqwest bytes_stream
  → app.emit('chat-chunk-{id}') per SSE chunk → frontend listen() → parseSSEChunk → reactive update
```

### Pattern 4: External Tool → File → File Watcher → Frontend
Claude Code edit interception uses the filesystem as an IPC mechanism.
```
Claude Code Edit tool → PreToolUse hook → intercept-edits.sh → writes pending-edits.json → notify watcher → fs-change event → reviews store reloads JSON → diff overlays update
```

## Component Hierarchy

```
App.vue
├── Header.vue
├── ResizeHandle.vue (left sidebar)
├── FileTree.vue
│   ├── FileTreeItem.vue (recursive)
│   └── ContextMenu.vue
├── ReviewBar.vue
├── PaneContainer.vue (recursive)
│   ├── EditorPane.vue (leaf nodes, routes by file type)
│   │   ├── TabBar.vue
│   │   ├── TextEditor.vue (CodeMirror, all text files)
│   │   ├── PdfViewer.vue (pdfjs-dist canvas + text layer)
│   │   ├── CsvEditor.vue (Handsontable)
│   │   ├── ImageViewer.vue (base64 via Rust)
│   │   └── DocxEditor.vue (SuperDoc)
│   └── SplitHandle.vue (split nodes)
├── ResizeHandle.vue (right sidebar)
├── RightPanel.vue
│   ├── ChatSession.vue (multiple, v-show toggled)
│   │   └── ChatMessage.vue
│   ├── ChatInput.vue + FileRefPopover.vue
│   ├── Terminal.vue (multiple, v-show toggled)
│   └── TaskThreads.vue
│       └── TaskThread.vue
├── Footer.vue
└── VersionHistory.vue (modal, teleported)
```

## State Architecture

Six Pinia stores, with clear dependency direction:

```
workspace ← files ← editor
    ↑          ↑
    ├── reviews (watches pending-edits.json via fs-change events)
    ├── tasks (uses workspace for API key + system prompt)
    └── chat (uses workspace for API keys/models, files for content cache, reviews for edit recording)
```

- **workspace** depends on nothing. Owns workspace path, API keys (multi-provider), models config.
- **files** depends on workspace (for the path). Owns file tree and content cache.
- **editor** depends on nothing at runtime. Owns pane tree and tab state.
- **reviews** depends on workspace (for .shoulders path). Owns pending edit data.
- **tasks** depends on workspace (indirectly via task agent service). Owns task threads.
- **chat** depends on workspace (API keys, models), and its tool execution accesses files, reviews, and editor stores.

No circular dependencies. Services are stateless: `chatTools.js`, `chatMessages.js`, `chatModels.js`, `chatProvider.js` are extracted from the chat store for readability.

## Managed State in Rust

Three state objects registered with `app.manage()`:

1. **`WatcherState`** (`fs_commands.rs`): Holds a `Mutex<Option<RecommendedWatcher>>`. Only one directory watcher active at a time.
2. **`PtyState`** (`pty.rs`): Holds a `Mutex<HashMap<u32, PtySession>>` (session map) and `Mutex<u32>` (next ID counter). Multiple concurrent PTY sessions supported.
3. **`ChatState`** (`chat.rs`): Holds a `Mutex<HashMap<String, ChatSession>>`. Each session has a `cancel_tx` for abort. Multiple concurrent chat streams supported.

## Startup Sequence

1. `main.rs` → `lib.rs:run()` → Tauri builder sets up plugins, state, commands, starts app
2. Tauri loads webview → `index.html` → `main.js` → Vue app mounts
3. `App.vue:onMounted()`:
   a. Check `localStorage` for last workspace path
   b. If found and exists → `openWorkspace(path)`
   c. Otherwise → native folder picker dialog
4. `openWorkspace(path)`:
   a. `workspace.openWorkspace()` → init .shoulders/, load settings (incl. models.json, multi-key .env), start file watcher, start auto-commit
   b. `files.loadFileTree()` → Rust reads directory recursively
   c. `files.startWatching()` → listen for fs-change events
   d. `reviews.startWatching()` → load + watch pending-edits.json
   e. `chatStore.loadSessions()` → scan `.shoulders/chats/`, restore sessions, build meta index

## Key Architectural Constraints

1. **Single workspace at a time.** The app opens one folder. No multi-root workspaces.
2. **macOS-only assumptions.** Terminal spawns `/bin/zsh -l`. Titlebar uses macOS overlay style. Keyboard shortcuts use `Cmd`.
3. **No authentication or networking** (other than the Anthropic API proxy). No user accounts, no sync.
4. **No database.** All state is either in-memory (Pinia stores), on disk (files in the workspace), or in `localStorage` (last workspace path only).
5. **Four themes.** Tokyo Night (default), Light, Monokai, Nord. Switchable via Settings modal.
