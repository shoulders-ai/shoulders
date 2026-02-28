import { callAnthropic } from '../../utils/ai'
import { searchReferences } from '../../utils/referenceVerify'

const SYSTEM_PROMPT = `You are a meticulous academic reference auditor. Your job is to verify bibliography entries by searching academic databases and report the verification status of each reference.

TOOLS:
- search_references: Searches Crossref and OpenAlex for bibliography entries. Returns raw results — you compare and judge whether results match the reference.
- submit_results: Submit your structured verification results when done.

WORKFLOW:
1. Call search_references with all references (up to 30).
2. For each reference, compare the paper's entry against database results:
   - "verified": title, authors, year, and journal closely match a database result
   - "error": a match was found but with a significant metadata error (wrong DOI, wrong year by >1, wrong journal, missing authors, wrong volume/pages). The note MUST describe what is wrong — e.g. "Missing authors (Gold, Menzel). Volume should be 38(9). Pages should be 982-988."
   - "unverified": no matching result in any database. The note MUST explain why — is this expected (grey literature, dataset, report, book chapter) or suspicious (a journal article that should be findable)? e.g. "Book chapter — could not be confirmed in academic databases." or "Journal article not found in Crossref or OpenAlex — may not exist."
3. Call submit_results with your structured findings.

IMPORTANT:
- Year ±1 is normal (preprint vs published). Minor author spelling variations are normal. These count as "verified".
- Only mark "error" for genuinely wrong metadata (wrong DOI, wrong journal, substantially wrong title, missing authors, wrong volume/pages).
- For "error" status: describe what is wrong, not that it was "corrected". The editor needs to know the specific discrepancy.
- For "unverified" status: distinguish between expected (grey literature, datasets, reports) and suspicious (journal articles not found).
- Be efficient — call search_references once with all refs, then analyze results.

You MUST call submit_results to complete your task.`

/**
 * Verify references using Claude Sonnet + search_references tool.
 * Input: array of structured references from referenceExtractor.
 * Output: { results: [...], summary, usage }
 */
export async function checkReferences(references) {
  if (!references?.length) {
    return { results: [], summary: 'No references to check.', usage: { input: 0, output: 0 } }
  }

  let verificationResults = []
  let summary = ''

  const searchTool = {
    name: 'search_references',
    description: 'Search Crossref and OpenAlex for bibliography entries. Returns raw database results for each reference.',
    input_schema: {
      type: 'object',
      properties: {
        references: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Reference identifier (e.g. "[1]")' },
              raw: { type: 'string', description: 'Full verbatim text of the bibliography entry' },
              doi: { type: 'string', description: 'DOI if available' },
              title: { type: 'string', description: 'Paper/book title' },
              authors: { type: 'string', description: 'Author names' },
              year: { type: 'string', description: 'Publication year' },
            },
            required: ['key', 'raw'],
          },
          maxItems: 30,
        },
      },
      required: ['references'],
    },
    execute: async ({ references: refs }) => {
      console.log(`[TriageRefChecker] search_references called with ${refs.length} refs`)
      const results = await searchReferences(refs)
      const found = results.filter(r => r.results?.length > 0).length
      console.log(`[TriageRefChecker] Results: ${found} found, ${refs.length - found} not found`)
      return results
    },
  }

  const submitTool = {
    name: 'submit_results',
    description: 'Submit your structured reference verification results.',
    input_schema: {
      type: 'object',
      properties: {
        summary: { type: 'string', description: '1-2 sentence summary of the reference check' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string', description: 'Reference identifier' },
              status: { type: 'string', enum: ['verified', 'error', 'unverified'] },
              note: { type: 'string', description: 'For error: describe the specific metadata error. For unverified: explain why (grey lit, suspicious, etc.)' },
            },
            required: ['key', 'status'],
          },
        },
      },
      required: ['summary', 'results'],
    },
    execute: async ({ summary: s, results }) => {
      summary = s
      verificationResults = results || []
      return { success: true, count: verificationResults.length }
    },
  }

  const refsText = references.map(r =>
    `${r.key}: ${r.raw || [r.authors, r.title, r.journal, r.year].filter(Boolean).join('. ')}`
  ).join('\n')

  const { usage } = await callAnthropic({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `Verify these ${references.length} references:\n\n${refsText}` }],
    tools: [searchTool, submitTool],
    maxTokens: 8000,
    maxSteps: 6,
  })

  return {
    results: verificationResults,
    summary: summary || 'Reference check completed.',
    usage,
  }
}
