import { useDb } from '../../db/index.js'
import { reviews } from '../../db/schema.js'
import { generateId } from '../../utils/id.js'
import { runReviewPipeline } from '../../services/review/pipeline'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  const docxFile = formData?.find(f => f.name === 'file')
  const emailField = formData?.find(f => f.name === 'email')

  if (!docxFile) {
    throw createError({ statusCode: 400, statusMessage: 'DOCX file is required' })
  }

  if (!docxFile.filename?.toLowerCase().endsWith('.docx')) {
    throw createError({ statusCode: 400, statusMessage: 'Only .docx files are accepted' })
  }

  if (docxFile.data.length > 50 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'File exceeds 50MB limit' })
  }

  const email = emailField?.data?.toString()?.trim() || null
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid email address' })
  }

  const id = generateId()
  const slug = generateSlug()
  const db = useDb()

  db.insert(reviews).values({
    id,
    slug,
    status: 'processing',
    email,
    filename: docxFile.filename,
    createdAt: new Date().toISOString(),
  }).run()

  // Fire-and-forget
  runReviewPipeline(id, docxFile.data, docxFile.filename, email)
    .catch(e => console.error(`[Review ${id}] Background pipeline error:`, e))

  return { slug }
})

function generateSlug() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789'
  let result = ''
  for (let i = 0; i < 12; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}
