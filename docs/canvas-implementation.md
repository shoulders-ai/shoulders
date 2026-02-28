# AI Canvas Editor — Technical Implementation Plan

> Visual thinking surface for researchers. Not a whiteboard, not a mind map — a space where you think through ideas with AI and see the shape of your thinking emerge.

## .canvas File Format

Three node types: `text`, `prompt`, `file`. No separate "response" type — AI outputs are text nodes.

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "n_abc123",
      "type": "text",
      "position": { "x": 100, "y": 200 },
      "dimensions": { "width": 280, "height": null },
      "data": {
        "content": "My research note...",
        "title": null,
        "color": null,
        "borderWidth": "thin",
        "fontSize": "medium",
        "aiGenerated": false
      }
    },
    {
      "id": "n_prompt1",
      "type": "prompt",
      "position": { "x": 100, "y": 400 },
      "dimensions": { "width": 280, "height": null },
      "data": {
        "content": "Explain the distributional effects",
        "title": null,
        "modelId": null,
        "runCount": 2
      }
    },
    {
      "id": "n_file1",
      "type": "file",
      "position": { "x": 500, "y": 100 },
      "dimensions": { "width": 200, "height": null },
      "data": {
        "filePath": "papers/smith-2024.pdf",
        "preview": "Smith et al. (2024) — Carbon pricing..."
      }
    }
  ],
  "edges": [
    { "id": "e_1", "source": "n_abc123", "target": "n_prompt1", "type": "smoothstep" }
  ],
  "aiState": {
    "messages": {
      "n_prompt1": { "role": "user", "content": "Explain the distributional effects" },
      "n_response1": { "role": "assistant", "content": "The distributional effects..." }
    }
  }
}
```

## Architecture

| Layer | What | Key files |
|---|---|---|
| Format | `.canvas` JSON, parse/serialize/migrate | `src/utils/canvasFormat.js` |
| Store | Pinia store: CRUD, undo/redo, AI streaming | `src/stores/canvas.js` |
| DAG | Context assembly, path walking | `src/services/canvasMessages.js` |
| Components | Vue Flow nodes, toolbar, context menu | `src/components/canvas/` |
| Shell | CanvasEditor.vue (load/save, event wiring) | `src/components/editor/CanvasEditor.vue` |

## Phases

### Phase 1: File Type Registration + Basic Canvas Shell
- Register `.canvas` in `fileTypes.js` and `EditorPane.vue`
- Install `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap`, `@vue-flow/node-resizer`
- Create `CanvasEditor.vue` with load/save pattern (matches NotebookEditor)
- Create `TextNode.vue` as custom Vue Flow node
- Create `canvasFormat.js` for parse/serialize

### Phase 2: Canvas Store, Node CRUD, Undo/Redo, Context Menu
- Create `canvas.js` Pinia store with snapshot-based undo/redo (max 50)
- Create `CanvasContextMenu.vue` (Teleported to body)
- Wire Vue Flow events to store actions
- Add `NodeResizer` and styling to TextNode

### Phase 3: Prompt Nodes, File Nodes, Drag-and-Drop
- Create `PromptNode.vue` (textarea + run button + model picker)
- Create `FileNode.vue` (compact file reference)
- Add optional titles and markdown rendering to TextNode
- File drag-and-drop from sidebar

### Phase 4: AI Streaming Integration
- Create `canvasMessages.js` for DAG traversal and context assembly
- Add `sendPrompt()` to canvas store (reuses chat.rs, apiClient, chatProvider)
- Context highlighting (visual feedback for what AI sees)
- Canvas-specific chat tools for sidebar integration

### Phase 5: Styling, Floating Toolbar, and Polish
- Create `FloatingStyleBar.vue` (color, border, font size, delete)
- Theme integration via CSS variable mapping
- Export branch as markdown

## Reused Infrastructure (no changes needed)

| File | What's reused |
|---|---|
| `src-tauri/src/chat.rs` | Streaming proxy (generic: URL+headers+body → SSE events) |
| `src/services/apiClient.js` | `resolveApiAccess()` for model/key resolution |
| `src/services/chatProvider.js` | `formatRequest()`, `parseSSEChunk()`, `interpretEvent()` |
| `src/services/systemPrompt.js` | `buildBaseSystemPrompt()` |
| `src/services/chatTools.js` | `getToolDefinitions()`, `executeSingleTool()` |
| `src/utils/chatMarkdown.js` | `renderMarkdown()` for response nodes |
| `src/stores/utils.js` | `nanoid()` for ID generation |

## Key Design Decisions

- **No "AI response" node type**: AI outputs are text nodes with `aiGenerated: true`. One content type, shared between user and AI.
- **Prompt nodes are factories**: Each run creates a new text node child. Edit prompt, run again → another child. Compare versions.
- **Directed edges**: Every edge has source/target for DAG traversal. No visual arrowheads (tree structure implies direction).
- **Context assembly**: Walk edges backward from prompt to root, collect conversation history. File nodes in path provide document context.
- **Snapshot undo**: Full JSON clone on each action (max 50 entries). Simple, reliable.
