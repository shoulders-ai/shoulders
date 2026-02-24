import { useDb } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { userId, amount } = await readBody(event)

  if (!userId || typeof amount !== 'number') {
    setResponseStatus(event, 400)
    return { error: 'userId and numeric amount are required' }
  }

  const db = useDb()
  const user = db.select().from(users).where(eq(users.id, userId)).get()

  if (!user) {
    setResponseStatus(event, 404)
    return { error: 'User not found' }
  }

  const newCredits = Math.max(0, user.credits + amount)

  db.update(users)
    .set({ credits: newCredits, updatedAt: new Date().toISOString() })
    .where(eq(users.id, userId))
    .run()

  return { userId, credits: newCredits, delta: amount }
})
