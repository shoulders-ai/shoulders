import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { reviews } from '../../../db/schema.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const db = useDb()
  db.delete(reviews).where(eq(reviews.slug, slug)).run()
  return { ok: true }
})
