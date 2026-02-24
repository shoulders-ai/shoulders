import { callModel, resolveApiAccess } from './apiClient'
import { getUsage } from './tokenUsage.js'

const GHOST_TIMEOUT_MS = 15000

async function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Ghost suggestion timed out')), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Truncate text at a word boundary, adding a marker if truncated.
 * For 'start' mode: trims from the beginning (keeps the end).
 * For 'end' mode: trims from the end (keeps the beginning).
 */
function smartTruncate(text, maxLen, mode) {
  if (text.length <= maxLen) return text

  if (mode === 'start') {
    // Keep the end, trim the start
    let trimmed = text.slice(-maxLen)
    const firstSpace = trimmed.indexOf(' ')
    if (firstSpace > 0 && firstSpace < 100) {
      trimmed = trimmed.slice(firstSpace + 1)
    }
    return '[…] ' + trimmed
  } else {
    // Keep the start, trim the end
    let trimmed = text.slice(0, maxLen)
    const lastSpace = trimmed.lastIndexOf(' ')
    if (lastSpace > maxLen - 100 && lastSpace > 0) {
      trimmed = trimmed.slice(0, lastSpace)
    }
    return trimmed + ' […]'
  }
}

/**
 * Get ghost text suggestions from AI.
 * Tries: Anthropic Haiku → Gemini Flash Lite → GPT-5-mini → Shoulders proxy.
 *
 * @param {string} before - Text before cursor (up to 5000 chars)
 * @param {string} after - Text after cursor (up to 1000 chars)
 * @param {string} systemPrompt - System prompt from .shoulders/system.md
 * @param {object} workspace - Workspace store instance
 * @param {string} [instructions] - User instructions from _instructions.md
 * @returns {Promise<{suggestions: string[], usage: object|null}>}
 */
export async function getGhostSuggestions(before, after, systemPrompt, workspace, instructions) {
  const access = await resolveApiAccess({ strategy: 'ghost' }, workspace)
  if (access?._networkError) {
    return { suggestions: [], usage: null, networkError: true }
  }
  if (!access) {
    return { suggestions: [], usage: null, noAccess: true }
  }

  const safeBefore = smartTruncate(before, 5000, 'start')
  const safeAfter = smartTruncate(after, 1000, 'end')

  const userMessage = `<prefix>${safeBefore}</prefix><cursor/><suffix>${safeAfter || ''}</suffix>

Predict text at <cursor/> by calling suggest_completions.`

  const system = `You are an inline text completion engine for a research workspace called Shoulders. Your users are researchers. Predict 3 continuations at <cursor/>.

Rules:
- Match the author's voice, style, and register exactly
- Length: 1 word to 3 sentences depending on context. Vary lengths across suggestions
- If completing a partial word (prefix ends mid-word), finish that word first then optionally continue
- If prefix ends at a word boundary, start a new word or phrase
- Include necessary whitespace in each suggestion (leading space, newline, etc.)
- NEVER hallucinate facts. Use [placeholder] for unknowns: [citation], [value], [source], [year]
- Do NOT repeat or complete text from <suffix> — your text is INSERTED BETWEEN prefix and suffix
- For empty documents, suggest a natural starting point based on the filename or context
- Markdown formatting (headers, lists, bold) is fine when contextually appropriate

Call suggest_completions with prefix_end, suffix_start, and your predictions.${systemPrompt ? '\n\n' + systemPrompt : ''}${instructions ? '\n\nUser instructions:\n' + instructions : ''}`

  let result
  try {
    result = await withTimeout(callModel({
      access,
      system,
      messages: [{ role: 'user', content: userMessage }],
      tools: [
        {
          name: 'suggest_completions',
          description: 'Insert predicted text at <cursor/> position',
          input_schema: {
            type: 'object',
            properties: {
              prefix_end: {
                type: 'string',
                description: 'Copy the last 20 characters from <prefix> verbatim',
              },
              suffix_start: {
                type: 'string',
                description: 'Copy the first 20 characters from <suffix> verbatim, or "EMPTY" if suffix is empty',
              },
              suggestions: {
                type: 'array',
                items: { type: 'string' },
                minItems: 3,
                maxItems: 5,
                description: 'Text completions to insert between prefix_end and suffix_start. Must flow naturally from prefix_end into suffix_start.',
              },
            },
            required: ['prefix_end', 'suffix_start', 'suggestions'],
          },
        },
      ],
      toolChoice: { type: 'tool', name: 'suggest_completions' },
      maxTokens: 4096,
    }), GHOST_TIMEOUT_MS)
  } catch (callErr) {
    throw callErr
  }

  // Compute usage
  let usage = null
  if (result.rawUsage) {
    usage = getUsage(access.provider, result.rawUsage, access.model)
  }

  // Extract suggestions — handle both Anthropic tool_use and OpenAI/Google function call formats
  const rawResponse = result.rawResponse
  const meta = { usage, provider: access.provider, modelId: access.model }

  // Anthropic / Shoulders: content[].type === 'tool_use'
  const toolUse = rawResponse.content?.find((block) => block.type === 'tool_use')
  if (toolUse?.input?.suggestions) {
    return { suggestions: toolUse.input.suggestions, ...meta }
  }

  // OpenAI Responses API: output[] → function_call
  const funcCall = rawResponse.output?.find(item => item.type === 'function_call')
  if (funcCall?.arguments) {
    try {
      const parsed = JSON.parse(funcCall.arguments)
      if (parsed.suggestions) {
        return { suggestions: parsed.suggestions, ...meta }
      }
    } catch { /* ignore */ }
  }

  // OpenAI Chat Completions (legacy fallback): choices[0].message.tool_calls
  const oaiToolCall = rawResponse.choices?.[0]?.message?.tool_calls?.[0]
  if (oaiToolCall?.function?.arguments) {
    try {
      const parsed = JSON.parse(oaiToolCall.function.arguments)
      if (parsed.suggestions) {
        return { suggestions: parsed.suggestions, ...meta }
      }
    } catch { /* ignore */ }
  }

  // Google: candidates[0].content.parts[].functionCall
  const googlePart = rawResponse.candidates?.[0]?.content?.parts?.find(p => p.functionCall)
  if (googlePart?.functionCall?.args?.suggestions) {
    return { suggestions: googlePart.functionCall.args.suggestions, ...meta }
  }

  return { suggestions: [], ...meta }
}
