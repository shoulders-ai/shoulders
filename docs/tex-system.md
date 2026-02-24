# LaTeX (.tex) Support

Shoulders provides first-class LaTeX editing with live PDF preview, auto-compilation, citation management, and SyncTeX position synchronization.

## Architecture Overview

```
User types in .tex → auto-save (1s) → auto-compile debounce (4s more)
  → Tectonic compiles → PDF appears in adjacent pane
  → errors shown in PDF viewer toolbar → "Ask AI to fix" sends to chat
```

### File Layout

| File | Purpose |
|---|---|
| `src-tauri/src/latex.rs` | Rust: compile_latex (runs Tectonic), synctex_forward/backward, LatexState |
| `src/stores/latex.js` | Pinia store: per-file compile state, 4s debounce, enabled + auto-compile toggles |
| `src/components/editor/LatexPdfViewer.vue` | Wraps PdfViewer with compile toolbar + error panel |
| `src/editor/latexCitations.js` | CM6 extension: `\cite{}` decorations, autocomplete, hover tooltips |
| `src/editor/latexAutocomplete.js` | CM6 completion source: ~80 LaTeX commands |
| `src/services/latexBib.js` | Auto-generates `references.bib` from reference library |

### Modified Files

- **TextEditor.vue**: Loads LaTeX extensions for `.tex` files, hooks auto-compile after save, handles backward sync events, auto-opens PDF on first compile
- **EditorPane.vue**: Routes PDFs with `.tex` source to `LatexPdfViewer`
- **Settings.vue**: Tectonic enable/disable toggle in Environment section
- **references.js**: `citedIn` getter scans `.tex` files for `\cite{}` patterns
- **chatTools.js**: `cite_reference` tool inserts `\cite{key}` for `.tex` files
- **ReferenceList.vue**: Drag to `.tex` editor inserts `\cite{key}` instead of `[@key]`
- **fileTypes.js**: Added `isLatex()` utility, updated icon to `IconMath`

## Compilation Engine

**Tectonic** is a Rust-based, self-contained TeX compiler. On first compilation of a document, it downloads required packages (~30MB) from a bundle server. Subsequent compilations use the cached packages and run in 2-5 seconds.

### How Compilation Works

1. User edits `.tex` file → auto-save fires (1s debounce)
2. `TextEditor.vue` calls `latexStore.scheduleAutoCompile(path)`
3. Latex store waits 4s (total ~5s from last keystroke)
4. Before invoking Tectonic: auto-generates `references.bib` from library
5. Rust invokes Tectonic sidecar with `--synctex --keep-logs`
6. Output parsed for errors/warnings, stored in `latexStore.compileState[path]`
7. `latex-compile-done` event dispatched
8. `LatexPdfViewer` refreshes PDF from disk

### Tectonic Discovery

Tectonic is **not bundled** with the app. It is downloaded on demand via Settings → System.

The Rust backend (`find_tectonic` in `latex.rs`) searches for Tectonic in this order:

1. **Shoulders-managed install** — `~/.shoulders/bin/tectonic` (downloaded via Settings)
2. **System install** — `/opt/homebrew/bin/tectonic`, `/usr/local/bin/tectonic`, `~/.cargo/bin/tectonic`
3. **Shell lookup** — `bash -lc "which tectonic"` (Unix) / `where tectonic` (Windows)

### On-Demand Download

If Tectonic is not found when the user clicks Compile:
1. Error panel shows "Tectonic not found" with a **Settings** button
2. Clicking it opens Settings → System → Tectonic card
3. User clicks **Download** (~15MB one-time download from [tectonic GitHub releases](https://github.com/tectonic-typesetting/tectonic/releases))
4. Binary is saved to `~/.shoulders/bin/tectonic` with progress bar
5. Official release binaries are statically linked — no external dependencies

Platform binaries downloaded:
- macOS ARM: `aarch64-apple-darwin`
- macOS Intel: `x86_64-apple-darwin`
- Linux: `x86_64-unknown-linux-musl` (static, no glibc dependency)
- Windows: `x86_64-pc-windows-msvc`

### Error Parsing

Tectonic output is parsed for:
- `error: ...` lines → displayed in error panel with "Ask AI to fix"
- `warning: ...` lines → displayed as warnings
- `! ...` lines → TeX errors (e.g., "Undefined control sequence")
- `l.42 ...` lines → line numbers attached to preceding errors

## Compile Controls (TabBar)

When a `.tex` file is the active tab, the TabBar shows compile controls (same position as Run/Render for `.R`/`.Rmd` files):

- **Status indicator**: spinner + "Compiling…", green "● 2.1s" (success), red "✕ 2 errors" (failure)
- **Compile button**: Triggers manual compile (also auto-compiles on save)
- **Auto toggle**: Enables/disables auto-compile on save (green = on, muted = off). Manual compile always works regardless.
- **Sync button**: Forward SyncTeX sync — jumps PDF to current cursor position

## PDF Viewer

When a `.pdf` file is opened and a `.tex` file with the same basename exists in the same directory, `EditorPane` routes to `LatexPdfViewer` instead of the plain `PdfViewer`.

### Error Panel

- Shows only when there are errors or warnings (no toolbar otherwise)
- Lists errors with line numbers, messages, and severity
- Click error to jump to line in `.tex` editor
- "Ask AI to fix" button pre-fills chat with error context + surrounding code

### Auto-Open

On first successful compile, TextEditor automatically:
1. Splits the current pane vertically
2. Opens the compiled PDF in the new pane

## Citations

### `\cite{}` in `.tex` Files

The `latexCitations.js` extension provides:

- **Decorations**: `\cite{}` command highlighted, keys colored (green = found, red = broken, yellow = needs review)
- **Annotations**: Inline "(Author Year)" widget after each `\cite{}` command
- **Autocomplete**: Type inside `\cite{` braces → reference library search
- **Hover tooltips**: Hover over a key → full citation details
- **Supported commands**: `\cite`, `\citep`, `\citet`, `\citealp`, `\citeauthor`, `\citeyear`, `\autocite`, `\textcite`, `\parencite`, `\nocite`

### BibTeX Generation

Before each compile, `latexBib.js` generates a `references.bib` file in the same directory as the `.tex` file. This file contains all references from the Shoulders reference library in BibTeX format.

The generated file has a header comment and is overwritten on each compile:
```bibtex
% Auto-generated by Shoulders from reference library
% Do not edit manually - changes will be overwritten on next compile
```

### Reference Drag-and-Drop

Dragging references from the sidebar to a `.tex` editor inserts `\cite{key}` (single) or `\cite{key1, key2}` (multiple), instead of the Pandoc `[@key]` format used for `.md` files.

### Chat Integration

The `cite_reference` chat tool detects when the active editor is a `.tex` file and inserts `\cite{key}` instead of `[@key]`.

## LaTeX Autocomplete

The `latexAutocomplete.js` extension provides completions for ~80 common LaTeX commands:

- **Sections**: `\section`, `\subsection`, `\chapter`, etc.
- **Text formatting**: `\textbf`, `\textit`, `\emph`, etc.
- **Environments**: `\begin{equation}`, `\begin{figure}`, `\begin{itemize}`, etc.
- **References**: `\label`, `\ref`, `\cite`, `\footnote`
- **Math symbols**: Greek letters, operators, relations, arrows
- **Includes**: `\usepackage`, `\input`, `\includegraphics`

Commands with braces use cursor positioning — after insertion, the cursor is placed inside the first `{}`.

## SyncTeX

SyncTeX provides bidirectional position synchronization between `.tex` source and PDF output.

### Forward Sync (Editor → PDF)

1. Click the Sync button in the `.tex` TabBar
2. `EditorPane` dispatches `latex-request-cursor` event
3. `TextEditor` responds with current line number via `latex-cursor-response`
4. `LatexPdfViewer` receives response → Rust parses `.synctex.gz` → returns page + position
5. PDF viewer scrolls to the corresponding page

### Backward Sync (PDF → Editor)

1. Double-click in the PDF
2. Rust parses `.synctex.gz` → returns file + line
3. `TextEditor` receives `latex-backward-sync` event
4. Editor scrolls to the line and centers it in view

### SyncTeX File Parsing

The Rust parser (`latex.rs`) handles:
- `Input:` declarations (file ID → path mapping)
- `{page}` markers (current page tracking)
- `h/v/x` records (position data: input, line, x, y, width, height)
- Gzip decompression via `flate2` crate

## Settings

In **Settings → System**, the Tectonic card has three states:

- **Not installed**: Shows download button (~15MB) with description
- **Downloading**: Progress bar with percentage
- **Installed**: Shows install path + enable/disable toggle

The enable/disable toggle state is synchronized between the Pinia store and Rust backend (`LatexState`).

Settings can be opened directly from the compile error panel via `workspace.openSettings('system')` (store-based navigation).

## Enterprise / Air-Gapped Use

Disable Tectonic in Settings to prevent:
- Any compilation attempts
- Package downloads from the internet
- SyncTeX file generation

This is useful for environments where external network access is restricted or where Tectonic is not available.
