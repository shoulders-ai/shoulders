/**
 * Provider proxy: translates between Anthropic Messages API format
 * and upstream provider formats (OpenAI, Google).
 *
 * The client always sends Anthropic format. The proxy translates to/from
 * the target provider, so the client always gets Anthropic format back.
 */

// --- Request translation ---

export function translateRequest(body, provider) {
  if (provider === 'anthropic') return stripExtraFields(body)

  if (provider === 'openai') return translateRequestToOpenAI(body)
  if (provider === 'google') return translateRequestToGoogle(body)

  throw new Error(`Unknown provider: ${provider}`)
}

// Strip provider-specific fields (e.g. _googleThoughtSignature) that Anthropic rejects
function stripExtraFields(body) {
  if (!body.messages) return body
  const hasExtra = body.messages.some(m =>
    m.role === 'assistant' && Array.isArray(m.content) && m.content.some(b => b._googleThoughtSignature)
  )
  if (!hasExtra) return body
  return {
    ...body,
    messages: body.messages.map(msg => {
      if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg
      return { ...msg, content: msg.content.map(b => {
        if (!b._googleThoughtSignature) return b
        const { _googleThoughtSignature, ...rest } = b
        return rest
      })}
    }),
  }
}

function translateRequestToOpenAI(body) {
  // Convert Anthropic-format messages to Responses API `input` array
  const input = []
  for (const msg of body.messages) {
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            input.push({
              type: 'function_call_output',
              call_id: block.tool_use_id,
              output: typeof block.content === 'string' ? block.content : JSON.stringify(block.content || ''),
            })
          } else if (block.type === 'text') {
            input.push({ role: 'user', content: block.text })
          }
        }
      } else {
        input.push({ role: 'user', content: msg.content })
      }
    } else if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
        if (textParts) input.push({ role: 'assistant', content: textParts })
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            input.push({
              type: 'function_call',
              call_id: block.id,
              name: block.name,
              arguments: JSON.stringify(block.input),
            })
          }
        }
      } else {
        input.push({ role: 'assistant', content: msg.content })
      }
    }
  }

  const result = {
    model: body.model,
    max_output_tokens: body.max_tokens || 16384,
    stream: body.stream ?? true,
    input,
  }

  // System prompt → instructions field
  if (body.system) {
    const systemText = typeof body.system === 'string'
      ? body.system
      : Array.isArray(body.system)
        ? body.system.map(b => b.text || '').join('\n')
        : String(body.system)
    result.instructions = systemText
  }

  // Tools: flat format (name/description/parameters at top level)
  if (body.tools?.length > 0) {
    result.tools = body.tools.map(t => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
      strict: false, // Schemas from Anthropic format lack additionalProperties:false
    }))
  }

  // Forward tool_choice (translate Anthropic format → Responses API format)
  if (body.tool_choice) {
    if (body.tool_choice.type === 'tool') {
      result.tool_choice = { type: 'function', name: body.tool_choice.name }
    } else if (body.tool_choice.type === 'any') {
      result.tool_choice = 'required'
    } else if (body.tool_choice.type === 'auto') {
      result.tool_choice = 'auto'
    }
  }

  // Forward reasoning params (Responses API uses nested reasoning object)
  if (body.reasoning) {
    result.reasoning = body.reasoning
  } else if (body.reasoning_effort) {
    result.reasoning = { effort: body.reasoning_effort, summary: 'auto' }
  }

  return result
}

function translateRequestToGoogle(body) {
  const contents = []

  for (const msg of body.messages) {
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        const parts = []
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            parts.push({
              functionResponse: {
                name: block._toolName || 'tool',
                response: { content: typeof block.content === 'string' ? block.content : JSON.stringify(block.content) },
              },
            })
          } else if (block.type === 'text') {
            parts.push({ text: block.text })
          }
        }
        contents.push({ role: 'user', parts })
      } else {
        contents.push({ role: 'user', parts: [{ text: msg.content }] })
      }
    } else if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        const parts = []
        for (const block of msg.content) {
          if (block.type === 'text') parts.push({ text: block.text })
          if (block.type === 'tool_use') {
            const fcPart = { functionCall: { name: block.name, args: block.input } }
            if (block._googleThoughtSignature) fcPart.thoughtSignature = block._googleThoughtSignature
            parts.push(fcPart)
          }
        }
        contents.push({ role: 'model', parts })
      } else {
        contents.push({ role: 'model', parts: [{ text: msg.content }] })
      }
    }
  }

  const result = {
    contents,
    generationConfig: { maxOutputTokens: body.max_tokens || 16384 },
  }

  if (body.system) {
    // Handle both string and Anthropic-format array [{type:'text', text:'...'}]
    const systemText = typeof body.system === 'string'
      ? body.system
      : Array.isArray(body.system)
        ? body.system.map(b => b.text || '').join('\n')
        : String(body.system)
    result.systemInstruction = { parts: [{ text: systemText }] }
  }

  if (body.tools?.length > 0) {
    result.tools = [{
      functionDeclarations: body.tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      })),
    }]
  }

  // Forward tool_choice (translate Anthropic format → Google toolConfig)
  if (body.tool_choice) {
    if (body.tool_choice.type === 'tool') {
      result.toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [body.tool_choice.name] } }
    } else if (body.tool_choice.type === 'any') {
      result.toolConfig = { functionCallingConfig: { mode: 'ANY' } }
    } else if (body.tool_choice.type === 'auto') {
      result.toolConfig = { functionCallingConfig: { mode: 'AUTO' } }
    }
  }

  return result
}

// --- Response translation (non-streaming) ---

export function translateResponse(provider, json) {
  if (provider === 'anthropic') return json

  if (provider === 'openai') {
    const content = []
    let hasToolCalls = false

    for (const item of json.output || []) {
      if (item.type === 'message') {
        for (const c of item.content || []) {
          if (c.type === 'output_text') {
            content.push({ type: 'text', text: c.text })
          }
        }
      } else if (item.type === 'function_call') {
        hasToolCalls = true
        content.push({
          type: 'tool_use',
          id: item.call_id,
          name: item.name,
          input: JSON.parse(item.arguments),
        })
      }
    }

    return {
      content,
      model: json.model,
      stop_reason: hasToolCalls ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: json.usage?.input_tokens || 0,
        output_tokens: json.usage?.output_tokens || 0,
      },
    }
  }

  if (provider === 'google') {
    const candidate = json.candidates?.[0]
    const parts = candidate?.content?.parts || []
    const content = []

    for (const part of parts) {
      if (part.text !== undefined) {
        content.push({ type: 'text', text: part.text })
      }
      if (part.functionCall) {
        content.push({
          type: 'tool_use',
          id: generateToolId(),
          name: part.functionCall.name,
          input: part.functionCall.args,
        })
      }
    }

    const hasToolCalls = content.some(c => c.type === 'tool_use')
    return {
      content,
      model: 'gemini',
      stop_reason: hasToolCalls ? 'tool_use' : 'end_turn',
      usage: {
        input_tokens: json.usageMetadata?.promptTokenCount || 0,
        output_tokens: json.usageMetadata?.candidatesTokenCount || 0,
      },
    }
  }

  return json
}

// --- Stream chunk translation ---

export function translateStreamChunk(provider, sseData) {
  if (provider === 'anthropic') return [sseData]

  if (provider === 'openai') return translateOpenAIChunk(sseData)
  if (provider === 'google') return translateGoogleChunk(sseData)

  return [sseData]
}

function translateOpenAIChunk(data) {
  const type = data.type
  if (!type) return []

  const events = []

  switch (type) {
    case 'response.output_text.delta':
      events.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: data.delta } })
      break

    case 'response.output_item.added':
      if (data.item?.type === 'function_call') {
        events.push({
          type: 'content_block_start',
          index: data.output_index || 0,
          content_block: { type: 'tool_use', id: data.item.call_id || data.item.id, name: data.item.name, input: {} },
        })
      }
      break

    case 'response.function_call_arguments.delta':
      events.push({ type: 'content_block_delta', index: data.output_index || 0, delta: { type: 'input_json_delta', partial_json: data.delta } })
      break

    case 'response.function_call_arguments.done':
      events.push({ type: 'content_block_stop', index: data.output_index || 0 })
      break

    case 'response.completed': {
      const response = data.response
      const hasToolCalls = response?.output?.some(item => item.type === 'function_call')
      const hasText = response?.output?.some(item => item.type === 'message')
      // Only emit content_block_stop for text — tool calls get theirs from function_call_arguments.done
      if (hasText && !hasToolCalls) {
        events.push({ type: 'content_block_stop', index: 0 })
      }
      const stopReason = hasToolCalls ? 'tool_use' : 'end_turn'
      events.push({ type: 'message_delta', delta: { stop_reason: stopReason }, usage: { output_tokens: response?.usage?.output_tokens || 0 } })
      break
    }

    case 'response.failed':
      events.push({ type: 'message_delta', delta: { stop_reason: 'error' }, usage: { output_tokens: 0 } })
      break

    case 'response.incomplete':
      events.push({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: data.response?.usage?.output_tokens || 0 } })
      break

    // All other response.* events are no-ops
    default:
      break
  }

  return events
}

function translateGoogleChunk(data) {
  if (!data.candidates?.length) return []
  const candidate = data.candidates[0]
  const parts = candidate.content?.parts
  const events = []
  let hasToolCalls = false

  if (parts) {
    for (const part of parts) {
      if (part.text !== undefined) {
        events.push({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: part.text } })
      }
      if (part.functionCall) {
        hasToolCalls = true
        const block = { type: 'tool_use', id: generateToolId(), name: part.functionCall.name, input: {} }
        if (part.thoughtSignature) block._googleThoughtSignature = part.thoughtSignature
        events.push({ type: 'content_block_start', index: 0, content_block: block })
        // Google sends complete args (not streamed) — emit as input_json_delta + block_stop
        // so the client's existing accumulate-then-parse flow handles it
        events.push({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(part.functionCall.args || {}) } })
        events.push({ type: 'content_block_stop', index: 0 })
      }
    }
  }

  // finishReason can arrive in the same chunk as text — must not be skipped
  if (candidate.finishReason === 'STOP') {
    const stopReason = hasToolCalls ? 'tool_use' : 'end_turn'
    events.push({ type: 'message_delta', delta: { stop_reason: stopReason }, usage: { output_tokens: data.usageMetadata?.candidatesTokenCount || 0 } })
  }

  return events
}

// --- Usage extraction ---

export function extractUsage(provider, data) {
  if (provider === 'anthropic') {
    return {
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    }
  }
  if (provider === 'openai') {
    // Responses API: usage at top level or nested in response.completed events
    const usage = data.usage || data.response?.usage
    return {
      inputTokens: usage?.input_tokens || 0,
      outputTokens: usage?.output_tokens || 0,
    }
  }
  if (provider === 'google') {
    return {
      inputTokens: data.usageMetadata?.promptTokenCount || 0,
      outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    }
  }
  return { inputTokens: 0, outputTokens: 0 }
}

// --- Provider URL + headers ---

export function getProviderUrl(provider, model, streaming) {
  if (provider === 'anthropic') {
    return 'https://api.anthropic.com/v1/messages'
  }
  if (provider === 'openai') {
    return 'https://api.openai.com/v1/responses'
  }
  if (provider === 'google') {
    const method = streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`
  }
  throw new Error(`Unknown provider: ${provider}`)
}

export function getProviderHeaders(provider, apiKey) {
  if (provider === 'anthropic') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    }
  }
  if (provider === 'openai') {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    }
  }
  if (provider === 'google') {
    return {
      'Content-Type': 'application/json',
    }
  }
  return { 'Content-Type': 'application/json' }
}

export function appendGoogleKey(url, apiKey) {
  if (url.includes('?')) return `${url}&key=${apiKey}`
  return `${url}?key=${apiKey}`
}

// --- Helpers ---

let _toolIdCounter = 0
function generateToolId() {
  return `toolu_proxy_${Date.now()}_${++_toolIdCounter}`
}
