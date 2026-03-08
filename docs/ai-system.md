# AI System

Four AI features, all built on the [AI SDK](https://ai-sdk.dev/docs):

1. **AI Chat** — multi-provider streaming chat with tool execution
2. **Ghost Suggestions** — inline completions triggered by `++`
3. **Document Comments** — margin annotations that bridge to AI chat for batch revision
4. **Reference AI** — citation parsing and PDF metadata extraction

All proxied through Rust to avoid CORS (`chat.rs` for streaming, `proxy_api_call` for non-streaming). All gated by the monthly budget — see [usage-system.md](usage-system.md).

## Packages

```
ai                    — Core: streamText, generateText, tool, ToolLoopAgent, DirectChatTransport
@ai-sdk/vue           — Vue composable: Chat (manages messages, status, streaming)
@ai-sdk/anthropic     — Anthropic provider
@ai-sdk/openai        — OpenAI provider
@ai-sdk/google        — Google provider
zod                   — Schema validation for tool inputSchema
```

> **AI SDK docs** (fetch these for API details — don't rely on memory):
> - Chat composable: `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot`
> - Transport: `https://ai-sdk.dev/docs/ai-sdk-ui/transport`
> - Tool usage: `https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage`
> - generateText: `https://ai-sdk.dev/docs/ai-sdk-core/generating-text`
> - streamText: `https://ai-sdk.dev/docs/ai-sdk-core/streaming-text`
> - Tools: `https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling`
> - Providers: `https://ai-sdk.dev/docs/ai-sdk-core/providers-and-models`
> - Message metadata: `https://ai-sdk.dev/docs/ai-sdk-ui/message-metadata`
> - Stream protocol: `https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol`

---

## Key Files

| File | Role |
|---|---|
| **Shared infrastructure** | |
| `services/aiSdk.js` | Model factory (`createModel`), provider options (`buildProviderOptions`), usage conversion (`convertSdkUsage`) |
| `services/tauriFetch.js` | `fetch()` wrapper routing through Rust `chat_stream` — CORS bypass for AI SDK |
| `services/apiClient.js` | Key resolution (`resolveApiAccess`), Shoulders proxy URL, billing route |
| `services/chatModels.js` | Context window sizes, thinking config detection |
| `services/systemPrompt.js` | Shared base system prompt for chat and ghost |
| `services/workspaceMeta.js` | `<workspace-meta>` block (open tabs, git diff) |
| `services/tokenUsage.js` | Per-model pricing, cost calculation |
| `src-tauri/src/chat.rs` | Rust streaming proxy: tokio + reqwest + Tauri events |
| **Chat** | |
| `stores/chat.js` | Chat sessions, `Chat` composable instances, persistence |
| `services/chatTransport.js` | `ToolLoopAgent` + `DirectChatTransport` factory |
| `services/chatTools.js` | 28 tools defined with AI SDK `tool()` + zod schemas (incl. comment tools) |
| `components/right/ChatSession.vue` | Per-session message list |
| `components/right/ChatMessage.vue` | Message renderer (parts-based: text, reasoning, tool calls) |
| `components/right/ToolCallLine.vue` | Compact tool call display with status indicators |
| `utils/chatMarkdown.js` | Shared markdown rendering, tool labels/icons/context |
| **Ghost** | |
| `services/ai.js` | `getGhostSuggestions()` — `generateText()` with `suggest_completions` tool |
| `editor/ghostSuggestion.js` | `++` trigger, state field, inline widgets |
| `editor/docxGhost.js` | SuperDoc ghost (ProseMirror plugin) |
| **Comments** | |
| `stores/comments.js` | Document comments: pure CRUD data store, persistence |
| `editor/comments.js` | Gutter markers, anchor highlights, position mapping |
| `components/comments/CommentMargin.vue` | 200px side panel with compact comment cards |
| `components/comments/CommentPanel.vue` | Floating overlay for viewing/editing comments |
| **Reference AI** | |
| `services/refAi.js` | Citation parsing + PDF metadata extraction via `generateText()` |

---

## Architecture

### How streaming works

```
User sends message
  → Chat composable (from @ai-sdk/vue)
    → createChatTransport (our custom transport)
      → ToolLoopAgent.stream() → streamText()
        → createModel(access, tauriFetch)
          → @ai-sdk/anthropic (or openai/google)
            → tauriFetch (our fetch wrapper)
              → Rust chat_stream command
                → reqwest HTTP to provider API
                → Tauri events back to JS
              ← ReadableStream (SSE bytes)
            ← AI SDK parses SSE internally
          ← Model response stream
        ← Tool execution happens inside streamText loop (up to 15 steps)
      ← UIMessageStream (tool-input-available, tool-output-available, text, etc.)
    ← Chat composable updates reactive messages/status
  ← Vue re-renders ChatMessage components
```

### Model creation (`aiSdk.js`)

`createModel(access, customFetch)` creates an AI SDK model instance from our `resolveApiAccess()` result:

```js
// Direct API key — standard SDK usage
createAnthropic({ apiKey, fetch: tauriFetch })('claude-sonnet-4-6')

// Shoulders proxy — native SDK + routing headers
createAnthropic({ authToken: jwt, baseURL: proxyUrl, headers: {
  'x-shoulders-provider': 'anthropic',
  'x-shoulders-model': 'claude-sonnet-4-6',
}, fetch: wrappedTauriFetch })('claude-sonnet-4-6')
```

For Shoulders, the client creates native provider SDKs (`createAnthropic`/`createOpenAI`/`createGoogleGenerativeAI`) — the proxy is transparent and forwards native format as-is. The fetch wrapper does two things:

1. **Strips SDK-appended paths** (`/messages`, `/responses`, `/models/...`) since the proxy expects requests at a single URL
2. **Detects streaming** and adds `x-shoulders-stream: 1|0` header (checks `body.stream` for Anthropic/OpenAI, URL for Google's `streamGenerateContent`)

Auth differs per provider SDK:
- **Anthropic**: `authToken = jwt` → SDK sends `Authorization: Bearer`
- **OpenAI**: `apiKey = jwt` → SDK sends `Authorization: Bearer`
- **Google**: `apiKey = 'shoulders-proxy'` (dummy — SDK requires it) + explicit `Authorization: Bearer` header (server reads this for auth, ignores the dummy key in the URL)

### tauriFetch (`tauriFetch.js`)

Wraps Rust's `chat_stream` in a standard `fetch()` interface that returns a `ReadableStream`:

1. Set up Tauri event listeners FIRST (before invoke — avoids race condition)
2. Create `ReadableStream` with synchronous `start()`
3. Call `invoke('chat_stream')` LAST
4. Filter out Shoulders proxy custom events (`shoulders_balance`) that crash the AI SDK validator

---

## AI Chat

### Chat composable pattern

Chat instances (`Chat` from `@ai-sdk/vue`) live in a `Map` **outside Pinia**:

```js
const chatInstances = new Map() // sessionId → Chat
```

Each `Chat` manages its own reactive `messagesRef` and `statusRef` (Vue `ref()`). The Pinia store has a `_chatVersion` counter that's incremented when instances are created/destroyed — this lets `computed()` consumers react to Chat instance changes.

```js
// In getChatInstance getter:
void this._chatVersion  // establish reactive dependency
return chatInstances.get(sessionId)

// In ChatSession.vue:
const messages = computed(() => chat.value?.state.messagesRef.value)
```

### Chat instance creation

```js
new Chat({
  id: session.id,
  messages: session._savedMessages || [],
  transport: createChatTransport(() => this._buildConfig(session)),
  sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  onError: (err) => { ... },
})
```

- `transport`: Our custom transport that creates a fresh `ToolLoopAgent` per request
- `sendAutomaticallyWhen`: After `streamText()` completes a tool loop internally, the Chat detects complete tool calls and may re-send to continue the conversation

### Transport (`chatTransport.js`)

```js
const agent = new ToolLoopAgent({
  model,
  tools: getAiTools(workspace),
  instructions: systemPrompt,
  stopWhen: stepCountIs(15),
  providerOptions,
  onStepFinish(event) { /* record usage */ },
})

const inner = new DirectChatTransport({ agent, sendReasoning: true })
return inner.sendMessages({ messages, abortSignal })
```

Tools execute **inside** `streamText()` (server-side in AI SDK terms). The `ToolLoopAgent` calls the model, executes tools, calls the model again with results, up to 15 steps.

### UIMessage format

Messages use the AI SDK `UIMessage` format with ordered `parts[]`:

```js
{
  id: 'msg-abc123',
  role: 'assistant',
  parts: [
    { type: 'step-start' },
    { type: 'reasoning', text: '...' },
    { type: 'text', text: 'I\'ll read that file for you.' },
    { type: 'tool-read_file', toolCallId: 'tc_1', state: 'output-available',
      input: { path: 'README.md' }, output: '...' },
    { type: 'text', text: 'Here\'s what I found...' },
  ]
}
```

Tool part states: `input-streaming` → `input-available` → `output-available` | `output-error`

### Tool definitions (`chatTools.js`)

28 tools defined with AI SDK `tool()` and zod schemas:

```js
import { tool } from 'ai'
import { z } from 'zod'

read_file: tool({
  description: 'Read a file from the workspace',
  inputSchema: z.object({
    path: z.string().describe('Relative path'),
    maxChars: z.number().optional().describe('Truncate after N chars'),
  }),
  execute: async ({ path, maxChars }) => { ... },
})
```

> **Zod v4 gotcha**: `z.record(z.any())` crashes `toJSONSchema()`. Always use `z.record(z.string(), z.any())`.

### Session persistence

Sessions persist to `.shoulders/chats/{id}.json` in UIMessage `parts[]` format. `cleanPartsForStorage()` strips `providerMetadata` before saving. Sessions are loaded on reopen and passed to the Chat constructor as `_savedMessages`.

### Workspace context

`buildWorkspaceMeta()` generates a `<workspace-meta>` XML block (open tabs, git diff) that's appended to the **system prompt** (not the user message) in `_buildConfig()`. This keeps the UI clean.

---

## Ghost Suggestions

`getGhostSuggestions()` in `ai.js` uses `generateText()` with a forced tool call:

```js
const result = await generateText({
  model: createModel(access, tauriFetch),
  system: ghostPrompt,
  messages: [{ role: 'user', content: '<prefix>...</prefix><cursor/><suffix>...</suffix>' }],
  tools: {
    suggest_completions: tool({
      inputSchema: z.object({
        prefix_end: z.string(),
        suffix_start: z.string(),
        suggestions: z.array(z.string()).min(3).max(5),
      }),
    }),
  },
  toolChoice: { type: 'tool', toolName: 'suggest_completions' },
})
// result.toolCalls[0].args.suggestions → ['completion 1', 'completion 2', 'completion 3']
```

Model selection: `resolveApiAccess({ strategy: 'ghost' })` tries Haiku → Gemini Flash Lite → GPT-5 Nano → Shoulders.

---

## Document Comments

See **[comments-system.md](comments-system.md)** for full documentation (architecture, data model, store API, editor extension, UI components, gotchas).

Summary: Margin annotations anchored to text ranges. Pure data store (no Chat composable / AI streaming). AI interacts via three chat tools (`add_comment`, `reply_to_comment`, `resolve_comment`). Margin visibility is per-file (toggle in tab bar).

---

## Reference AI

`refAi.js` uses `generateText()` for two operations:
- `aiParseReferences(text)` — extract structured citations from text
- `aiExtractPdfMetadata(text)` — extract metadata from PDF text

Both use `resolveApiAccess({ strategy: 'cheapest' })` (Gemini Flash Lite → Haiku → GPT-5 Nano → Shoulders).

---

## DOCX AI Provider

`docxProvider.js` creates a provider for SuperDoc's `@superdoc-dev/ai` AIActions:
- `getCompletion()` → `generateText()`
- `streamCompletion()` → `streamText()` with async generator yielding `textStream` chunks

---

## Shoulders Proxy

The Shoulders proxy (`shoulde.rs/api/v1/proxy`) is **transparent**: native provider format in, native provider format out. The client creates real provider SDKs and the server just routes, bills, and injects server-side API keys.

### How it works

```
Client (native SDK format)
  → tauriFetch → Rust chat_stream → Shoulders proxy
    → reads x-shoulders-provider, x-shoulders-model, x-shoulders-stream headers
    → adds server-side API key (x-api-key / Authorization / ?key=)
    → forwards body as-is to upstream provider
    → streams raw SSE bytes back unchanged
    → extracts usage from SSE for billing
    → injects shoulders_balance trailer event
  ← tauriFetch filters shoulders_balance, returns ReadableStream
← AI SDK parses native SSE format
```

### Client-side headers

The fetch wrapper in `aiSdk.js` adds three routing headers:

| Header | Purpose | Example |
|---|---|---|
| `x-shoulders-provider` | Which upstream to call | `anthropic`, `openai`, `google` |
| `x-shoulders-model` | Model ID (server needs for Google URL construction) | `gemini-3.1-flash-lite-preview` |
| `x-shoulders-stream` | Whether the request is streaming | `1` or `0` |

### Gotchas

- **Auth per provider**: Anthropic uses `authToken` (Bearer), OpenAI uses `apiKey` (Bearer), Google uses dummy `apiKey` + explicit `Authorization: Bearer` header. See [Model creation](#model-creation-aisdkjs) above.
- **URL stripping**: SDK appends provider paths (`/messages`, `/responses`, `/models/...`). The fetch wrapper strips these since the proxy expects a single URL.
- **Balance events**: Shoulders injects `{"type":"shoulders_balance",...}` into the SSE stream after the upstream closes. Filtered out in `tauriFetch.js` before reaching the SDK (would crash the UIMessageStream validator). Balance data dispatched as a `shoulders-balance` CustomEvent on `window`.
- **Proxy URL**: Single source of truth in `apiClient.js:SHOULDERS_PROXY_URL`.
- **Token refresh**: `resolveApiAccess()` is async — calls `workspace.ensureFreshToken()` before returning Shoulders access (15-min JWT).

## Vue Reactivity Gotchas

- **Chat instances outside Pinia**: The `Map<sessionId, Chat>` is non-reactive. Use `_chatVersion` counter trick for computed consumers.
- **Tool part state mutation**: AI SDK mutates `part.state` in place. Vue doesn't detect this. Use `:key="part.toolCallId + '-' + part.state"` on `ToolCallLine` to force re-render.
- **Cross-provider model switching**: Reasoning/thinking parts are provider-specific (Anthropic signatures, Google thoughtSignature, OpenAI itemId). Switching mid-conversation crashes. Errors are surfaced in chat UI but no sanitization yet. Fix: strip reasoning from previous exchanges in `chatTransport.js` at send time, keep current exchange intact. No SDK utility exists. ([#2](https://github.com/shoulders-ai/shoulders/issues/2))
- **Invalid tool call JSON kills the session**: When a model produces malformed JSON arguments, the SDK leaves an `input-available` tool part with no paired result — subsequent sends return HTTP 400. Fix in `chat.js` `onError`: pop the broken message, push a synthetic `output-error` part (`input: {}`, not `undefined` — required by `validateUIMessages`). SDK generates a valid `tool-call`+`tool-result` pair; session recovers and model sees the error. See gotchas.md for full details.
