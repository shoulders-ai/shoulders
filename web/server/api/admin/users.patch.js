import { useDb } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { hashPassword } from '../../utils/auth.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { userId, plan, credits, emailVerified, suspended, password } = await readBody(event)

  if (!userId) {
    setResponseStatus(event, 400)
    return { error: 'userId is required' }
  }

  const db = useDb()
  const user = db.select().from(users).where(eq(users.id, userId)).get()
  if (!user) {
    setResponseStatus(event, 404)
    return { error: 'User not found' }
  }

  const updates = { updatedAt: new Date().toISOString() }
  if (plan !== undefined) updates.plan = plan
  if (typeof credits === 'number') updates.credits = Math.max(0, credits)
  if (typeof emailVerified === 'number') updates.emailVerified = emailVerified
  if (typeof suspended === 'number') updates.suspended = suspended
  if (password) updates.passwordHash = await hashPassword(password)

  db.update(users).set(updates).where(eq(users.id, userId)).run()

  const response = { userId }
  if (updates.plan !== undefined) response.plan = updates.plan
  if (updates.credits !== undefined) response.credits = updates.credits
  if (updates.emailVerified !== undefined) response.emailVerified = updates.emailVerified
  if (updates.suspended !== undefined) response.suspended = updates.suspended
  return response
})
