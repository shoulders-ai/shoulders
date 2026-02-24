import { useDb } from '../../db/index.js'

export default defineEventHandler((event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Slug required' })
  }

  const db = useDb()
  const sqlite = db.$client

  const share = sqlite.prepare(`
    SELECT id, slug, deck_name, recipient, is_active
    FROM deck_shares
    WHERE slug = ? AND is_active = 1
  `).get(slug)

  if (!share) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  return share
})
