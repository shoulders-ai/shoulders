# Comments System

Document-anchored comment threads with AI integration, proposed edits, and batch submission to chat.

## Relevant Files

| File | Role |
|---|---|
| `src/stores/comments.js` | Pinia store: CRUD, persistence, margin visibility, proposed edit application, submit to chat |
| `src/editor/comments.js` | CodeMirror 6 extension: StateField, gutter markers, range highlights, position mapping |
| `src/components/comments/CommentMargin.vue` | Right-side margin strip: card list, add button, show/hide resolved, submit footer |
| `src/components/comments/CommentPanel.vue` | Floating overlay: create mode + view/reply mode, proposed edit diffs, resolve/delete |
| `src/components/comments/CommentCard.vue` | Compact card in margin: author icon, truncated text, reply count, edit indicator |
| `src/components/comments/CommentInput.vue` | Shared input: auto-grow textarea, @file references, Enter/Cmd+Enter save/submit |
| `src/css/comments.css` | All comment styles: gutter, highlights, margin, cards, panel, diff cards, buttons |
| `src/components/editor/EditorPane.vue` | Wires CommentMargin + CommentPanel to editor, handles create/scroll events |
| `src/components/editor/TextEditor.vue` | Syncs store comments to/from CM6 StateField, handles gutter/range clicks |
| `src/services/chatTools.js` | AI tools: `add_comment`, `reply_to_comment`, `resolve_comment`, `create_proposal` |

## Architecture

```
App.vue (Cmd+Shift+L keybinding)
  └── EditorPane.vue
        ├── TextEditor.vue                    comments.js (CM6 extension)
        │     ├── commentsExtension()           ├── commentField (StateField)
        │     ├── syncCommentsToEditor()  ◄───► ├── CommentGutterMarker
        │     ├── pushCommentPositionsToStore()  ├── commentHighlights (decorations)
        │     └── handleCommentClick()           └── commentRangeClick (handler)
        │           │
        │           ▼
        ├── CommentMargin.vue ◄──────────► comments.js (Pinia store)
        │     ├── CommentCard.vue ×N              ├── comments[]
        │     └── Submit footer                   ├── activeCommentId
        │                                         ├── marginVisible{}
        └── CommentPanel.vue                      ├── editStatuses{}
              ├── Thread view                     └── persistence → .shoulders/comments.json
              ├── CommentInput.vue
              └── Proposed edit diffs

  chatTools.js (AI SDK tools)
    ├── add_comment     → commentsStore.createComment()
    ├── reply_to_comment → commentsStore.addReply()
    └── resolve_comment  → commentsStore.resolveComment()
```

## Data Model

### Comment

```javascript
{
  id: 'comment-a1b2c3d4',        // nanoid-based
  filePath: '/abs/path/to/file.md',
  range: { from: 142, to: 198 },  // character offsets in document
  anchorText: 'the selected text', // original text at creation time
  author: 'user' | 'ai',
  text: 'Your feedback here',
  replies: [Reply],
  proposedEdit: ProposedEdit | null,
  fileRefs: [FileRef] | null,
  status: 'active' | 'resolved',
  createdAt: '2026-03-08T...',
  updatedAt: '2026-03-08T...',
}
```

### Reply

```javascript
{
  id: 'reply-e5f6g7h8',
  author: 'user' | 'ai',
  text: 'Response text',
  proposedEdit: ProposedEdit | null,
  fileRefs: [FileRef] | null,
  timestamp: '2026-03-08T...',
}
```

### ProposedEdit

```javascript
{
  oldText: 'text to replace',
  newText: 'replacement text',
}
```

Applied via `applyProposedEdit()` which does a string replace on the file, updates `filesStore.fileContents`, and adjusts the comment range to cover the new text.

### Edit Status Tracking

`editStatuses` maps `"commentId:replyId"` (or `"commentId:"` for root) to `{ status, error? }`:
- `pending` — apply in progress
- `applied` — successfully applied
- `error` — failed (e.g., `oldText` not found in file)

## Store API (`comments.js`)

### State

| Name | Type | Description |
|---|---|---|
| `comments` | `ref([])` | All comments across all files |
| `activeCommentId` | `ref(null)` | Currently focused comment (drives panel + CM highlight) |
| `marginVisible` | `ref({})` | Per-file margin visibility: `{ [filePath]: boolean }` |
| `showResolved` | `ref(false)` | Whether resolved comments are shown in the margin |
| `editStatuses` | `ref({})` | Proposed edit application status tracking |

### Getters

| Name | Returns | Description |
|---|---|---|
| `commentsForFile(path)` | `Comment[]` | All comments for a file, sorted by `range.from` |
| `unresolvedForFile(path)` | `Comment[]` | Active-only comments for a file, sorted by `range.from` |
| `unresolvedCount(path)` | `number` | Count of active comments for a file |
| `activeComment` | `Comment\|null` | Computed from `activeCommentId` |
| `isMarginVisible(path)` | `boolean` | Defaults to `true` if not explicitly set to `false` |

### Actions

| Name | Description |
|---|---|
| `createComment(filePath, range, anchorText, text, author, fileRefs, proposedEdit)` | Creates and persists a new comment |
| `addReply(commentId, { author, text, proposedEdit, fileRefs })` | Appends a reply to a comment thread |
| `resolveComment(commentId)` | Sets status to `'resolved'`, clears active if needed |
| `unresolveComment(commentId)` | Sets status back to `'active'` |
| `deleteComment(commentId)` | Removes entirely from array |
| `updateRange(commentId, from, to)` | Updates position (debounced save, called by CM position mapping) |
| `setActiveComment(commentId)` | Sets the focused comment |
| `toggleMargin(filePath)` | Toggles margin visibility for a specific file |
| `applyProposedEdit(commentId, replyId?)` | Applies `oldText→newText` replacement to the file on disk |
| `getEditStatus(commentId, replyId?)` | Returns edit application status |
| `loadComments()` | Reads from `.shoulders/comments.json` on workspace open |
| `submitToChat(filePath)` | Sends all unresolved comments to AI chat (see below) |

### Persistence

Comments persist to `.shoulders/comments.json` (gitignored). `_save()` writes immediately on most mutations. `_debouncedSave()` (1s debounce) is used only for `updateRange()` since position updates fire on every keystroke via CM6 position mapping.

## Editor Extension (`comments.js`)

### StateField

`commentField` tracks `{ comments: [], activeId: null }` where each comment has `{ id, from, to, status, author }`. Updated via four effects:

| Effect | Payload | Description |
|---|---|---|
| `addComment` | `{ id, from, to, status, author }` | Add a comment anchor |
| `removeComment` | `string` (id) | Remove by ID |
| `updateComment` | `{ id, ...fields }` | Merge fields (e.g., status change) |
| `setActiveComment` | `string\|null` | Set active highlight |

### Position Mapping

On `tr.docChanged`, all comment positions are mapped through the transaction's changeset:
- `from` uses `mapPos(pos, -1)` — keeps position before insertions (grows range outward)
- `to` uses `mapPos(pos, 1)` — keeps position after insertions (grows range outward)
- Positions are clamped to the old document length before mapping (prevents `RangeError` from stale positions)
- `Math.min`/`Math.max` safety ensures `from <= to` after mapping

### Gutter

`CommentGutterMarker` renders a 12x12 SVG speech-bubble icon in a 16px-wide gutter column. Only shown for unresolved comments. Click handler uses the `gutter()` config's `domEventHandlers` (not `EditorView.domEventHandlers`, which only covers the content area) and dispatches a `comment-click` CustomEvent.

### Range Highlights

`commentHighlights` is a decoration computed from `commentField`. Unresolved comments with `from < to` get `Decoration.mark`:
- `.comment-range` — subtle accent background + underline
- `.comment-range-active` — stronger accent background + underline (when `id === activeId`)

### Content-Area Click Handler

`commentRangeClick` uses `EditorView.domEventHandlers` to detect clicks within a comment range and dispatches `comment-click`. Does not consume the event (returns `false`), allowing normal cursor placement.

## UI Components

### CommentMargin

Right-side 200px strip next to the editor. Shows:
- **Header**: Toggle resolved (eye icon) + Add button (requires text selection)
- **Card list**: `CommentCard` for each visible comment (filtered by resolved toggle)
- **Empty state**: Instructions to select text + press shortcut
- **Footer**: "Submit N" button when unresolved comments exist

Card clicks set the active comment and dispatch `comment-scroll-to` to scroll the editor.

### CommentPanel

Floating overlay positioned relative to the comment's anchor position in the editor. Two modes:

**Create mode**: Shows `CommentInput` with autofocus. Save creates the comment; Submit creates and immediately sends to chat.

**View mode**: Shows the full thread:
- Original comment with author, text, timestamp
- Proposed edit diff card (if present) with Apply/Dismiss buttons
- All replies with their own proposed edit diffs
- Resolve/Reopen toggle button
- Reply input at the bottom
- More menu with Delete option

Positioning uses `coordsAtPos()` to find the anchor text's screen position. Panel is centered horizontally within the editor area (accounting for margin width). Flips above the anchor when in the bottom 60% of the container.

Closes on: click outside, Escape key, resolve, delete.

### CommentCard

Compact display for the margin list. Shows author icon (sparkle for AI, person silhouette for user), truncated text (2-line CSS clamp), reply count, and "Edit suggested" indicator when any proposed edit exists.

### CommentInput

Shared by both create and reply flows. Features:
- Auto-growing textarea (36px min, 160px max)
- `@` file references with `FileRefPopover` (Teleported to body)
- File chips showing attached files
- Enter = Save, Cmd+Enter = Save & Submit, Escape = Cancel
- Arrow keys navigate file popover when open

## AI Tools

Four comment-related tools available to the AI chat:

### `add_comment`

```
Input:  file_path, anchor_text, text, proposed_edit? { old_text, new_text }
```

Reads the file, finds `anchor_text` via `indexOf()`, creates a comment at that position with `author: 'ai'`. Returns error if anchor text not found in file.

### `reply_to_comment`

```
Input:  comment_id, text, proposed_edit? { old_text, new_text }
```

Adds a reply with `author: 'ai'` to an existing comment thread. Returns error if comment ID not found.

### `resolve_comment`

```
Input:  comment_id
```

Marks a comment as resolved. Returns error if comment ID not found.

### `create_proposal`

```
Input:  prompt, options[2-5] { title, description, url?, doi? }
```

Not strictly a comment tool — presents interactive choice cards in the chat. Used for paper recommendations, methodology options, etc. Included in the "Comments" tool category in the system.

## Submit to Chat Workflow

`submitToChat(filePath)` sends all unresolved comments on a file to the AI chat as a single message:

1. Collects all unresolved comments for the file
2. Reads the file content from cache or disk
3. Builds a `<document-comments>` XML block with each comment's ID, line number, author, anchor text, comment text, and replies
4. Appends the XML block to the file content as a `fileRef`
5. Constructs a user message: "Please review and address the N comments on {relativePath}."
6. Opens a chat panel beside the editor (`editorStore.openChatBeside()`)
7. Waits 200ms for component mount, then sends the message to the active chat session

The AI receives both the file content and the structured comment data, allowing it to use `reply_to_comment`, `resolve_comment`, and `edit_file` tools to address the feedback.

## Per-File Margin Visibility

The comment margin visibility is tracked per file path in `marginVisible: ref({})`. This allows different files to have independently toggled margins.

- **Default**: visible (`true`) — `isMarginVisible()` returns `true` when the path has no entry
- **Toggle**: `toggleMargin(filePath)` flips the value for that specific file
- **Auto-show**: clicking a gutter dot or adding a comment auto-shows the margin if hidden
- **UI controls**: Tab bar comment icon button + context menu + `Cmd+Shift+L` shortcut

The margin state is ephemeral (not persisted to disk) — all margins reset to visible on app restart.

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd+Shift+L` | Add comment on current selection (requires text selected) |
| `Enter` | Save comment/reply (in CommentInput) |
| `Cmd+Enter` | Save comment and submit to chat (in CommentInput, create mode) |
| `Shift+Enter` | Newline in comment input |
| `Escape` | Close panel / cancel input |

## Store ↔ Editor Sync (`TextEditor.vue`)

Two-way synchronization between the Pinia store and the CM6 StateField:

**Store → CM** (`syncCommentsToEditor`): Watched via `watch(commentsStore.commentsForFile(...))`. Diffs the store comments against CM state and dispatches `addComment`, `removeComment`, `updateComment`, and `setActiveComment` effects as needed. Positions are clamped to `doc.length` to prevent range errors.

**CM → Store** (`pushCommentPositionsToStore`): Runs on every `docChanged` update. Reads mapped positions from the CM StateField and calls `updateRange()` on each comment. This is how comment anchors survive user edits — CM6 maps positions through its changeset, then the store persists the new positions.

**Active comment sync**: A separate watcher on `commentsStore.activeCommentId` dispatches `setActiveComment` to CM to update the highlight decoration.

**Click handling**: `comment-click` CustomEvent (from gutter dots or range clicks) sets the active comment in both the store and CM, and auto-shows the margin if hidden.

## Event Flow

```
User selects text → Cmd+Shift+L (App.vue)
  → dispatches 'comment-create' CustomEvent
  → EditorPane.handleCommentCreate()
  → startComment() → sets commentPanelMode='create'
  → CommentPanel renders in create mode
  → user types + Enter
  → commentsStore.createComment()
  → store watch fires → syncCommentsToEditor()
  → CM6 adds gutter dot + range highlight

User clicks gutter dot (CM6 gutter handler)
  → dispatches 'comment-click' CustomEvent
  → TextEditor.handleCommentClick()
  → commentsStore.setActiveComment()
  → CommentPanel renders in view mode

User clicks "Submit N" (CommentMargin footer)
  → commentsStore.submitToChat()
  → builds <document-comments> XML
  → sends to active chat session
  → AI uses add_comment / reply_to_comment / resolve_comment / edit_file
```

## Gotchas

### `mapPos` assoc values for mark ranges
`mapPos(pos, -1)` keeps position before insertions; `mapPos(pos, 1)` keeps it after. For comment ranges: `from` uses `-1` and `to` uses `1` (both grow outward). Swapping these causes the range to collapse or invert, and `Decoration.mark().range(from, to)` throws `RangeError: Mark decorations may not be empty`.

### Full-document swap destroys comment positions
Dispatching `{ from: 0, to: doc.length, insert: newContent }` maps every tracked position to `0` or `newContent.length`, expanding every comment range to cover the entire document. Use `computeMinimalChange()` from `src/utils/textDiff.js` to dispatch only the changed span. Applied in `TextEditor.vue` and `NotebookCell.vue`.

### Gutter click handlers need the `gutter()` config
`EditorView.domEventHandlers` only covers `.cm-content`. Gutter marker clicks (comment dots) must use the `domEventHandlers` option inside the `gutter()` config. Note the different signature: `(view, line, event) => boolean` vs `(event, view)`.

### Stale positions can exceed document length
Comments persisted to disk may have positions beyond the current document length (e.g., file was truncated externally). The StateField clamps positions to `oldLen` before calling `mapPos` to prevent `RangeError`. The sync function also clamps `from` to `doc.length` when adding effects.

### Proposed edit anchor drift
`applyProposedEdit()` finds `oldText` via `content.indexOf()`. If the file has been edited since the comment was created, `oldText` may no longer exist or may appear at a different location. The status is set to `error` with a descriptive message if not found.
