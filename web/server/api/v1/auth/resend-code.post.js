import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { sendVerificationCode } from '../../../utils/email.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  if (!email) {
    setResponseStatus(event, 400)
    return { error: 'Email is required' }
  }

  const db = useDb()
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get()

  if (!user) {
    // Don't reveal whether account exists
    return { ok: true }
  }

  if (user.emailVerified) {
    return { ok: true }
  }

  sendVerificationCode(user.id, user.email).catch(e =>
    console.error('[resend] Failed to send verification code:', e)
  )

  return { ok: true }
})
