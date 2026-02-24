import { useDb } from '../../../../db/index.js'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Missing share ID' })
  }

  const db = useDb()
  const sqlite = db.$client

  sqlite.prepare(`
    UPDATE deck_shares SET cleared_at = ? WHERE id = ?
  `).run(new Date().toISOString(), id)

  return { success: true }
})
