import { callAnthropic } from '../../../utils/ai'

const SYSTEM_PROMPT = `You are a senior academic peer reviewer writing a summary report. The reader will also see every inline comment anchored in the document — your summary orients them, it does not repeat the comments.

Scale your summary to the paper: a short letter needs a short summary; a long methods paper needs more. The summary must always fit on one page (≤400 words). For minor papers or few comments, a single paragraph may suffice.

Use this structure, but skip or compress sections that have nothing substantive to say:

## Peer Review Summary

### General Impression
What the paper does and how well it does it.

### Strengths
Only if there are genuine, specific strengths worth highlighting.

### Key Issues
The most important problems, grouped by theme. Reference inline comment numbers in brackets (e.g. [3, 7]). Do not explain what the comments already say — just identify the theme and point to them.

### Bibliography & Citations
Only if citation issues were flagged.

### Overall Assessment
A concluding sentence or two. Specific and qualitative — no numerical scores.

Be direct. No filler, no hedging, no restating the inline comments.`

export async function writeReport(plainText, comments, { citationSummary } = {}) {
  const wordCount = plainText.split(/\s+/).length
  const commentsSummary = comments.map((c, i) => {
    return `[${i + 1}] (${c.reviewer}, ${c.severity}) "${c.text_snippet?.slice(0, 80)}..." → ${c.content}`
  }).join('\n')

  let userMessage = `Paper length: ~${wordCount} words, ${comments.length} inline comments.\n\n`
  userMessage += `Here is the paper:\n\n${plainText.slice(0, 30000)}\n\n---\n\nInline reviewer comments:\n\n${commentsSummary}`
  if (citationSummary) {
    userMessage += `\n\n---\n\nCitation & Reference check:\n${citationSummary}`
  }
  userMessage += '\n\nWrite the peer review summary.'

  const { text, usage } = await callAnthropic({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
    maxTokens: 8000,
  })

  return { text, usage }
}
