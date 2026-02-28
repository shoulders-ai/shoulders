import { useDb } from '../../db/index.js'
import { triages } from '../../db/schema.js'
import { generateId } from '../../utils/id.js'
import { runTriagePipeline } from '../../services/triage/pipeline'

export default defineEventHandler(async (event) => {
  const formData = await readMultipartFormData(event)
  const uploadedFile = formData?.find(f => f.name === 'file')

  if (!uploadedFile) {
    throw createError({ statusCode: 400, statusMessage: 'A .pdf or .docx file is required' })
  }

  const fname = uploadedFile.filename?.toLowerCase()
  if (!fname?.endsWith('.pdf') && !fname?.endsWith('.docx')) {
    throw createError({ statusCode: 400, statusMessage: 'Only .pdf and .docx files are accepted' })
  }

  if (uploadedFile.data.length > 50 * 1024 * 1024) {
    throw createError({ statusCode: 400, statusMessage: 'File exceeds 50MB limit' })
  }

  const id = generateId()
  const slug = generateSlug()
  const db = useDb()

  db.insert(triages).values({
    id,
    slug,
    status: 'processing',
    currentStep: 'extracting',
    filename: uploadedFile.filename,
    createdAt: new Date().toISOString(),
  }).run()

  // Fire-and-forget
  runTriagePipeline(id, uploadedFile.data, uploadedFile.filename)
    .catch(e => console.error(`[Triage ${id}] Background pipeline error:`, e))

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
