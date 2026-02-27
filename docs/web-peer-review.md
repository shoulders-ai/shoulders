# Peer Review (`web/pages/review/`)

Free promotional tool on shoulde.rs: users upload a .docx or .pdf, receive an AI-powered peer review with a structured report and inline comments anchored to specific passages. No account required. Reviews expire after 7 days.


---

## Overview

- Pipeline orchestrator: `web/server/services/review/pipeline.js` — 5-stage flow (extract → gate → review → report → anchor)
- Gatekeeper: `web/server/services/review/gatekeeper.js` — Gemini Flash Lite classification
- Technical reviewer: `web/server/services/review/agents/technicalReviewer.js` — statistics + methods (Claude Sonnet)
- Editorial reviewer: `web/server/services/review/agents/editorialReviewer.js` — argumentation + structure (Claude Sonnet)
- Reference checker: `web/server/services/review/agents/referenceChecker.js` — bibliography verification + citation coverage (Claude Sonnet)
- Reference search: `web/server/utils/referenceVerify.js` — batch Crossref/OpenAlex search (raw results, no judgment)
- Report writer: `web/server/services/review/agents/reportWriter.js` — synthesises comments into summary
- Anchor validation: `web/server/services/review/validateAnchors.js` — verifies snippets exist in source
- Guidance system: `web/server/services/review/guidanceLoader.js` + `guidance/` directory (markdown chapters)
- AI abstraction: `web/server/utils/ai.js` — `callAnthropic()` (tool loop), `callGemini()`
- DOCX conversion: `web/server/utils/docx.js` — mammoth + turndown + image extraction
- PDF conversion: `web/server/utils/pdfOcr.js` — Z OCR API (GLM-OCR) → markdown → marked HTML
- Comment anchoring: `web/server/utils/anchorComments.js` — injects `<mark>` tags in HTML
- PDF export: `web/server/utils/reviewToTypst.js` + `web/server/api/review/[slug]/pdf.get.js`
- Email: `web/server/utils/reviewEmail.js` — Resend notification
- Cost tracking: `web/server/utils/pricing.js` — per-model pricing tables
- Upload page: `web/pages/review/index.vue`
- Review display: `web/pages/review/[slug].vue` — comment positioning, scroll sync, stats header
- Comment layout: `web/composables/useReviewLayout.js` — waterfall algorithm
- Scroll sync: `web/composables/useScrollSync.js`
- **Adding a new agent?** See [Agent Pattern](#agent-pattern) for the shared interface, tool structure, and step-by-step instructions

---

## User Flow

1. **Upload** (`/review`) — User drops a .docx or .pdf and enters their email (required). On submit, server creates a review record and runs the pipeline in the background. Page shows a confirmation message (no redirect).
2. **Processing** — Pipeline extracts text, runs AI review, generates report + comments, anchors comments to document passages. User receives an email when ready.
3. **View** (`/review/[slug]`) — Split layout: report + annotated document (left), positioned comments column (right). Comments align vertically with their marks in the document via scroll sync.
4. **Export** — Download PDF (Typst) or .md. Delete when done.

---

## Architecture

```
Upload (.docx or .pdf)
  → POST /api/review/upload
  → Creates DB record (status: processing)
  → Background: runReviewPipeline()
      Stage 1: Extract (branches by file type)
               .docx → HTML (mammoth) + markdown (turndown) + images (base64)
               .pdf  → markdown (Z OCR / GLM-OCR) → HTML (marked)
      Stage 2: Gatekeeper (Gemini Flash Lite) — is this a research paper?
      Stage 3: Three review agents run in parallel (Claude Sonnet):
               ├── Technical Reviewer — methods, statistics, validity
               ├── Editorial Reviewer — argumentation, structure, reporting standards
               └── Reference Checker — bibliography verification (Crossref/OpenAlex), citation coverage
               All use tool-calling loop: submit → validateAnchors → retry if snippets invalid
      Stage 4: Report Writer (Claude Sonnet) — synthesises comments into summary (incl. Bibliography & Citations)
      Stage 5: anchorCommentsInHtml() — injects <mark data-comment-id data-severity> tags
      → Stores: anchoredHtml, report, commentsJson, costCents, token counts
      → Sends notification email (Resend)
  → Returns { slug }

View (/review/[slug])
  → GET /api/review/[slug]
  → Returns: { status, anchoredHtml, report, comments[], domainHint, filename, expiresAt }

PDF Export
  → GET /api/review/[slug]/pdf
  → reviewToTypst() → typst compile → PDF blob
```

---

## File Structure

```
web/
├── pages/review/
│   ├── index.vue                    # Upload page (drag-drop, email, post-submit confirmation)
│   └── [slug].vue                   # Review display (states: loading, processing, expired, failed, complete)
├── composables/
│   ├── useReviewLayout.js           # Comment positioning (waterfall algorithm, DOM-based anchor detection)
│   └── useScrollSync.js             # Scroll sync between document panel and comments column
├── server/
│   ├── api/review/
│   │   ├── upload.post.js           # File upload + email → create review, start pipeline
│   │   └── [slug]/
│   │       ├── index.get.js         # Full review data
│   │       ├── status.get.js        # Lightweight status check (for polling)
│   │       ├── index.delete.js      # Delete review
│   │       └── pdf.get.js           # Typst → PDF generation
│   ├── services/review/
│   │   ├── pipeline.js              # Orchestrator: 5-stage pipeline (extract → gate → review → report → anchor)
│   │   ├── gatekeeper.js            # Stage 2: Gemini Flash Lite classifies if document is reviewable research
│   │   ├── guidanceLoader.js        # Tool factory: loads markdown guidance chapters for reviewer agents
│   │   ├── validateAnchors.js       # Validates text_snippet quotes exist verbatim in the source document
│   │   ├── agents/
│   │   │   ├── technicalReviewer.js # Statistics, methods, validity (Claude Sonnet, tool loop)
│   │   │   ├── editorialReviewer.js # Argumentation, structure, reporting standards (Claude Sonnet, tool loop)
│   │   │   ├── referenceChecker.js  # Bibliography verification + citation coverage (Claude Sonnet, search tool)
│   │   │   └── reportWriter.js      # Synthesises inline comments into structured summary report
│   │   └── guidance/                # Markdown reference chapters loaded by agents via getGuidance tool
│   │       ├── statistics/          # 18 chapters: p-values, effect sizes, sample size, Bayesian, meta-analysis, etc.
│   │       ├── reporting-standards/ # CONSORT (more standards planned)
│   │       └── general/             # Argumentation
│   └── utils/
│       ├── ai.js                    # AI provider abstraction: callAnthropic (tool loop), callGemini
│       ├── pricing.js               # Per-model token pricing + cost calculation (cents)
│       ├── docx.js                  # DOCX → HTML (mammoth) + markdown (turndown) + image extraction
│       ├── pdfOcr.js                # PDF → markdown (Z OCR / GLM-OCR) → HTML (marked)
│       ├── referenceVerify.js       # Batch search Crossref + OpenAlex — returns raw results, no judgment
│       ├── anchorComments.js        # Injects <mark> tags into HTML at text_snippet positions
│       ├── reviewEmail.js           # Resend: sends "review ready" or "review failed" notification email
│       └── reviewToTypst.js         # Converts review data → Typst markup for PDF export
└── assets/css/main.css              # Print styles, font faces
```

---

## Review Pipeline (`pipeline.js`)

The pipeline runs in the background after upload. Each stage updates the DB row so progress is visible.

### Stage 1: Extract

Branches by file extension:

- **DOCX**: `convertDocx(buffer)` — mammoth converts DOCX → HTML, turndown converts HTML → markdown (for AI consumption), images extracted as base64 with content types. Display HTML uses inline data URIs.
- **PDF**: `convertPdf(buffer)` — Z OCR API (GLM-OCR model, `api.z.ai`) converts PDF → clean markdown with headings, structure, formulas, tables. `marked` then renders markdown → HTML for display + comment anchoring. No image extraction (agents review without figures). OCR cost tracked separately (~$0.002 per paper).

### Stage 2: Gatekeeper

`runGatekeeper(plainText)` — sends the first 8,000 chars to Gemini 2.5 Flash Lite. Returns `{ eligible, domain_hint, reason }`. Non-research documents (CVs, fiction, blank docs) are rejected early. The `domain_hint` (e.g. "health economics", "computer science") is stored and shown in the UI.

### Stage 3: Review Agents (parallel)

Three agents run concurrently via `Promise.all`, each with a 10-minute timeout and 1 automatic retry on failure (5s pause between attempts):

**Technical Reviewer** (`technicalReviewer.js`) — Claude Sonnet. Focuses on statistical methods, effect sizes, sample size, reproducibility. Has access to `getGuidance` tool with 18 statistics chapters.

**Editorial Reviewer** (`editorialReviewer.js`) — Claude Sonnet. Focuses on argumentation, structure, reporting standards (CONSORT, STROBE, CHEERS, PRISMA). Has access to `getGuidance` tool with reporting-standards and general guidance chapters.

**Reference Checker** (`referenceChecker.js`) — Claude Sonnet. Verifies bibliography entries against Crossref/OpenAlex databases, audits citation coverage. Uses `search_references` tool — a dumb search pipe that returns raw database results (title, year, authors, journal, DOI). The LLM sees what the databases returned and decides whether it matches. Can call the tool multiple times. Quick-exits if no bibliography section found.

Technical and Editorial agents follow the same pattern — see [Agent Pattern](#agent-pattern) below. Reference Checker uses a different tool (`search_references` + `submit_citation_report`) but the same anchor validation on output.

**Input guards** (applied before agents receive the paper):
- **Paper truncation**: markdown capped at 150,000 characters (~37K tokens). If truncated, a note is appended telling agents to acknowledge the limitation.
- **Image payload cap**: total base64 image payload capped at 5MB per agent. Omitted figures are noted so the agent can inform the user.
- **Guidance budget**: each agent's `getGuidance` tool has a 300,000-character budget (~75K tokens). Once exceeded, further chapter loads are refused.

Comments are deduplicated across all agents by snippet before passing to Stage 4.

### Stage 4: Report

`writeReport(plainText, comments, { citationSummary })` — Claude Sonnet synthesises all inline comments into a structured summary: General Impression, Strengths, Areas for Improvement, Bibliography & Citations (if reference checker produced a summary), Overall Assessment. 500-1000 words.

### Stage 5: Anchor

`anchorCommentsInHtml(html, comments)` — finds each comment's `text_snippet` in the HTML and wraps the matching passage in `<mark data-comment-id="..." data-severity="...">`. Comments are numbered sequentially (`comment-1`, `comment-2`, ...).

### Cost Tracking

Cost is tracked per-stage at the correct model rate: Gemini Flash Lite (gatekeeper), Sonnet (technical, editorial, reference checker, report writer). `calculateCostCents()` is called per-stage with cache-aware pricing and accumulated. Stored in `reviews.costCents`, `reviews.inputTokens`, `reviews.outputTokens`. Prompt caching reduces input costs by ~80% on tool loop steps 2+ (system prompt + paper content cached).

### Email Notification

`sendReviewEmail(email, slug, status)` — sends via Resend. Success email has a "View Review" CTA button + 7-day expiry notice. Failure email has a "Try Again" link. Graceful no-op if `RESEND_API_KEY` is not set.

---

## Agent Pattern

All reviewer agents share the same structure. Understanding this pattern is essential for adding new agents or modifying existing ones.

### Shared Interface

Every reviewer agent exports a single async function:

```js
export async function runXxxReview(text, images, shared = { allValid: [], techNotes: [] })
```

- `text` — full markdown of the paper
- `images` — array of `{ base64, contentType }` extracted from the DOCX
- `shared` — mutable accumulator passed by the pipeline. `allValid` collects accepted comments, `techNotes` collects diagnostic info about invalid snippets

Returns `{ comments, techNotes, usage }`.

### Two Tools Per Agent

Each agent gets two tools via `callAnthropic()`:

1. **`getGuidance`** (optional) — created by `guidanceLoader.js`. Lets the agent look up reference chapters before commenting. Each agent chooses which guidance categories it has access to (e.g. `['statistics']` for technical, `['reporting-standards', 'general']` for editorial).

2. **`submit_review`** (required) — defined inline in each agent. This is how the agent submits its comments. The tool:
   - Receives `{ comments: [{ text_snippet, content, severity }] }`
   - Calls `validateAnchors(comments, text)` to check each `text_snippet` exists verbatim in the source
   - Valid comments are pushed into `shared.allValid` (deduped against existing snippets + content)
   - If all valid → returns `{ success: true, accepted: N }`
   - If some invalid → returns the failed comments with reasons + instructions to fix and resubmit
   - The agent gets up to `maxSteps: 10` turns to retry failed snippets

### System Prompt Structure

Each agent's system prompt defines:
- **Role** — what kind of reviewer (e.g. "senior academic peer reviewer specializing in quantitative methods")
- **Focus areas** — bulleted list of what to look for
- **Guidance tool instruction** — tells the agent to consult chapters before commenting
- **Output constraint** — "You MUST call submit_review" (prevents free-text output)
- **Comment requirements** — exact verbatim snippet, specific actionable content, severity rating
- **Target volume** — "Aim for 8-20 comments"

### Pipeline Wiring (`pipeline.js`)

The pipeline runs agents with a timeout wrapper and deduplication:

```js
// Each agent gets its own shared accumulator
const techShared = { allValid: [], techNotes: [] }
const editShared = { allValid: [], techNotes: [] }
const refShared = { allValid: [], techNotes: [] }

// Parallel execution with 10-minute timeout per agent
const [technicalResult, editorialResult, referenceResult] = await Promise.all([
  runAgent(runTechnicalReview, markdown, images, techShared, 'Technical reviewer'),
  runAgent(runEditorialReview, markdown, images, editShared, 'Editorial reviewer'),
  runAgent(runReferenceCheck, markdown, images, refShared, 'Reference checker'),
])

// Merge + deduplicate by text_snippet across all agents
const allComments = deduplicateComments([...technicalComments, ...editorialComments, ...referenceComments])
```

If an agent times out or crashes, the pipeline continues with partial results (comments already accumulated in `shared.allValid` are preserved).

### Adding a New Agent

1. Create `server/services/review/agents/yourReviewer.js`
2. Export `async function runYourReview(text, images, shared)` following the pattern above
3. Write a system prompt with role, focus areas, and the "MUST call submit_review" constraint
4. Choose guidance categories (or omit `getGuidance` if not needed)
5. Define the `submit_review` tool inline (copy from an existing agent — the implementation is identical)
6. In `pipeline.js`:
   - Import your agent
   - Add a new shared accumulator: `const yourShared = { allValid: [], techNotes: [] }`
   - Add to the `Promise.all` array
   - Merge results into `allComments`
   - Add token usage to `totalUsage`
7. Set the `reviewer` label (e.g. `"Your Reviewer"`) — this appears in comment cards and the PDF

### Adding Guidance Chapters

1. Create a markdown file in `server/services/review/guidance/{category}/`
2. Add frontmatter: `id`, `name`, `applies_to` (optional)
3. The `getGuidance` tool will automatically discover it via `readdirSync`
4. To add a new category, create the directory and pass the category name to `createGuidanceTool(['your-category'])` in your agent

---

## AI Infrastructure

### `utils/ai.js`

Two provider functions used by the pipeline:

- **`callAnthropic({ model, system, messages, tools, maxTokens, maxSteps })`** — Anthropic Messages API with built-in tool-calling loop. Executes tools server-side (no client round-trips), accumulates token usage across steps. Used by all three reviewer agents and the report writer. Features: prompt caching (system prompt + first user message cached via `cache_control: ephemeral`), 120-second per-fetch timeout, detailed error logging on failure (cause, body size, step number).
- **`callGemini({ model, system, messages, maxTokens })`** — Google Gemini API. No tool support. Used by the gatekeeper (fast, cheap classification).

### `utils/pricing.js`

Per-model token pricing for Anthropic (Opus, Sonnet, Haiku), Google (Flash Lite, Flash, Pro), and OpenAI (GPT-5.2, GPT-5-mini, GPT-5 Nano). `calculateCostCents(input, output, model, { cacheRead, cacheCreation })` returns cents rounded to 2 decimal places. Cache-aware: accounts for Anthropic's cache read (10% of input) and cache write (125% of input) pricing.

### Guidance System (`guidanceLoader.js`)

Creates a `getGuidance` tool that agents can call to load reference material during review:
- `action: "list"` — returns available chapters in a category (parsed from markdown frontmatter: `id`, `name`, `applies_to`)
- `action: "load"` — returns the full content of a specific chapter
- **Budget**: 300,000 characters per tool instance (~75K tokens). Once exceeded, further loads are refused with an error message. Each agent gets its own budget.

Guidance chapters are markdown files in `server/services/review/guidance/{category}/`. Currently 3 categories: `statistics` (18 chapters, ~450KB total), `reporting-standards` (1 chapter), `general` (1 chapter).

---

## Database

Single `reviews` table (SQLite, see `server/db/schema.js`):

| Column | Type | Notes |
|---|---|---|
| id | integer PK | Auto-increment |
| slug | text unique | 12-char random URL identifier |
| status | text | `processing`, `complete`, `failed` |
| email | text | User's email for notification |
| filename | text | Original .docx filename |
| domainHint | text | Detected academic domain (e.g. "Computer Science") |
| report | text | AI-generated review summary (markdown) |
| commentsJson | text | JSON array of comment objects |
| anchoredHtml | text | Document HTML with `<mark>` tags injected |
| html | text | Raw document HTML (mammoth output with data URIs) |
| markdown | text | Plaintext markdown (turndown output, used by AI) |
| costCents | integer | Total AI cost in cents |
| inputTokens | integer | Total input tokens across all stages |
| outputTokens | integer | Total output tokens across all stages |
| techNotes | text | JSON: internal diagnostics (gatekeeper result, agent stats, errors) |
| completedAt | text | ISO 8601 timestamp when review finished |
| expiresAt | text | ISO 8601 timestamp (7 days from creation) |
| created_at | text | ISO 8601 |

---

## Comment Data Shape

```js
{
  id: "c_abc123",           // unique ID
  number: 1,                // display order
  severity: "major",        // "major" | "minor" | "suggestion"
  reviewer: "Technical Reviewer",
  text_snippet: "quoted passage from paper",
  content: "The comment explaining the issue..."
}
```

Comments are stored in `commentsJson` as a JSON array. The `text_snippet` is used by `anchorCommentsInHtml()` to find the passage in the document and wrap it in `<mark data-comment-id="..." data-severity="...">`.

---

## Comment Positioning (Google Docs-style)

The `[slug].vue` complete state uses a two-panel layout:

- **Left panel**: scrollable, contains stats header + report + annotated document
- **Right panel**: `overflow-hidden`, inner div positioned via CSS `transform: translateY()`

### `useReviewLayout.js`

Waterfall algorithm adapted from the main app's `useCommentLayout.js` but uses DOM queries instead of TipTap:

1. Queries `mark[data-comment-id]` elements in the document panel
2. Computes each mark's Y position relative to scroll container
3. Runs active-first waterfall: active comment at ideal position, predecessors pushed up, successors pushed down
4. Falls back to simple top-down waterfall when no comment is active

### `useScrollSync.js`

Keeps comments column aligned with document scroll:
- Listens to `scroll` events on document panel (RAF-throttled)
- Updates `transform: translateY(-scrollTop)` on comments inner div
- Forwards `wheel` events from comments column → document panel scroll

### Interactions

- **Click mark in document** → activates corresponding comment card, recalculates layout
- **Click comment card** → scrolls document to mark (smooth, center), 2s ring highlight
- **Click active comment again** → deactivates (toggle)
- **Mobile (<1024px)** → stacked layout, flat comment list below document (no positioning)

---

## PDF Export (Typst)

**Requires `typst` CLI on the server.** Install: `sudo snap install typst` (Ubuntu) or `brew install typst` (macOS).

### Flow

1. `GET /api/review/[slug]/pdf` fetches review from DB
2. `reviewToTypst()` converts review data to Typst markup:
   - Title block: "Peer Review" + filename + domain + date + severity summary
   - Report body: markdown → Typst syntax conversion (headings, bold, italic, lists)
   - Comments appendix: numbered cards with severity color, reviewer, quoted snippet, content
3. Typst markup written to temp file → `typst compile` → PDF read → temp files cleaned up
4. PDF returned as blob with `Content-Disposition: attachment`

### Typst Template

- Font: New Computer Modern (Typst built-in, academic standard)
- Page: 2.5cm × 2cm margins, header/footer with page numbers
- Comments: light gray `block()` cards with colored severity labels
- Report and comments on separate pages

---

## Upload Page (`/review/index.vue`)

- `definePageMeta({ layout: false })` — no SiteHeader/SiteFooter
- Minimal brand wordmark link at top
- Drag-and-drop .docx upload with file validation (type, 50MB limit)
- Email field (required, validated with regex)
- On success: shows confirmation message, no redirect to slug
- "Submit another" resets the form

---

## Review Page (`/review/[slug].vue`)

### States

- **loading** — spinner while fetching initial status
- **processing** — "Your paper is being reviewed" + copyable URL + polls every 5s
- **expired** / **not_found** — appropriate message + link back to upload
- **failed** — error message + retry link
- **complete** — full review display (see below)

### Complete State Layout

```
┌──────────────────────────────────────────────────────────┐
│ Shoulders | Peer Review · domain · filename     [actions]│
├────────────────────────────────┬─────────────────────────┤
│  Stats header:                 │  Positioned comments    │
│  "We reviewed your CS paper    │  (scroll-synced,        │
│   and found 3 major, 5 minor,  │   waterfall layout)     │
│   4 suggestions."              │                         │
│  ─────────────────────────     │  [comment card]         │
│  Report (rendered markdown)    │  [comment card]         │
│  ─────────────────────────     │  [comment card]         │
│  Document with <mark>s         │                         │
└────────────────────────────────┴─────────────────────────┘
```

### Action Bar

- **Download PDF** — primary action, generates Typst PDF server-side
- **.md** — secondary, client-side markdown blob download
- **Delete** — confirms, then removes review and redirects

---

## Print Styles

Print view (Cmd+P fallback) shows report + comments appendix only:
- Paper/document hidden (`.review-paper { display: none }`)
- Comments column hidden
- Print-only comments appendix rendered with full snippets
- Professional margins: `@page { margin: 2.5cm 3cm }`

---

## Prerequisites

- **Node.js** 25+ (Nuxt server)
- **Typst** CLI for PDF export: `sudo snap install typst` (Ubuntu) / `brew install typst` (macOS)
- **`NUXT_Z_API_KEY`** in `.env` — Z OCR API key for PDF intake (required for PDF uploads, DOCX works without it)
