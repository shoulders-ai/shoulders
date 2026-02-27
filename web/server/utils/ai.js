const config = () => useRuntimeConfig()

export async function callAnthropic({ model = 'claude-sonnet-4-6', system, messages, tools, maxTokens = 4096, maxSteps = 1 }) {
  const apiKey = config().anthropicApiKey
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const totalUsage = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }
  let currentMessages = [...messages]
  let steps = 0
  let finalText = ''

  const toolMap = new Map()
  const apiTools = tools?.map(t => {
    toolMap.set(t.name, t)
    return { name: t.name, description: t.description, input_schema: t.input_schema }
  })

  // Add cache_control to the first user message (the paper)
  // Normalize string content to array format so cache_control can be applied
  if (currentMessages[0]) {
    if (typeof currentMessages[0].content === 'string') {
      currentMessages[0] = {
        ...currentMessages[0],
        content: [{ type: 'text', text: currentMessages[0].content, cache_control: { type: 'ephemeral' } }],
      }
    } else if (Array.isArray(currentMessages[0].content)) {
      const lastBlock = currentMessages[0].content[currentMessages[0].content.length - 1]
      if (lastBlock && !lastBlock.cache_control) {
        lastBlock.cache_control = { type: 'ephemeral' }
      }
    }
  }

  while (steps < maxSteps) {
    steps++

    const body = {
      model,
      max_tokens: maxTokens,
      messages: currentMessages,
    }
    // System prompt with cache_control for prompt caching
    if (system) {
      body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
    }
    if (apiTools?.length) body.tools = apiTools

    const bodyJson = JSON.stringify(body)

    let res
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: AbortSignal.timeout(120_000),
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: bodyJson,
      })
    } catch (fetchErr) {
      const detail = fetchErr.cause?.message || fetchErr.cause?.code || fetchErr.message
      console.error(`[callAnthropic] Fetch failed on step ${steps}/${maxSteps}, model=${model}, bodySize=${bodyJson.length} chars: ${detail}`)
      throw new Error(`Anthropic fetch failed (step ${steps}, ~${bodyJson.length} chars): ${detail}`, { cause: fetchErr })
    }

    if (!res.ok) {
      const err = await res.text()
      console.error(`[callAnthropic] API error on step ${steps}/${maxSteps}, model=${model}, status=${res.status}: ${err.slice(0, 500)}`)
      throw new Error(`Anthropic API error ${res.status}: ${err}`)
    }

    const data = await res.json()

    if (data.usage) {
      totalUsage.input += data.usage.input_tokens || 0
      totalUsage.output += data.usage.output_tokens || 0
      totalUsage.cacheRead += data.usage.cache_read_input_tokens || 0
      totalUsage.cacheCreation += data.usage.cache_creation_input_tokens || 0
    }

    const textBlocks = data.content?.filter(b => b.type === 'text') || []
    const toolUseBlocks = data.content?.filter(b => b.type === 'tool_use') || []

    if (textBlocks.length) {
      finalText = textBlocks.map(b => b.text).join('')
    }

    if (data.stop_reason !== 'tool_use' || !toolUseBlocks.length) {
      return { text: finalText, content: data.content, usage: totalUsage, steps }
    }

    // Execute tool calls
    currentMessages.push({ role: 'assistant', content: data.content })

    const toolResults = []
    for (const toolUse of toolUseBlocks) {
      const tool = toolMap.get(toolUse.name)
      if (!tool) {
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ error: `Unknown tool: ${toolUse.name}` }) })
        continue
      }
      try {
        const result = await tool.execute(toolUse.input)
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify(result) })
      } catch (e) {
        toolResults.push({ type: 'tool_result', tool_use_id: toolUse.id, content: JSON.stringify({ error: e.message }), is_error: true })
      }
    }

    currentMessages.push({ role: 'user', content: toolResults })
  }

  return { text: finalText, content: [], usage: totalUsage, steps }
}

export async function callGemini({ model = 'gemini-2.5-flash-lite', system, messages, maxTokens = 4096 }) {
  const apiKey = config().googleApiKey
  if (!apiKey) throw new Error('GOOGLE_API_KEY not configured')

  const contents = messages.map(m => {
    const role = m.role === 'assistant' ? 'model' : 'user'
    if (typeof m.content === 'string') {
      return { role, parts: [{ text: m.content }] }
    }
    // Array content (multimodal)
    const parts = m.content.map(part => {
      if (part.type === 'text') return { text: part.text }
      if (part.type === 'image') return { inlineData: { mimeType: part.mimeType || 'image/png', data: part.data } }
      return { text: JSON.stringify(part) }
    })
    return { role, parts }
  })

  const body = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  }
  if (system) body.systemInstruction = { parts: [{ text: system }] }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gemini API error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
  const usage = {
    input: data.usageMetadata?.promptTokenCount || 0,
    output: data.usageMetadata?.candidatesTokenCount || 0,
  }

  return { text, usage }
}
