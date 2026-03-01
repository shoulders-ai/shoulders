# AI System

Four AI features, all built on the [AI SDK](https://ai-sdk.dev/docs):

1. **AI Chat** — multi-provider streaming chat with tool execution
2. **Ghost Suggestions** — inline completions triggered by `++`
3. **Task Threads** — spatially-anchored multi-turn AI on selected text
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
| `services/systemPrompt.js` | Shared base system prompt for chat, tasks, ghost |
| `services/workspaceMeta.js` | `<workspace-meta>` block (open tabs, git diff) |
| `services/tokenUsage.js` | Per-model pricing, cost calculation |
| `src-tauri/src/chat.rs` | Rust streaming proxy: tokio + reqwest + Tauri events |
| **Chat** | |
| `stores/chat.js` | Chat sessions, `Chat` composable instances, persistence |
| `services/chatTransport.js` | `ToolLoopAgent` + `DirectChatTransport` factory |
| `services/chatTools.js` | 27 tools defined with AI SDK `tool()` + zod schemas |
| `components/right/ChatSession.vue` | Per-session message list |
| `components/right/ChatMessage.vue` | Message renderer (parts-based: text, reasoning, tool calls) |
| `components/right/ToolCallLine.vue` | Compact tool call display with status indicators |
| `utils/chatMarkdown.js` | Shared markdown rendering, tool labels/icons/context |
| **Ghost** | |
| `services/ai.js` | `getGhostSuggestions()` — `generateText()` with `suggest_completions` tool |
| `editor/ghostSuggestion.js` | `++` trigger, state field, inline widgets |
| `editor/docxGhost.js` | SuperDoc ghost (ProseMirror plugin) |
| **Tasks** | |
| `stores/tasks.js` | Task threads: Chat composable (mirrors chat.js), multi-turn, propose_edit |
| `editor/tasks.js` | Gutter dots, range highlights, position mapping |
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
// Direct API key
createAnthropic({ apiKey, fetch: tauriFetch })('claude-sonnet-4-6')

// Shoulders proxy — uses authToken (Bearer) not apiKey (x-api-key)
createAnthropic({ authToken, baseURL: proxyUrl, fetch: wrappedTauriFetch })('claude-sonnet-4-6')
```

For Shoulders, the fetch wrapper strips SDK-appended paths (`/messages`, `/responses`) since the proxy expects requests at the proxy URL directly.

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

27 tools defined with AI SDK `tool()` and zod schemas:

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

## Task Threads

Task threads use the same `Chat` composable pattern as chat sessions. A `taskChatInstances` Map (outside Pinia, same as `chatInstances` in `chat.js`) holds one `Chat` instance per thread. Each Chat uses `createChatTransport()` with `extraTools: { propose_edit }` and `maxSteps: 10`. Full workspace tool capabilities plus `propose_edit`.

Edit application status is tracked separately in an `editStatuses` ref (`toolCallId → { status, error? }`) — SDK-owned UIMessage parts must not be mutated.

Surrounding context (5000 chars before + 1000 chars after selection) is captured at thread creation and injected into the system prompt. Legacy `tasks.json` (flat `{ content, toolCalls }` messages) is migrated to UIMessage `parts[]` format on load via `migrateTaskMessages()`.

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

## Shoulders Proxy Gotchas

- **Auth**: Anthropic SDK uses `authToken` (sends `Authorization: Bearer`), not `apiKey` (sends `x-api-key`). OpenAI/Google use `apiKey` + explicit `Authorization` header.
- **URL rewriting**: SDK appends provider paths (`/messages`, `/responses`). The fetch wrapper strips these for Shoulders since the proxy expects the URL as-is.
- **Balance events**: Shoulders injects `{"type":"shoulders_balance",...}` into the SSE stream. Filtered out in `tauriFetch.js` before reaching the SDK (would crash the UIMessageStream validator). Balance data dispatched as a `shoulders-balance` CustomEvent.
- **Proxy URL**: Single source of truth in `apiClient.js:SHOULDERS_PROXY_URL`.

## Vue Reactivity Gotchas

- **Chat instances outside Pinia**: The `Map<sessionId, Chat>` is non-reactive. Use `_chatVersion` counter trick for computed consumers.
- **Tool part state mutation**: AI SDK mutates `part.state` in place. Vue doesn't detect this. Use `:key="part.toolCallId + '-' + part.state"` on `ToolCallLine` to force re-render.
