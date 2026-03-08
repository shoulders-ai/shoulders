# _MAP.md - Central Documentation Registry

This is the master index. When looking for anything, start here.

---

## Read This First: Gotchas That Will Bite You

These are hard-won lessons from this codebase. Violating any of them causes subtle, hard-to-debug breakage. **See: [gotchas.md](gotchas.md).**

---

## Systems & Their Documentation

| System | Doc File | What It Covers |
|---|---|---|
| Overall architecture | [architecture.md](architecture.md) | App structure, data flow, component hierarchy, how systems connect |
| CodeMirror editor | [editor-system.md](editor-system.md) | Extensions, pane tree, tab management, auto-save, soft wrap |
| AI features | [ai-system.md](ai-system.md) | Ghost suggestions, AI chat (streaming, tools, multi-provider), API proxy, skills system, shared system prompt |
| Document comments | [comments-system.md](comments-system.md) | Margin annotations, per-file visibility, store/extension/UI architecture, AI tools, submit-to-chat, gotchas |
| File operations | [file-system.md](file-system.md) | Rust file commands, tree building, file watching, content search |
| Edit review | [review-system.md](review-system.md) | Edit interception hook, pending-edits.json, diff overlays, direct mode |
| Terminal & code runner | [terminal-system.md](terminal-system.md) | PTY in Rust, xterm.js frontend, multi-tab, language REPLs, code chunks |
| R Markdown / Quarto | [rmd-system.md](rmd-system.md) | Inline chunk execution (Jupyter), chunk identity, knitting pipeline, PDF-aware output formatting |
| Notebooks & kernels | [notebook-system.md](notebook-system.md) | .ipynb editing, Jupyter kernel protocol (ZeroMQ), cell execution, environment detection, AI tools, review diffs |
| Git integration | [git-system.md](git-system.md) | Auto-commit, manual save, version history, restore, GitHub sync (push/pull/merge/conflict) |
| Wiki links & backlinks | [wiki-links.md](wiki-links.md) | `[[wiki links]]`, autocomplete, click-navigate, backlinks panel, rename propagation |
| State management | [state-management.md](state-management.md) | All Pinia stores, their fields, getters, actions, and cross-store dependencies |
| UI layout & components | [ui-layout.md](ui-layout.md) | Component tree, layout structure, resize handles, modals |
| Design & style | [style-guide.md](style-guide.md) | Color palette, fonts, CSS variables, Tailwind usage, styling conventions |
| Building & releasing | [building.md](building.md) | Local builds, CI/CD workflow, GitHub releases, icon changes, docs search indexing |
| Markdown system | [markdown-system.md](markdown-system.md) | Raw editing, HTML preview, PDF export via Typst (5 templates, per-file settings), formatting shortcuts |
| DOCX editing (SuperDoc) | [superdoc-system.md](superdoc-system.md) | Hidden-host architecture, extension API (NOT TipTap!), overlay pattern, visible DOM structure, AIActions |
| **SuperDoc API reference** | [superdoc-toc.md](superdoc-toc.md) | Local copy of docs.superdoc.dev — config, commands, extensions, modules, AI. **Read this before any DOCX/ProseMirror work.** |
| Usage tracking & cost | [usage-system.md](usage-system.md) | SQLite backend, per-call recording, pricing, footer display, Settings Usage tab, month navigation, trend strip, Shoulders account link |
| SQLite infrastructure | [sqlite-infrastructure.md](sqlite-infrastructure.md) | Reusable pattern: lazy init, WAL mode, managed state, schema conventions, frontend store pattern |
| Ghost suggestions (deep) | [ghost-work.md](ghost-work.md) | SuperDoc rendering pipeline, run node creation, mark vs runProperties, debugging, prompt engineering |
| Gotchas & lessons | [gotchas.md](gotchas.md) | Full details, file paths, and additional edge cases beyond the summary above |
| **Web backend** | [web-backend.md](web-backend.md) | Nuxt server: auth, AI proxy, credits, contact form, telemetry, admin dashboard, email (Resend), deployment |
| **Peer review** | [web-peer-review.md](web-peer-review.md) | Free promo tool: .docx/.pdf upload → multi-agent AI review (gatekeeper + technical/editorial/reference-checker reviewers + report writer), inline comments with Google Docs-style positioning, Typst PDF export, guidance document system. PDF intake via Z OCR API (GLM-OCR). |
| **Paper triage** | [web-triage.md](web-triage.md) | **WIP.** Desk triage for journal editors: PDF/DOCX upload → metadata extraction, reference verification, AI detection, novelty search, author lookup (OpenAlex), structured assessment. ~$0.40/paper, ~3 minutes. |
| **Auth system** | [auth-system.md](auth-system.md) | Refresh token rotation, desktop login (polling + deep link), OS keychain, production checklist, debugging |
| **Admin system** | [admin-system.md](admin-system.md) | Admin dashboard (JWT cookie auth, CSRF), 7 pages (dashboard, users, calls, reviews, decks, analytics), anonymous page view tracking, all admin API endpoints |
| **Auto-updates** | [building.md](building.md#auto-updates) | tauri-plugin-updater, signing keypair, version bump, server endpoint, platform notes |

---

## Quick Lookup: "I need to change X"

### Want to change markdown editing, preview, or PDF export?
- Formatting shortcuts: `src/editor/markdownShortcuts.js` — Cmd+B/I/K/E etc.
- HTML preview: `src/utils/markdownPreview.js` — Marked + KaTeX + highlight.js
- Preview component: `src/components/editor/MarkdownPreview.vue` — rendered side-by-side view (Geist font)
- PDF export (Rust): `src-tauri/src/typst_export.rs` — pulldown-cmark → Typst → PDF, 5 templates, citation-gated bibliography, `$` escaping
- PDF export (store): `src/stores/typst.js` — per-file settings (template/font/size/margins/spacing/bib_style), persistence to `.project/pdf-settings.json`
- PDF settings UI: `src/components/editor/PdfSettingsPopover.vue` — gear icon popover in TabBar (template, font, size, margins, spacing)
- TabBar buttons: `src/components/editor/TabBar.vue` — Preview / Create PDF / gear
- Typst binary: `src-tauri/binaries/typst-{triple}` — bundled sidecar
- Split pane logic: `EditorPane.vue:ensurePdfOpen()` — uses `activePaneId` for reliable splits
- See [markdown-system.md](markdown-system.md)

### Want to change how files are read/written?
- Rust: `src-tauri/src/fs_commands.rs` (lines 82-123) - all CRUD commands
- Frontend caller: `src/stores/files.js` - uses `invoke()` to call Rust
- See [file-system.md](file-system.md)

### Want to change DOCX editing?
- **READ THIS FIRST:** [superdoc-system.md](superdoc-system.md) — hidden-host architecture, overlay pattern, extension API
- **SuperDoc API reference:** [superdoc-toc.md](superdoc-toc.md) — local copy of docs.superdoc.dev. Look up commands, config, and extensions here BEFORE writing ProseMirror code.
- Editor component: `src/components/editor/DocxEditor.vue` — SuperDoc wrapper, ghost overlay, save pipeline
- Ghost suggestions: `src/editor/docxGhost.js` — ProseMirror plugin (state + keyboard in hidden view, overlay callback)
- Review bar: `src/components/editor/DocxReviewBar.vue` — tracked changes Accept/Reject
- AI provider: `src/services/docxProvider.js` — wraps Rust proxy for @superdoc-dev/ai
- Text extraction: `src/services/docxContext.js` — ProseMirror doc text utilities
- Binary bridge: `src/utils/docxBridge.js` — base64 <-> Blob <-> File conversion
- Store: `src/stores/editor.js` — `superdocInstances` registry (SuperDoc + AIActions per pane)
- Chat tools: `src/services/chatTools.js` — DOCX-aware `read_file` and `edit_file` (uses AIActions.literalReplace)

### Want to change the editor behavior?
- Extension assembly: `src/editor/setup.js` - creates all CodeMirror extensions
- Editor component: `src/components/editor/TextEditor.vue` - mounts CodeMirror, wires extensions
- Pane/tab logic: `src/stores/editor.js` - recursive pane tree data structure
- Editor state persistence: `src/services/editorPersistence.js` - save/restore pane tree to `.shoulders/editor-state.json`, parallel tab validation
- See [editor-system.md](editor-system.md)

### Want to change AI ghost suggestions?
- CodeMirror: `src/editor/ghostSuggestion.js` - `++` detection, state field, widgets
- DOCX/SuperDoc: `src/editor/docxGhost.js` - standalone run insertion, state + keyboard
- API call: `src/services/ai.js:getGhostSuggestions()` - `generateText()` with `suggest_completions` tool (AI SDK)
- API routing: `src/services/apiClient.js:resolveApiAccess({ strategy: 'ghost' })` - Haiku → Gemini → GPT-5 Nano → Shoulders
- Model creation: `src/services/aiSdk.js:createModel()` + `src/services/tauriFetch.js` for CORS bypass
- API keys: read from `~/.shoulders/keys.env` (global) by `src/stores/workspace.js:loadSettings()`
- Deep notes: [ghost-work.md](ghost-work.md) — SuperDoc internals, rendering pipeline, debugging
- See [ai-system.md](ai-system.md)

### Want to change the AI chat?
- Store: `src/stores/chat.js` — Chat composable instances (`@ai-sdk/vue`), sessions, persistence
- Transport: `src/services/chatTransport.js` — `ToolLoopAgent` + `DirectChatTransport` factory (creates fresh agent per request)
- Model factory: `src/services/aiSdk.js` — `createModel()`, `buildProviderOptions()`, `convertSdkUsage()`
- Tool definitions: `src/services/chatTools.js` — 27 tools via AI SDK `tool()` + zod schemas
- Academic paper search: `src/services/openalex.js` — OpenAlex API client (primary), fallback chain in `chatTools.js` (OpenAlex → Exa → CrossRef)
- API routing + auth: `src/services/apiClient.js` — `resolveApiAccess()`, Shoulders proxy URL
- Context windows: `src/services/chatModels.js` — context window sizes, thinking config
- Fetch bridge: `src/services/tauriFetch.js` — wraps Rust `chat_stream` in `fetch()` for AI SDK
- Workspace meta: `src/services/workspaceMeta.js` — open tabs, git diff, injected into system prompt
- Rust streaming proxy: `src-tauri/src/chat.rs` — tokio + reqwest + Tauri events
- Markdown rendering: `src/utils/chatMarkdown.js` — shared pipeline (marked + DOMPurify), tool labels/icons/context
- UI: `src/components/chat/ChatSession.vue`, `ChatMessage.vue` (parts-based rendering), `ChatInput.vue`, `ToolCallLine.vue`
- @file search: `src/components/shared/FileRefPopover.vue`
- Chat tabs: `src/components/chat/ChatPanel.vue` — chat sessions as editor tabs (`chat:*` paths)
- See [ai-system.md](ai-system.md)

### Want to change AI context (system prompt, instructions, workspace meta)?
- System prompt: `.shoulders/system.md` — internal base prompt, loaded by `workspace.loadSettings()`
- Instructions: `_instructions.md` (workspace root) — user-editable, loaded as `workspace.instructions`, hot-reloads on save, feeds chat + comments (via submit to chat) + ghost
- Workspace meta: `src/services/workspaceMeta.js` — builds `<workspace-meta>` block (tabs, git diff)
- Git diff helper: `src/services/git.js:gitDiffSummary()` — abbreviated diff for meta
- Injection: `src/stores/chat.js:_buildConfig()` — meta appended to system prompt
- See [ai-system.md](ai-system.md)

### Want to change usage tracking or cost display?
- Store: `src/stores/usage.js` — record, query, settings, session totals
- Pricing + normalization: `src/services/tokenUsage.js` — per-model pricing tables, `getUsage()`, `formatCost()`
- Rust DB: `src-tauri/src/usage_db.rs` — SQLite at `~/.shoulders/usage.db`, 4 Tauri commands
- Footer display: `src/components/layout/Footer.vue` — monthly total (click opens Settings > Usage)
- Settings tab: `src/components/settings/SettingsUsage.vue` — breakdown tables, budget, footer toggle
- Call sites: `chat.js`, `ghostSuggestion.js`, `docxGhost.js`, `refAi.js`, `docxProvider.js`
- See [usage-system.md](usage-system.md)

### Want to change the comment system?
- Store: `src/stores/comments.js` — pure CRUD data store (no Chat instances), persistence to `.shoulders/comments.json`
- Editor decorations: `src/editor/comments.js` — gutter markers, anchor highlights, position mapping
- Margin UI: `src/components/comments/CommentMargin.vue` — 200px side panel showing compact comment cards
- Floating panel: `src/components/comments/CommentPanel.vue` — overlay for viewing/editing comments
- Comment card: `src/components/comments/CommentCard.vue` — individual comment display
- Comment input: `src/components/comments/CommentInput.vue` — input for adding/replying to comments
- CSS: `src/css/comments.css` — comment system styles
- Chat tools: `src/services/chatTools.js` — `add_comment`, `reply_to_comment`, `resolve_comment`
- Submit to chat: "Submit N comments" button sends all unresolved comments to chat as structured context
- See [comments-system.md](comments-system.md)

### Want to change the edit review system?
- Hook script: `.claude/hooks/intercept-edits.sh` - captures Edit/Write tool calls
- Hook config: `.claude/settings.json` - registers the PreToolUse hook
- Store: `src/stores/reviews.js` - loads/saves pending-edits.json, accept/reject logic
- Editor decorations: `src/editor/diffOverlay.js` - strikethrough + insertion widgets
- Review banner: `src/components/editor/ReviewBar.vue`
- Direct mode flag: `.shoulders/.direct-mode` (file existence = direct mode on)
- See [review-system.md](review-system.md)

### Want to change the terminal or code runner?
- Rust PTY: `src-tauri/src/pty.rs` - spawn/write/resize/kill
- Frontend: `src/components/layout/Terminal.vue` - xterm.js setup, custom spawn commands via props
- Bottom panel: `src/components/layout/BottomPanel.vue` - primary terminal panel (multi-tab, language REPLs)
- Right panel terminal: `src/components/panel/RightPanel.vue` - also has a terminal tab
- Code runner: `src/services/codeRunner.js` - language session management (R/Python/Julia), Cmd+Enter execution
- Code chunks: `src/editor/codeChunks.js` - CM6 extension for .Rmd/.qmd chunk play buttons
- See [terminal-system.md](terminal-system.md)

### Want to change notebook editing (.ipynb)?
- Viewer: `src/components/editor/NotebookEditor.vue` - main notebook component (cell list, toolbar, kernel lifecycle, auto-save)
- Cell: `src/components/editor/NotebookCell.vue` - CodeMirror per code cell, rendered markdown, cell toolbar, ghost suggestions (`++`)
- Output: `src/components/editor/CellOutput.vue` - Jupyter output renderer (stream, display_data, images, errors, ANSI)
- Format: `src/utils/notebookFormat.js` - .ipynb v4 JSON parse/serialize
- Kernel store: `src/stores/kernel.js` - Pinia store wrapping Rust kernel commands
- Kernel backend: `src-tauri/src/kernel.rs` - Jupyter wire protocol (ZeroMQ), kernel discovery/launch/execute/interrupt/shutdown, `find_python_with_ipykernel()` (8-category probe)
- Ghost suggestions: `ghostSuggestionExtension` from `src/editor/ghostSuggestion.js` added per-cell in `NotebookCell.vue`
- AI tools: `src/services/chatTools.js` - `read_notebook`, `edit_cell`, `run_cell`, `run_all_cells`, `add_cell`, `delete_cell`
- File routing: `src/utils/fileTypes.js` - `.ipynb` → `'notebook'` viewer type
- EditorPane: `src/components/editor/EditorPane.vue` - NotebookEditor loaded as async component
- Events: `notebook-scroll-to-cell` (chat navigation → NotebookEditor)

### Want to change git behavior?
- Rust git ops: `src-tauri/src/git.rs` - all git2 commands (clone, push, pull, fetch, merge, ahead/behind, diff)
- Frontend service: `src/services/git.js` - JS wrappers for all Rust git commands
- GitHub sync orchestration: `src/services/githubSync.js` - `syncNow()` (fetch→check→pull/merge→push), conflict handling, error classification, GitHub API helpers
- Auto-commit: `src/stores/workspace.js:startAutoCommit()` - 5-minute interval
- Sync timer: `src/stores/workspace.js:startSyncTimer()` - 30-second interval
- Manual save: `src/App.vue:forceSaveAndCommit()` - Cmd+S handler with named snapshot flow (8s window)
- Named snapshots: `src/components/layout/SnapshotDialog.vue` - naming dialog, `Footer.vue:beginSaveConfirmation()` - center crossfade
- Sync UI: `src/components/layout/Footer.vue` (icon + toasts), `SyncPopover.vue` (status + guidance), `GitHubConflictDialog.vue` (conflict resolution)
- GitHub settings: `src/components/settings/SettingsGitHub.vue` - account + repo linking
- Version history UI: `src/components/VersionHistory.vue` - named snapshots get bookmark icon + accent styling
- See [git-system.md](git-system.md)

### Want to change the UI layout?
- Root layout: `src/App.vue` - launcher vs workspace toggle, header/sidebar/editor/footer arrangement
- Launcher: `src/components/Launcher.vue` - empty state (no workspace open): Open Folder, Clone Repository, recent workspaces
- Header: `src/components/layout/Header.vue` - hamburger menu (≡), inline search bar (Cmd+P), sidebar toggles, settings
- Footer: `src/components/layout/Footer.vue` - status bar, git branch, word count, cursor pos, inline status messages (save, commit)
- Toast notifications: `src/stores/toast.js` + `src/components/layout/ToastContainer.vue` - attention-worthy alerts (e.g. first PDF creation). Footer is for routine status; toasts are for "pay attention" moments.
- Bottom panel: `src/components/layout/BottomPanel.vue` - primary terminal panel below editor area
- Sidebar resize: `src/components/layout/ResizeHandle.vue`
- **What persists across restarts**: see [ui-layout.md](ui-layout.md#what-persists-across-restarts) — full table of localStorage keys, `.shoulders/` files, and what is session-only
- See [ui-layout.md](ui-layout.md)

### Want to change the theme or colors?
- Theme definitions: `src/style.css` — `:root` (Tokyo Night) + `.theme-light`, `.theme-monokai`, `.theme-nord`
- Theme switching: `src/stores/workspace.js` — `setTheme()` / `restoreTheme()`
- CodeMirror theme: `src/editor/theme.js` — uses CSS vars, auto-switches
- Terminal themes: `src/themes/terminal.js` — JS hex objects per theme
- Settings UI: `src/components/settings/` — theme picker, API keys, tools, environment, usage, account
- See [style-guide.md](style-guide.md)

### Want to change wiki links or backlinks?
- Link index store: `src/stores/links.js` - resolution, indexing, rename propagation
- CM6 extension: `src/editor/wikiLinks.js` - decorations, click handler, autocomplete
- Backlinks panel: `src/components/panel/Backlinks.vue`
- Wired into: `TextEditor.vue` (extension), `files.js` (save/rename/delete hooks), `App.vue` (fullScan)
- See [wiki-links.md](wiki-links.md)

### Want to change the file tree sidebar?
- Left sidebar: `src/components/sidebar/LeftSidebar.vue` - three collapsible panels (Explorer, Outline, References)
- Tree component: `src/components/sidebar/FileTree.vue` - explorer panel, inline create/rename, Cmd+F filter
- Tree items: `src/components/sidebar/FileTreeItem.vue` - recursive node rendering, filter highlight
- Outline panel: `src/components/panel/OutlinePanel.vue` - document headings, click-to-navigate
- Context menu: `src/components/sidebar/ContextMenu.vue` - right-click actions
- Tree data: `src/stores/files.js` - tree state, expanded dirs, collision handling (create/rename/move)
- Rust tree builder: `src-tauri/src/fs_commands.rs:build_file_tree()` - filtering + sorting logic
- See [file-system.md](file-system.md)

### Want to change the search bar / go-to-file?
- Header input: `src/components/layout/Header.vue` - real input, Cmd+P focuses it
- Results dropdown: `src/components/SearchResults.vue` - fuzzy file match, content search, reference search
- Content search backend: `src-tauri/src/fs_commands.rs:search_file_contents()` - Rust-side
- See [ui-layout.md](ui-layout.md)


### SHOULDERS WEBSITE

The `/web` folder contains both the web front and backend (Nuxt) of the Shoulders webite. It includes the authentication system, admin dashboard, API routes, database, and website UI. It also has peer review tool.

#### Want to change the web frontend?
- Style guide: `docs/web-style-guide.md`
- LLM discoverability: `web/public/llms.txt` — served at `shoulde.rs/llms.txt`, structured index of product and docs for AI agents

#### Want to change the peer review system?
- See [web-peer-review.md](web-peer-review.md)

#### Want to change the paper triage system?
- See [web-triage.md](web-triage.md)

#### Want to change the web backend (auth, proxy, admin)?
- **All server code**: `web/server/` — Nuxt/Nitro API routes, middleware, utils
- See [web-backend.md](web-backend.md)

#### Want to change the admin dashboard or page analytics?
- Admin layout: `web/layouts/admin.vue` — nav + content slot
- Admin pages: `web/pages/admin/` — Dashboard, Users, Calls, Reviews, Decks, Analytics
- Admin API: `web/server/api/admin/` — all admin endpoints (protected by `02.admin.js` middleware)
- Page analytics: `web/server/api/v1/analytics/event.post.js` (ingest), `web/composables/usePageAnalytics.js` (client tracking), `web/plugins/analytics.client.js` (Nuxt plugin)
- See [admin-system.md](admin-system.md)

---

## Complete File Map

### Rust Backend (`src-tauri/`)
| File | Purpose |
|---|---|
| `src/main.rs` | Entry point, calls `run()` |
| `src/lib.rs` | App builder: plugin registration (dialog, deep-link, shell), keychain commands (keyring crate), state management, command handler registration |
| `src/git.rs` | Git operations via `git2` crate (vendored libgit2): clone, init, add, commit, status, branch, log, show, diff, push, pull, fetch, merge, ahead/behind, push-branch. **No OS git dependency** — all git is done through this library. |
| `src/fs_commands.rs` | File CRUD, directory tree, file watching, API proxy, content search, shell commands, global config dir |
| `src/pty.rs` | PTY session management: spawn, write, resize, kill, output streaming |
| `src/chat.rs` | AI chat streaming proxy: tokio::spawn + reqwest SSE + Tauri event emission |
| `src/usage_db.rs` | Usage tracking: SQLite at ~/.shoulders/usage.db, record/query/settings commands |
| `src/typst_export.rs` | Markdown → Typst conversion (pulldown-cmark), Typst binary discovery, PDF compilation |
| `Cargo.toml` | Rust dependencies: tauri 2, git2 0.20 (vendored libgit2), notify 6, portable-pty 0.8, reqwest 0.12 (stream), futures-util, tokio, pulldown-cmark, keyring 3 (OS keychain) |
| `tauri.conf.json` | Window config (1400x900, overlay titlebar), build config, bundle settings |
| `capabilities/default.json` | Permissions: core, window dragging, dialog, deep-link, shell |
| `build.rs` | Standard tauri_build::build() |

### Vue Frontend (`src/`)

#### Stores (`src/stores/`)
| File | Purpose |
|---|---|
| `workspace.js` | Workspace path, API keys (multi-provider), system prompt, user instructions, sidebar state, auto-commit, models config, recent workspaces, closeWorkspace |
| `chat.js` | AI chat sessions, streaming orchestration, persistence |
| `files.js` | File tree data, expanded dirs, file content cache, CRUD operations, file watching |
| `editor.js` | Pane tree (recursive leaf/split), tab management, cross-pane moves, smart chat routing, editor view registry |
| `reviews.js` | Pending edits from Claude Code, accept/reject, direct mode toggle |
| `comments.js` | Document comments: CRUD, persistence to `.shoulders/comments.json`, anchor tracking |
| `links.js` | Wiki link index: forward/backlinks, name map, aliases, headings, rename propagation |
| `toast.js` | Toast notifications: `show(message, opts)`, auto-dismiss, used for attention-worthy alerts |
| `usage.js` | Usage tracking: record API calls, query monthly aggregates, budget settings |
| `utils.js` | `nanoid()` - 8-char random ID generator |

#### Services (`src/services/`)
| File | Purpose |
|---|---|
| `ai.js` | Ghost suggestions: `generateText()` with forced `suggest_completions` tool, multi-provider fallback |
| `aiSdk.js` | Model factory (`createModel`), provider options (`buildProviderOptions`), usage conversion (`convertSdkUsage`) |
| `apiClient.js` | API routing: `resolveApiAccess()` (3 strategies), `SHOULDERS_PROXY_URL`, `hasAnyAccess()` |
| `tauriFetch.js` | `fetch()` wrapper routing through Rust `chat_stream` — CORS bypass for AI SDK |
| `chatTransport.js` | `ToolLoopAgent` + `DirectChatTransport` factory for AI SDK Chat composable |
| `shouldersAuth.js` | Desktop auth: browser login (polling + deep link), OS keychain (keyring), token refresh, logout |
| `git.js` | Git commands: init, add, commit, status, branch, log, show, restore, diff, diffSummary, push, pull, fetch, merge, ahead/behind |
| `githubSync.js` | GitHub sync orchestration: `syncNow()` (fetch→pull/merge→push), conflict detection + branch escalation, error classification, GitHub API (user/repos/create), token keychain helpers |
| `chatTools.js` | 28 AI SDK `tool()` definitions (incl. comment tools) with zod schemas + execution with review system integration |
| `chatModels.js` | Context window sizes, thinking config detection, model access checks |
| `workspaceMeta.js` | Builds `<workspace-meta>` block: open tabs, active tab, git branch, abbreviated diff |
| `tokenEstimator.js` | Token estimation (~4 chars/token), conversation totals, sliding-window truncation |
| `tokenUsage.js` | Provider-specific usage normalization, 7-model pricing table, cost calculation, formatting |
| `openalex.js` | OpenAlex API: search works, abstract reconstruction (inverted index → text), CSL-JSON conversion |
| `editorPersistence.js` | Editor state persistence: `saveState()`, `loadState()`, `findInvalidTabs()` — pane tree ↔ `.shoulders/editor-state.json`, parallel tab validation |

#### Editor Extensions (`src/editor/`)
| File | Purpose |
|---|---|
| `setup.js` | Extension assembly: core CM6 setup, auto-save, cursor tracking, word count, soft wrap |
| `theme.js` | Tokyo Night theme for CodeMirror + syntax highlighting rules |
| `ghostSuggestion.js` | `++` trigger, ghost state field, inline widgets, accept/cycle/cancel handlers |
| `diffOverlay.js` | Inline diff rendering: strikethrough + insertion widget + accept/reject buttons |
| `comments.js` | Comment gutter markers, anchor highlights, position mapping |
| `wikiLinks.js` | `[[wiki link]]` decorations, Cmd+click navigation, `[[` autocomplete |
| `livePreview.js` | Semi-WYSIWYG: hides markdown syntax when cursor is elsewhere, renders tables as HTML widgets (StateField), inline images via async base64 loading (ViewPlugin). Toggled via Settings > Hide Markup |
| `markdownShortcuts.js` | Cmd+B bold, Cmd+I italic, Cmd+K link, Cmd+E code, etc. |

#### Components (`src/components/`)
| File | Purpose |
|---|---|
| `Launcher.vue` | Empty state: logo, Open Folder, Clone Repository, recent workspaces |
| `SetupWizard.vue` | First-run wizard (2 steps): AI provider setup (account/keys/skip), theme picker (8 themes). Uses real app icon + serif wordmark. |
| `SearchResults.vue` | Header search dropdown: fuzzy file match, debounced Rust content search, reference search |
| `VersionHistory.vue` | Git log viewer + read-only CodeMirror preview + restore. Named snapshots (not `Auto:`/`Save:`) get bookmark icon + accent styling |
| `GitHubConflictDialog.vue` | Conflict resolution modal: guided steps, "Open GitHub" primary action, expandable "What happened?" |
| `settings/Settings.vue` | Settings modal shell (Cmd+,): overlay, nav, routes to 7 section components |
| `settings/Settings*.vue` | SettingsTheme, SettingsModels, SettingsTools, SettingsEnvironment, SettingsUsage, SettingsAccount, SettingsGitHub |
| **layout/** | |
| `Header.vue` | Titlebar: hamburger menu (≡), inline search input (Cmd+P), sidebar toggles, settings cog |
| `Footer.vue` | Status bar: git branch, sync icon, save confirmation center swap (8s named snapshot window), pending edits, direct/review mode, word count, cursor |
| `SyncPopover.vue` | Sync status popover: actionable error guidance, conflict branch info, "Sync Now"/"Reconnect" actions |
| `ToastContainer.vue` | Fixed bottom-right toast stack: TransitionGroup animations, themed, auto-dismiss |
| `ResizeHandle.vue` | Draggable divider for sidebar resizing |
| `SnapshotDialog.vue` | Named snapshot input dialog (Cmd+S → "Name this version"). Teleported to body, auto-focus, Enter/Esc |
| `BottomPanel.vue` | Bottom terminal panel: multi-tab terminals, drag-reorder, rename, language REPL support, lazy-initialized |
| `Terminal.vue` | xterm.js instance: PTY spawn, themed output, auto-resize |
| **sidebar/** | |
| `LeftSidebar.vue` | Three collapsible panels (Explorer, Outline, References), resize handles, localStorage persistence |
| `FileTree.vue` | Explorer: tree rendering, inline create/rename, context menu, Cmd+F filter |
| `FileTreeItem.vue` | Recursive tree node: icon, expand/collapse, rename input, pending edit badge, filter highlight |
| `ContextMenu.vue` | Right-click: typed file creation (folders/empty), Rename, Duplicate, Delete, Reveal in Finder, Version History |
| **editor/** | |
| `PaneContainer.vue` | Recursive: EditorPane for leaves, split with SplitHandle for split nodes |
| `EditorPane.vue` | Pane: TabBar + MarkdownEditor + empty state |
| `TextEditor.vue` | CodeMirror mount: loads file, wires all extensions, comment store↔CM sync, watches external changes |
| `TabBar.vue` | Draggable tabs (within-pane reorder + cross-pane drag), "+" new tab button, close buttons, unsaved dot, split/close pane actions |
| `SplitHandle.vue` | Drag handle between editor panes |
| `ReviewBar.vue` | Banner: "N pending changes from Claude Code" + Accept All button |
| **chat/** | |
| `ChatPanel.vue` | Chat sessions as editor tabs (`chat:*` paths) |
| `ChatSession.vue` | Per-session view: message list, auto-scroll, send/abort delegation |
| `ChatMessage.vue` | Message renderer: user bubbles (right-aligned, clamped), assistant (marked+DOMPurify markdown), compact tool calls, context cards |
| `ChatInput.vue` | Input: textarea, model picker, @file refs, send/stop buttons, token count display |
| `ToolCallLine.vue` | Individual tool call display with state machine rendering |
| `ProposalCard.vue` | Proposed edit diff card with apply/reject actions |
| **comments/** | |
| `CommentMargin.vue` | 200px side panel in editor showing compact comment cards, "Submit N" button |
| `CommentPanel.vue` | Floating overlay for viewing and editing comments |
| `CommentCard.vue` | Individual comment display with reply/resolve/delete actions |
| `CommentInput.vue` | Input for adding and replying to comments |
| **panel/** | |
| `RightPanel.vue` | Tabbed panel: Outline / Terminal / Backlinks |
| `Backlinks.vue` | Backlinks panel: shows files linking to active file, click to navigate |
| `OutlinePanel.vue` | Document outline: headings for .md/.tex/.docx/.ipynb, click-to-navigate, cursor highlight |
| **shared/** | |
| `RichTextInput.vue` | Rich text input with @file mention support (used in chat input) |
| `FileRefPopover.vue` | @mention file search dropdown (fuzzy match against flatFiles) |

### Configuration & Hooks
| File | Purpose |
|---|---|
| `.claude/settings.json` | PreToolUse hook: intercept Edit/Write for review |
| `.claude/hooks/intercept-edits.sh` | Shell script: logs edits to pending-edits.json (non-blocking) |
| `.shoulders/system.md` | Internal AI system prompt (base role + tool instructions) |
| `_instructions.md` (root) | User-editable project instructions — hot-reloads, feeds all AI features |
| `~/.shoulders/keys.env` | Global API key storage (ANTHROPIC/OPENAI/GOOGLE). Workspace `.shoulders/.env` migrated on first load. |
| `.shoulders/models.json` | Model configs: 4 presets, provider URLs, key env mappings |
| `.shoulders/chats/` | Persisted chat sessions (one JSON per session) |
| `.shoulders/comments.json` | Persisted document comments (single file, all comments) |
| `.shoulders/pending-edits.json` | Edit review queue |
| `.shoulders/.direct-mode` | Flag file: when present, bypasses edit interception |
| `~/.shoulders/usage.db` | Global SQLite DB: per-call usage records + settings (cross-workspace) |

### Build & Config
| File | Purpose |
|---|---|
| `package.json` | bun deps: Vue 3, Pinia, CodeMirror 6, xterm.js, Tauri API/CLI |
| `vite.config.js` | Vite config: Vue plugin, port 1420, Tauri dev host |
| `tailwind.config.js` | Tailwind: Inter + JetBrains Mono fonts, dark mode class |
| `postcss.config.js` | PostCSS: tailwindcss + autoprefixer |
| `index.html` | HTML shell: Google Fonts links (Inter, JetBrains Mono) |
| `src/style.css` | Global CSS: Tailwind directives, 4 theme definitions (CSS vars), component styles |
| `src/themes/terminal.js` | xterm.js color objects per theme (hex values for canvas rendering) |
| `src/main.js` | Vue app creation with Pinia |
| `src/services/telemetry.js` | Client-side telemetry: opt-in, batched events, random device ID |

### Web Backend (`web/server/`)

#### Database & Infrastructure
| File | Purpose |
|---|---|
| `nuxt.config.js` | Runtime config (secrets, API keys), Tailwind module |
| `drizzle.config.js` | Schema path + SQLite location |
| `server/db/schema.js` | Tables: users, auth_tokens (legacy), verification_tokens, refresh_tokens, api_calls, contact_submissions, telemetry_events, processed_webhooks, reviews, deck_shares, deck_views, page_views |
| `server/db/index.js` | Drizzle singleton, better-sqlite3, WAL mode |
| `server/plugins/migrations.js` | Auto-create tables on startup (inline SQL fallback if no migrations dir) |
| `server/plugins/cleanup.js` | Periodic token cleanup: expired refresh tokens + old revoked tokens (every 24h) |
| `server/middleware/rateLimit.js` | In-memory rate limiting (30/min auth, 120/min proxy) |
| `server/middleware/01.auth.js` | JWT verification, suspended check (403), last_active_at tracking (5-min debounce) |
| `server/middleware/02.admin.js` | Admin cookie verification (protects all `/api/admin/*` except login) |

#### Server Utils
| File | Purpose |
|---|---|
| `server/utils/id.js` | `generateId()` — 16-char hex |
| `server/utils/auth.js` | JWT (jose HS256, 15-min access tokens), refresh token creation/rotation (90-day, SHA-256 hashed), argon2 password hashing |
| `server/utils/credits.js` | `calculateCredits()` + atomic `deductCredits()` |
| `server/utils/email.js` | Resend: verification + password reset emails (graceful no-op without API key) |
| `server/utils/providerProxy.js` | Provider URL routing, auth headers, usage extraction for billing |

#### API Endpoints
| File | Purpose |
|---|---|
| `server/api/health.get.js` | DB check + timestamp |
| `server/api/releases.get.js` | GitHub releases proxy (10min cache) |
| `server/api/v1/auth/signup.post.js` | Create account (email + password, 50 credits, sends verification email) |
| `server/api/v1/auth/login.post.js` | Authenticate → access JWT + refresh token |
| `server/api/v1/auth/delete-account.post.js` | User self-service account deletion |
| `server/api/v1/auth/refresh.post.js` | Rotate refresh token, issue new access JWT (theft detection via familyId) |
| `server/api/v1/auth/logout.post.js` | Revoke refresh token family |
| `server/api/v1/auth/sessions.get.js` | List active refresh token sessions |
| `server/api/v1/auth/sessions/[id].delete.js` | Revoke specific session |
| `server/api/v1/auth/desktop-code.post.js` | Store tokens for desktop polling (2-min TTL) |
| `server/api/v1/auth/desktop-poll.post.js` | Desktop polls for tokens by state |
| `server/api/v1/auth/exchange.post.js` | Exchange deep link code for tokens |
| `server/api/v1/auth/status.get.js` | Current user profile + credits (Bearer auth) |
| `server/api/v1/auth/verify.get.js` | Email verification link handler → redirects to `/login?verified=true` |
| `server/api/v1/auth/forgot.post.js` | Send password reset email (always returns success) |
| `server/api/v1/auth/reset.post.js` | Token + new password → reset |
| `server/api/v1/auth/change-password.post.js` | Authenticated password change (current + new) |
| `server/api/v1/proxy.post.js` | Core AI proxy: streaming + non-streaming, credit tracking |
| `server/api/v1/search.post.js` | Search proxy: OpenAlex academic search (1¢) + Exa web search (3¢) + Exa contents (1¢), credit deduction, usage logging |
| `server/api/v1/contact.post.js` | Enterprise form: stores in DB + emails notification to contact@shoulde.rs |
| `server/api/v1/telemetry/events.post.js` | Batch event ingestion (max 100) |
| `server/api/admin/login.post.js` | ADMIN_KEY → httpOnly JWT cookie (24h) |
| `server/api/admin/logout.post.js` | Clear admin cookie |
| `server/api/admin/stats.get.js` | Dashboard: users, calls, credits, DAU/WAU/MAU, contacts (undismissed), plan/provider breakdowns |
| `server/api/admin/users.get.js` | Paginated users (search, sort by created/active/credits, plan filter) |
| `server/api/admin/users.post.js` | Create user (email, password, plan, credits — pre-verified) |
| `server/api/admin/users.patch.js` | Edit user (plan, credits, verified, suspended, password reset) |
| `server/api/admin/users.delete.js` | Delete user + cascade (tokens, calls) |
| `server/api/admin/calls.get.js` | Paginated API calls (provider, status, userId, date range filters) |
| `server/api/admin/contacts.get.js` | Paginated contacts (dismissed filter, sort) |
| `server/api/admin/contacts.patch.js` | Toggle contact dismissed status |
| `server/api/admin/credits.post.js` | Add/remove credits for a user (admin action) |

### Web Frontend (`web/`)

#### Pages
| File | Purpose |
|---|---|
| `pages/index.vue` | Landing page: hero, social proof, feature pillars, comparison table, Newton quote, CTA |
| `pages/about.vue` | About page: AI manifesto, mission, get involved |
| `pages/pricing.vue` | Pricing: free vs subscription comparison |
| `pages/docs.vue` | Documentation: full-viewport sidebar+content layout, 14 sections (getting started, editor, AI, references, notebooks, files, version history, export, terminal, wiki links, edit review, customization, shortcuts, privacy). Query-param nav (`?section=id`), mobile-responsive |
| `pages/download.vue` | Download page with platform links, GitHub, legal agreement |
| `pages/enterprise.vue` | Organisation page: value props + contact form (→ `/api/v1/contact`) |
| `pages/terms.vue` | Terms of Service (16 sections) |
| `pages/privacy.vue` | Privacy Policy (11 sections, GDPR-compliant) |
| `pages/login.vue` | Sign in (stores auth via `useAuth()`, shows verified banner) |
| `pages/signup.vue` | Create account (→ `/verify-email` after signup) |
| `pages/verify-email.vue` | "Check your email" confirmation page |
| `pages/reset-password.vue` | Password reset form (?token=) |
| `pages/account.vue` | Account management: email, plan, credits, change password, sign out |
| `pages/admin/login.vue` | Admin key entry (standalone layout) |
| `pages/admin/index.vue` | Dashboard: stats, DAU/WAU/MAU, contact management (dismiss/restore/expand) |
| `pages/admin/users.vue` | User CRUD: create, edit (plan/credits/verified/password), suspend, delete. Sortable, filterable |
| `pages/admin/calls.vue` | API call log: provider/status/userId/date-range filters |

#### Layouts, Components, Composables
| File | Purpose |
|---|---|
| `layouts/default.vue` | Marketing: SiteHeader + slot + SiteFooter |
| `layouts/auth.vue` | Centered card: Shoulders logo + slot |
| `layouts/admin.vue` | Admin: sticky nav (Dashboard/Users/Calls) + slot |
| `components/SiteHeader.vue` | Marketing header: nav links + download button (ClientOnly auth link to avoid SSR hydration mismatch) |
| `components/SiteFooter.vue` | Marketing footer: 4-column grid + Newton quote |
| `components/DownloadButton.vue` | OS-detecting download CTA |
| `components/docs/Sidebar.vue` | Docs sidebar: grouped nav (5 groups), active state, mobile slide-in |
| `components/docs/Search.vue` | Client-side fuzzy search for documentation using fuse.js |
| `components/docs/Callout.vue` | Docs callout boxes: note/tip/warning with Tabler icons |
| `components/docs/*.vue` | 14 section components: GettingStarted, Editor, AiFeatures, References, CodeNotebooks, FilesNavigation, VersionHistory, ExportPdf, Terminal, WikiLinks, EditReview, Customization, KeyboardShortcuts, Privacy |
| `composables/useAuth.js` | Client-side auth state: localStorage-backed, setAuth/clearAuth, authedFetch (auto-refresh), session management |
| `scripts/generate-search.js` | Manual Node.js script to parse docs and generate `search-index.json` |

#### Auth Flow
1. Signup → account created + access JWT (15 min) + refresh token (90 days) returned + verification email sent → redirect to `/verify-email`
2. User clicks email link → `verify.get.js` marks `email_verified=1` → redirect to `/login?verified=true`
3. Login → both tokens stored via `useAuth()` → redirect to `/account`
4. `authedFetch()` auto-refreshes access token when expired (transparent to caller)
5. Desktop app: opens browser to `/auth/desktop-onboard` (signup-first) → user creates account (6-digit code verification) or signs in → desktop polls for tokens → stores in OS keychain
6. See [auth-system.md](auth-system.md) for full details

#### Deployment
| File | Purpose |
|---|---|
| `deploy/shoulders-web.service` | Systemd unit |
| `deploy/Caddyfile` | `shoulde.rs { reverse_proxy localhost:3000 }` |
| `deploy/backup.sh` | Daily SQLite backup, 30-day retention |
| `.github/workflows/deploy-web.yml` | Auto-deploy on push to main (web/** paths) |
