import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { triages } from '../../../db/schema.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  const db = useDb()
  const row = db.select({
    status: triages.status,
    currentStep: triages.currentStep,
    stepDetails: triages.stepDetails,
    filename: triages.filename,
  }).from(triages).where(eq(triages.slug, slug)).get()

  if (!row) throw createError({ statusCode: 404, statusMessage: 'Triage not found' })

  let stepDetails = null
  try { stepDetails = row.stepDetails ? JSON.parse(row.stepDetails) : null } catch {}

  return {
    status: row.status,
    currentStep: row.currentStep,
    stepDetails,
    filename: row.filename,
  }
})
