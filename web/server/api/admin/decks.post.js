import { useDb } from '../../db/index.js'
import { generateId } from '../../utils/id.js'
import { randomBytes } from 'crypto'

function generateSlug() {
  const bytes = randomBytes(6)
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { recipient, deck_name } = body

  if (!recipient || !deck_name) {
    throw createError({ statusCode: 400, statusMessage: 'recipient and deck_name required' })
  }

  const db = useDb()
  const sqlite = db.$client

  const id = generateId()
  const slug = generateSlug()
  const now = new Date().toISOString()

  sqlite.prepare(`
    INSERT INTO deck_shares (id, slug, deck_name, recipient, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
  `).run(id, slug, deck_name, recipient, now)

  return { id, slug, url: `/d/${slug}` }
})
