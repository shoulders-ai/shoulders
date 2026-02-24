const config = () => useRuntimeConfig()

export async function callAnthropic({ model = 'claude-sonnet-4-6', system, messages, tools, maxTokens = 4096, maxSteps = 1 }) {
  const apiKey = config().anthropicApiKey
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

  const totalUsage = { input: 0, output: 0 }
  let currentMessages = [...messages]
  let steps = 0
  let finalText = ''

  const toolMap = new Map()
  const apiTools = tools?.map(t => {
    toolMap.set(t.name, t)
    return { name: t.name, description: t.description, input_schema: t.input_schema }
  })

  while (steps < maxSteps) {
    steps++

    const body = {
      model,
      max_tokens: maxTokens,
      messages: currentMessages,
    }
    if (system) body.system = system
    if (apiTools?.length) body.tools = apiTools

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${err}`)
    }

    const data = await res.json()

    if (data.usage) {
      totalUsage.input += data.usage.input_tokens || 0
      totalUsage.output += data.usage.output_tokens || 0
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
