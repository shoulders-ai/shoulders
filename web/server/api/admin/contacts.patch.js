import { useDb } from '../../db/index.js'

export default defineEventHandler(async (event) => {
  const { id, dismissed } = await readBody(event)

  if (!id || typeof dismissed !== 'number') {
    setResponseStatus(event, 400)
    return { error: 'id and dismissed (0 or 1) are required' }
  }

  const db = useDb()
  const sqlite = db.$client

  const row = sqlite.prepare('SELECT id FROM contact_submissions WHERE id = ?').get(id)
  if (!row) {
    setResponseStatus(event, 404)
    return { error: 'Contact submission not found' }
  }

  sqlite.prepare('UPDATE contact_submissions SET dismissed = ? WHERE id = ?').run(dismissed ? 1 : 0, id)

  return { id, dismissed: dismissed ? 1 : 0 }
})
