# Terminal System

Embedded terminal using xterm.js on the frontend and portable-pty on the Rust backend. Supports multiple concurrent terminal tabs.

## Relevant Files

| File | Role |
|---|---|
| `src-tauri/src/pty.rs` | Rust: PTY session lifecycle, I/O, resize |
| `src/components/right/Terminal.vue` | xterm.js setup, event wiring, resize observer |
| `src/components/layout/BottomPanel.vue` | Primary terminal panel (bottom of editor area): multi-tab, language REPLs, lazy init |
| `src/components/right/RightPanel.vue` | Right sidebar terminal tab (also has multi-tab terminals) |

## Architecture

```
xterm.js (Terminal.vue)
    ↕ onData / write
invoke('pty_write')  ←→  Rust PtySession.writer
invoke('pty_spawn')  →   portable_pty spawn
invoke('pty_resize') →   PtySession.master.resize()
invoke('pty_kill')   →   sessions.remove()
    ↑
listen('pty-output-{id}') ← Rust reader thread → app.emit()
listen('pty-exit-{id}')   ← reader thread EOF
```

## Rust Side (`pty.rs`)

### State
```rust
pub struct PtyState {
    sessions: Mutex<HashMap<u32, PtySession>>,  // ID → session
    next_id: Mutex<u32>,                        // auto-incrementing counter
}

pub struct PtySession {
    writer: Box<dyn Write + Send>,        // write to PTY stdin
    master: Box<dyn portable_pty::MasterPty + Send>,  // for resize
}
```

### Commands

| Command | Args | Returns | Purpose |
|---|---|---|---|
| `pty_spawn` | cmd, args, cwd, cols, rows | `u32` (session ID) | Spawn a new PTY process |
| `pty_write` | id, data | `()` | Send input to PTY |
| `pty_resize` | id, cols, rows | `()` | Resize PTY terminal |
| `pty_kill` | id | `()` | Kill and remove session |

### Spawn Details
1. Opens a PTY pair with the given dimensions
2. Builds a command (`/bin/zsh -l` typically) with cwd set to workspace path
3. Sets env: `TERM=xterm-256color`, `PROMPT=%1~ %# ` (short zsh prompt), `PS1=\W \$ ` (short bash prompt)
4. Spawns the child process on the slave side
5. Drops the slave (only the master is needed)
6. Clones a reader from the master
7. Takes the writer from the master
8. Stores the session in the HashMap
9. Spawns a **reader thread** that:
   - Reads from the PTY master in 4096-byte chunks
   - Emits `pty-output-{id}` events with the data
   - On EOF, emits `pty-exit-{id}` and terminates

### Kill
Simply removes the session from the HashMap. Dropping the writer/master causes the PTY to close.

## Frontend Side (`Terminal.vue`)

### xterm.js Setup
- Loads `@xterm/xterm`, `@xterm/addon-fit`, `@xterm/addon-web-links` dynamically
- Theme matches the app's Tokyo Night palette (colors explicitly set)
- Font: JetBrains Mono 13px, line height 1.4
- Cursor blink enabled, 10000 line scrollback

### Event Wiring
1. `terminal.onData(data)` → `invoke('pty_write', {id, data})` (keyboard input → PTY)
2. `listen('pty-output-{id}', event)` → `terminal.write(event.payload.data)` (PTY output → screen)
3. `listen('pty-exit-{id}')` → shows "[Process exited]" message
4. `terminal.onResize({cols, rows})` → `invoke('pty_resize', {id, cols, rows})`

### Auto-Resize
A `ResizeObserver` on the terminal container calls `fitAddon.fit()` whenever the container size changes, then sends `pty_resize` to the Rust side. This handles sidebar resizing, window resizing, etc.

### Lifecycle
- **Mount**: Calls `initXterm()` then `spawnTerminal()` (spawns `/bin/zsh -l` in workspace dir)
- **Unmount**: Unlisten events, disconnect resize observer, dispose xterm, kill PTY

### Exposed Methods
- `focus()` - Focus the xterm.js terminal
- `refitTerminal()` - Refit the terminal to its container
- `writeToPty(data)` - Write data to the PTY (async, with chunking for large payloads)

### Chunked PTY Writes

Large payloads written to the PTY can overflow the input buffer (~4KB on Unix). `writeToPty` handles this:

- **< 2KB**: sent directly in a single `pty_write` call (no overhead)
- **>= 2KB**: split into ~2KB chunks, breaking at newline boundaries when possible. 10ms pause between chunks.

### Multi-Line Code Execution (Temp File Approach)

Sending multi-line code directly to a PTY causes **readline garbling**: R/Python/Julia echo and execute each line individually while remaining lines are still buffering, interleaving output with unprocessed input.

**Fix:** `buildReplCommand()` (in both `BottomPanel.vue` and `RightPanel.vue`) writes multi-line code to a temp file (`/tmp/.shoulders-run-{timestamp}.{ext}`) via Rust `write_file`, then sends a single-line source command:

| Language | Command |
|----------|---------|
| R | `source("/tmp/.shoulders-run-123.R", echo = TRUE)` |
| Python | `exec(open("/tmp/.shoulders-run-123.py").read())` |
| Julia | `include("/tmp/.shoulders-run-123.jl")` |

Single-line selections bypass temp files and are sent directly. An 8ms delay before writing the command provides a natural feel.

R's `echo = TRUE` prints each expression before executing — visually similar to interactive input (with `> ` prefixes and output after each expression).

## Multi-Terminal Tabs

Terminals live in two locations, both using the same `Terminal.vue` component and the same tab management pattern:

### Bottom Panel (`BottomPanel.vue`) — Primary
The bottom panel sits below the PaneContainer in the center column. It is the **primary terminal location**, toggled by the Header's terminal icon button (`workspace.toggleBottomPanel()`).

- Lazy-initialized: terminals are only mounted when the panel is first opened (`hasEverOpened` flag)
- Closing the last terminal tab hides the panel entirely
- Language REPL events (`create-language-terminal`, `focus-language-terminal`, `send-to-repl`) open/focus terminals here

### Right Panel (`RightPanel.vue`) — Secondary
The right panel retains a Terminal tab alongside Outline and Backlinks. It also supports multi-tab terminals with the same language REPL event listeners.

### Tab Management (shared pattern)
- `terminals` reactive array: `[{ id: number, label: string }]`
- `activeTerminal` ref: index into the array
- "+" button adds a new terminal
- Close button removes a terminal
- Double-click a tab to rename it
- Tabs are drag-reorderable (mouse-based, same pattern as editor tabs)

### Terminal Persistence
Terminals use `v-show` (not `v-if`) so that switching tabs doesn't destroy/recreate the xterm instance. All terminals stay mounted and running; only the active one is visible.

### Focus Integration
- **Bottom panel**: `BottomPanel.focusTerminal()` opens the panel and focuses the active terminal. The Header terminal button toggles `workspace.bottomPanelOpen`.
- **Right panel**: `RightPanel.focusTerminal()` switches to the terminal tab and focuses the active terminal.
- **Chat**: Chat sessions live as `chat:*` tabs in the editor pane system (not in the right panel). `Cmd+J` opens a chat tab beside the current editor via `editorStore.openChatBeside()`, routing to the last active chat/newtab pane.

## Platform Notes

- **Shell prompt env vars** (`PS1`, `PROMPT`) are only set on Unix via `#[cfg(unix)]`. Windows shells use their own defaults.
- **`run_shell_command`** (in `fs_commands.rs`) uses `bash -c` on Unix, `cmd /C` on Windows.
- The PTY spawn command (`/bin/zsh -l`) is still macOS-specific. Windows PTY support relies on `portable-pty` which handles `cmd.exe`/PowerShell, but the spawn path would need platform branching.

## Important Notes

1. **No shell integration**: The terminal is a raw PTY. No special integration with the editor (e.g., no "open file" from terminal).
2. **CSS import**: xterm.js CSS is imported dynamically in `initXterm()` - `await import('@xterm/xterm/css/xterm.css')`.
3. **PTY output encoding**: Raw bytes are converted to string via `String::from_utf8_lossy` in Rust. This handles most UTF-8 content but may garble malformed sequences.
