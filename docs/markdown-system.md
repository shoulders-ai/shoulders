# Markdown System

Markdown (`.md`) is the primary file type in Shoulders. It gets two layers of enhancement: rendered HTML preview and PDF export via Typst. Editing is done in raw text mode with formatting shortcuts.

## Architecture Overview

```
Raw editing    — plain CodeMirror with syntax highlighting + formatting shortcuts
HTML Preview   — marked + KaTeX + hljs — side-by-side rendered view
PDF Export     — pulldown-cmark → Typst markup → template → typst compile → PDF
```

## Relevant Files

| File | Purpose |
|---|---|
| `src/editor/markdownShortcuts.js` | Keymap: Cmd+B bold, Cmd+I italic, Cmd+K link, etc. |
| `src/utils/markdownPreview.js` | Marked instance with KaTeX, highlight.js, footnotes, citations, wiki links |
| `src/components/editor/MarkdownPreview.vue` | Rendered HTML preview component (side-by-side, Geist font) |
| `src-tauri/src/typst_export.rs` | Rust: markdown→Typst conversion + 5 templates + compile + binary discovery |
| `src/stores/typst.js` | Pinia store: per-file PDF settings, availability check, export action |
| `src/components/editor/PdfSettingsPopover.vue` | PDF settings popover (template, font, size, margins, spacing) |
| `src/components/editor/TabBar.vue` | Markdown buttons: Preview, Create PDF, gear icon |
| `src/components/editor/EditorPane.vue` | MarkdownPreview viewer + preview/export handlers |
| `src/utils/fileTypes.js` | `preview:` virtual path routing, `isPreviewPath()` |
| `src/stores/toast.js` | Toast notifications (first PDF creation) |
| `src/components/layout/ToastContainer.vue` | Fixed bottom-right toast stack |

---

## Formatting Shortcuts

`markdownShortcuts.js` provides keymap bindings:

| Shortcut | Action | Toggle Logic |
|---|---|---|
| `Cmd+B` | Bold | Check 2 chars before/after selection for `**` |
| `Cmd+I` | Italic | Check 1 char before/after for `*` |
| `Cmd+Shift+X` | Strikethrough | Check 2 chars for `~~` |
| `Cmd+E` | Inline code | Check 1 char for backtick |
| `Cmd+K` | Link | Wrap as `[text](url)`, select `url` |
| `Cmd+Shift+.` | Blockquote | Toggle `> ` line prefix |
| `Cmd+Shift+7` | Ordered list | Toggle `1. ` prefix |
| `Cmd+Shift+8` | Bullet list | Toggle `- ` prefix |

Each function reads the selection, checks if the wrapper already exists, and dispatches an insert or delete transaction.

**Note:** `Cmd+B` is intercepted at the `App.vue` level for sidebar toggle. The handler returns early for `.md` and `.docx` files, letting the editor handle it.

---

## Layer 2: Rendered HTML Preview

### Marked Configuration

`markdownPreview.js` creates a **separate** `Marked` instance (doesn't share with `chatMarkdown.js`) with:

- **KaTeX**: `$inline$` and `$$display$$` math via `marked-katex-extension`
- **Syntax highlighting**: 17 languages via selective `highlight.js` imports (~50KB)
- **Footnotes**: via `marked-footnote`
- **Wiki links**: `[[target]]` → clickable `<a class="md-preview-wikilink">`
- **Citations**: `[@key]` → resolved via references store → "(Author, Year)"
- **Sanitization**: DOMPurify with KaTeX and MathML tags allowed

### Preview Component

`MarkdownPreview.vue` is an async component loaded via `EditorPane.vue`:

- Uses `preview:` virtual path prefix (e.g., `preview:/path/to/file.md`)
- Watches `filesStore.fileContents[sourcePath]` → re-renders on change (300ms debounce)
- Click handler: wiki links navigate, citations open reference detail
- Styled with themed CSS vars (`--hl-heading`, `--bg-secondary`, etc.)
- Max-width 800px, centered, Geist font (sans-serif), `line-height: 1.7`

### Opening Preview

Click "Preview" button in TabBar → `handlePreviewMarkdown()`:
1. Builds `preview:${activeTab}` virtual path
2. Checks if already open in any pane
3. Splits pane vertically using `editorStore.activePaneId` (always a leaf)
4. Returns focus to source pane

### Theme Integration

Highlight.js classes are mapped to existing `--hl-*` CSS vars so code blocks in the preview match the active editor theme automatically.

---

## PDF Export via Typst

### Typst Overview

[Typst](https://typst.app/) is a modern typesetting system — like LaTeX but with much faster compilation and simpler syntax. Shoulders uses it as a backend to convert markdown to publication-quality PDFs.

### Conversion Pipeline

```
.md file → pulldown-cmark parser → Typst markup → template wrapper → typst compile → .pdf
```

### Markdown → Typst Conversion

`typst_export.rs:markdown_to_typst()` uses pulldown-cmark to parse markdown events and emit Typst syntax:

| Markdown | Typst |
|---|---|
| `# Heading` | `= Heading` |
| `**bold**` | `*bold*` |
| `*italic*` | `_italic_` |
| `` `code` `` | `` `code` `` |
| `[text](url)` | `#link("url")[text]` |
| `![alt](path)` | `#image("path")` |
| `> quote` | `#quote[...]` |
| Code fences | ` ```lang ... ``` ` |
| `$math$` | `$math$` (same!) |
| `[@key]` | `@key` (Typst native citations) |
| Tables | `#table()` function |
| `~~strike~~` | `#strike[...]` |
| `---` | `#line(length: 100%)` |

### Templates & PDF Settings

`wrap_in_template()` accepts a `PdfSettings` struct and generates the Typst preamble accordingly. No special syntax is needed in the markdown — the template is purely a rendering concern injected at export time.

#### Available Templates

| Template | Description | Key Typst Rules |
|---|---|---|
| **Clean** (default) | Minimal, no numbering | `heading(numbering: none)`, justified |
| **Academic** | Papers and essays | `heading(numbering: "1.1")`, first-line indent, tighter leading |
| **Report** | Formal reports | `heading(numbering: "1.1")`, page numbers, chapter page breaks |
| **Letter** | Correspondence | Left-aligned (no justify), no numbering |
| **Compact** | Reference sheets | Two-column, 9pt font, narrow margins |

#### Configurable Settings

| Setting | Options | Default |
|---|---|---|
| Font | STIX Two Text, Lora, Times New Roman, Inter, Arial | STIX Two Text |
| Font size | 9–14pt | 11pt |
| Page size | A4, US Letter, A5 | A4 |
| Margins | Narrow (1.5cm), Normal (2.5cm), Wide (3.5cm) | Normal |
| Spacing | Compact (0.8em), Normal (1.8em), Relaxed (2.4em) | Normal |

STIX Two Text, Lora, and Inter are bundled as Tauri resources (`bundle.resources` in `tauri.conf.json`). Typst finds them via `--font-path` pointing to the resolved font directory (`find_font_dir()`). Times New Roman and Arial are system fonts — `--font-path` is additive, so they still work. If a saved font is no longer in the list (e.g., after upgrading from the old 9-font list), the popover resets to the first font.

#### Settings Storage

Per-file settings stored in `.project/pdf-settings.json`, keyed by relative path. Loaded at workspace open via `typstStore.loadSettings()`. If a source file is renamed/deleted, orphaned entries are harmless — next export uses defaults.

#### Settings UI

Gear icon next to "Export PDF" in TabBar opens `PdfSettingsPopover.vue` (Teleported, fixed position). Template selection is a row of toggle buttons; other settings are dropdowns. The "Export PDF" button in the popover saves settings and triggers export in one click.

### Binary Discovery

`find_typst()` uses a 5-tier search (same pattern as `find_tectonic` for LaTeX):

1. **Bundled sidecar** — next to executable (production builds)
2. **Resource dir** — Tauri v2 bundled resources
3. **Dev binaries** — `src-tauri/binaries/typst-{triple}`
4. **System paths** — `/opt/homebrew/bin/typst`, `/usr/local/bin/typst`, `~/.cargo/bin/typst`
5. **Shell lookup** — `which typst` (Unix) / `where typst` (Windows)

### Sidecar Bundling (Production)

Typst binaries are placed in `src-tauri/binaries/` with target-triple suffixes:
- `typst-aarch64-apple-darwin` (Apple Silicon)
- `typst-x86_64-apple-darwin` (Intel Mac)

In production builds, Tauri includes the correct binary automatically. Users never need to install anything — the PDF button just works.

### Tauri Commands

| Command | Signature | Purpose |
|---|---|---|
| `export_md_to_pdf` | `(md_path, bib_path?, settings?) → ExportResult` | Convert + compile with template/font/margins, returns `{success, pdf_path, errors, warnings, duration_ms}` |
| `is_typst_available` | `() → bool` | Check if Typst binary exists |

### Bibliography

Bibliography inclusion is **citation-gated**: the Rust exporter checks whether the markdown source contains any `[@key]` citations before including a `#bibliography()` directive. If the document has no citations, no bibliography section is rendered — even if the reference library has entries and a `.bib` file is provided.

The check chain:
1. `handleExportPdf()` calls `ensureBibFile()` which exports the full reference library to `references.bib`
2. Rust reads the markdown and checks for `[@` (Pandoc citation syntax)
3. If no citations found → `effective_bib = None` → no bibliography in output
4. If citations found → Rust also verifies the `.bib` has `@type{}` entries (not just comments)

### Frontend Flow

1. User clicks "Create PDF" in TabBar (or "Create PDF" in settings popover)
2. `handleExportPdf()` resolves settings: popover override > saved per-file > defaults
3. Checks if the PDF already exists on disk (`path_exists`)
4. Calls `typstStore.exportToPdf(activeTab, bibPath, settings)`
5. On success:
   - **First creation**: toast notification ("Created filename.pdf in Xms")
   - **Subsequent updates**: no toast (silent re-export)
   - PDF opens in split pane via `ensurePdfOpen()` — reopens if user closed it
6. On error: error message sent to AI chat via `chat-prefill` event

### Split Pane Reliability

`ensurePdfOpen()` and `handlePreviewMarkdown()` use `editorStore.activePaneId` (always a leaf node) rather than the component's `props.paneId` to determine which pane to split. This avoids a bug where `props.paneId` could point to a split node after a previous split operation mutated the tree — `splitPaneWith` would then silently fail because `findPane` matched the split parent, not the leaf.

### bun Dependencies

| Package | Purpose |
|---|---|
| `marked` | Markdown parser (for HTML preview) |
| `marked-katex-extension` | KaTeX math rendering |
| `marked-highlight` | Code block syntax highlighting |
| `marked-footnote` | Footnote support |
| `katex` | Math rendering engine |
| `dompurify` | HTML sanitization |
| `highlight.js` | Syntax highlighting (selective imports) |

### Rust Dependencies

| Crate | Purpose |
|---|---|
| `pulldown-cmark` | Markdown → event stream parser (for Typst conversion) |

---

## File Export UX

The PDF is created alongside the `.md` file (e.g., `notes.md` → `notes.pdf`). The button is labeled "Create PDF". A gear icon next to it opens per-file settings (template, font, page size, margins).

Since the workspace is a regular folder on the user's filesystem, all files are always accessible via Finder/Explorer.

### Markdown Editing Philosophy

Markdown is edited in **raw text mode** — no semi-WYSIWYG decorations. Users write markdown directly and use "Preview" for a side-by-side rendered view (to check URLs, images, formatting). PDF creation is a deliberate action, not a continuous preview.

### PDF Auto-Reload

When the user clicks "Create PDF" again after the first export, the open PdfViewer automatically reloads. `handleExportPdf` dispatches a `pdf-updated` custom event with the path; `PdfViewer.vue` listens for it and re-reads the file from disk (destroying the old pdfjs document first).

### Dollar Sign Escaping

Typst uses `$` as a math delimiter. Non-math `$` signs in markdown text (e.g., "$10 budget") are escaped to `\$` during conversion to prevent "unclosed delimiter" errors. Math expressions (`$...$` and `$$...$$`) pass through correctly via pulldown-cmark's `ENABLE_MATH` option.
