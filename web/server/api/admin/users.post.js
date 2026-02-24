import { useDb } from '../../db/index.js'
import { users } from '../../db/schema.js'
import { generateId } from '../../utils/id.js'
import { hashPassword } from '../../utils/auth.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email, password, plan, credits } = await readBody(event)

  if (!email || !password) {
    setResponseStatus(event, 400)
    return { error: 'Email and password are required' }
  }

  const emailLower = email.toLowerCase().trim()
  const db = useDb()

  const existing = db.select().from(users).where(eq(users.email, emailLower)).get()
  if (existing) {
    setResponseStatus(event, 409)
    return { error: 'User with this email already exists' }
  }

  const now = new Date().toISOString()
  const id = generateId()
  const passwordHash = await hashPassword(password)

  db.insert(users).values({
    id,
    email: emailLower,
    passwordHash,
    plan: plan || 'free',
    credits: typeof credits === 'number' ? credits : 500,
    emailVerified: 1,
    createdAt: now,
    updatedAt: now,
  }).run()

  return { id, email: emailLower, plan: plan || 'free', credits: typeof credits === 'number' ? credits : 500 }
})
