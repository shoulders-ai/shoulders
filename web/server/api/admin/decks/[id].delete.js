import { useDb } from '../../../db/index.js'

export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'id required' })
  }

  const db = useDb()
  const sqlite = db.$client

  // Delete views first (FK constraint), then the share
  const deleteAll = sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM deck_views WHERE share_id = ?').run(id)
    sqlite.prepare('DELETE FROM deck_shares WHERE id = ?').run(id)
  })

  deleteAll()

  return { success: true }
})
