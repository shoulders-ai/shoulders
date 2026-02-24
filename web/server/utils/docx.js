import mammoth from 'mammoth'
import TurndownService from 'turndown'

export async function convertDocx(buffer) {
  let imageCounter = 0
  const images = []

  const { value: html } = await mammoth.convertToHtml({ buffer }, {
    convertImage: mammoth.images.imgElement(image => {
      return image.read('base64').then(data => {
        const contentType = image.contentType || 'image/png'
        const id = `image-${++imageCounter}`
        images.push({ id, buffer: Buffer.from(data, 'base64'), base64: data, contentType })
        return { src: id, alt: id }
      })
    }),
  })

  // Build display HTML with base64 data URIs for browser rendering
  let displayHtml = html
  for (const img of images) {
    displayHtml = displayHtml.replace(
      new RegExp(`src="${img.id}"`, 'g'),
      `src="data:${img.contentType};base64,${img.base64}"`
    )
  }

  // Convert to markdown for AI consumption
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
  const markdown = turndown.turndown(html)

  return { html: displayHtml, markdown, images }
}
