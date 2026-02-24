import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { generateId } from '../../../utils/id.js'
import { hashPassword } from '../../../utils/auth.js'
import { sendVerificationCode } from '../../../utils/email.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email, password } = await readBody(event)

  if (!email || !password) {
    setResponseStatus(event, 400)
    return { error: 'Email and password are required' }
  }

  if (password.length < 8) {
    setResponseStatus(event, 400)
    return { error: 'Password must be at least 8 characters' }
  }

  if (password.length > 1024) {
    setResponseStatus(event, 400)
    return { error: 'Password must be 1024 characters or fewer' }
  }

  if (!email.includes('@') || !email.includes('.')) {
    setResponseStatus(event, 400)
    return { error: 'Invalid email format' }
  }

  const emailLower = email.toLowerCase().trim()
  const db = useDb()

  const existing = db.select().from(users).where(eq(users.email, emailLower)).get()
  if (existing) {
    setResponseStatus(event, 409)
    return { error: 'An account with this email already exists' }
  }

  const userId = generateId()
  const passwordHash = await hashPassword(password)
  const now = new Date().toISOString()

  db.insert(users).values({
    id: userId,
    email: emailLower,
    passwordHash,
    plan: 'free',
    credits: 500,
    createdAt: now,
    updatedAt: now,
  }).run()

  // Send 6-digit verification code
  sendVerificationCode(userId, emailLower).catch(e =>
    console.error('[signup] Failed to send verification code:', e)
  )

  return { ok: true, email: emailLower }
})
