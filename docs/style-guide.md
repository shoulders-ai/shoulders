# Design & Style Guide

8 themes (4 light, 4 dark), all defined via CSS custom properties. Class-based switching on `<html>`.

## Relevant Files

| File | Role |
|---|---|
| `src/css/fonts.css` | `@font-face` declarations for self-hosted variable fonts |
| `src/style.css` | Imports `src/css/*.css`, base resets, scrollbar, selection |
| `src/css/themes.css` | All theme definitions (CSS vars for 8 themes) |
| `src/css/editor.css` | CodeMirror widget styles (ghost, diff, tasks, wiki links) |
| `src/css/components.css` | Global component styles (context menu, quick open, version history, kbd) |
| `src/css/handsontable.css` | Handsontable (CSV editor) theme overrides |
| `src/css/superdoc.css` | SuperDoc (DOCX editor) theme overrides |
| `src/css/xterm.css` | xterm.js (terminal) theme overrides |
| `src/editor/theme.js` | CodeMirror theme + syntax highlighting (uses CSS vars) |
| `src/themes/terminal.js` | xterm.js color objects per theme (hex, not CSS vars — canvas needs literal values) |
| `src/components/Settings.vue` | Theme picker UI |
| `src/stores/workspace.js` | `theme` state, `setTheme()`, localStorage persistence |

## Themes

| Theme | Class | Description |
|---|---|---|
| Light | `.theme-light` | High contrast, cadet blue (`#5f9ea0`) accent |
| Solarized Light | `.theme-solarized` | Ethan Schoonover's cream palette, blue accent |
| One Light | `.theme-one-light` | Atom-inspired, clean with purple keywords |
| Humane | `.theme-humane` | Warm paper-white, terracotta (`#b5623a`) accent |
| Tokyo Night | `:root` (default) | Blue/purple dark theme |
| Dracula | `.theme-dracula` | Purple/pink/cyan dark theme |
| Monokai | `.theme-monokai` | Classic Monokai — orange/pink accents |
| Nord | `.theme-nord` | Arctic palette — frost blue accents |

Switching: `workspace.setTheme('monokai')` → adds `.theme-monokai` to `<html>`, persists to localStorage. All components using `var(--*)` update instantly. Terminal needs explicit JS update (watched in `Terminal.vue`).

## CSS Variables (per theme)

**UI colors** (14): `--bg-primary`, `--bg-secondary`, `--bg-tertiary`, `--bg-hover`, `--fg-primary`, `--fg-secondary`, `--fg-muted`, `--accent`, `--accent-secondary`, `--border`, `--success`, `--error`, `--warning`, `--info`

**Syntax highlighting — Markdown** (11): `--hl-heading`, `--hl-heading-minor`, `--hl-emphasis`, `--hl-link`, `--hl-code`, `--hl-number`, `--hl-keyword`, `--hl-function`, `--hl-type`, `--hl-operator`, `--hl-list`

**Syntax highlighting — Code tokens** (16): `--hl-string`, `--hl-comment`, `--hl-constant`, `--hl-property`, `--hl-tag`, `--hl-attribute`, `--hl-regexp`, `--hl-escape`, `--hl-self`, `--hl-def-keyword`, `--hl-ctrl-keyword`, `--hl-module-keyword`, `--hl-class`, `--hl-decorator`, `--hl-punctuation`, `--hl-bracket`

**Editor-specific** (5): `--editor-active-line`, `--editor-selection`, `--editor-bracket-match`, `--editor-bracket-border`, `--editor-search-match`

**Size** (2): `--editor-font-size`, `--ui-font-size`

**Fonts** (3): `--font-sans`, `--font-mono`, `--ui-font`

### Adding a new theme

1. Add a CSS class in `src/css/themes.css` (e.g. `.theme-dracula`) overriding all `--*` vars
2. Add a terminal color object in `src/themes/terminal.js`
3. Add a theme card in `src/components/Settings.vue` (themes array)
4. Add the class name to `workspace.setTheme()`'s removal list

## Typography

### Fonts
Self-hosted variable fonts in `public/fonts/`, declared in `src/css/fonts.css`:
- **Inter** (variable, 100–900 + italic): UI text — labels, buttons, status bar
- **JetBrains Mono** (variable, 100–800 + italic, `font-variant-ligatures: none`): Editor, terminal, code
- **Geist** (variable, 100–900): Markdown preview only

### Font CSS Variables (`:root` in `themes.css`)
- `--font-sans`: `'Inter', system-ui, sans-serif` — body default, inherited everywhere
- `--font-mono`: `'JetBrains Mono', 'Menlo', 'Consolas', monospace` — used via `var(--font-mono)` wherever code/mono is needed
- `--ui-font`: alias for `--font-sans` — used in SuperDoc/DOCX overrides

Only set `font-family` explicitly when switching to mono. Sans inherits from body. Exception: `Terminal.vue` hardcodes the font string because xterm.js renders to canvas and can't resolve CSS vars.

### Font Sizes
- Base: 13px (`html, body, #app` in style.css)
- Editor: controlled by `--editor-font-size` (default 14px), adjusted via Cmd+=/- zoom
- Terminal: 13px (xterm.js config, not zoom-responsive)

#### Zoom-Responsive UI Sizes (`ui-text-*`)
All right sidebar text (except terminal) uses the `ui-text-*` utility classes defined in `src/css/themes.css`. These scale with `--ui-font-size` (default 13px, adjusted via Cmd+=/- zoom):

| Class | Formula | Default |
|---|---|---|
| `ui-text-xs` | `--ui-font-size - 4px` | 9px |
| `ui-text-sm` | `--ui-font-size - 3px` | 10px |
| `ui-text-md` | `--ui-font-size - 2px` | 11px |
| `ui-text-base` | `--ui-font-size - 1px` | 12px |
| `ui-text-lg` | `--ui-font-size` | 13px |
| `ui-text-xl` | `--ui-font-size + 1px` | 14px |
| `ui-text-2xl` | `--ui-font-size + 2px` | 15px |

For scoped CSS rules that can't use utility classes, use `calc(var(--ui-font-size) ± Npx)` or `var(--ui-font-size)` directly. Do NOT use hardcoded pixel values or Tailwind `text-*` classes for font sizes in the right sidebar.

### Line Heights
- Editor: 1.6 (`.cm-content`)
- Terminal: 1.4 (xterm.js config)
- Default UI: normal (inherited)

## Syntax Highlighting (`theme.js`)

All token colors use CSS vars (`var(--hl-*)`) so they auto-switch with theme. Key mappings:

| Token | CSS Variable |
|---|---|
| Headings 1-3 | `--hl-heading` |
| Headings 4-6 | `--hl-heading-minor` |
| Emphasis | `--hl-emphasis` |
| Strong | `--fg-primary` |
| Links | `--hl-link` |
| Code/strings | `--hl-code` |
| Numbers | `--hl-number` |
| Keywords | `--hl-keyword` |
| Functions | `--hl-function` |
| Types | `--hl-type` |
| Operators | `--hl-operator` |
| List markers | `--hl-list` |
| Comments | `--fg-muted` |

This works because `HighlightStyle.define()` generates CSS class rules, not inline styles — CSS vars resolve at render time.

## Styling Approach

### Tailwind CSS
Used for layout utilities (flex, grid, padding, margin, sizing). The config is minimal:
```js
content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
darkMode: 'class',
```

### Inline Styles for Colors
Components use inline `:style` bindings with CSS variables rather than Tailwind color classes:
```html
<div :style="{ color: 'var(--fg-muted)', background: 'var(--bg-secondary)' }">
```
This keeps all colors centralized in the CSS variables, making theme changes easier.

### Global CSS in `src/css/`
Complex UI elements live in dedicated CSS files rather than scoped component styles:

**`src/css/editor.css`** — CodeMirror widget styles:
- Ghost text (`.ghost-text`, `.ghost-badge`, `.ghost-spinner`)
- Diff overlays (`.diff-deletion`, `.diff-insertion-widget`, `.diff-new-text`, `.diff-accept`, `.diff-reject`)
- Task markers (`.task-gutter`, `.task-dot`, `.task-range`)
- Wiki links (`.cm-wikilink`, `.cm-wikilink-broken`, `.cm-wikilink-bracket`, `.cm-wikilink-target`, `.cm-wikilink-display`, `.cm-wikilink-pipe`)

**`src/css/components.css`** — Shared component styles:
- Context menu (`.context-menu`, `.context-menu-item`)
- Search results dropdown (`.search-results-dropdown`, `.quick-open-item`)
- Version history (`.version-overlay`, `.version-modal`)
- Keyboard badges (`kbd`)
- Chat UI: `.chat-md` (markdown scope — headings, lists with explicit `list-style-type`, blockquotes, tables, links, code), `.chat-msg-user` (bubble, right-aligned `w-fit`), `.chat-msg-assistant` (full-width), `.chat-code-block`/`.chat-code-lang`/`.chat-inline-code` (code rendering), `.chat-streaming-dots` (pulsing 3-dot indicator), `.chat-thinking-bar` (gradient shimmer), `.chat-tool-line`/`.chat-tool-detail` (compact tool calls with expand), `.chat-context-cards`/`.chat-context-chip` (file ref + selection pills below user bubble), `.chat-user-clamped`/`.chat-show-more` (5-line truncation)

These are in global stylesheets because they're used by CodeMirror widgets (which exist outside Vue's scoped style system) or by multiple components.

### Scoped Styles
15 components use `<style scoped>`:
- `ResizeHandle.vue` — resize handle sizing and hover
- `SplitHandle.vue` — split handle sizing and hover
- `NotebookEditor.vue`, `NotebookCell.vue`, `CellOutput.vue` — notebook layout
- `DocxEditor.vue` — SuperDoc container
- `PdfViewer.vue` — PDF canvas and text layer
- `ImageViewer.vue` — zoom/pan container
- `ReferenceView.vue` — reference detail card
- `Settings.vue` — settings modal and theme cards
- `SetupWizard.vue` — first-run wizard
- `FileTreeItem.vue` — tree item hover/indent
- `ChatMessage.vue` — message bubble layout
- `TaskThread.vue` — task thread styling
- `ProposalCard.vue` — AI proposal card

## Scrollbar Styling

Custom WebKit scrollbars (`style.css:40-53`):
- 8px width/height
- Transparent track
- `--fg-muted` colored thumb with 4px border-radius
- Lighter on hover (`--fg-secondary`)

## Selection Styling

Text selection uses `var(--editor-selection)` — changes per theme.

## Icons

- **Header**: Tabler icons (`IconLayoutSidebar`/`IconLayoutSidebarFilled`, `IconLayoutSidebarRight`/`IconLayoutSidebarRightFilled`, `IconSettings`, `IconSearch`). Filled variants for active sidebar state.
- **File tree**: Tabler icons (`IconFileText`, `IconFile`, `IconBraces`, `IconFileCode`, `IconTerminal2`, `IconLock`, `IconChevronRight`)
- **Other components**: Inline SVGs (stroke-based, 16px, `stroke-width="1.5"`)

## Animation

- Ghost spinner: CSS `@keyframes spin` (360deg rotation, 1s linear infinite)
- Task processing dot: CSS `@keyframes pulse` (opacity 1 → 0.4 → 1, 1.5s ease)
- Save message: opacity transition (fades out after 2s)
- Folder expand arrow: CSS transition on rotation (100ms)
- Resize handles: background transition (150ms)

## Tauri-Specific Styling

The header has `padding-left: 78px` to accommodate the macOS traffic light buttons (close/minimize/maximize). The `data-tauri-drag-region` attribute on the header enables window dragging on the overlay titlebar.
