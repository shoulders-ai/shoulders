# Shoulders

An AI workspace for researchers. Handles Markdown, LaTeX, DOCX, Jupyter notebooks, CSV, and code in a single environment with integrated reference management, multi-provider AI, and version control.

**Central documentation registry: [`docs/MAP.md`](../docs/MAP.md) — start here when looking for anything.**

## Architecture

```
Tauri v2 Shell
  Rust Backend (src-tauri/src/)
    fs_commands.rs  — File I/O, file watching, API proxy, content search, shell commands
    git.rs          — Git operations via git2 crate (no OS git dependency)
    chat.rs         — AI streaming proxy (SSE via reqwest + tokio)
    pty.rs          — Terminal sessions via portable-pty
    kernel.rs       — Jupyter kernel protocol (ZeroMQ), kernel discovery/launch/execute
    typst_export.rs — Markdown → Typst → PDF (5 templates, citation-gated bibliography)
    latex.rs        — LaTeX compilation via Tectonic, SyncTeX
    usage_db.rs     — Usage tracking SQLite at ~/.shoulders/usage.db
    lib.rs          — App setup, state management, command registration, OS keychain (keyring)

  Vue 3 Frontend (src/)
    stores/         — Pinia: workspace, files, editor, chat, tasks, reviews, links, usage, kernel, typst, latex, references, toast, environment
    services/       — AI providers, chat orchestration, git, GitHub sync, references, system prompt, auth, code runner, telemetry
    editor/         — CodeMirror 6: setup, theme, ghost suggestions, diff overlay, tasks, wiki links, citations, live preview, code chunks
    components/     — Vue components: layout, sidebar, editor, right panel, modals, settings
    utils/          — Helpers: chatMarkdown, fileTypes, notebookFormat, textDiff, errorMessages

  Web Backend (web/)  — Optional Nuxt 3 server powering shoulde.rs (auth, admin, AI proxy, peer review)
```

Desktop shell is Tauri v2 (Rust + webview). All file operations and API calls go through custom Rust commands — no browser filesystem access, no CORS issues. The frontend is Vue 3 + Pinia + Tailwind CSS 3.

## Key Systems

| System | Key Files | Doc |
|---|---|---|
| Editor (CodeMirror 6) | `editor/setup.js`, `TextEditor.vue`, `stores/editor.js` | [editor-system.md](../docs/editor-system.md) |
| DOCX editing (SuperDoc) | `DocxEditor.vue`, `editor/docxGhost.js`, `stores/editor.js` | [superdoc-system.md](../docs/superdoc-system.md) |
| AI chat | `stores/chat.js`, `services/chatTools.js`, `services/chatProvider.js` | [ai-system.md](../docs/ai-system.md) |
| Ghost suggestions | `editor/ghostSuggestion.js`, `editor/docxGhost.js`, `services/ai.js` | [ai-system.md](../docs/ai-system.md) |
| Task threads | `stores/tasks.js`, `editor/tasks.js`, `TaskThread.vue` | [ai-system.md](../docs/ai-system.md) |
| Edit review | `stores/reviews.js`, `editor/diffOverlay.js`, `.claude/hooks/intercept-edits.sh` | [review-system.md](../docs/review-system.md) |
| Git & GitHub sync | `services/git.js`, `services/githubSync.js`, `src-tauri/src/git.rs` | [git-system.md](../docs/git-system.md) |
| References | `stores/references.js`, `editor/citations.js`, `services/openalex.js` | [state-management.md](../docs/state-management.md) |
| Notebooks & Jupyter | `NotebookEditor.vue`, `stores/kernel.js`, `src-tauri/src/kernel.rs` | [notebook-system.md](../docs/notebook-system.md) |
| Terminal & code runner | `Terminal.vue`, `services/codeRunner.js`, `src-tauri/src/pty.rs` | [terminal-system.md](../docs/terminal-system.md) |
| Markdown → PDF | `stores/typst.js`, `src-tauri/src/typst_export.rs` | [markdown-system.md](../docs/markdown-system.md) |
| LaTeX | `stores/latex.js`, `src-tauri/src/latex.rs`, `editor/latexCitations.js` | [tex-system.md](../docs/tex-system.md) |
| Wiki links | `stores/links.js`, `editor/wikiLinks.js`, `Backlinks.vue` | [wiki-links.md](../docs/wiki-links.md) |
| Usage tracking | `stores/usage.js`, `src-tauri/src/usage_db.rs` | [usage-system.md](../docs/usage-system.md) |
| Live preview | `editor/livePreview.js` | [editor-system.md](../docs/editor-system.md) |
| Auth & Shoulders proxy | `services/shouldersAuth.js`, `services/apiClient.js` | [auth-system.md](../docs/auth-system.md) |
| Web backend | `web/server/` (Nuxt/Nitro) | [web-backend.md](../docs/web-backend.md) |

## AI Chat

Multi-provider streaming chat in the right sidebar with parallel sessions.

- **Providers**: Anthropic, OpenAI, Google (configured in `~/.shoulders/models.json` + `~/.shoulders/keys.env`)
- **28 tools** across 5 categories:
  - **Workspace** (11): `read_file`, `list_files`, `search_content`, `write_file`, `edit_file`, `create_file`, `rename_file`, `move_file`, `duplicate_file`, `delete_file`, `run_command`
  - **References** (5): `search_references`, `get_reference`, `add_reference`, `cite_reference`, `edit_reference`
  - **Feedback** (3): `add_task`, `read_tasks`, `create_proposal`
  - **Notebooks** (6): `read_notebook`, `edit_cell`, `run_cell`, `run_all_cells`, `add_cell`, `delete_cell`
  - **Web** (3): `web_search`, `search_papers`, `fetch_url`
- **Streaming**: Rust proxy (`chat.rs`) → Tauri events → SSE parsing → reactive UI
- **Sessions**: persist to `.shoulders/chats/`, close/reopen via history dropdown
- **System prompt**: `services/systemPrompt.js` — shared base for chat, tasks, and ghost
- **Skills**: `.project/skills/` — user-defined skill manifests injected into system prompt
- **Context**: `services/workspaceMeta.js` builds `<workspace-meta>` (open tabs, git diff) prepended to first user message

## Edit Review Workflow

When Claude Code or the built-in AI chat edits files, changes are queued in `.shoulders/pending-edits.json` and shown as inline diffs (accept/reject via merge view).

- **Claude Code**: intercepted by PreToolUse hook (`.claude/hooks/intercept-edits.sh`)
- **Built-in chat**: `edit_file` and `write_file` tools record edits directly via reviews store
- **Race condition fix**: update `filesStore.fileContents[path]` BEFORE recording pending edit

Toggle "direct mode" in the footer to let edits through without review.

## Config Directories

- **`.shoulders/`** — private AI state (gitignored): `system.md`, `pending-edits.json`, `.direct-mode`, `chats/`, `tasks.json`, `open-sessions.json`
- **`.project/`** — public project data (syncs via git): `references/`, `styles/`, `skills/`, `pdf-settings.json`, `citation-style.json`
- **`~/.shoulders/`** — global config: `keys.env` (API keys), `models.json`, `usage.db`

## Commands

```bash
bun install
npx tauri dev          # Development (hot-reload)
npx tauri build        # Production build
bun run build          # Frontend only
cargo build --manifest-path src-tauri/Cargo.toml  # Rust backend only
```

## Key Gotchas

See [`docs/gotchas.md`](../docs/gotchas.md) for the full list. Critical ones:

- **SuperDoc + Vue Proxy**: SuperDoc uses `#private` class fields — NEVER put instances in `ref()` or `reactive()`. Use `shallowRef` + `markRaw()`.
- **`invoke()` struct args**: When Rust command takes `request: MyStruct`, JS MUST pass `{ request: { ... } }` — NOT flat args.
- **CM6 full-doc swap kills position tracking**: Use `computeMinimalChange()` (`src/utils/textDiff.js`) for surgical diffs.
- **RightPanel overflow-hidden clips popovers**: Use `<Teleport to="body">` with `position: fixed` for any dropdown inside the right panel.
- **NEVER use `tauri-plugin-stronghold`**: `Stronghold.load()` takes ~50 seconds. Use `keyring` crate instead.
- **Shoulders proxy URL**: Single source of truth in `apiClient.js:SHOULDERS_PROXY_URL`.
