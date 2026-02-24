# Ghost Suggestions — Working Notes

This document tracks what we've learned about ghost text in both editors (CodeMirror and SuperDoc), especially the hard-won lessons about SuperDoc's internal architecture.

---

## SuperDoc Rendering Pipeline (Key to Understanding the DOCX Ghost Bug)

SuperDoc renders documents via a **two-layer architecture**:

1. **Hidden ProseMirror DOM** — the standard PM editor DOM, hidden from view. Marks on text nodes render via `renderDOM` (e.g. `<span style="color: #B0B0B0">`). This layer is NOT what the user sees.

2. **Painted pages** — SuperDoc's visual output. Built from `runProperties` on run nodes, converted to CSS via `encodeCSSFromRPr()`. This is what the user actually sees.

**Critical implication:** Adding a ProseMirror mark to a text node (`addMark`) changes the hidden DOM but does NOT directly change the painted output. The painted output is driven by the run's `runProperties` attribute, not the text node's marks.

### How SuperDoc Connects Marks to Painted Output

SuperDoc has two appendTransaction plugins that bridge marks and run properties:

1. **`wrapTextInRunsPlugin`** (fires first): Finds bare text nodes (not inside runs) and wraps them. Calls `decodeRPrFromMarks(textNode.marks)` to extract OOXML properties, creates `runNode = runType.create({ runProperties }, textNode)`. **Only wraps BARE text — text already inside a run is skipped.**

2. **`calculateInlineRunPropertiesPlugin`** (fires second): Detects when text nodes inside a run have marks that differ from the run's `runProperties`. Uses `segmentRunByInlineProps()` to segment the run, then splits it into multiple runs with correct properties. **This is the mechanism that should propagate mark changes to the painted output.**

### The Run Properties → Marks Round-Trip

```
Marks → runProperties:  decodeRPrFromMarks(marks)
runProperties → Marks:  encodeMarksFromRPr(runProperties)
```

Properties that survive the round-trip (in `RUN_PROPERTIES_DERIVED_FROM_MARKS`):
- strike, italic, bold, underline, highlight
- textTransform, **color**, fontSize, letterSpacing
- fontFamily, vertAlign, position

### Color Format in RunProperties

```javascript
// runProperties format (OOXML): hex WITHOUT # prefix
{ color: { val: 'B0B0B0' } }

// textStyle mark format (CSS): hex WITH # prefix
{ color: '#B0B0B0' }

// Conversion:
// decodeRPrFromMarks:  '#B0B0B0' → { val: 'B0B0B0' }  (strips #)
// encodeMarksFromRPr:  { val: 'B0B0B0' } → '#B0B0B0'   (adds #)
```

---

## The DOCX Ghost Bug (2026-02-14)

### Symptom
First ghost suggestion immediately appears as normal (black) text instead of gray ghost text. The text becomes permanent — can't be dismissed, gets saved to disk.

### Root Cause
`insertText()` places text inside the **existing run**, inheriting that run's `runProperties`. Then `addMark()` applies the ghost color mark to the text node. But the **painter reads `runProperties`** (which still has the original color), not the text node marks. Result: text is gray in the hidden PM DOM but black in the painted output.

`calculateInlineRunPropertiesPlugin` SHOULD detect the mark/runProperties mismatch and split the run, but either:
- Doesn't fire for `addMark`-only changes on the same tick
- Detects but doesn't reliably split within the same dispatch cycle
- The painter renders before the split completes

### Fix (2026-02-14)
Instead of `insertText + addMark` (which relies on the splitting pipeline), create a **standalone run node** with the ghost color baked into `runProperties`:

1. Find the ancestor run at the cursor position
2. Split the ancestor run's content at the cursor offset
3. Create three runs: [before-text | ghost-text | after-text]
4. Replace the original run with the three-run sequence
5. Ghost run has `runProperties.color = { val: 'B0B0B0' }` → painter renders gray immediately

This bypasses the mark → runProperties propagation pipeline entirely.

### Secondary Fix: Update Timing Race
`DocxEditor.vue`'s `editor.on('update')` checks `ghostState.value?.type` to suppress saves during ghost. But this Vue ref may lag behind the ProseMirror plugin state. Fix: check `ghostPluginKey.getState()` directly instead of the Vue ref.

---

## SuperDoc Node Schema Reference

### Run Node Spec
```
name: "run"
oXmlName: "w:r"
group: "inline"
inline: true
content: "inline*"
attributes:
  runProperties: { default: null, keepOnSplit: true }
  rsidR, rsidRPr, rsidDel: revision IDs
```

### Creating Run Nodes Programmatically
```javascript
const schema = view.state.schema
const runType = schema.nodes.run

// Text node with marks
const ghostMark = schema.marks.textStyle.create({ color: '#B0B0B0' })
const textNode = schema.text('suggestion text', [ghostMark])

// Run with OOXML properties (no # prefix on color)
const runProperties = { color: { val: 'B0B0B0' } }
const run = runType.create({ runProperties }, textNode)
```

### Inheriting Run Properties
When creating a ghost run that should inherit formatting (font, size, etc.) from the surrounding text:
```javascript
const $pos = tr.doc.resolve(insertPos)
const ancestorRun = findAncestorRun($pos) // walk up $pos.depth
const baseProps = ancestorRun?.attrs?.runProperties
  ? JSON.parse(JSON.stringify(ancestorRun.attrs.runProperties))
  : {}
baseProps.color = { val: 'B0B0B0' }  // override color only
```

### Fragment Construction (no direct import needed)
```javascript
// Access Fragment class from any existing node's content:
const FragmentClass = someNode.content.constructor
const fragment = FragmentClass.from([run1, run2, run3])
```

---

## SuperDoc Extension API (for ghost plugin)

The ghost extension uses `Extension.create()` from `superdoc/super-editor`:

```javascript
import { Extensions } from 'superdoc/super-editor'
const { Extension, Plugin, PluginKey } = Extensions
```

### Key Patterns
- **Plugin state via `PluginKey`**: `ghostPluginKey.getState(view.state)` — returns the plugin's state for a given editor state
- **`addPmPlugins()`**: Returns array of raw ProseMirror plugins
- **`onUpdate({ editor })`**: Fires on every editor update (used for `++` detection)
- **`handleKeyDown(view, event)`**: ProseMirror key handler inside plugin props
- **`view().update(view)`**: Plugin view callback — fires after state update, used for external notifications

### Ghost Text Detection
Ghost text is found by scanning the document for text nodes with a `textStyle` mark whose color matches `GHOST_COLOR`:
```javascript
function findGhostRange(doc) {
  doc.descendants((node, pos) => {
    if (node.isText && node.marks.some(m =>
      m.type.name === 'textStyle' && m.attrs.color?.toUpperCase() === '#B0B0B0'
    )) { /* found */ }
  })
}
```
This is more reliable than position tracking because `wrapTextInRunsPlugin` shifts positions when restructuring nodes.

---

## Ghost Prompt Engineering

### Key Insight: LLMs Complete Suffix Boundaries
When context is truncated mid-word (e.g. `"the study was conduc"`), LLMs are strongly biased toward completing that fragment. This causes ghost suggestions to complete the SUFFIX boundary rather than the CURSOR position.

### Mitigations
1. **Truncate at word boundaries** — find the nearest whitespace before truncation point
2. **Add truncation markers** — `[…]` signals to the LLM that text continues
3. **Force context grounding** — `prefix_end` / `suffix_start` tool fields make the LLM explicitly read the text around the cursor, anchoring its output
4. **XML tags** — `<prefix>` / `<suffix>` instead of `--- TEXT BEFORE ---` (Anthropic models handle XML structure better)

### Prompt Evolution
- **v1 (current)**: Basic "generate 3-5 completions" with `--- TEXT BEFORE ---` markers
- **v2 (2026-02-14)**: XML tags, grounding fields, smart truncation, concise system prompt

---

## Previous Approaches Tried

### Overlay Approach (pre-2026-02-13)
Rendered ghost text as a floating DOM overlay positioned near the caret. **Did work** (confirmed by user) but had styling issues — overlay didn't match document fonts/margins/pagination.

### Inline Approach — First Attempt
Used `insertText + addMark`. Ghost text was in the document but appeared black (painter reads runProperties, not marks). This is the bug described above.

### Inline Approach — Fixed (2026-02-14)
Creates standalone run nodes with correct `runProperties`. Ghost text renders gray through the normal painting pipeline.

---

## Debugging Ghost Issues

### Console Logs
All ghost logs are prefixed `[ghost]`:
- `[ghost] context before/after` — text sent to API
- `[ghost] prompt:` — full prompt (debug, remove in prod)
- `[ghost] textStyle mark not found` — schema issue
- `[ghost] Ghost text NOT findable after insert` — mark was stripped
- `[ghost] Ghost text found at X-Y` — mark preserved (success)
- `[ghost] error:` — API or insertion error

### Diagnostic Verification
After ghost text insertion, a `setTimeout(200ms)` checks if `findGhostRange()` can locate the ghost text. If it can't, the mark was stripped by a SuperDoc internal plugin.

### Key State to Monitor
- `ghostPluginKey.getState(view.state)` — `{ type, suggestions, activeIndex }`
- `type: null` = idle, `'loading'` = API in flight, `'suggestion'` = ghost visible
- Ghost text in document: look for `textStyle` mark with color `#B0B0B0`
- Run properties: check parent run's `attrs.runProperties.color.val`
