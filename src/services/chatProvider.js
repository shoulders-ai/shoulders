// Multi-provider request formatting and SSE parsing
// Starts with Anthropic, extended in Phase 5 for OpenAI + Google

export function formatRequest(provider, { url, apiKey, model, messages, system, tools, maxTokens, providerHint, thinking }) {
  if (provider === 'anthropic') {
    return formatAnthropic({ url, apiKey, model, messages, system, tools, maxTokens, thinking })
  }
  if (provider === 'openai') {
    return formatOpenAI({ url, apiKey, model, messages, system, tools, maxTokens, thinking })
  }
  if (provider === 'google') {
    return formatGoogle({ url, apiKey, model, messages, system, tools, maxTokens, thinking })
  }
  if (provider === 'shoulders') {
    return formatShoulders({ url, apiKey, model, messages, system, tools, maxTokens, providerHint, thinking })
  }
  throw new Error(`Unknown provider: ${provider}`)
}

function formatAnthropic({ url, apiKey, model, messages, system, tools, maxTokens, thinking }) {
  // Strip provider-specific fields that Anthropic rejects (e.g. _googleThoughtSignature from cross-provider sessions)
  const cleanMessages = messages.map(msg => {
    if (msg.role !== 'assistant' || !Array.isArray(msg.content)) return msg
    const hasExtra = msg.content.some(b => b._googleThoughtSignature)
    if (!hasExtra) return msg
    return { ...msg, content: msg.content.map(b => {
      if (!b._googleThoughtSignature) return b
      const { _googleThoughtSignature, ...rest } = b
      return rest
    })}
  })
  const body = {
    model,
    max_tokens: thinking ? 32768 : (maxTokens || 16384),
    stream: true,
    messages: cleanMessages,
  }
  if (system) {
    body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
  }
  body.cache_control = { type: 'ephemeral' }
  if (tools && tools.length > 0) body.tools = tools

  // Extended thinking
  if (thinking) {
    if (thinking.mode === 'adaptive') {
      body.thinking = { type: 'adaptive' }
      body.output_config = { effort: thinking.effort || 'medium' }
    } else if (thinking.mode === 'manual') {
      body.thinking = { type: 'enabled', budget_tokens: thinking.budgetTokens || 10000 }
    }
  }

  return {
    url: url || 'https://api.anthropic.com/v1/messages',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  }
}

function formatOpenAI({ url, apiKey, model, messages, system, tools, maxTokens, thinking }) {
  const input = _convertToOpenAIInput(messages)
  const body = {
    model,
    input,
    stream: true,
  }
  if (system) body.instructions = system
  if (maxTokens) body.max_output_tokens = thinking ? 32768 : maxTokens

  // Tools: flatter format in Responses API (name/description/parameters at top level)
  if (tools?.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
      strict: false, // Our schemas lack additionalProperties:false — strict:true (default) would reject them
    }))
  }

  // Reasoning (native in Responses API)
  if (thinking?.mode === 'openai') {
    body.reasoning = { effort: thinking.effort || 'medium', summary: 'auto' }
  }

  return {
    url: url || 'https://api.openai.com/v1/responses',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }
}

function formatGoogle({ url, apiKey, model, messages, system, tools, maxTokens, thinking }) {
  const contents = _convertToGoogleContents(messages)
  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens || 16384 },
  }
  if (system) {
    body.systemInstruction = { parts: [{ text: system }] }
  }
  if (tools && tools.length > 0) {
    body.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      })),
    }]
  }

  // Extended thinking
  if (thinking?.mode === 'google') {
    body.generationConfig.thinkingConfig = {
      thinkingLevel: thinking.level || 'high',
      includeThoughts: true,
    }
  } else if (thinking?.mode === 'google25') {
    body.generationConfig.thinkingConfig = {
      thinkingBudget: thinking.budget || 8192,
      includeThoughts: true,
    }
  }

  const baseUrl = url || 'https://generativelanguage.googleapis.com/v1beta/models'
  return {
    url: `${baseUrl}/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function formatShoulders({ url, apiKey, model, messages, system, tools, maxTokens, providerHint, thinking }) {
  const body = {
    model,
    max_tokens: thinking ? 32768 : (maxTokens || 16384),
    stream: true,
    messages,
  }
  if (system) {
    if (providerHint === 'anthropic') {
      body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    } else {
      body.system = system
    }
  }
  if (providerHint === 'anthropic') {
    body.cache_control = { type: 'ephemeral' }
  }
  if (tools && tools.length > 0) body.tools = tools

  // Extended thinking — pass provider-specific fields; proxy forwards them
  if (thinking) {
    if (thinking.mode === 'adaptive') {
      body.thinking = { type: 'adaptive' }
      body.output_config = { effort: thinking.effort || 'medium' }
    } else if (thinking.mode === 'manual') {
      body.thinking = { type: 'enabled', budget_tokens: thinking.budgetTokens || 10000 }
    } else if (thinking.mode === 'openai') {
      body.reasoning_effort = thinking.effort || 'medium'
      body.reasoning = { effort: thinking.effort || 'medium', summary: 'auto' }
    } else if (thinking.mode === 'google') {
      body.thinking_config = { thinkingLevel: thinking.level || 'high', includeThoughts: true }
    } else if (thinking.mode === 'google25') {
      body.thinking_config = { thinkingBudget: thinking.budget || 8192, includeThoughts: true }
    }
  }

  return {
    url: url || `${import.meta.env.DEV ? 'http://localhost:3000' : 'https://shoulde.rs'}/api/v1/proxy`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'X-Shoulders-Provider': providerHint || 'anthropic',
    },
    body: JSON.stringify(body),
  }
}

// --- Non-streaming request formatting ---
// Same provider-specific body/header construction as streaming, minus stream fields.
// toolChoice support: Anthropic tool_choice → OpenAI/Google equivalents.

export function formatNonStreamingRequest(provider, { url, apiKey, model, messages, system, tools, toolChoice, maxTokens, providerHint }) {
  if (provider === 'anthropic') {
    const body = { model, max_tokens: maxTokens || 4096, messages }
    if (system) {
      body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    }
    if (tools?.length) body.tools = tools
    if (toolChoice) body.tool_choice = toolChoice
    return {
      url: url || 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    }
  }

  if (provider === 'openai') {
    const input = _convertToOpenAIInput(messages)
    const body = {
      model,
      max_output_tokens: maxTokens || 4096,
      input,
      // Minimize reasoning for non-streaming calls (ghost, quick tasks) —
      // reasoning tokens eat into max_output_tokens budget
      reasoning: { effort: 'low' },
    }
    if (system) body.instructions = system
    if (tools?.length) {
      body.tools = tools.map(t => ({
        type: 'function',
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
        strict: false, // Our schemas lack additionalProperties:false — strict:true (default) would reject them
      }))
    }
    if (toolChoice) {
      if (toolChoice.type === 'tool') {
        body.tool_choice = { type: 'function', name: toolChoice.name }
      } else if (toolChoice.type === 'any') {
        body.tool_choice = 'required'
      } else if (toolChoice.type === 'auto') {
        body.tool_choice = 'auto'
      }
    }
    return {
      url: url || 'https://api.openai.com/v1/responses',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    }
  }

  if (provider === 'google') {
    const contents = _convertToGoogleContents(messages)
    const body = { contents, generationConfig: { maxOutputTokens: maxTokens || 4096 } }
    if (system) body.systemInstruction = { parts: [{ text: system }] }
    if (tools?.length) {
      body.tools = [{ functionDeclarations: tools.map(t => ({
        name: t.name, description: t.description, parameters: t.input_schema,
      }))}]
    }
    if (toolChoice && toolChoice.type === 'tool') {
      body.toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [toolChoice.name] } }
    }
    const baseUrl = url || 'https://generativelanguage.googleapis.com/v1beta/models'
    return {
      url: `${baseUrl}/${model}:generateContent?key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  }

  if (provider === 'shoulders') {
    const body = { model, max_tokens: maxTokens || 4096, messages }
    if (system) {
      body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    }
    if (tools?.length) body.tools = tools
    if (toolChoice) body.tool_choice = toolChoice
    return {
      url: url || `${import.meta.env.DEV ? 'http://localhost:3000' : 'https://shoulde.rs'}/api/v1/proxy`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-Shoulders-Provider': providerHint || 'anthropic',
      },
      body: JSON.stringify(body),
    }
  }

  throw new Error(`Unknown provider: ${provider}`)
}

// --- Shared message conversion helpers ---

function _convertToOpenAIMessages(messages, system) {
  const oaiMessages = []
  if (system) oaiMessages.push({ role: 'system', content: system })
  for (const msg of messages) {
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            oaiMessages.push({ role: 'tool', tool_call_id: block.tool_use_id, content: block.content || '' })
          } else if (block.type === 'text') {
            oaiMessages.push({ role: 'user', content: block.text })
          }
        }
      } else {
        oaiMessages.push({ role: 'user', content: msg.content })
      }
    } else if (msg.role === 'assistant') {
      if (Array.isArray(msg.content)) {
        const textParts = msg.content.filter(b => b.type === 'text').map(b => b.text).join('')
        const toolCalls = msg.content.filter(b => b.type === 'tool_use').map(b => ({
          id: b.id, type: 'function', function: { name: b.name, arguments: JSON.stringify(b.input) },
        }))
        const oaiMsg = { role: 'assistant' }
        if (textParts) oaiMsg.content = textParts
        if (toolCalls.length > 0) oaiMsg.tool_calls = toolCalls
        oaiMessages.push(oaiMsg)
      } else {
        oaiMessages.push({ role: 'assistant', content: msg.content })
      }
    }
  }
  return oaiMessages
}

// Convert Anthropic-format messages to Responses API `input` array.
// Tool calls and results are top-level items (not nested inside messages).
function _convertToOpenAIInput(messages) {
  const input = []
  for (const msg of messages) {
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
        // Tool calls as separate top-level items
        for (const block of msg.content) {
          if (block.type === 'tool_use') {
            input.push({
              type: 'function_call',
              call_id: block.id,
              name: block.name,
              arguments: JSON.stringify(block.input),
            })
          }
          // thinking blocks → dropped (OpenAI manages reasoning internally)
        }
      } else {
        input.push({ role: 'assistant', content: msg.content })
      }
    }
  }
  return input
}

function _convertToGoogleContents(messages) {
  const contents = []
  for (const msg of messages) {
    if (msg.role === 'user') {
      if (Array.isArray(msg.content)) {
        const parts = []
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            if (Array.isArray(block.content)) {
              for (const sub of block.content) {
                if (sub.type === 'document') parts.push({ inlineData: { mimeType: sub.source.media_type, data: sub.source.data } })
                else if (sub.type === 'text') parts.push({ text: sub.text })
              }
            } else {
              parts.push({ functionResponse: { name: block._toolName || 'tool', response: { content: block.content || '' } } })
            }
          } else if (block.type === 'text') {
            parts.push({ text: block.text })
          } else if (block.type === 'document') {
            parts.push({ inlineData: { mimeType: block.source.media_type, data: block.source.data } })
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
          if (block.type === 'thinking') {
            // Include thinking blocks for Google conversation history
            const tp = { text: block.thinking, thought: true }
            if (block.signature) tp.thoughtSignature = block.signature
            parts.push(tp)
          }
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
  return contents
}

// Parse raw SSE data into events
export function parseSSEChunk(provider, rawChunk, buffer) {
  const text = buffer + rawChunk
  const events = []
  const lines = text.split('\n')
  let remaining = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // If this is the last line and doesn't end with \n, it might be incomplete
    if (i === lines.length - 1 && !text.endsWith('\n')) {
      remaining = line
      break
    }

    if (line.startsWith('data: ')) {
      const data = line.slice(6).trim()
      if (data === '[DONE]') {
        events.push({ type: 'done' })
        continue
      }
      try {
        const parsed = JSON.parse(data)
        events.push(parsed)
      } catch (e) {
        // Incomplete JSON, carry over
        remaining = line
      }
    }
  }

  return { events, remainingBuffer: remaining }
}

// Normalize provider-specific events into a common format
export function interpretEvent(provider, event) {
  // Shoulders balance trailer — arrives after stream ends, before [DONE]
  if (event.type === 'shoulders_balance') {
    return { type: 'shoulders_balance', credits: event.credits, costCents: event.cost_cents }
  }

  if (event.type === 'done') return { type: 'message_stop' }

  if (provider === 'anthropic') return interpretAnthropic(event)
  if (provider === 'openai') return interpretOpenAI(event)
  if (provider === 'google') return interpretGoogle(event)
  if (provider === 'shoulders') return interpretAnthropic(event) // proxy normalizes to Anthropic SSE format
  return null
}

function interpretAnthropic(event) {
  const type = event.type
  if (type === 'content_block_start') {
    const block = event.content_block
    if (block.type === 'text') return { type: 'block_start', blockType: 'text' }
    if (block.type === 'thinking') return { type: 'block_start', blockType: 'thinking' }
    if (block.type === 'tool_use') {
      return { type: 'block_start', blockType: 'tool_use', toolName: block.name, toolId: block.id, thoughtSignature: block._googleThoughtSignature || null }
    }
    return null
  }
  if (type === 'content_block_delta') {
    const delta = event.delta
    if (delta.type === 'text_delta') return { type: 'text_delta', text: delta.text }
    if (delta.type === 'input_json_delta') return { type: 'tool_input_delta', json: delta.partial_json }
    if (delta.type === 'thinking_delta') return { type: 'thinking_delta', text: delta.thinking }
    if (delta.type === 'signature_delta') return { type: 'signature_delta', signature: delta.signature }
    return null
  }
  if (type === 'content_block_stop') return { type: 'block_stop' }
  if (type === 'message_delta') {
    return { type: 'message_delta', stopReason: event.delta?.stop_reason, usage: event.usage }
  }
  if (type === 'message_stop') return { type: 'message_stop' }
  if (type === 'message_start') return { type: 'message_start', usage: event.message?.usage }
  return null
}

// Responses API streaming events — type field in JSON tells us the event kind
function interpretOpenAI(event) {
  const type = event.type

  if (!type) return null

  switch (type) {
    case 'response.created':
      return { type: 'message_start', usage: event.response?.usage }

    case 'response.output_item.added': {
      const item = event.item
      if (item?.type === 'function_call') {
        return {
          type: 'block_start',
          blockType: 'tool_use',
          toolName: item.name,
          toolId: item.call_id || item.id,
        }
      }
      return null
    }

    case 'response.output_text.delta':
      return { type: 'text_delta', text: event.delta }

    // Reasoning summaries (with summary: 'auto')
    case 'response.reasoning_summary_text.delta':
      return { type: 'thinking_delta', text: event.delta }

    // Full reasoning text (if exposed by API)
    case 'response.reasoning_text.delta':
      return { type: 'thinking_delta', text: event.delta }

    case 'response.function_call_arguments.delta':
      return { type: 'tool_input_delta', json: event.delta }

    case 'response.function_call_arguments.done':
      return { type: 'block_stop' }

    case 'response.completed': {
      const response = event.response
      const outputTypes = response?.output?.map(item => `${item.type}${item.name ? ':' + item.name : ''}`) || []
      const hasToolCalls = response?.output?.some(item => item.type === 'function_call')
      const stopReason = hasToolCalls ? 'tool_use' : 'end_turn'
      return { type: 'message_delta', stopReason, usage: response?.usage }
    }

    case 'response.failed': {
      console.error('[openai-failed]', JSON.stringify(event).slice(0, 1000))
      return { type: 'message_delta', stopReason: 'error', usage: null }
    }

    case 'response.incomplete':
      console.warn('[openai-incomplete]', JSON.stringify(event).slice(0, 500))
      return { type: 'message_delta', stopReason: 'end_turn', usage: event.response?.usage }

    // Known events we don't need to act on
    case 'response.in_progress':
    case 'response.output_item.done':
    case 'response.content_part.added':
    case 'response.content_part.done':
    case 'response.output_text.done':
    case 'response.reasoning_summary_part.added':
    case 'response.reasoning_summary_part.done':
    case 'response.reasoning_summary_text.done':
      return null

    default:
      console.warn('[openai-unhandled]', type, JSON.stringify(event).slice(0, 500))
      return null
  }
}

function interpretGoogle(event) {
  // Returns an ARRAY of interpreted events (Google can send multiple parts per chunk)
  const rawUsage = event.usageMetadata || null

  if (!event.candidates || event.candidates.length === 0) return null
  const candidate = event.candidates[0]
  const parts = candidate.content?.parts

  if (!parts) {
    if (candidate.finishReason === 'STOP') {
      return [{ type: 'message_delta', stopReason: 'end_turn', usage: rawUsage }]
    }
    return null
  }

  // Google sends complete parts, not deltas — collect ALL parts
  const results = []
  for (const part of parts) {
    if (part.text !== undefined) {
      if (part.thought) {
        results.push({ type: 'thinking_delta', text: part.text })
      } else {
        results.push({ type: 'text_delta', text: part.text })
      }
    }
    if (part.functionCall) {
      results.push({
        type: 'google_tool_call',
        toolName: part.functionCall.name,
        toolInput: part.functionCall.args,
        thoughtSignature: part.thoughtSignature || null,
      })
    }
  }

  if (results.length === 0) {
    if (candidate.finishReason === 'STOP') {
      return [{ type: 'message_delta', stopReason: 'end_turn', usage: rawUsage }]
    }
    return null
  }

  // Attach usage to the last result
  results[results.length - 1].usage = rawUsage
  return results
}
