// Default SKILL.md content for the shoulders-meta skill.
// This is auto-generated into .project/skills/shoulders-meta/SKILL.md for new workspaces.
// The canonical version is the SKILL.md file itself — update there first, then sync here.

export default `# Shoulders — App Reference

> **For the AI agent.** This is a technical reference. When answering the user, translate to plain language appropriate to their question and level of expertise. Do not expose internal file paths or architecture details unless the user is asking a technical question. For unresolved issues, direct to contact@shoulde.rs.

---

## What is Shoulders

Desktop app (macOS, Windows, Linux) for researchers. Writing, references, and AI in one system. Local-first: files live on the user's filesystem, no cloud sync required, works fully offline for all non-AI features. A "workspace" is any folder — no proprietary format. Website: shoulde.rs. Support: contact@shoulde.rs.

---

## Editing

### Markdown (.md, .rmd, .qmd)
- Auto-save 1 second after last edit. Cmd+S creates a version history checkpoint.
- Formatting shortcuts: Cmd+B (bold), Cmd+I (italic), Cmd+K (link), Cmd+E (inline code), Cmd+Shift+X (strikethrough), Cmd+Shift+. (blockquote), Cmd+Shift+7 (numbered list), Cmd+Shift+8 (bullet list).
- Word count, character count, and cursor position in footer. Selection counts shown when text is selected.
- Find (Cmd+F), Find & Replace (Cmd+H).
- Tabs, split panes (Cmd+\\ vertical, Cmd+Shift+\\\\ horizontal), zoom (Cmd+/−).

### Wiki Links
- Syntax: \`[[filename]]\`, \`[[filename|display text]]\`, \`[[filename#heading]]\`.
- Type \`[[\` for autocomplete from all workspace files. Click to navigate (broken links auto-create file).
- Backlinks tab in right sidebar shows files that link to the current file.
- Renaming a file automatically updates all wiki links across the workspace.

### Preview & PDF Export
- Preview: click "Preview" in tab bar for rendered HTML in a split pane. Math (KaTeX), code highlighting, tables, footnotes.
- PDF: click "Create PDF" in tab bar. Uses bundled Typst engine — no external tools needed.
- 5 templates: Article, Report, Essay, Letter, Plain.
- Per-file settings (gear icon in tab bar): template, font, font size, page size (A4/US Letter/A5), margins (normal/narrow/wide), line spacing (compact/normal/relaxed).
- Citations: \`[@key]\` references resolved from the reference library, automatic bibliography appended.
- 30 citation styles available (APA 7, Chicago, IEEE, Harvard, Vancouver, Nature, Science, Cell, PLOS ONE, ACS, AMA, MLA, Chicago Notes, OSCOLA, and more). Select in gear icon menu or left sidebar references header. Custom CSL files can be added to \`.project/styles/\`.
- Settings persist per-file in \`.project/pdf-settings.json\`.

### Word Documents (.docx)
- Native DOCX editing — opens and saves directly, no import/export conversion.
- Formatting toolbar: bold, italic, underline, headings (H1-H6), lists, tables, paragraph styles.
- Tracked changes from Word are preserved; review bar to accept/reject.
- AI features (ghost suggestions, tasks, chat read/edit) work on DOCX files.
- DOCX has its own zoom control, independent from editor zoom.

### LaTeX (.tex)
- Uses bundled Tectonic engine — no external tools needed. Packages download automatically on first compile.
- Can be disabled in Settings > Environment.
- Auto-compiles 5 seconds after last edit; PDF opens in split pane.
- SyncTeX: click in editor to jump to PDF, click in PDF to jump to source.
- \`\\\\cite{key}\` autocomplete from reference library, hover previews, color-coded (valid=accent, broken=red).
- Standard cite variants: \`\\\\citep\`, \`\\\\citet\`, \`\\\\citeauthor\`, \`\\\\citeyear\`, etc.
- \`references.bib\` auto-generated before each compile.
- ~80 LaTeX command completions (document structure, formatting, math, environments).
- Error panel below editor — click errors to jump to source line. "Ask AI to fix" sends errors to chat.

---

## References & Citations

- Library stored in \`.project/references/library.json\` (CSL-JSON format, compatible with Pandoc/Zotero/Mendeley).
- Left sidebar panel below file explorer, with search, sort (date/author/year/title), filter (All/Cited/Not Cited).

**Import methods:**
- DOI: paste a DOI (e.g., \`10.1038/...\`), looked up via CrossRef. Batch import by pasting multiple DOIs.
- Free text: paste any citation format, searched on CrossRef by title.
- BibTeX / RIS / CSL-JSON: standard formats, batch-capable.
- PDF drag-drop: extracts metadata (DOI scan, then AI + CrossRef verification), stores PDF, indexes full text for search.
- Duplicate detection by DOI and title similarity.

**Citation syntax (Pandoc-compatible, for Markdown/PDF):**
- \`[@smith2020]\` — single citation
- \`[@smith2020; @jones2021]\` — grouped
- \`[see @smith2020, p. 42]\` — with prefix and locator
- Autocomplete triggers inside \`[@...]\`. Hover for details. Color-coded (valid/broken).

**Export:** Right-click a reference for BibTeX/key copy. Bulk export (all, cited only, or filtered) as BibTeX or RIS from sidebar.

**AI integration:** Chat tools can search references, look up details, add references by DOI, insert citations at cursor, search academic databases, and read full text of attached PDFs.

---

## AI Setup

### Two paths
1. **Shoulders account** — sign up at shoulde.rs or in-app (Settings > Account). Starts with $5 free balance. No API key management. Requests proxied through Shoulders servers (content not stored).
2. **Own API keys** — add in Settings (Cmd+,) > Models. Keys stored in \`~/.shoulders/keys.env\` and sent directly to the provider.

### Supported providers and models
| Provider | Models |
|---|---|
| Anthropic | Opus 4.6, Sonnet 4.6, Haiku 4.5 |
| OpenAI | GPT-5.2, GPT-5 Mini |
| Google | Gemini 3.1 Pro, Gemini 3 Flash |

### Custom endpoints
Edit \`~/.shoulders/models.json\` to add any OpenAI-compatible, Anthropic, or Google endpoint (private deployments, local LLMs, institutional servers). Add a model entry with provider URL and key env var name.

### Exa (web search)
The web_search, search_papers, and fetch_url tools require either an Exa API key (add \`EXA_API_KEY\` in Settings) or a Shoulders account. search_papers falls back to CrossRef (free) when Exa is unavailable.

---

## AI Features

### Ghost Suggestions (inline completions)
- **Trigger:** type \`++\` (two plus signs within 300ms). The characters are consumed, not inserted.
- **Display:** gray ghost text at cursor position, badge shows alternative count (e.g., "2/4").
- **Accept:** Tab, Enter, or Right arrow. **Cycle:** Up/Down arrows. **Dismiss:** Esc, Left, click, or keep typing.
- **Enable/disable:** Settings > Environment.
- **Works in:** Markdown, code files, DOCX, Jupyter notebook cells.
- **Context:** 5000 chars before cursor + 1000 after, plus system prompt and \`_instructions.md\`.
- Silently stops when over monthly budget.

### AI Chat
- Open right sidebar: Cmd+J. Focus chat input: Cmd+Shift+L (also sends selected text as context).
- Multiple parallel sessions (tabs). Close to archive, reopen from history dropdown (clock icon).
- **@file references:** type \`@\` in chat input to search and attach file content (truncated at 50KB, PDFs text-extracted).
- **Model picker:** dropdown in chat input, switch mid-conversation.
- **Auto context:** open tabs, active file, git branch, recent changes included automatically.
- **Token budget:** badge shows usage (e.g., "2.1k"). Turns red near context limit. Older messages auto-trimmed (keeps start + recent).
- Sessions persist across app restarts.

### AI Tasks
- Select text, press Cmd+Shift+C. Thread opens in right sidebar.
- Multi-turn conversation anchored to the selection. Gutter dots indicate thread state (neutral/pulsing/red).
- AI can propose edits (side-by-side diff with Apply button). Applied edits go through the review system.
- Same tool access as chat. Resolve when done; delete to remove permanently.
- Works on notebook cells too (anchored by cell, shows cell context).

### Project Instructions (\`_instructions.md\`)
- File at workspace root, included in every AI interaction (chat, tasks, suggestions).
- Use to set writing style, terminology, project context, domain-specific rules.
- Changes take effect immediately, no restart needed.
- HTML comments (\`<!-- ... -->\`) are stripped before injection (use as personal notes).
- Access via model picker dropdown > "Instructions" entry. If deleted, AI works normally without it.

---

## Tools & Review System

### 28 tools in 5 categories
- **Workspace (11):** read_file, write_file, edit_file, create_file, list_files, search_content, rename_file, move_file, duplicate_file, delete_file, run_command
- **References (5):** search_references, get_reference, add_reference, cite_reference, edit_reference
- **Feedback (3):** add_task, read_tasks, create_proposal
- **Notebooks (6):** read_notebook, edit_cell, run_cell, run_all_cells, add_cell, delete_cell
- **Web Research (3):** web_search, search_papers, fetch_url (external — need Exa key or Shoulders account)

### Review mode (default)
AI edits appear as inline diffs: old text in red strikethrough, new text in green, with accept/reject buttons. Review bar at top shows total pending changes with "Keep All" / "Revert All". Accept = keep the change (already on disk). Reject = revert to pre-edit content.

### Direct mode
Toggle in footer bar. Edits apply immediately without review. Useful for trusted workflows or rapid iteration.

### Tool permissions
Settings > Tools. Individually toggle any tool. Disabled tools are completely removed from the AI's awareness. "Disable all external tools" button for privacy.

---

## Notebooks (.ipynb)

- Native Jupyter notebook editing (same format as JupyterLab, VS Code, Colab).
- Code cells (syntax-highlighted), markdown cells (live preview), raw cells.
- **Requirements:** Python/R/Julia runtime + \`ipykernel\` (\`pip install ipykernel\`). Check Settings > Environment for detection status and install buttons.
- Toolbar: run cell, run all, restart kernel, interrupt, clear outputs. Kernel status indicator.
- Cell outputs render inline: text, HTML, images, error tracebacks with ANSI colors.
- Ghost suggestions (++) work in code cells. Tasks (Cmd+Shift+C) attach to cells.
- AI chat tools can read, edit, run, add, and delete cells — edits go through review system.

---

## Terminal & Code Execution

- Built-in terminal in right sidebar, multi-tab (+ button).
- Full shell (same as system terminal). Processes persist across sidebar tab switches.
- **Run code:** Cmd+Enter (selection or current line), Shift+Cmd+Enter (entire file).
- Auto-creates language session (Python/R/Julia REPL) on first code run, reuses for subsequent runs.
- R Markdown / Quarto: green play button in gutter for code chunks (\`{r}\`, \`{python}\`, etc.).

---

## Version History & GitHub

### Local version control (Git, automatic)
- Auto-commit every 5 minutes (invisible safety net).
- Cmd+S: save + create version checkpoint. Click "Name this version" within 8 seconds to add a label.
- Version history: right-click file > "Version History". Preview any version, restore non-destructively (current version stays in history).

### GitHub sync (optional)
- Connect in Settings > GitHub with a personal access token.
- Syncs automatically in background after each commit.
- Footer icon shows sync status (green checkmark, syncing arrows, error badge).
- Conflict resolution: if same file edited on multiple devices, creates safe branch (\`shoulders/sync-...\`), opens resolution dialog with link to compare on GitHub.

---

## Themes

8 themes: Tokyo Night (default), Light, Monokai, Nord, Solarized, Humane, One Light, Dracula. Change in Settings > Theme. Applies to editor, sidebars, terminal, all UI.

---

## Usage & Cost

- Footer shows toggleable monthly AI cost total.
- Settings > Usage: breakdown by feature (chat/suggestions/tasks), by model, 12-month trend chart.
- Optional soft budget (alert at threshold, never blocks usage).
- Shoulders account: costs deducted per-request; manage balance at shoulde.rs/account.

---

## Configuration & File Locations

| Location | Purpose |
|---|---|
| \`~/.shoulders/keys.env\` | API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, EXA_API_KEY) |
| \`~/.shoulders/models.json\` | Model definitions and provider endpoints (global, all workspaces) |
| \`.shoulders/\` | Private AI state (auto-created, gitignored): chats, tasks, system prompt, pending edits |
| \`.shoulders/system.md\` | Base system prompt (editable, advanced) |
| \`.project/\` | Shared project data (syncs via git): references, styles, skills, PDF settings |
| \`.project/styles/\` | Custom CSL citation style files |
| \`_instructions.md\` | Project instructions for AI (workspace root, user-editable) |

---

## Keyboard Shortcuts

On Windows/Linux: Cmd → Ctrl, Option → Alt.

| Action | Shortcut |
|---|---|
| Quick open | Cmd+P |
| Settings | Cmd+, |
| Toggle left sidebar | Cmd+B |
| Toggle right sidebar | Cmd+J |
| Focus AI chat | Cmd+Shift+L |
| Save + commit | Cmd+S |
| New file | Cmd+N |
| Close tab | Cmd+W |
| Switch tabs | Cmd+Opt+Left/Right |
| Split vertical | Cmd+\\\\ |
| Split horizontal | Cmd+Shift+\\\\ |
| Bold / Italic / Link / Code | Cmd+B / I / K / E |
| Find / Replace | Cmd+F / Cmd+H |
| Inline suggestion | ++ |
| Accept suggestion | Tab / Enter / Right |
| Cycle suggestions | Up / Down |
| Dismiss suggestion | Esc / Left |
| Add task | Cmd+Shift+C |
| Run code line | Cmd+Enter |
| Run entire file | Shift+Cmd+Enter |
| Zoom in / out | Cmd++ / Cmd+- |
| Toggle word wrap | Opt+Z |

---

## Troubleshooting

- **Ghost suggestions not appearing:** Check enabled in Settings > Environment. Verify an API key is configured (Settings > Models) or Shoulders account is logged in. Check you're not over budget (Settings > Usage).
- **PDF export fails:** Uses bundled Typst — should work without setup. Check for Markdown syntax issues (unclosed brackets, etc.).
- **LaTeX not compiling:** Uses bundled Tectonic — should work without setup. Check Settings > Environment shows Tectonic enabled. First compile may take longer as packages are downloaded automatically.
- **Notebook kernel not connecting:** Ensure language runtime installed and \`ipykernel\` available (\`pip install ipykernel\`). Check Settings > Environment for kernel status.
- **Web search / fetch_url not available:** Requires Exa API key (add EXA_API_KEY in Settings) or a Shoulders account.
- **AI edits not showing for review:** Check footer shows "Review" mode (not "Direct"). In direct mode, edits apply immediately.
- **GitHub sync conflict:** Work is safe on a \`shoulders/sync-...\` branch. Open the dialog, compare on GitHub, resolve, then click "Refresh".
- **Other issues:** contact@shoulde.rs
`
