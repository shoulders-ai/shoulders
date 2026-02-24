import { useDb } from '../../../db/index.js'
import { users } from '../../../db/schema.js'
import { sendPasswordResetEmail } from '../../../utils/email.js'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const { email } = await readBody(event)

  if (!email) {
    setResponseStatus(event, 400)
    return { error: 'Email is required' }
  }

  const db = useDb()
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).get()

  // Always return success to prevent email enumeration
  if (!user) {
    return { message: 'If an account with that email exists, a reset link has been sent.' }
  }

  await sendPasswordResetEmail(user.id, user.email)

  return { message: 'If an account with that email exists, a reset link has been sent.' }
})
