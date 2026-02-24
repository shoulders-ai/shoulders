import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { reviews } from '../../../db/schema.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const db = useDb()

  const review = db.select({ status: reviews.status })
    .from(reviews)
    .where(eq(reviews.slug, slug))
    .get()

  if (!review) {
    throw createError({ statusCode: 404, statusMessage: 'Review not found' })
  }

  return { status: review.status }
})
