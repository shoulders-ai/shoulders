# Paper Triage (`web/pages/triage/`)

> **STATUS: WORK IN PROGRESS.** This feature is under active development. Not production-ready. Pipeline is functional but the dashboard UI, assessment schema, and author lookup are being iterated on. Expect breaking changes to the assessment JSON structure, DB schema, and frontend layout.

Desk triage tool on shoulde.rs: editors upload a PDF or DOCX manuscript and receive a structured editorial assessment. Extracts paper metadata (title, authors, abstract), verifies references against Crossref/OpenAlex, runs AI content detection (Pangram), finds related work, looks up author profiles on OpenAlex, and produces a structured AI assessment. Cost ~$0.40/paper, ~3 minutes. No account required.

---

## Overview

- Pipeline orchestrator: `web/server/services/triage/pipeline.js` — 5-stage flow (extract → metadata → refs → parallel checks → assessment)
- Metadata extractor: `web/server/services/triage/metadataExtractor.js` — Gemini Flash Lite extracts title, authors, abstract, sections
- Reference extractor: `web/server/services/triage/referenceExtractor.js` — Gemini Flash Lite parses bibliography into structured refs
- Reference checker: `web/server/services/triage/referenceChecker.js` — Claude Sonnet verifies refs against Crossref/OpenAlex (agentic tool loop)
- AI content detection: `web/server/services/triage/pangramDetection.js` — Pangram v3 API
- Novelty check: `web/server/services/triage/noveltyCheck.js` — Gemini-generated queries → OpenAlex search
- Author lookup: `web/server/services/triage/authorLookup.js` — OpenAlex author search (free API, no key)
- Assessment agent: `web/server/services/triage/assessmentAgent.js` — Claude Sonnet synthesises all results into structured output
- AI abstraction: `web/server/utils/ai.js` — `callAnthropic()` (tool loop), `callGemini()`
- DOCX conversion: `web/server/utils/docx.js` — mammoth + turndown
- PDF conversion: `web/server/utils/pdfOcr.js` — Z OCR API (GLM-OCR)
- Cost tracking: `web/server/utils/pricing.js` — per-model pricing tables
- Upload page: `web/pages/triage/index.vue`
- Dashboard display: `web/pages/triage/[slug].vue` — progressive UI (processing → complete → failed states)

---

## User Flow

1. **Upload** (`/triage`) — Editor selects a target journal (from presets or custom text), optionally adds assessment instructions, drops a PDF/DOCX. Server creates a triage record and runs the pipeline in background.
2. **Processing** (`/triage/[slug]`) — Dashboard polls every 2s, shows progressive step completion (extracting → metadata → refs → checking → assessing). Each step shows summary data when complete.
3. **Dashboard** — Structured editorial cockpit: paper identity (extracted title, author profiles, abstract), verdict (TL;DR + scope fit + impact forecast), integrity checks (references, AI content, methods, writing), context (contribution + related work).
4. **View Original** — Link to download/view the original uploaded file.

---

## Architecture

```
Upload (.pdf or .docx)
  → POST /api/triage/upload
  → Creates DB record (status: processing)
  → Saves file to {dataDir}/triage-files/{id}.{ext}
  → Background: runTriagePipeline()

      Step 0: Extract
               .pdf  → markdown (Z OCR / GLM-OCR)
               .docx → markdown (mammoth + turndown)
               Computes: word count, page estimate, table count, figure count

      Step 0a: Metadata Extraction (Gemini Flash Lite)
               First ~5000 chars → title, authors[], abstract, sections[], appendix flag
               Stored in metadata_json column

      Step 0b: Reference Extraction (Gemini Flash Lite)
               Full markdown → structured refs with keys, raw text

      Step 1: Parallel Checks (all 4 concurrent)
               ├── Reference Verification (Claude Sonnet, agentic tool loop)
               │   Tools: search_references (Crossref+OpenAlex), submit_results
               │   Output: { results: [{ key, status, note }], summary, usage }
               │   Statuses: verified | error | unverified
               ├── AI Content Detection (Pangram v3 API)
               │   Output: { available, aiScore, humanScore, prediction, headline }
               ├── Novelty Search (Gemini Flash Lite + OpenAlex)
               │   Output: { relatedPapers[], queries[], usage }
               └── Author Lookup (OpenAlex — free, no API key)
                   Output: [{ name, institution, works_count, cited_by_count, orcid, status }]
                   Stored in authors_json column

      Step 2: Assessment (Claude Sonnet)
               Receives: paper markdown + all Step 1 results + journal scope + custom instructions
               Output: structured JSON (see Assessment Schema below)

      → Stores: all JSON results, cost, token counts, completion timestamp
  → Returns { slug }

Dashboard (/triage/[slug])
  → Initial: GET /api/triage/{slug} (full data)
  → Polling: GET /api/triage/{slug}/status (lightweight, 2s interval while processing)
  → File: GET /api/triage/{slug}/file (original uploaded file)
```

---

## File Structure

```
web/
├── pages/triage/
│   ├── index.vue                         # Upload page (journal selector, instructions, drop zone)
│   └── [slug].vue                        # Dashboard (processing/complete/failed states)
├── public/triage/
│   └── journals.json                     # 12 preset journal scopes
├── server/
│   ├── api/triage/
│   │   ├── upload.post.js                # File upload → create record, start pipeline
│   │   └── [slug]/
│   │       ├── index.get.js              # Full triage data (all JSON fields)
│   │       ├── status.get.js             # Lightweight status check (for polling)
│   │       └── file.get.js               # Serve original uploaded file
│   └── services/triage/
│       ├── pipeline.js                   # Orchestrator: 5-stage pipeline
│       ├── metadataExtractor.js          # Title/authors/abstract extraction (Gemini Flash Lite)
│       ├── referenceExtractor.js         # Bibliography → structured refs (Gemini Flash Lite)
│       ├── referenceChecker.js           # Ref verification (Claude Sonnet, agentic)
│       ├── pangramDetection.js           # AI content detection (Pangram v3 API)
│       ├── noveltyCheck.js               # Related work search (Gemini + OpenAlex)
│       ├── authorLookup.js               # Author profiles (OpenAlex)
│       └── assessmentAgent.js            # Final assessment (Claude Sonnet)
```

---

## Pipeline Details

### Step 0: Text Extraction

Branches by file extension:

- **PDF**: `convertPdf(buffer)` — Z OCR API (GLM-OCR) converts PDF → markdown. OCR cost tracked separately.
- **DOCX**: `convertDocx(buffer)` — mammoth → HTML → turndown → markdown.

After extraction, computes: word count, estimated page count (wordCount / 350 for PDFs), table count (by detecting markdown table blocks), figure count (by regex matching "Figure N" / "Fig. N" references).

### Step 0a: Metadata Extraction

`extractMetadata(markdown)` — sends first ~5000 chars to Gemini 2.5 Flash Lite. Returns:

```json
{
  "title": "Full Paper Title",
  "authors": [
    { "name": "First Last", "affiliation": "University" }
  ],
  "abstract": "Full abstract text...",
  "sections": ["Introduction", "Methods", "Results", "Discussion"],
  "appendix": false
}
```

Cheap (~$0.001) and fast (~2-3 seconds). Falls back to empty structure on failure (doesn't block pipeline).

### Step 0b: Reference Extraction

`extractReferences(markdown)` — Gemini Flash Lite parses the bibliography section into structured references with keys (e.g. `[1]`, `[2]`) and raw text. Used as input for the reference checker.

### Step 1: Parallel Checks

Four concurrent operations:

**Reference Checker** (`referenceChecker.js`) — Claude Sonnet with agentic tool loop (up to `maxSteps`). Two tools:
- `search_references` — takes an array of refs, queries Crossref + OpenAlex, returns raw results
- `submit_results` — Claude submits structured findings: `{ key, status, note }` for each ref
  - `verified` — metadata matches database entry (year ±1 and minor spelling = OK)
  - `error` — wrong DOI, year, journal, missing authors, wrong volume/pages
  - `unverified` — no match found (grey literature, reports, etc.)

**Pangram Detection** (`pangramDetection.js`) — POST to `text.api.pangram.com/v3` with truncated text (max 25k chars). Returns AI/human scores and prediction. Graceful fallback (`{ available: false }`) if API key missing or call fails.

**Novelty Check** (`noveltyCheck.js`) — Two-stage: (1) Gemini generates 3-5 targeted search queries from paper snippet, (2) parallel OpenAlex searches, deduplication by DOI/title, top 10 by citation count.

**Author Lookup** (`authorLookup.js`) — For each extracted author (up to 5): queries OpenAlex API with name + affiliation filter, falls back to name-only search. Returns: `{ name, institution, works_count, cited_by_count, orcid, openalex_id, status }`. Free API, no key needed, rate limit 10/sec.

### Step 2: Assessment

`runAssessment()` — single Claude Sonnet call. Receives paper markdown (capped at 120k chars) + all pipeline results + optional journal scope and custom instructions. Uses prompt caching for the paper content.

---

## Assessment Schema

The assessment agent returns structured JSON organized around the editor's decision flow:

```json
{
  "verdict": "2-3 sentences: the TL;DR of the entire ASSESSMENT",
  "scope_fit": {
    "headline": "Target journals/domain in ≤12 words",
    "detail": "2-3 sentences on fit"
  },
  "impact": {
    "headline": "Academic + practical impact in ≤12 words",
    "citation_forecast": {
      "point_estimate": 28,
      "range_low": 12,
      "range_high": 55,
      "horizon_months": 24,
      "reasoning": "1-2 sentences citing specific comparables"
    }
  },
  "methodology": {
    "status": "clear",
    "headline": "Methodological character in ≤12 words",
    "detail": "2-3 sentences"
  },
  "writing": {
    "status": "warning",
    "headline": "Writing quality in ≤12 words",
    "detail": "2-3 sentences"
  },
  "contribution": {
    "headline": "What's genuinely new in ≤12 words",
    "detail": "2-3 sentences embedding related work context"
  },
  "references_summary": "1 sentence: counts + key finding",
  "novelty_summary": "1 sentence: paper count + key finding"
}
```

**Status values** (for `methodology` and `writing`):
- `"clear"` — no concerns (renders as ✓ green)
- `"warning"` — minor issues (renders as ⚠ amber)
- `"concern"` — significant issues (renders as ✗ red)

### Backward Compatibility

Old assessments (from before the schema restructure) used a different format:
- `summary` (array of 3 bullets or string) instead of `verdict`
- `scope` instead of `scope_fit`
- `contribution.citation_forecast` instead of `impact.citation_forecast`
- `methods` instead of `methodology`
- `authors` (extracted by agent) — now handled by metadata extractor + OpenAlex
- `ai_content` (interpreted by agent) — now primarily Pangram data

The dashboard handles both old and new formats via computed properties with fallback chains.

---

## Database

Uses the `triages` table (SQLite, see `server/db/schema.js`):

| Column | Type | Notes |
|---|---|---|
| id | text PK | 16-char hex |
| slug | text unique | 12-char random URL identifier |
| status | text | `processing`, `complete`, `failed` |
| currentStep | text | Pipeline progress: `extracting`, `checking`, `assessing`, `complete`, `failed` |
| stepDetails | text (JSON) | Progressive UI data: stats, ref counts, pangram scores, etc. |
| filename | text | Original uploaded filename |
| filePath | text | Disk path to saved original file |
| journalScope | text | Target journal (from preset or custom) |
| customInstructions | text | Additional assessment instructions |
| markdown | text | Extracted paper text |
| referencesJson | text | Extracted structured references |
| refCheckJson | text | Reference verification results |
| pangramJson | text | AI content detection results |
| noveltyJson | text | Related work from OpenAlex |
| metadataJson | text | Extracted title, authors, abstract, sections |
| authorsJson | text | OpenAlex author profiles |
| assessmentJson | text | Final structured assessment |
| techNotes | text (JSON) | Internal diagnostics (stage info, errors) |
| costCents | integer | Total AI cost in cents |
| inputTokens | integer | Total input tokens across all stages |
| outputTokens | integer | Total output tokens across all stages |
| createdAt | text | ISO 8601 |
| completedAt | text | ISO 8601 |

---

## API Endpoints

### `POST /api/triage/upload`

Accepts multipart form data:
- `file` — PDF or DOCX (max 50MB)
- `journalScope` — optional target journal text
- `customInstructions` — optional assessment instructions

Returns `{ slug }`. Pipeline runs in background (fire-and-forget).

### `GET /api/triage/{slug}`

Returns full triage data including all parsed JSON fields: `stepDetails`, `references`, `refCheck`, `pangram`, `novelty`, `assessment`, `metadata`, `authorProfiles`, `hasFile`, `costCents`.

### `GET /api/triage/{slug}/status`

Lightweight endpoint for polling during processing. Returns: `status`, `currentStep`, `stepDetails`, `filename`. Polled every 2 seconds by the dashboard.

### `GET /api/triage/{slug}/file`

Serves the original uploaded file with correct `Content-Type` (`application/pdf` or DOCX MIME) and `Content-Disposition: inline` header.

---

## Dashboard Page (`/triage/[slug].vue`)

### States

- **processing** — progressive step list with spinners/checkmarks, polls every 2s via `/status` endpoint
- **complete** — full editorial dashboard (see layout below)
- **failed** — error message + retry link

### Dashboard Layout (Complete State)

Four sections following the editor's decision flow:

**THE PAPER** — Paper identity
- Title (from metadata extraction, fallback to filename)
- Authors (merged metadata + OpenAlex profiles, clickable to expand: institution, works count, citations, ORCID)
- Stats line (pages, words, tables, figures, references)
- Abstract (from metadata, shown by default, collapsible)
- "View Original" link

**VERDICT** — Should I care?
- TL;DR (2-3 sentence assessment verdict)
- Scope fit (headline + expandable detail)
- Impact (headline + inline citation forecast with range, expandable reasoning)

**INTEGRITY** — Is it clean?
- References: ✓/⚠ status + "39/45 verified · 1 error" + expandable issues list + full reference list
- AI content: ✓/⚠/✗ status + Pangram data + expandable detail
- Methods: status + headline from assessment + expandable detail
- Writing: status + headline from assessment + expandable detail

**CONTEXT** — How does it fit?
- Contribution headline + expandable detail with embedded related work
- Featured papers (top cited + most recent)
- Full related papers list (expandable)
- Reviewer Suggestions (coming soon placeholder)

### Inline Components

Two render-function components defined in `<script setup>`:

- **`StepRow`** — processing step with done/active/pending states (checkmark/spinner/dot)
- **`IntegrityRow`** — status indicator (✓/⚠/✗/—) + label + headline + expandable detail slot

---

## Cost Model

Approximate cost per paper (~$0.40):

| Stage | Model | Cost |
|---|---|---|
| Text extraction (PDF) | GLM-OCR | ~$0.002 |
| Metadata extraction | Gemini 2.5 Flash Lite | ~$0.001 |
| Reference extraction | Gemini 2.5 Flash Lite | ~$0.002 |
| Reference verification | Claude Sonnet 4.6 | ~$0.15-0.25 |
| AI content detection | Pangram API | free (API key) |
| Novelty search | Gemini 2.5 Flash Lite + OpenAlex | ~$0.001 |
| Author lookup | OpenAlex | free |
| Assessment | Claude Sonnet 4.6 | ~$0.10-0.20 |

Total typically $0.30-0.50. Prompt caching (Anthropic) reduces repeat-step costs.

---

## Prerequisites

- **`NUXT_ANTHROPIC_API_KEY`** — required for reference checker + assessment agent (Claude Sonnet)
- **`NUXT_GOOGLE_API_KEY`** — required for metadata/reference extraction + novelty queries (Gemini Flash Lite)
- **`NUXT_PANGRAM_API_KEY`** — optional, for AI content detection (graceful degradation without it)
- **`NUXT_Z_API_KEY`** — required for PDF upload (Z OCR API). DOCX works without it.

---

## Known Limitations / TODO

- No account or authentication required (public access)
- No expiry on triage records (unlike peer reviews which expire after 7 days)
- No email notification when assessment completes
- Reviewer suggestions section is a placeholder ("coming soon")
- File storage has no cleanup mechanism — files accumulate in `{dataDir}/triage-files/`
- **Author lookup is unreliable and needs significant work.** Two compounding bugs: (1) `authorLookup.js` falls back to the top OpenAlex result when the affiliation-filtered search fails, which silently returns the wrong person for common names (e.g. "Paul Schneider" at Sheffield → returns a different Paul Schneider at Oxford with 189 works). Should return `not_found` instead. (2) The dashboard (`[slug].vue`) prefers OpenAlex institution over the paper's own stated affiliation, so the wrong institution overwrites the correct one. The metadata extractor (Gemini) correctly reads "University of Sheffield" from the paper, but the OpenAlex lookup returns a different person and the dashboard displays their institution instead. Fix: `authorLookup.js` should not blindly take first result when affiliation doesn't match; dashboard should prefer paper-stated affiliation and only supplement with OpenAlex data (works count, citations, ORCID)
- Citation forecast is a Fermi estimate — not a validated prediction model
- No PDF export of the assessment (unlike peer review which has Typst export)
- Old assessment format (pre-restructure) still works but renders with reduced detail
