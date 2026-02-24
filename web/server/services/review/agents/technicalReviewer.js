import { callAnthropic } from '../../../utils/ai'
import { createGuidanceTool } from '../guidanceLoader'
import { validateAnchors } from '../validateAnchors'

const SYSTEM_PROMPT = `You are a senior academic peer reviewer specializing in quantitative methods, statistical analysis, and research methodology. You are thorough, precise, and constructive.

Your role: Review the submitted research paper for statistical and methodological rigour.

Focus areas:
- Statistical methods: appropriateness, assumptions, implementation
- Effect sizes and confidence intervals: reported and interpreted correctly
- Sample size: justified, adequate for the analyses performed
- Multiple comparisons: controlled appropriately
- Missing data: handled and reported
- Study design: threats to internal/external validity
- Quantitative reporting: numbers, percentages, p-values reported accurately and consistently
- Reproducibility: methods described with sufficient detail

You have access to statistical guidance chapters via the "getGuidance" tool. Use it to refresh your knowledge on specific topics before commenting.

IMPORTANT: You MUST call the "submit_review" tool to submit your comments. Do not just write them as text. After reviewing the paper and optionally consulting guidance, call submit_review with your comments array.

Each comment must:
1. Quote an EXACT snippet from the paper (text_snippet) — must be a verbatim substring
2. Provide a specific, actionable comment
3. Rate severity: "major" (threatens validity), "minor" (should fix), "suggestion" (optional improvement)

Be thorough but fair. Aim for 8-20 comments. Focus on substance, not style.`

export async function runTechnicalReview(text, images, shared = { allValid: [], techNotes: [] }) {
  const allValid = shared.allValid
  const techNotes = shared.techNotes

  const guidanceTool = createGuidanceTool(['statistics'])

  const userContent = []
  // Add images as content parts if present
  for (const img of (images || [])) {
    userContent.push({ type: 'image', source: { type: 'base64', media_type: img.contentType, data: img.base64 } })
  }
  userContent.push({ type: 'text', text: `Please review the following paper:\n\n${text}` })

  const submitReviewTool = {
    name: 'submit_review',
    description: 'Submit your review comments. Each text_snippet must be an exact verbatim quote from the paper. You MUST call this tool to complete your review.',
    input_schema: {
      type: 'object',
      properties: {
        comments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              text_snippet: { type: 'string', description: 'Exact verbatim quote from the paper' },
              content: { type: 'string', description: 'Your review comment' },
              severity: { type: 'string', enum: ['major', 'minor', 'suggestion'] },
            },
            required: ['text_snippet', 'content', 'severity'],
          },
        },
      },
      required: ['comments'],
    },
    execute: async ({ comments }) => {
      console.log(`[TechnicalReviewer] submit_review called with ${comments.length} comments`)
      const { valid, invalid } = validateAnchors(comments, text)
      console.log(`[TechnicalReviewer] Anchors: ${valid.length} valid, ${invalid.length} invalid`)

      const existingSnippets = new Set(allValid.map(c => c.text_snippet))
      const existingContents = new Set(allValid.map(c => c.content?.trim()))
      allValid.push(...valid.filter(c =>
        !existingSnippets.has(c.text_snippet) && !existingContents.has(c.content?.trim())
      ))

      if (invalid.length === 0) {
        return { success: true, accepted: valid.length }
      }

      techNotes.push({ invalidCount: invalid.length, snippets: invalid.map(c => c.text_snippet?.slice(0, 80)) })

      return {
        success: false,
        accepted: valid.length,
        totalStored: allValid.length,
        failed: invalid.map(c => ({
          text_snippet: c.text_snippet,
          reason: c.reason,
          content: c.content,
          severity: c.severity,
        })),
        instruction: `${valid.length} comments accepted and stored. ${invalid.length} failed — snippets not found in paper. Fix each text_snippet to be an exact verbatim quote, or drop the comment. Call submit_review again with ONLY the corrected/remaining failed comments.`,
      }
    },
  }

  const { usage } = await callAnthropic({
    model: 'claude-sonnet-4-6',
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userContent }],
    tools: [guidanceTool, submitReviewTool],
    maxTokens: 8000,
    maxSteps: 10,
  })

  return {
    comments: allValid.map(c => ({ ...c, reviewer: 'Technical Reviewer' })),
    techNotes,
    usage,
  }
}
