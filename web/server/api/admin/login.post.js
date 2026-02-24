import { SignJWT } from 'jose'
import { timingSafeEqual } from 'node:crypto'

function safeCompare(a, b) {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) {
    // Compare against itself to keep constant time, then return false
    timingSafeEqual(bufA, bufA)
    return false
  }
  return timingSafeEqual(bufA, bufB)
}

export default defineEventHandler(async (event) => {
  const { key } = await readBody(event)
  const config = useRuntimeConfig()

  if (!config.adminKey) {
    setResponseStatus(event, 503)
    return { error: 'Admin access is not configured' }
  }

  if (!key || !safeCompare(key, config.adminKey)) {
    setResponseStatus(event, 401)
    return { error: 'Invalid admin key' }
  }

  const secret = new TextEncoder().encode(config.jwtSecret)
  const token = await new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)

  setCookie(event, 'admin_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60,
    path: '/',
  })

  return { success: true }
})
