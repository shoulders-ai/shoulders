# AI System

Three AI features:
1. **AI Chat** — multi-provider streaming chat with tool execution (Anthropic/OpenAI/Google)
2. **Ghost Suggestions** — inline completions via Anthropic Haiku
3. **Task Threads** — spatially-anchored multi-turn AI conversations on selected text

All proxied through Rust to avoid CORS. All gated by the monthly budget — at 100% of the limit, every AI call site returns early (chat/tasks push a synthetic error message, ghost suggestions silently skip, reference AI returns null, DOCX AI throws). See [usage-system.md](usage-system.md).

## Relevant Files

| File | Role |
|---|---|
| **Chat** | |
| `src/stores/chat.js` | Chat store: sessions, streaming orchestration, persistence |
| `src/services/chatTools.js` | Tool definitions (28 tools) + categories + permission filtering + execution |
| `src/services/chatMessages.js` | API message array building + file-ref dedup |
| `src/services/apiClient.js` | Unified API routing: `resolveApiAccess()` (3 strategies), `callModel()` (non-streaming), `SHOULDERS_PROXY_URL` |
| `src/services/chatModels.js` | Context window sizes, model access checks, thinking config detection |
| `src/services/chatProvider.js` | Multi-provider SSE adapter: format request (streaming + non-streaming), parse chunks, interpret events |
| `src-tauri/src/chat.rs` | Rust streaming proxy: tokio + reqwest + Tauri events |
| `src/components/right/ChatSession.vue` | Per-session message list |
| `src/components/right/ChatMessage.vue` | Message renderer (markdown via marked+DOMPurify, tool cards, context cards) |
| `src/utils/chatMarkdown.js` | Shared markdown rendering pipeline: `renderMarkdown()`, tool labels/icons/context |
| `src/components/right/ChatInput.vue` | Input area: textarea, model picker, @file refs |
| `src/components/right/FileRefPopover.vue` | @mention file search |
| **Ghost Suggestions** | |
| `src/services/ai.js` | Ghost suggestions: multi-provider (Haiku → Gemini → GPT-5 Nano → Shoulders), tool_choice, prefix/suffix grounding |
| `src/editor/ghostSuggestion.js` | Ghost text CodeMirror extension |
| `src/editor/docxGhost.js` | Ghost text SuperDoc extension (standalone run insertion) |
| **Task Threads** | |
| `src/stores/tasks.js` | Task store: threads, streaming, persistence, apply edits |
| `src/editor/tasks.js` | Task gutter markers + range underlines + position mapping |
| `src/components/right/TaskThreads.vue` | Two-mode panel: thread list / thread detail |
| `src/components/right/TaskThread.vue` | Full conversation view with Apply/Resolve |
| `src/components/right/TaskInput.vue` | Simplified chat input with @file refs + model picker |
| **Dynamic Context** | |
| `src/services/workspaceMeta.js` | Builds `<workspace-meta>` block (open tabs, git diff) |
| `src/services/tokenEstimator.js` | Token estimation + sliding-window truncation |
| `src/components/right/ToolCallLine.vue` | Shared tool call rendering: status dot + icon + label + context + expandable detail |
| **Shared** | |
| `src/services/systemPrompt.js` | Shared base system prompt builder (`buildBaseSystemPrompt()`). Chat + tasks share persona, tool guidance, writing rules |
| `src/stores/workspace.js` | API keys, system prompt, user instructions, models config, skills manifest |
| `src/services/apiClient.js` | Unified routing + auth + non-streaming transport (used by all AI features) |
| `src/services/chatProvider.js` | Format conversion + SSE parsing (streaming: chat/tasks, non-streaming: ghost/refAi/docx) |
| `src/services/chatModels.js` | Context window sizes, thinking config (used by chat + tasks for token budgeting + thinking) |
| `src-tauri/src/chat.rs` | Streaming proxy (used for both chat sessions AND task threads) |
| `src-tauri/src/fs_commands.rs` | `proxy_api_call()` - Rust HTTP proxy (non-streaming AI calls) |

## AI Chat System

### Architecture
```
User types → ChatInput.vue → chatStore.sendMessage()
  → await buildApiMessages() [async: workspaceMeta + chatMessages.js, file-ref dedup]
  → estimateConversationTokens() → truncateToFitBudget() if over budget
  → formatRequest() [chatProvider.js, multi-provider]
  → invoke('chat_stream', { sessionId, request })
  → Rust chat.rs: tokio::spawn → reqwest streaming → app.emit('chat-chunk-{id}')
  → Frontend: listen() → parseSSEChunk() → interpretEvent() → update reactive message
  → If stop_reason=tool_use → executeToolCalls → executeSingleTool → re-stream
  → If stop_reason=end_turn → saveSession → idle
```

### Rust Streaming Proxy (`chat.rs`)

Three commands:
- `chat_stream(session_id, request)` — spawns tokio task, streams SSE via reqwest, emits `chat-chunk-{id}` events
- `chat_abort(session_id)` — cancels via `watch::channel`
- `chat_cleanup(session_id)` — removes session from HashMap

State: `ChatState { sessions: Mutex<HashMap<String, ChatSession>> }` where `ChatSession { cancel_tx }`.

Events emitted: `chat-chunk-{sessionId}` (raw SSE data), `chat-done-{sessionId}`, `chat-error-{sessionId}`.

Uses `tokio::select!` on stream chunk vs cancel_rx for abort. 5-minute timeout.

### Anthropic API Message Array Format (NON-OBVIOUS)

The Anthropic Messages API is **strict** about field validation. Extra fields cause 400 errors.

**Allowed fields per block type:**

| Block Type | Required Fields | Optional Fields |
|---|---|---|
| `tool_result` | `type`, `tool_use_id` | `content` (string or content blocks), `is_error` (bool) |
| `tool_use` | `type`, `id`, `name`, `input` | (none) |
| `text` | `type`, `text` | (none) |

**NEVER add custom fields** (e.g. `_toolName`) to these blocks — the API rejects them.

**Message alternation rule:** Messages must alternate `user` → `assistant` → `user`. Tool results go in `user` messages as content blocks:

```javascript
// After assistant requests tools:
{ role: 'assistant', content: [
    { type: 'text', text: 'Let me check...' },
    { type: 'tool_use', id: 'toolu_123', name: 'read_file', input: { path: 'foo.md' } }
]}
// Tool results sent as user message:
{ role: 'user', content: [
    { type: 'tool_result', tool_use_id: 'toolu_123', content: 'file contents here' }
]}
```

### Tool Execution Loop

28 tools defined in `chatTools.js`, organized into 6 categories:

| Category | Tools | External? |
|---|---|---|
| **Workspace** (11) | `run_command`, `read_file`, `write_file`, `edit_file`, `list_files`, `search_content`, `create_file`, `rename_file`, `move_file`, `duplicate_file`, `delete_file` | All local |
| **References** (5) | `search_references`, `get_reference`, `add_reference`, `cite_reference`, `edit_reference` | `add_reference` → CrossRef |
| **Feedback** (3) | `add_task`, `read_tasks`, `create_proposal` | All local |
| **Notebooks** (6) | `read_notebook`, `edit_cell`, `run_cell`, `run_all_cells`, `add_cell`, `delete_cell` | All local |
| **Web Research** (3) | `web_search`, `search_papers`, `fetch_url` | OpenAlex + Exa |

`write_file` and `edit_file` have review integration (pending edits + merge view). `web_search` and `fetch_url` are always included in tool definitions — when called without an Exa API key (`EXA_API_KEY` in `~/.shoulders/keys.env`) or Shoulders account, they return a guidance message telling the AI how the user can enable them. `search_papers` uses a three-tier fallback chain: **OpenAlex** (primary, 450M+ works, structured metadata) → **Exa** (semantic search fallback) → **CrossRef** (keyword search, last resort). OpenAlex requires an API key (`OPENALEX_API_KEY` in `~/.shoulders/keys.env`) or Shoulders account. `fetch_url` falls back to direct Rust HTTP fetch.

### Academic Paper Search (`search_papers`)

Three-tier fallback chain: **OpenAlex → Exa → CrossRef**.

| Tier | Backend | What it provides | Access required |
|---|---|---|---|
| Primary | **OpenAlex** (450M+ works) | Structured metadata: title, authors, year, DOI, citation count, type, journal, abstract, OA status/URL, volume/issue/pages | `OPENALEX_API_KEY` in `~/.shoulders/keys.env` or Shoulders account |
| Fallback 1 | **Exa** (semantic search) | Neural search results with AI summaries, URLs | `EXA_API_KEY` or Shoulders account |
| Fallback 2 | **CrossRef** (keyword search) | Basic metadata: title, authors, year, DOI, abstract | None (free, always available) |

**Result slimming:** OpenAlex returns ~150 lines of JSON per work (institution hierarchies, ORCIDs, lineage arrays, ROR IDs). `slimWork()` in `openalex.js` extracts only the fields useful for discovery (~15 lines): title, author names, year, DOI, citation count, type, journal, abstract (300 chars), OA status/URL, volume/issue/pages. Abstract is reconstructed from OpenAlex's inverted index format.

**Error propagation:** Errors accumulate across tiers. When results come from a fallback backend, a bracketed note is prepended (e.g., `[Note: OpenAlex failed (...). Results from Exa semantic search — citation counts unavailable.]`). If all three fail, the AI gets a structured error listing each failure with actionable suggestions.

**Access resolution** (`_resolveOpenAlexAccess` in `chatTools.js`): Direct API key → Shoulders proxy → `null` (skip to next tier). Same pattern as `_resolveSearchAccess` for Exa.

**Key files:**

| File | Role |
|---|---|
| `src/services/openalex.js` | `searchWorks()`, `slimResults()`, `reconstructAbstract()`, `openalexToCsl()` |
| `src/services/chatTools.js` | `_resolveOpenAlexAccess()`, `_callOpenAlex()`, `search_papers` case |
| `web/server/api/v1/search.post.js` | `openalex_search` action (1¢/search via Shoulders proxy) |
| `src/components/settings/SettingsTools.vue` | `OPENALEX_API_KEY` input field |

**Configuration:** API key stored in `~/.shoulders/keys.env` as `OPENALEX_API_KEY=...`. Free tier (~1000 searches/day) available at [openalex.org](https://openalex.org). Server-side key in `OPENALEX_API_KEY` env var (already in `nuxt.config.js` runtime config). Rust allowlist: `api.openalex.org` in `fs_commands.rs:ALLOWED_HOSTS`.

### Tool Permission System

Users can enable/disable individual tools in Settings > Tools. Data model:

- **File**: `.shoulders/tools.json` — `{ version: 1, disabled: ["tool_name", ...] }`
- **Store**: `workspace.disabledTools` (array, loaded at startup)
- **Deny-list**: Only disabled tool names stored. New tools default to enabled.

Two layers of enforcement:
1. **Definition filtering**: `getToolDefinitions(workspace)` removes disabled tools from the array sent to the AI model — the model never sees them.
2. **Execution guard**: `executeSingleTool()` rejects disabled tools at the top of the function — safety net in case of unexpected invocation.

`TOOL_CATEGORIES` (exported from `chatTools.js`) defines the UI structure: categories, subgroups, tool metadata (name, description, external badge). `EXTERNAL_TOOLS` lists the 4 tools that transmit data to third-party services (`web_search`, `search_papers`, `fetch_url`, `add_reference`). The Settings UI has a one-click "Disable all external tools" button.

Category collapse state is in `localStorage` (UI preference, not project config).

### Workspace Path Sandboxing

All file-based AI tools (`read_file`, `write_file`, `edit_file`, `list_files`, `search_content`, `create_file`, `rename_file`, `move_file`, `duplicate_file`, `delete_file`) are restricted to the workspace directory. `resolvePath()` in `chatTools.js` normalizes paths (resolving `..` segments) and rejects any path outside `workspace.path` — returns `null`, which produces a user-visible error.

**Exception:** `run_command` is **not sandboxed** — it passes raw strings to `bash -c`. The AI can still access the filesystem via shell commands. This is intentional (same model as Claude Code) and documented in Settings > Tools with an "unsandboxed" badge. Users can disable `run_command` entirely via the tool permission toggle.

**Note:** The Rust file commands (`fs_commands.rs`) remain unrestricted — they serve the file tree, settings, and global config which legitimately need access outside the workspace.

**Review integration (critical timing):** When `edit_file` or `write_file` executes:
1. Write new content to disk
2. Update `filesStore.fileContents[path]` with new content (MUST happen before step 3)
3. Open file in editor via `editorStore.openFile(path)`
4. Record pending edit in `reviews.pendingEdits`
5. Save pending edits to disk

**Why step 2 must precede step 4:** The `MarkdownEditor` watcher on `reviews.editsForFile` calls `showMergeViewIfNeeded()`, which compares `view.state.doc` (editor content) against `edit.old_content`. If the editor still has old content (file watcher has 300ms debounce), `original === currentContent` and the merge view is suppressed. Updating `filesStore.fileContents` first triggers the editor content watcher, which updates CodeMirror synchronously.

### Multi-Provider Support

Configured in `.shoulders/models.json` + `~/.shoulders/keys.env`:
```json
{
  "models": [
    { "id": "sonnet", "name": "Sonnet 4.6", "provider": "anthropic", "model": "claude-sonnet-4-6" },
    { "id": "haiku", "name": "Haiku 4.5", "provider": "anthropic", "model": "claude-haiku-4-5-20251001" },
    { "id": "gemini-3.1-pro-fast", "name": "Gemini 3.1 Pro (Low)", "provider": "google", "model": "gemini-3.1-pro-preview", "thinking": "low" },
    { "id": "gemini-3.1-pro-deep", "name": "Gemini 3.1 Pro (High)", "provider": "google", "model": "gemini-3.1-pro-preview", "thinking": "high" },
    { "id": "gemini-flash", "name": "Gemini 3 Flash", "provider": "google", "model": "gemini-3-flash-preview", "thinking": "medium" }
  ],
  "providers": {
    "anthropic": { "url": "https://api.anthropic.com/v1/messages", "apiKeyEnv": "ANTHROPIC_API_KEY" },
    "openai": { "url": "https://api.openai.com/v1/responses", "apiKeyEnv": "OPENAI_API_KEY" },
    "google": { "url": "https://generativelanguage.googleapis.com/v1beta/models", "apiKeyEnv": "GOOGLE_API_KEY" }
  }
}
```

`chatProvider.js` handles format differences:
- **Anthropic**: `content_block_delta` events, `messages` array, tools with `input_schema`
- **OpenAI (streaming)**: Responses API (`/v1/responses`) — `response.output_text.delta` events, `input` array, flat tool format, native `reasoning` param
- **OpenAI (non-streaming)**: Chat Completions (`/v1/chat/completions`) — `choices[0].delta`, `messages` array, nested tool format (ghost suggestions only)
- **Google**: `candidates[0].content.parts`
- **Shoulders proxy**: Client sends Anthropic format → `providerProxy.js` translates request to upstream format (Chat Completions for OpenAI, Gemini for Google) → translates streaming response back to Anthropic SSE events. Client interprets as Anthropic. Critical translation rules:
  - Tool calls: must emit `input_json_delta` + `content_block_stop` (client parses JSON on `block_stop`)
  - Google tool calls: args arrive complete (not streamed) — emit full JSON as single `input_json_delta`
  - Google stop reason: detect function calls in chunk → `tool_use`, not `end_turn` (Google always sends `STOP`)
  - Google `thoughtSignature`: round-trip through `_googleThoughtSignature` field on `content_block_start` → tool call → back to Google
  - `body.system`: handle both string and Anthropic array `[{type:'text', text:'...'}]`
  - `_googleThoughtSignature`: strip before forwarding to Anthropic (rejects extra fields)

New sessions inherit the last-selected model via `localStorage('lastModelId')`, falling back to `models.json`'s `default` field; reopened sessions restore the model they were saved with.

### Extended Thinking

Capable models get thinking/reasoning automatically — no user toggle needed. `getThinkingConfig()` in `chatModels.js` detects model capability and returns the appropriate config:

| Provider | Models | Mode | Config |
|---|---|---|---|
| Anthropic/Shoulders | Claude Opus/Sonnet 4.6 | `adaptive` | `effort` from model entry (default `'medium'`) |
| Anthropic/Shoulders | Claude Opus/Sonnet 4.x | `manual` | `budget_tokens: 10000` |
| OpenAI | GPT-5, o-series | `openai` | `reasoning_effort` (default `'medium'`) |
| Google | Gemini 3.x, 2.5 (non-lite) | `google` | `thinkingLevel` from model entry (default `'high'`) |

**Opt-out:** Set `"thinking": "none"` on a model entry in `models.json` to disable thinking for that entry. Haiku models return `null` (no thinking — speed-critical).

**Google dual-entry pattern:** Google thinking levels have significant latency/cost impact, so the default config provides two entries per model (e.g., "Gemini 3.1 Pro (Low)" and "Gemini 3.1 Pro (High)"). Anthropic uses adaptive mode which handles this automatically.

**Streaming:** Thinking blocks stream as `thinking_delta` events (Anthropic) or `thought: true` parts (Google). Anthropic also sends `signature_delta` for thinking block signatures. Both `chat.js` and `tasks.js` accumulate thinking text into `assistantMsg.thinking` (displayed in UI) and structured `_thinkingBlocks` array (sent back to API on subsequent turns).

**Token budget:** When thinking is active, output reserve increases from 16384 to 32768 tokens.

### API Client Architecture (`apiClient.js`)

All AI features share a single routing + auth layer in `apiClient.js`. Two key functions:

**`resolveApiAccess(options, workspace)`** — returns `{ model, provider, apiKey, url, providerHint? }` or `null`.

Three strategies:

| Caller | Usage | Fallback chain |
|---|---|---|
| Ghost | `{ strategy: 'ghost' }` | Anthropic Haiku → Google Flash Lite → OpenAI GPT-5 Nano → Shoulders proxy (Haiku) |
| Chat/Tasks/Docx | `{ modelId: 'sonnet' }` | models.json lookup → Shoulders proxy |
| RefAi | `{ strategy: 'cheapest' }` | Google Flash Lite → Anthropic Haiku → OpenAI GPT-5 Nano → Shoulders proxy (Flash Lite) |

`url` is always fully resolved. The Shoulders proxy URL is `SHOULDERS_PROXY_URL` (single source of truth, `localhost:3000` in dev, `shoulde.rs` in prod). When falling back to the Shoulders proxy, `resolveApiAccess()` calls `workspace.ensureFreshToken()` to auto-refresh expired JWTs (15-min access tokens) before returning the access object.

**`callModel({ access, system, messages, tools, toolChoice, maxTokens })`** — non-streaming call via `chatProvider.formatNonStreamingRequest()` + `invoke('proxy_api_call')`. Returns `{ text, rawResponse, rawUsage }`.

**Callers:**
- Ghost (`ai.js`) and RefAi (`refAi.js`) use `callModel()` for non-streaming
- Chat (`chat.js`) and Tasks (`tasks.js`) use `resolveApiAccess()` then `formatRequest()` from chatProvider for streaming
- DocxProvider (`docxProvider.js`) uses `callModel()` for non-streaming, `resolveApiAccess()` + `formatRequest()` for streaming

### Session Persistence

- Sessions saved to `.shoulders/chats/{id}.json` after each completed turn
- `loadSessions()` clears `this.sessions = []` first (prevents HMR duplication), scans chats dir
- `closeSession(id)` removes from memory but keeps file on disk
- `reopenSession(id)` loads from disk back into memory
- `allSessionsMeta` tracks all persisted sessions (lightweight: id, label, updatedAt, messageCount)
- History dropdown shows only closed sessions, refreshes meta on open

### Chat UI Design (`ChatMessage.vue` + `chatMarkdown.js`)

Design philosophy: calm and minimal surface, technical depth on click. No role labels — message shape IS the differentiator.

**User messages**: Right-aligned bubble (`--bg-tertiary`, rounded, `max-width: 85%`, `w-fit`). Long messages (>5 lines or >300 chars) are line-clamped with "show more"/"show less" toggle. Code blocks blend into the bubble (no border/bg, just monospace). Below the bubble: **context cards** — small pill-shaped chips showing attached file refs (document icon + filename, clickable → opens file) and selection context (code brackets icon + truncated text, clickable → opens source file).

**Assistant messages**: Full-width, document-style, no background. Proper markdown rendering via `marked` + `DOMPurify` (lists, headings, tables, blockquotes, links, code blocks with language label). Copy button appears top-right on hover.

**Markdown rendering** (`src/utils/chatMarkdown.js`): Shared pipeline used by both `ChatMessage.vue` and `TaskThread.vue`. Strips `<file-ref>`, `<context>`, `<selection>` XML tags → `marked.parse()` with custom renderer (code blocks get language label, links get `target="_blank"`) → `DOMPurify.sanitize()`. Styles scoped under `.chat-md` class in `components.css` (Tailwind preflight resets list-style, so `disc`/`decimal` are explicitly restored).

**Streaming indicator**: Three pulsing dots (staggered animation), only shown while waiting for the first content token (`status === 'streaming' && !content`). Disappears once text starts flowing.

**Thinking blocks**: Unified collapsible section. During streaming — "Thinking..." with animated dots, collapsed by default (click to expand live text). After completion — "Thought process" label, still collapsed. Thinking blocks (`_thinkingBlocks` array) are stored on the message object and sent back to the API on subsequent turns (Anthropic requires them for conversation continuity). OpenAI/Google filter them out in `_convertToOpenAIMessages`/`_convertToGoogleContents` (they only match `type: 'text'` and `type: 'tool_use'`).

**Tool calls**: Compact 28px one-liner with contextual icon + human label + file/command context. No status indicator on success (expected state). Running: small pulsing accent dot on the left. Error: red dot on the left. Click expands to bordered detail panel with Input/Output `<pre>` blocks (grid-row transition).

Tool icons: `read_file` → eye, `edit_file` → pencil, `write_file` → file-plus, `list_files` → folder, `run_command` → terminal, `search_content` → magnifying glass, reference tools → open book.

**Turn spacing**: `ChatSession.vue` computes `prevRole` per message. 16px gap at role changes, 8px between same-role messages.

**Empty state**: "New conversation" greeting + context-aware suggestion chips (e.g., "Summarize this document" if markdown file open, "Explain this code" if code file). Chips dispatch `chat-set-input` event to pre-fill the input.

**Dependencies**: `marked` (~37KB, synchronous) + `dompurify` (~7KB) in `package.json`.

### @File References (`ChatInput.vue` + `FileRefPopover.vue`)

User types `@` in the chat textarea → popover appears with file list. Typing after `@` filters inline (no separate search input). Enter/Tab confirms, Escape dismisses, Arrow keys navigate. On selection, `@filter` text is removed and a file chip appears above the textarea. File content loaded via `invoke('read_file')`, truncated at 50KB.

**Teleport requirement:** Both the file popover and model picker dropdown are Teleported to `<body>` with `position: fixed`. RightPanel has nested `overflow-hidden` containers (lines 35 and 160) that clip any absolutely-positioned children. See [ui-layout.md](ui-layout.md) for layout details.

### Editor Context in API Messages

When the user sends a selection to chat (via `Cmd+Shift+L` or right-click "Ask AI"), the context block in the API message includes surrounding text:

```xml
<context file="path/to/file.md">
<before>...~200 chars before selection...</before>
<selected>the selected text</selected>
<after>...~200 chars after selection...</after>
</context>
```

When no surrounding context is available (e.g., legacy persisted sessions), it falls back to the original format:

```xml
<context file="path/to/file.md" selection="true">
selected text
</context>
```

### File-Ref Deduplication (`chatMessages.js`)

When the same file is @-referenced in multiple messages, only the latest occurrence includes the full content. Earlier occurrences are **skipped entirely** (no placeholder text, no `<file-ref>` block emitted). This saves tokens versus the previous `[Content removed...]` approach.

### Pinia Reactivity Gotcha

After `session.messages.push(newMsg)`, the local `newMsg` variable is the **raw unwrapped object**. Pinia wraps the pushed object in a reactive Proxy inside the array. All mutations to the local ref are invisible to Vue. **Fix:** re-acquire via `session.messages[session.messages.length - 1]`. Same applies to `toolCalls.push()`.

---

## API Proxy (CORS Workaround)

The Tauri webview cannot call `api.anthropic.com` directly (CORS blocks it). All API calls go through:

```
Frontend ai.js → invoke('proxy_api_call', {url, method, headers, body})
→ Rust reqwest client → api.anthropic.com → response text
→ Frontend JSON.parse()
```

The Rust `proxy_api_call` command (`fs_commands.rs:198-225`) accepts `ApiProxyRequest`:
- `url: String` - full API URL
- `method: String` - "POST", "GET", or "PUT"
- `headers: HashMap<String, String>` - includes `x-api-key`, `anthropic-version`, `content-type`
- `body: String` - JSON-stringified request body

Returns the response body as a string. Errors if status is outside 200-299.

## API Configuration

- **API Key**: Stored in `~/.shoulders/keys.env` as `ANTHROPIC_API_KEY=sk-...` (global, shared across workspaces). Loaded by `workspace.loadSettings()` on workspace open. Available as `workspace.apiKeys`. Legacy workspace `.shoulders/.env` is auto-migrated on first load.
- **System Prompt**: Stored in `.shoulders/system.md`. Internal base prompt (role + tool instructions). Loaded by `workspace.loadSettings()`. Available as `workspace.systemPrompt`.
- **User Instructions**: Stored in `_instructions.md` at workspace root. User-editable project instructions. Loaded by `workspace.loadInstructions()`, hot-reloads via file watcher. HTML comment lines (`<!-- ... -->`) stripped before injection. Available as `workspace.instructions`. Feeds all three AI features (chat, tasks, ghost).
- **Model**: Resolved by `apiClient.resolveApiAccess({ strategy: 'ghost' })` — Haiku → Gemini Flash Lite → GPT-5 Nano → Shoulders proxy

## Dynamic AI Context System

Three layers of context are assembled for every AI request:

### 1. System Prompt (stable — Anthropic caching friendly)

Built in `chat.js:_streamResponse()` and `tasks.js:_streamResponse()`:
```
[Base role text]
+ workspace.systemPrompt       (.shoulders/system.md — internal base prompt)
+ workspace.instructions       (_instructions.md at workspace root — user-editable, hot-reloads)
```

The system prompt is **stable across turns** so Anthropic can cache it. Dynamic info goes in user messages instead.

**Prompt caching (Anthropic/Shoulders):** The system prompt is sent as an array with explicit `cache_control: { type: 'ephemeral' }` on the text block. A top-level `cache_control: { type: 'ephemeral' }` auto-caches the growing conversation. On the second message in a session, the system prompt tokens appear as `cache_read_input_tokens` instead of `input_tokens` (~90% cost reduction). OpenAI and Google cache automatically — no format changes needed.

### 2. Workspace Meta (dynamic — injected into first user message)

Built by `workspaceMeta.js:buildWorkspaceMeta()`, prepended to the first user message content by `chatMessages.js:buildApiMessages()`. Both chat and tasks use this.

Contains:
- **Open tabs** (relative paths)
- **Active tab** (relative path)
- **Git branch** name
- **Recent changes** — abbreviated `git diff` (stat + per-file hunks)

Git strategy: tries `git diff` (uncommitted changes since last auto-commit), falls back to `git diff HEAD~1` (just after auto-commit). Capped at 5 files, 20 lines per file.

Example output:
```xml
<workspace-meta>
This is auto-generated workspace context. It may or may not be relevant to the user's query.

Open tabs: chapter-3.md, notes/ideas.md
Active tab: chapter-3.md

Branch: main

Recent changes:
 chapter-3.md | 12 ++++++------
 1 file changed, 6 insertions(+), 6 deletions(-)

--- chapter-3.md
@@ -42,4 +42,4 @@
 The results suggest that
-the hypothesis was partially confirmed
+the hypothesis was strongly supported by the data
</workspace-meta>
```

### 3. User Instructions (`_instructions.md`)

`_instructions.md` lives at the workspace root (visible in file tree, sparkles icon). Created on first workspace open with an HTML-comment template. Users edit it like any other markdown file.

HTML comment lines (`<!-- ... -->`) are stripped before injection — they serve as template hints visible in the editor but invisible to the AI. The file hot-reloads: editing and saving immediately updates `workspace.instructions` via the file watcher (`fs-change` event). No restart or settings save needed.

Appended to the system prompt after `system.md`. Use cases: writing style, domain context, terminology, persona instructions, project-specific rules.

Accessible from the model picker dropdown in the chat input (divider + "Instructions" entry). If the user deletes the file, AI features work normally with no custom instructions. Clicking the Instructions entry recreates it with the default template.

Replaces the legacy `.shoulders/AGENTS.md` (content is auto-migrated on first open).

### Token Budget

`tokenEstimator.js` provides:
- `estimateTokens(text)` — ~4 chars/token heuristic
- `estimateConversationTokens(system, apiMessages)` — total estimate across all messages
- `truncateToFitBudget(apiMessages, maxTokens, system)` — sliding-window: keeps first message (has workspace meta) + removes from the middle until under budget

`chatModels.js:getContextWindow(modelId, workspace)` returns the context window size from `models.json` (fallback 200000).

`chatModels.js:getThinkingConfig(apiModel, provider, thinkingLevel)` returns thinking configuration for capable models. Returns `null` for Haiku and unsupported models. Supports `thinkingLevel: 'none'` opt-out from model config.

In both `chat.js` and `tasks.js`, after building messages:
1. Resolve thinking config via `getThinkingConfig()` (reads `modelEntry?.thinking` from models.json)
2. Estimate total tokens
3. If over `contextWindow - outputReserve` (16384 normally, 32768 with thinking): truncate
4. Store estimate on session/thread as `_estimatedTokens` (runtime-only, not persisted)

`ChatInput.vue` displays the token count next to the model picker:
- Format: `2.1k`, `45.3k`, etc.
- Color: `--fg-muted` normally, `--error` when >80% of context window

### File-Ref Deduplication (Clean)

When the same file is @-referenced in multiple messages, only the **latest** occurrence includes content. Earlier occurrences are **skipped entirely** (no placeholder text). This saves tokens compared to the previous `[Content removed...]` approach.

## Ghost Suggestions

### Enable/Disable

Ghost suggestions can be toggled in Settings > Environment. State is `workspace.ghostEnabled` (persisted in localStorage, default `true`). When disabled, `++` types normally. The check happens at trigger time via an `isEnabled` callback — no editor restart needed.

### Trigger Mechanism
The `++` trigger uses a 300ms double-tap detection (only when enabled):
1. User types `+` → record timestamp
2. User types `+` again within 300ms → double-plus detected
3. Prevent the second `+` from inserting
4. Delete the first `+` that was already inserted
5. Trigger API call from the cursor position

### State Machine
The ghost system has a `StateField` with these states:
```
IDLE → (++ trigger) → LOADING → (API returns) → ACTIVE → (accept/dismiss) → IDLE
                         ↓                          ↓
                   (any key/click)            (any key/click/Esc)
                         ↓                          ↓
                        IDLE                       IDLE
```

Ghost state fields (CodeMirror):
- `active: boolean` - suggestions are showing
- `loading: boolean` - API call in flight
- `suggestions: string[]` - 3-5 completion strings
- `activeIndex: number` - which suggestion is displayed
- `pos: number` - document position where the ghost text appears

Ghost state fields (DOCX / SuperDoc):
- `type: null | 'loading' | 'suggestion'`
- `suggestions: string[]`, `activeIndex: number`
- No position tracked — ghost text found by scanning for `textStyle` mark with color `#B0B0B0`

### Generation Counter
A module-level `currentGeneration` counter prevents stale API responses from appearing. Each trigger increments it; when the API response arrives, it checks if the generation still matches. This handles rapid re-triggers gracefully.

### Key Bindings (when ghost is active)
| Key | Action |
|---|---|
| Tab, Enter, ArrowRight | Accept current suggestion (insert text) |
| ArrowUp | Cycle to previous suggestion |
| ArrowDown | Cycle to next suggestion |
| Escape, ArrowLeft | Dismiss ghost |
| Any other key | Dismiss ghost, let the key through |
| Mouse click | Dismiss ghost |

### Accept Behavior
When accepted, the suggestion text is inserted at `pos`. The cursor is placed at the end of the **trimmed** text (not trailing whitespace). A `ghostAcceptAnnotation` marks the transaction so the state field doesn't treat it as "user edited, dismiss ghost".

### API Call Structure
Uses `tool_choice: { type: 'tool', name: 'suggest_completions' }` to force structured output:
```json
{
  "model": "claude-haiku-4-5-20251001",
  "max_tokens": 1024,
  "system": "<role prompt + system.md + _instructions.md>",
  "tools": [{
    "name": "suggest_completions",
    "input_schema": {
      "type": "object",
      "properties": {
        "prefix_end": { "type": "string", "description": "Last 20 chars of prefix" },
        "suffix_start": { "type": "string", "description": "First 20 chars of suffix, or EMPTY" },
        "suggestions": {
          "type": "array", "items": {"type": "string"},
          "minItems": 3, "maxItems": 5
        }
      },
      "required": ["prefix_end", "suffix_start", "suggestions"]
    }
  }],
  "tool_choice": {"type": "tool", "name": "suggest_completions"},
  "messages": [{"role": "user", "content": "<prefix>...<cursor/>...<suffix>"}]
}
```

**Context**: Up to 5000 chars before cursor, 1000 after. Smart word-boundary truncation with `[…]` markers prevents the LLM from completing truncation-boundary fragments.

**Grounding fields**: `prefix_end` and `suffix_start` force the LLM to read context boundaries before generating — prevents suffix-completion errors.

**User message format**: XML tags `<prefix>`, `<suffix>`, `<cursor/>` (Anthropic models handle XML structure better than text markers).

### Visual Rendering (CodeMirror)
- **Loading**: Animated dots (`SpinnerWidget`) at cursor position
- **Active**: Ghost text in muted italic + a badge showing `1/3`, `2/3`, etc. (`GhostTextWidget`)
- Both use `Decoration.widget` with `side: 1` (after the position)

### Visual Rendering (DOCX / SuperDoc)
- **Loading**: Floating dot overlay at caret position (Vue template in DocxEditor)
- **Active**: Ghost text as inline content in a standalone run with `runProperties.color = B0B0B0`
- Ghost run is created by splitting the ancestor run — see [ghost-work.md](ghost-work.md)

## Task Thread System

A task thread is a spatially-anchored multi-turn AI conversation attached to a text selection. The selected text provides context; the AI can respond with analysis, suggestions, and propose edits via a `propose_edit` tool.

**Core insight:** A task thread IS a streaming session. It reuses `chat.rs` directly (thread ID = session ID for `chat_stream`), plus `chatProvider.js` and `chatModels.js`. No dedicated Rust code needed.

### Flow
```
User selects text → Cmd+Shift+C
  → App.vue:startTask()
  → tasksStore.createThread(fileId, range, selectedText)
  → Right panel opens to Tasks tab, input focused
  → User types message + Enter
  → tasksStore.sendMessage(threadId, { text, fileRefs })
  → _buildApiMessages() [selection context in first msg]
  → formatRequest() [chatProvider.js, multi-provider]
  → invoke('chat_stream', { sessionId: threadId, request })
  → Rust chat.rs streams SSE → listen('chat-chunk-{threadId}')
  → parseSSEChunk() → interpretEvent() → update reactive message
  → If stop_reason=tool_use → _executeToolCalls (propose_edit + chat tools) → re-stream
  → If stop_reason=end_turn → saveThreads → idle
```

### Thread Data Model
```javascript
{
  id: 'task-{nanoid}',
  fileId: '/path/to/file.md',
  range: { from: 42, to: 87 },        // CodeMirror positions, updated via mapPos()
  selectedText: 'The highlighted text',
  messages: [/* same shape as chat messages */],
  modelId: 'sonnet',
  status: 'idle' | 'streaming' | 'error' | 'resolved',
  createdAt, updatedAt,
  // Runtime-only (not persisted):
  _sseBuffer, _currentToolInputJson, _unlistenChunk, _unlistenDone, _unlistenError
}
```

### Thread Statuses

| Status | Gutter Dot | Range Underline | In Thread List |
|---|---|---|---|
| `idle` | Accent, 60% opacity | Dotted accent underline | Normal |
| `streaming` | Accent, pulsing | Pulsing accent underline + faint bg | Normal, streaming badge on tab |
| `error` | Red | Red underline | Normal |
| `resolved` | Hidden (no dot) | Hidden (no underline) | Bottom of list, 50% opacity, green "resolved" badge |

### Resolve vs Delete

- **Resolve** — Marks a thread as done. Gutter dot and underline disappear. Thread moves to bottom of list, greyed out. Conversation history preserved. Available when any proposed edit has been applied.
- **Delete** — Permanently removes the thread. Cleans up Rust session (`chat_cleanup`). Always available.

### System Prompt

Tasks share the same base prompt as chat via `buildBaseSystemPrompt()` from `src/services/systemPrompt.js` (persona, communication rules, tool guidance, writing/analysis norms, boundaries). A task-specific `# Current Task` section is appended with:

- **Text files**: File path + surrounding context (5000 chars before, 1000 chars after selection, captured at `createThread()` time) + selected text
- **Notebook cells**: File path + cell index/type/language + cell source + cell outputs

`workspace.systemPrompt` and `workspace.instructions` appended after. Workspace meta injected into first user message (same as chat).

### Task Tools (full capabilities)

Tasks have **all tools** from `getToolDefinitions(workspace)` plus `propose_edit` (unique to tasks). No filtering — same capabilities as chat. Tool permissions automatically respected via `getToolDefinitions()`.

Execution routes through `executeSingleTool()` from `chatTools.js` for all tools except `propose_edit`, which is handled locally.

### Task Tool Call UI

Non-`propose_edit` tool calls render via the shared `ToolCallLine.vue` component (compact one-liner: status dot + icon + label + context, click to expand). `propose_edit` keeps its special diff card with Apply button.

When the AI calls `propose_edit`, the tool call is recorded with `output: "Proposal recorded. User will review."` and the conversation continues. The user sees the old/new text in the thread UI with an "Apply" button.

### Apply Edit → Review System

`tasksStore.applyProposedEdit(threadId, toolCallId)`:
1. Read current file content from disk
2. Check `old_string` exists → error if not found
3. `newContent = currentContent.replace(old_string, new_string)`
4. Write `newContent` to disk
5. Update `filesStore.fileContents[path]` **BEFORE** recording pending edit (race condition fix — same as chat tools)
6. Open file in editor via `editorStore.openFile(path)`
7. Push to `reviews.pendingEdits` with `id: 'task-{timestamp}-{nanoid6}'`
8. Save pending edits → merge view appears in editor
9. Set `tc.status = 'applied'`, save threads

### Editor Bridge (`TextEditor.vue` + `tasks.js`)

**Store → CodeMirror sync:** A deep watcher on `tasksStore.threadsForFile(filePath)` calls `syncTasksToEditor()`, which diffs CM state against the store and dispatches `addTask`/`removeTask`/`updateTask` effects.

**CodeMirror → Store sync (position mapping):** An `EditorView.updateListener` fires on `docChanged`, reads updated ranges from `taskField`, and calls `tasksStore.updateRange()` for each thread. This keeps thread ranges accurate as the user edits the document.

**Gutter click:** Clicking a task dot dispatches a `CustomEvent('task-click')` which bubbles to the container. `TextEditor.vue` listens for it, sets the active thread, and dispatches `window.dispatchEvent('open-tasks')`. `App.vue` catches this and opens the right panel to the tasks tab.

### Editor Decorations — CodeMirror (`tasks.js`)

- **`taskField`** — `StateField<Array>`: List of `{id, range, status, messages}` objects. Ranges mapped through doc changes via `tr.changes.mapPos()`.
- **Gutter markers** — `TaskGutterMarker`: Colored dot per thread (accent for idle, pulsing for streaming, red for error). Resolved threads hidden. Click dispatches `task-click` event.
- **Range highlights** — `Decoration.mark` with class `task-range task-range-{status}`. Resolved threads hidden.
- **Effects** — `addTask`, `removeTask`, `updateTask` for store↔CM sync.

### Editor Decorations — DOCX (`DocxTaskIndicators.vue` + `docxTaskPositions.js`)

ProseMirror decorations are invisible in SuperDoc (hidden host at x:-9999). DOCX uses **floating overlay dots** instead:

- **Position mapping** — `docxTaskPositions.js`: SuperDoc extension with a PM plugin that calls `tr.mapping.map()` on each thread's `range.from/to` when the document changes. Fires `onPositionsUpdated()` which updates the store and dispatches a `docx-content-changed` event.
- **Visual indicators** — `DocxTaskIndicators.vue`: Mounted as a sibling overlay inside the DocxEditor wrapper. For each non-resolved thread, searches visible `.superdoc-line` elements for `thread.selectedText` (first 60 chars, normalized, case-insensitive). Positions a dot at the matching line's vertical center, 20px left of the first `.superdoc-fragment` edge (in the page margin area).
- **Fallback positioning** — When text search fails (deleted text, duplicate passages), estimates vertical position as `range.from / docSize * scrollHeight`. These dots render with dashed outline styling (`.docx-task-approximate`).
- **Recalc triggers** — Scroll (RAF-debounced), resize (ResizeObserver, 150ms), thread changes (Vue watcher, 50ms), content edits (`docx-content-changed` custom event, 300ms).
- **Click** — Sets active thread + dispatches `open-tasks` window event → right panel opens.
- **CSS classes** — `.docx-task-idle`, `.docx-task-streaming`, `.docx-task-error`, `.docx-task-active`, `.docx-task-approximate` (in `editor.css`).

### UI Components

**`TaskThreads.vue`** — Two-mode panel:
- **List mode** (no active thread): Header with count, thread items with status dot + preview + filename + timestamp. Resolved threads sorted to bottom with 50% opacity and green "resolved" label.
- **Detail mode** (active thread): Renders `TaskThread.vue`. Back button returns to list.

**`TaskThread.vue`** — Full conversation view:
- Header: back button, selection preview, file name, Navigate button, Resolve button (if any edits applied), Delete button.
- Messages: role labels, markdown rendering, streaming cursor, `propose_edit` tool call cards with old/new text + Apply/Applied/Error state.
- Auto-scroll (same pattern as `ChatSession.vue`).
- Navigate: opens file and scrolls to selection range. DOCX uses brute-force 4x retry (0/500/1000/1500ms) because SuperDoc may still be mounting.

**`TaskInput.vue`** — Simplified `ChatInput.vue`:
- Textarea with @file reference support (same `FileRefPopover` mechanism, Teleported to body).
- Model picker (Teleported to body).
- Send/Stop buttons.
- No editor context chip (the selection IS the context).

### Persistence

- All threads saved to `.shoulders/tasks.json` (single file, JSON array).
- Loaded at workspace open via `tasksStore.loadThreads()` (called from `App.vue:openWorkspace()`).
- Saved after each completed streaming turn (`saveThreads()` called from `_streamResponse` on end_turn/message_stop/done).
- Runtime fields (`_sseBuffer`, `_unlisten*`, `_currentToolInputJson`) stripped on save, restored on load.

### Shared Infrastructure (no duplication)

| Reused From | What | Used For |
|---|---|---|
| `src-tauri/src/chat.rs` | `chat_stream`, `chat_abort`, `chat_cleanup` | Streaming proxy (thread ID = session ID) |
| `src/services/chatProvider.js` | `formatRequest`, `parseSSEChunk`, `interpretEvent` | Multi-provider SSE handling |
| `src/services/apiClient.js` | `resolveApiAccess` | Model ID → API key + provider config + URL |
| `src/components/right/FileRefPopover.vue` | @file search dropdown | File attachment in task input |

## Skills System

Just-in-time instruction manuals the agent reads via `read_file` when a task matches. Three-level progressive disclosure: metadata always in context, SKILL.md loaded on trigger, bundled scripts called as needed.

### Structure

```
.project/skills/
  skills.json              ← manifest (always injected into system prompt)
  shoulders-meta/
    SKILL.md               ← loaded by agent when triggered
```

### Manifest (`skills.json`)

```json
{
  "skills": [{
    "name": "shoulders-meta",
    "description": "Trigger: user asks about app features or support.",
    "path": ".project/skills/shoulders-meta/SKILL.md"
  }]
}
```

### Loading

- **State**: `workspace.skillsManifest` (array or null)
- **Load**: `workspace.loadSkillsManifest()` called from `loadSettings()`. Reads `.project/skills/skills.json`, parses, stores.
- **Init**: `initProjectDir()` creates `.project/skills/` with default `skills.json` + `shoulders-meta` placeholder skill if dir doesn't exist.
- **Injection**: `buildBaseSystemPrompt()` in `systemPrompt.js` appends skill entries to system prompt. Both chat and tasks see skills.

### Adding Skills

Create a folder in `.project/skills/` with a `SKILL.md`, add an entry to `skills.json`. The agent discovers it automatically. Skills can include scripts (bash, python, R) — the agent calls them via `run_command`. Prerequisites should be documented at the top of SKILL.md.

## Shared System Prompt (`systemPrompt.js`)

`buildBaseSystemPrompt(workspace)` builds the prompt shared by chat and tasks. Sections: Role, Communication, Action Framework, Tool Usage, Action Safety, Writing & Analysis, Boundaries. Appends dynamic context: date, workspace path, workspace structure note, skills manifest.

Chat uses the base prompt directly. Tasks append a `# Current Task` section with file path, selection context (5000 chars before, 1000 after), and selected text. Both append `workspace.systemPrompt` + `workspace.instructions` after.

Ghost has its own minimal prompt in `ai.js` — not shared.
