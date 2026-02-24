# R Markdown / Quarto Chunk System

.Rmd and .qmd files get inline code chunk execution via Jupyter kernels, HTML preview with knitted outputs, and PDF export via Typst.

## File Map

| File | Role |
|---|---|
| `src/editor/codeChunks.js` | CM6 StateField that parses ```` ```{r} ```` fences into chunk objects `{ language, headerLine, contentFrom, contentTo, endLine }`. Gutter play buttons, line highlighting. |
| `src/editor/chunkOutputs.js` | CM6 StateField + block widget for inline outputs below chunks. `CellOutput.vue` mounted per widget. |
| `src/services/chunkKernelBridge.js` | Lifecycle bridge: one Jupyter kernel per language, deduplicates concurrent launches via `_launching` promise cache. Returns `{ outputs, success }` or a setup-error output (never null). |
| `src/services/rmdKnit.js` | Knits full .Rmd content — executes all chunks via its own `ChunkKernelBridge`, returns clean markdown with outputs embedded. Used by preview (HTML images) and PDF export (file images). |
| `src/components/editor/TextEditor.vue` | Wires chunk execution: `Cmd+Enter` (single chunk + advance), `Shift+Cmd+Enter` (run all), gutter `chunk-execute` events. |
| `src/components/editor/EditorPane.vue` | PDF export: calls `knitRmd()` with `imageDir`, writes knitted markdown to temp file, runs Typst. |
| `src/components/editor/MarkdownPreview.vue` | HTML preview: calls `knitRmd()` without `imageDir` (data URI images). |

## Chunk Identity

`chunkKey(chunk, doc)` → `"language::headerLine::first80chars"`.

The key includes `headerLine` (1-based line number) to disambiguate chunks with identical content prefixes. Tradeoff: inserting lines above a chunk orphans its output (acceptable — output is stale after structural edits, re-run recreates it).

## Execution Flow

1. **Single chunk**: gutter play or `Cmd+Enter` → `executeChunk()` dispatches `setChunkOutput(status:'running')` → spinner widget → `kernelBridge.execute()` → dispatches `setChunkOutput(outputs, status:'done')` → `CellOutput.vue` widget.
2. **Run All**: `Shift+Cmd+Enter` or gutter "Run All" button → sequential loop, re-reads `state.field(chunkField)` on each iteration (offsets shift as output widgets are added).
3. **Cold start**: first execution triggers environment detection (`which` + `--version` probes) → kernel discovery → kernel launch (3-5s for IRkernel). Spinner shows during this time.

## Knitting Pipeline (`rmdKnit.js`)

`knitRmd(content, workspacePath, { imageDir })` creates its own `ChunkKernelBridge`, executes every chunk, and formats outputs as markdown.

Two modes controlled by `imageDir`:

| | Preview (no `imageDir`) | PDF export (`imageDir` set) |
|---|---|---|
| PNG/JPEG | `<img src="data:base64,...">` | `![output](file.png)` (saved to disk) |
| SVG | Inline `<svg>` | Saved as `.svg` file → `![output](file.svg)` |
| HTML tables | Raw `<table>` HTML | Downgraded to `text/plain` (fenced code block) |
| stderr | `<pre>` with error styling | Fenced code block |
| errors | `<pre>` with error styling | Fenced code block |
| stdout | Fenced code block | Fenced code block |

The PDF path avoids HTML because Typst's markdown→typst converter (`typst_export.rs`) drops all HTML tags as comments.

## Key Decisions

- **Jupyter-only, no subprocess fallback.** Chunks need shared execution state (variables persist across chunks). A REPL subprocess can't return structured MIME outputs. When no kernel is found, a clear install-instructions error is shown inline.
- **Each consumer creates its own `ChunkKernelBridge`.** The editor's bridge (in `TextEditor.vue`) is separate from `knitRmd`'s bridge. They may share the same kernel process (via kernel store dedup) but have independent lifecycle.
- **Block widgets must come from a StateField**, not a ViewPlugin. CM6 throws `"Block decorations may not be specified via plugins"`. This is why `chunkOutputs.js` uses two StateFields (data + decorations).
