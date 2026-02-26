import { useDb } from '../../db/index.js'
import { reviews } from '../../db/schema.js'
import { generateId } from '../../utils/id.js'
import { runReviewPipeline } from '../../services/review/pipeline'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  const uploadedFile = formData?.find(f => f.name === 'file')
  const emailField = formData?.find(f => f.name === 'email')

  if (!uploadedFile) {
    throw createError({ statusCode: 400, statusMessage: 'A .docx or .pdf file is required' })
  }

  const fname = uploadedFile.filename?.toLowerCase()
  if (!fname?.endsWith('.docx') && !fname?.endsWith('.pdf')) {
    throw createError({ statusCode: 400, statusMessage: 'Only .docx and .pdf files are accepted' })
  }

  if (uploadedFile.data.length > 50 * 1024 * 1024) {
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
    filename: uploadedFile.filename,
    createdAt: new Date().toISOString(),
  }).run()

  // Fire-and-forget
  runReviewPipeline(id, uploadedFile.data, uploadedFile.filename, email)
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
