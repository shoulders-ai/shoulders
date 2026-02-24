# SuperCite: Citation System for DOCX (SuperDoc)

## Overview

SuperCite adds Zotero-compatible citation management to the DOCX editor.
Citations are stored as ProseMirror inline atom nodes and survive editing,
undo/redo, and (with post-processing) DOCX round-trips.

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│ DocxEditor.vue                                           │
│   ├── Pre-scan DOCX (Phase 1) → zoteroCitations         │
│   ├── Create citationExt → Node extension                │
│   ├── SuperDoc init with editorExtensions                │
│   └── Post-process (Phase 2) → replace text with nodes   │
├──────────────────────────────────────────────────────────┤
│ docxCitations.js — ProseMirror Node Extension            │
│   ├── citation Node (inline, atom, selectable)           │
│   ├── CitationNodeView (renders formatted text)          │
│   ├── Plugin (handleClickOn → opens popover)             │
│   └── Commands: insertCitation, updateCitation, etc.     │
├──────────────────────────────────────────────────────────┤
│ docxCitationImporter.js — DOCX Import                    │
│   ├── prescanDocxForZotero() — Phase 1: extract field    │
│   │   codes from DOCX ZIP before SuperDoc loads          │
│   └── postProcessCitationsOrdered() — Phase 2: replace   │
│       display text with citation nodes after 'ready'     │
├──────────────────────────────────────────────────────────┤
│ DocxCitationPopover.vue — Edit UI                        │
│   ├── Lists cited items with remove/locator controls     │
│   ├── Search to add new references                       │
│   └── Teleported to body (avoids overflow clipping)      │
├──────────────────────────────────────────────────────────┤
│ citationFormatter.js — Display Text Generation           │
│   ├── 5 styles: APA, Chicago, IEEE, Harvard, Vancouver  │
│   └── formatInlineCitation() → "(Author, Year)" etc.     │
├──────────────────────────────────────────────────────────┤
│ references.js (Pinia store) — Reference Library          │
│   ├── CSL-JSON format, persisted to .project/references/  │
│   └── getByKey, searchRefs, citationStyle                │
└──────────────────────────────────────────────────────────┘
```

## DOCX Import Flow (Zotero → Citation Nodes)

### Phase 1: Pre-scan (before SuperDoc loads)

1. DocxEditor reads the file as base64 from Rust
2. `prescanDocxForZotero(bytes)` unzips the DOCX with JSZip
3. Parses `word/document.xml` for `ADDIN ZOTERO_ITEM CSL_CITATION` field codes
4. Extracts CSL-JSON citation data + display text for each citation
5. Also extracts Zotero document preferences from `docProps/custom.xml`
6. Returns `{ citations: [{displayText, cslCitation}], bibliography, prefs }`

### Phase 2: Post-process (after SuperDoc 'ready')

1. SuperDoc imports the DOCX normally — Zotero field codes are dropped but display
   text survives as plain text (e.g., "(Chetty et al., 2022)")
2. `postProcessCitationsOrdered(editor, citations, referencesStore)`:
   a. Imports unknown references from CSL-JSON into the reference library
   b. Matches each citation's display text in the ProseMirror document (ordered)
   c. Replaces matched text ranges with `citation` nodes
   d. Preserves original Zotero CSL_CITATION JSON in `zoteroData` attr for export

## Citation Node Schema

```
Node: citation
  group: inline
  inline: true
  atom: true
  selectable: true

  Attributes:
    citationId: string     — unique ID for this citation instance
    cites: Array<{         — one or more cited references
      key: string          — reference library key (e.g., "chetty2022")
      locator: string      — page/chapter number
      prefix: string       — text before (e.g., "see")
      suffix: string       — text after
      suppressAuthor: bool — suppress author name in display
    }>
    mode: string           — "normal" or "suppress-author"
    zoteroData: Object     — original CSL_CITATION JSON (for export, not rendered)
```

## Zotero DOCX Field Code Format

Zotero stores citations as Word field codes:

```xml
<w:r><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:instrText> ADDIN ZOTERO_ITEM CSL_CITATION {json} </w:instrText></w:r>
<w:r><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:t>(Chetty et al., 2022)</w:t></w:r>
<w:r><w:fldChar w:fldCharType="end"/></w:r>
```

The CSL_CITATION JSON contains:
- `citationID` — unique per-citation instance
- `citationItems[]` — array of cited items, each with full `itemData` (CSL-JSON)
- `properties.formattedCitation` — rendered display text

Multiple references in one parenthetical = multiple entries in `citationItems[]`.

## Style Switching

All CitationNodeView instances are tracked in an `activeViews` Set.
When the citation style changes:

1. `referencesStore.citationStyle` updates
2. Call `citationExt._refreshAll()` or `editor.commands.refreshAllCitations()`
3. Each NodeView re-calls `formatText()` which reads the new style from the store
4. Display text updates instantly across all citations

## Known Limitations & TODO

### Not yet implemented:
- **DOCX export**: Citation nodes are not yet re-serialized as Zotero field codes
  on export. SuperDoc will export them based on `renderDOM()` output (as plain
  `<span class="docx-citation">` elements). Zotero-compatible export requires
  post-processing the DOCX ZIP to inject field codes.
- **Bibliography**: Auto-generated bibliography section in DOCX
- **@ autocomplete in DOCX**: Insert citations via keyboard (like markdown `[@key]`)
- **Numbered styles**: IEEE/Vancouver need document-order numbering (not per-citation)

### Potential issues:
- Display text matching (Phase 2) may fail if SuperDoc modifies whitespace during import
- Citation nodes may not be painted by SuperDoc's presentation layer (hidden-host) —
  this needs live testing. If NodeViews aren't painted, we'll need the overlay approach.
- The `run` content spec allows `inline*` — our citation node is `group: inline`,
  so it should be valid. But `wrapTextInRunsPlugin` might interfere.

## Files

| File | Purpose |
|------|---------|
| `src/editor/docxCitations.js` | Citation Node extension, NodeView, Plugin, Commands |
| `src/services/docxCitationImporter.js` | DOCX pre-scan + post-process for Zotero |
| `src/components/editor/DocxCitationPopover.vue` | Click-to-edit citation UI |
| `src/components/editor/DocxEditor.vue` | Integration: pre-scan, register ext, post-process |
| `src/services/citationFormatter.js` | Pure formatting functions (5 styles) |
| `src/stores/references.js` | Reference library store |
| `src/utils/docxBridge.js` | base64ToUint8Array helper |
| `docs/supercite-system.md` | This file |
