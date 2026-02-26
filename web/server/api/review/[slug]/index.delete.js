import { eq } from 'drizzle-orm'
import { useDb } from '../../../db/index.js'
import { reviews } from '../../../db/schema.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  const db = useDb()
  db.update(reviews).set({
    status: 'deleted',
    html: null,
    markdown: null,
    anchoredHtml: null,
    report: null,
    commentsJson: null,
    techNotes: null,
  }).where(eq(reviews.slug, slug)).run()
  return { ok: true }
})
