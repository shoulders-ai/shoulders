import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { triages } from '../../../db/schema.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) throw createError({ statusCode: 400, statusMessage: 'Missing slug' })

  const db = useDb()
  const row = db.select().from(triages).where(eq(triages.slug, slug)).get()
  if (!row) throw createError({ statusCode: 404, statusMessage: 'Triage not found' })

  return {
    slug: row.slug,
    status: row.status,
    currentStep: row.currentStep,
    filename: row.filename,
    stepDetails: safeJson(row.stepDetails),
    references: safeJson(row.referencesJson),
    refCheck: safeJson(row.refCheckJson),
    pangram: safeJson(row.pangramJson),
    novelty: safeJson(row.noveltyJson),
    assessment: safeJson(row.assessmentJson),
    metadata: safeJson(row.metadataJson),
    authorProfiles: safeJson(row.authorsJson),
    hasFile: !!row.filePath,
    costCents: row.costCents || 0,
    createdAt: row.createdAt,
    completedAt: row.completedAt,
  }
})

function safeJson(str) {
  if (!str) return null
  try { return JSON.parse(str) } catch { return null }
}
