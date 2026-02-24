import { callAnthropic } from '../../../utils/ai'
import { searchReferences } from '../../../utils/referenceVerify'
import { validateAnchors } from '../validateAnchors'

const SYSTEM_PROMPT = `You are a meticulous academic reference and citation auditor.

OBJECTIVE: Verify the accuracy of every bibliography entry and audit citation coverage in the submitted paper. Use the search_references tool to look up references in Crossref and OpenAlex, then use your judgment to assess what you find.

TOOLS:
- search_references: Searches academic databases for bibliography entries. Returns raw results — titles, authors, years, journals, DOIs. You decide whether a result matches the reference or not. You can call this tool multiple times (e.g. to re-check a suspicious reference with different search terms).
- submit_citation_report: Submit your findings when done. Summary is required, comments are optional — only include them for genuine issues.

GUIDANCE:
- For each reference, compare what the paper claims vs what the databases return. Are they the SAME paper? Check title, authors, year, journal — not just keywords.
- If the tool returns nothing, the reference could not be verified externally. Books, reports, and non-indexed sources won't appear — that's normal. But journal articles and conference papers should.
- Scan the full text for citation coverage: every in-text citation [N] should have a bibliography entry, and every entry should be cited.
- Year ±1 is normal (preprint vs published). Minor author name spelling variations are normal. Don't flag these.
- DO flag: wrong journal, wrong year (>1 off), wrong title, fabricated-looking references, phantom citations, uncited bibliography entries.

You MUST call submit_citation_report to complete your review.`

export async function runReferenceCheck(text, images, shared = { allValid: [], techNotes: [] }) {
  if (!/\b(references|bibliography|works cited|literature cited)\b/i.test(text)) {
    return { comments: [], summary: 'No bibliography section found.', techNotes: [], usage: { input: 0, output: 0 } }
  }

  const allValid = shared.allValid
  const techNotes = shared.techNotes
  let summary = null

  const searchTool = {
    name: 'search_references',
    description: 'Search Crossref and OpenAlex for bibliography entries. Returns raw database results for each reference — you compare and judge. Include the full raw text of each entry for best results.',
    input_schema: {
      type: 'object',
      properties: {
        references: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Reference identifier (e.g. "[1]", "Smith2020")' },
              raw: { type: 'string', description: 'Full verbatim text of the bibliography entry' },
              doi: { type: 'string', description: 'DOI if visible in the entry' },
              title: { type: 'string', description: 'Paper/book title (best effort)' },
              authors: { type: 'string', description: 'Author names (best effort)' },
              year: { type: 'string', description: 'Publication year' },
            },
            required: ['key', 'raw'],
          },
          maxItems: 30,
        },
      },
      required: ['references'],
    },
    execute: async ({ references }) => {
      console.log(`[ReferenceChecker] search_references called with ${references.length} refs`)
      const results = await searchReferences(references)
      const withResults = results.filter(r => r.results?.length > 0).length
      const empty = results.filter(r => r.results?.length === 0 && !r.note).length
      console.log(`[ReferenceChecker] Results: ${withResults} found, ${empty} not found`)
      return results
    },
  }

  const submitTool = {
    name: 'submit_citation_report',
    description: 'Submit your citation and reference check report. Summary is required (1-3 sentences). Comments are optional — only include them for genuine issues.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '1-3 sentence summary of the reference check' },
        comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text_snippet: { type: 'string', description: 'Exact verbatim quote from the paper' },
              content: { type: 'string', description: 'Description of the issue' },
              severity: { type: 'string', enum: ['major', 'minor', 'suggestion'] },
            },
            required: ['text_snippet', 'content', 'severity'],
          },
        },
      },
      required: ['summary'],
    },
    execute: async ({ summary: s, comments: rawComments }) => {
      summary = s
      if (!rawComments?.length) {
        console.log(`[ReferenceChecker] submit_citation_report: no comments, summary only`)
        return { success: true, accepted: 0 }
      }

      console.log(`[ReferenceChecker] submit_citation_report called with ${rawComments.length} comments`)
      const { valid, invalid } = validateAnchors(rawComments, text)
      console.log(`[ReferenceChecker] Anchors: ${valid.length} valid, ${invalid.length} invalid`)

      const existingSnippets = new Set(allValid.map(c => c.text_snippet))
      allValid.push(...valid.filter(c => !existingSnippets.has(c.text_snippet)))

      if (invalid.length === 0) return { success: true, accepted: valid.length }

      techNotes.push({ invalidCount: invalid.length, snippets: invalid.map(c => c.text_snippet?.slice(0, 80)) })

      return {
        success: false,
        accepted: valid.length,
        totalStored: allValid.length,
        failed: invalid.map(c => ({ text_snippet: c.text_snippet, reason: c.reason, content: c.content, severity: c.severity })),
        instruction: `${valid.length} comments accepted and stored. ${invalid.length} failed — snippets not found in paper. Fix each text_snippet to be an exact verbatim quote, or drop the comment. Call submit_citation_report again with ONLY the corrected/remaining failed comments.`,
      }
    },
  }

  const { usage } = await callAnthropic({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Check the references and citations in this paper:\n\n${text}` }],
    tools: [searchTool, submitTool],
    maxTokens: 8000,
    maxSteps: 10,
  })

  return {
    comments: allValid.map(c => ({ ...c, reviewer: 'Reference Checker' })),
    summary: summary || 'Reference check completed.',
    techNotes,
    usage,
  }
}
