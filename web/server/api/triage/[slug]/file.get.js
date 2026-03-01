import { eq } from 'drizzle-orm'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { useDb } from '../../../db/index.js'
import { triages } from '../../../db/schema.js'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  const db = useDb()
  const row = db.select({
    filePath: triages.filePath,
    filename: triages.filename,
  }).from(triages).where(eq(triages.slug, slug)).get()

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Triage not found' })
  if (!row.filePath || !existsSync(row.filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Original file not available' })
  }

  const buffer = await readFile(row.filePath)
  const fname = (row.filename || 'document').toLowerCase()
  const isPdf = fname.endsWith('.pdf')
  const contentType = isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

  setResponseHeaders(event, {
    'Content-Type': contentType,
    'Content-Disposition': `inline; filename="${row.filename || (isPdf ? 'paper.pdf' : 'paper.docx')}"`,
    'Content-Length': buffer.length,
  })

  return buffer
})
