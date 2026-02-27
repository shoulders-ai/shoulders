import { invoke } from '@tauri-apps/api/core'
import { useWorkspaceStore } from '../stores/workspace'
import { buildWorkspaceMeta } from './workspaceMeta'

/**
 * Build file-ref content blocks, handling PDFs natively for supported providers.
 * Returns { text: string, docBlocks: ContentBlock[] }
 */
async function buildFileRefBlocks(msg, lastFileRefIndex, idx, provider) {
  const textParts = []
  const docBlocks = []

  if (msg.fileRefs && msg.fileRefs.length > 0) {
    for (const ref of msg.fileRefs) {
      // Skip entirely if a newer version exists in a later message
      if (lastFileRefIndex[ref.path] !== idx) continue

      if (ref._isPdf && provider !== 'openai') {
        // Native PDF for Anthropic/Google
        try {
          const base64 = await invoke('read_file_base64', { path: ref.path })
          docBlocks.push({
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64 },
          })
        } catch {
          textParts.push(`<file-ref path="${ref.path}">[PDF file not accessible]</file-ref>`)
        }
      } else {
        // Text content (all non-PDF files, or OpenAI PDF fallback)
        textParts.push(`<file-ref path="${ref.path}">\n${ref.content}\n</file-ref>`)
      }
    }
  }

  return { text: textParts.length > 0 ? textParts.join('\n\n') + '\n\n' : '', docBlocks }
}

/**
 * Build a tool_result block, reading native PDF if applicable.
 */
async function buildToolResultBlock(tc, provider) {
  const block = {
    type: 'tool_result',
    tool_use_id: tc.id,
    ...(tc.status === 'error' ? { is_error: true } : {}),
  }

  if (tc._pdfPath && provider === 'google') {
    try {
      const base64 = await invoke('read_file_base64', { path: tc._pdfPath })
      block.content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      ]
    } catch {
      block.content = tc.output || '[PDF file not accessible]'
    }
  } else {
    block.content = tc.output || ''
  }

  return block
}

/**
 * Combine text + document blocks into a user message content value.
 * Returns string if no doc blocks, array of content blocks if doc blocks present.
 */
function buildUserContent(text, docBlocks) {
  if (docBlocks.length === 0) return text
  const content = [...docBlocks]
  if (text) content.push({ type: 'text', text })
  return content
}

export async function buildApiMessages(session, provider = 'anthropic') {
  const workspace = useWorkspaceStore()

  // Build workspace meta (async — git calls)
  const meta = await buildWorkspaceMeta(workspace.path)

  // First pass: find last index of each file-ref path
  const lastFileRefIndex = {}
  session.messages.forEach((msg, idx) => {
    if (msg.role === 'user' && msg.fileRefs) {
      for (const ref of msg.fileRefs) {
        lastFileRefIndex[ref.path] = idx
      }
    }
  })

  const apiMessages = []
  let isFirstUserMsg = true

  for (let idx = 0; idx < session.messages.length; idx++) {
    const msg = session.messages[idx]

    if (msg.role === 'user') {
      const textParts = []

      // Prepend workspace meta to the first user message
      if (isFirstUserMsg && meta) {
        textParts.push(meta)
      }
      isFirstUserMsg = false

      // Add file refs (with native PDF support)
      const { text: refText, docBlocks } = await buildFileRefBlocks(msg, lastFileRefIndex, idx, provider)
      if (refText) textParts.push(refText.trimEnd())

      // Add context
      if (msg.context && msg.context.text) {
        if (msg.context.contextBefore || msg.context.contextAfter) {
          textParts.push(`<context file="${msg.context.file}">\n<before>${msg.context.contextBefore || ''}</before>\n<selected>${msg.context.text}</selected>\n<after>${msg.context.contextAfter || ''}</after>\n</context>`)
        } else {
          textParts.push(`<context file="${msg.context.file}" selection="${msg.context.selection}">\n${msg.context.text}\n</context>`)
        }
      }

      // Add user text
      if (msg.content) textParts.push(msg.content)

      const text = textParts.join('\n\n').trim()

      // Check if previous assistant message had tool calls (need tool_result blocks)
      if (idx > 0) {
        const prevMsg = session.messages[idx - 1]
        if (prevMsg.role === 'assistant' && prevMsg.toolCalls && prevMsg.toolCalls.length > 0) {
          const toolResults = await Promise.all(
            prevMsg.toolCalls.map(tc => buildToolResultBlock(tc, provider))
          )

          if (text || docBlocks.length > 0) {
            const extra = [...docBlocks]
            if (text) extra.push({ type: 'text', text })
            apiMessages.push({ role: 'user', content: [...toolResults, ...extra] })
          } else {
            apiMessages.push({ role: 'user', content: toolResults })
          }
          continue
        }
      }

      apiMessages.push({ role: 'user', content: buildUserContent(text, docBlocks) })
    } else if (msg.role === 'assistant') {
      const hasToolCalls = msg.toolCalls?.length > 0
      const hasThinking = msg._thinkingBlocks?.length > 0

      if (hasToolCalls || hasThinking) {
        const blocks = []
        if (hasThinking) {
          for (const tb of msg._thinkingBlocks) {
            blocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
          }
        }
        if (msg.content) blocks.push({ type: 'text', text: msg.content })
        if (hasToolCalls) {
          for (const tc of msg.toolCalls) {
            const block = { type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }
            if (tc._googleThoughtSignature) block._googleThoughtSignature = tc._googleThoughtSignature
            blocks.push(block)
          }
        }
        apiMessages.push({ role: 'assistant', content: blocks })
      } else {
        apiMessages.push({ role: 'assistant', content: msg.content || '' })
      }
    }
  }

  return apiMessages
}

export async function buildApiMessagesWithToolResults(session, provider = 'anthropic') {
  const workspace = useWorkspaceStore()

  // Build workspace meta (async — git calls)
  const meta = await buildWorkspaceMeta(workspace.path)

  // Track file-ref dedup
  const lastFileRefIndex = {}
  session.messages.forEach((msg, idx) => {
    if (msg.role === 'user' && msg.fileRefs) {
      for (const ref of msg.fileRefs) {
        lastFileRefIndex[ref.path] = idx
      }
    }
  })

  const apiMessages = []
  let isFirstUserMsg = true

  for (let idx = 0; idx < session.messages.length; idx++) {
    const msg = session.messages[idx]

    if (msg.role === 'user') {
      // Check for tool result messages
      if (msg._isToolResult && msg._toolResults) {
        const processed = await Promise.all(
          msg._toolResults.map(async ({ _toolName, _pdfPath, ...rest }) => {
            if (_pdfPath && provider === 'google') {
              try {
                const base64 = await invoke('read_file_base64', { path: _pdfPath })
                return {
                  ...rest,
                  content: [
                    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
                  ],
                }
              } catch {
                return rest // fall back to text content
              }
            }
            return rest
          })
        )
        apiMessages.push({ role: 'user', content: processed })
        continue
      }

      const textParts = []

      // Prepend workspace meta to the first user message
      if (isFirstUserMsg && meta) {
        textParts.push(meta)
      }
      isFirstUserMsg = false

      // Add file refs (with native PDF support)
      const { text: refText, docBlocks } = await buildFileRefBlocks(msg, lastFileRefIndex, idx, provider)
      if (refText) textParts.push(refText.trimEnd())

      if (msg.context && msg.context.text) {
        if (msg.context.contextBefore || msg.context.contextAfter) {
          textParts.push(`<context file="${msg.context.file}">\n<before>${msg.context.contextBefore || ''}</before>\n<selected>${msg.context.text}</selected>\n<after>${msg.context.contextAfter || ''}</after>\n</context>`)
        } else {
          textParts.push(`<context file="${msg.context.file}" selection="${msg.context.selection}">\n${msg.context.text}\n</context>`)
        }
      }

      if (msg.content) textParts.push(msg.content)

      const text = textParts.join('\n\n').trim()

      // If previous assistant had tool calls, include tool_results
      // (handles corrupted sessions where a user message was interleaved during tool execution)
      if (idx > 0) {
        const prevMsg = session.messages[idx - 1]
        if (prevMsg.role === 'assistant' && prevMsg.toolCalls && prevMsg.toolCalls.length > 0) {
          const toolResults = await Promise.all(
            prevMsg.toolCalls.map(tc => buildToolResultBlock(tc, provider))
          )
          if (text || docBlocks.length > 0) {
            const extra = [...docBlocks]
            if (text) extra.push({ type: 'text', text })
            apiMessages.push({ role: 'user', content: [...toolResults, ...extra] })
          } else {
            apiMessages.push({ role: 'user', content: toolResults })
          }
          continue
        }
      }

      apiMessages.push({ role: 'user', content: buildUserContent(text, docBlocks) })
    } else if (msg.role === 'assistant') {
      const hasToolCalls = msg.toolCalls?.length > 0
      const hasThinking = msg._thinkingBlocks?.length > 0

      if (hasToolCalls || hasThinking) {
        const blocks = []
        if (hasThinking) {
          for (const tb of msg._thinkingBlocks) {
            blocks.push({ type: 'thinking', thinking: tb.thinking, signature: tb.signature })
          }
        }
        if (msg.content) blocks.push({ type: 'text', text: msg.content })
        if (hasToolCalls) {
          for (const tc of msg.toolCalls) {
            const block = { type: 'tool_use', id: tc.id, name: tc.name, input: tc.input }
            if (tc._googleThoughtSignature) block._googleThoughtSignature = tc._googleThoughtSignature
            blocks.push(block)
          }
        }
        apiMessages.push({ role: 'assistant', content: blocks })
      } else {
        apiMessages.push({ role: 'assistant', content: msg.content || '' })
      }
    }
  }

  return apiMessages
}
