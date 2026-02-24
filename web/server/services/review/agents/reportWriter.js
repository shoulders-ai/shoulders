import { callAnthropic } from '../../../utils/ai'

const SYSTEM_PROMPT = `You are a senior academic peer reviewer writing a summary report for a research paper. You have access to detailed inline comments from two reviewers (Technical and Editorial).

Write a peer review summary (500-1000 words) structured as:

## Peer Review Summary

### General Impression
A 2-3 sentence overview of the paper's contribution and quality.

### Strengths
Bullet points highlighting what the paper does well.

### Areas for Improvement
Organised by theme (not reviewer). Reference the inline comments where relevant. Focus on the most important issues.

### Overall Assessment
A concluding paragraph. Be specific and qualitative — no numerical scores. Example tone: "This paper presents interesting findings but several methodological concerns should be addressed before publication."

Write in the voice of a fair, thorough senior colleague. Professional but direct. No hedging, no filler.`

export async function writeReport(plainText, comments, { citationSummary } = {}) {
  const commentsSummary = comments.map((c, i) => {
    return `[${i + 1}] (${c.reviewer}, ${c.severity}) "${c.text_snippet?.slice(0, 80)}..." → ${c.content}`
  }).join('\n')

  const { text, usage } = await callAnthropic({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Here is the paper (plain text):\n\n${plainText.slice(0, 30000)}\n\n---\n\nHere are the inline reviewer comments:\n\n${commentsSummary}${citationSummary ? `\n\n---\n\nCitation & Reference check (include as "### Bibliography & Citations" subsection just before Overall Assessment):\n${citationSummary}` : ''}\n\nWrite the peer review summary.`
    }],
    maxTokens: 4000,
  })

  return { text, usage }
}
