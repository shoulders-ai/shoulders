import { marked } from 'marked'

/**
 * Convert a PDF buffer to { html, markdown, images } via Z OCR API (GLM-OCR).
 * Same return shape as convertDocx() so the pipeline can branch transparently.
 */
export async function convertPdf(buffer) {
  const config = useRuntimeConfig()
  const apiKey = config.zApiKey
  if (!apiKey) throw new Error('Z API key not configured (NUXT_Z_API_KEY)')

  const base64 = buffer.toString('base64')

  const response = await $fetch('https://api.z.ai/api/paas/v4/layout_parsing', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: {
      model: 'glm-ocr',
      file: `data:application/pdf;base64,${base64}`,
    },
    timeout: 120_000,
  })

  const markdown = response?.md_results
  if (!markdown) {
    throw new Error(`OCR returned no text (code: ${response?.code || 'unknown'})`)
  }

  // Render markdown → HTML for display + comment anchoring
  const html = await marked.parse(markdown)

  return {
    html,
    markdown,
    images: [],
    ocrUsage: response.usage || {},
  }
}
