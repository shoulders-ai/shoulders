import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { reviews } from '../../../db/schema.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const db = useDb()

  const review = db.select().from(reviews).where(eq(reviews.slug, slug)).get()

  if (!review) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  // Check expiry
  if (review.expiresAt && new Date(review.expiresAt) < new Date()) {
    throw createError({ statusCode: 410, statusMessage: 'This review has expired' })
  }

  if (review.status !== 'complete') {
    return { status: review.status }
  }

  let comments = []
  try { comments = JSON.parse(review.commentsJson || '[]') } catch {}

  return {
    status: review.status,
    anchoredHtml: review.anchoredHtml,
    report: review.report,
    comments,
    domainHint: review.domainHint,
    filename: review.filename,
    expiresAt: review.expiresAt,
  }
})
