/**
 * Custom ChatTransport for AI SDK Chat composable.
 *
 * Creates a ToolLoopAgent + DirectChatTransport per request,
 * reading fresh workspace state each time.
 */

import { DirectChatTransport, ToolLoopAgent, stepCountIs } from 'ai'
import { createModel, buildProviderOptions, convertSdkUsage } from './aiSdk'
import { createTauriFetch } from './tauriFetch'
import { getAiTools } from './chatTools'

/**
 * Create a ChatTransport for the AI SDK Chat composable.
 *
 * @param {Function} getConfig - Async function returning fresh config per request:
 *   { access, workspace, systemPrompt, thinkingConfig, provider, onUsage }
 * @returns {object} ChatTransport implementation
 */
export function createChatTransport(getConfig) {
  return {
    async sendMessages({ messages, abortSignal }) {
      const config = await getConfig()
      const tauriFetch = createTauriFetch()
      const model = createModel(config.access, tauriFetch)
      const tools = { ...getAiTools(config.workspace), ...config.extraTools }
      const providerOptions = buildProviderOptions(config.thinkingConfig, config.provider)

      const agent = new ToolLoopAgent({
        model,
        tools,
        instructions: config.systemPrompt,
        stopWhen: stepCountIs(config.maxSteps || 15),
        providerOptions,
        prepareStep({ steps, messages }) {
          // Inject native PDF data as user messages.
          // Only inject PDFs from the LAST step to avoid re-sending on every loop iteration.
          const lastStep = steps[steps.length - 1]
          if (!lastStep) return undefined
          const pdfParts = []
          for (const result of lastStep.toolResults) {
            if (result.output?._type === 'pdf' && result.output.base64) {
              pdfParts.push({
                type: 'file',
                data: result.output.base64,
                mediaType: 'application/pdf',
                filename: result.output.filename,
              })
            }
          }
          if (pdfParts.length === 0) return undefined
          return {
            messages: [
              ...messages,
              { role: 'user', content: pdfParts },
            ],
          }
        },
        onStepFinish(event) {
          if (config.onUsage && event.usage) {
            const normalized = convertSdkUsage(event.usage, event.providerMetadata, config.provider)
            config.onUsage(normalized, config.access.model)
          }
        },
      })

      const inner = new DirectChatTransport({ agent, sendReasoning: true })
      return inner.sendMessages({ messages, abortSignal })
    },

    async reconnectToStream() {
      return null
    },
  }
}
