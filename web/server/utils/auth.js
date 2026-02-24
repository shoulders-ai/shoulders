import { SignJWT, jwtVerify } from 'jose'
import { createHash, randomBytes } from 'crypto'
import argon2 from 'argon2'
import { generateId } from './id.js'
import { useDb } from '../db/index.js'
import { refreshTokens } from '../db/schema.js'
import { eq } from 'drizzle-orm'

function getSecret() {
  const config = useRuntimeConfig()
  return new TextEncoder().encode(config.jwtSecret)
}

export async function createAccessToken(userId) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(getSecret())
  return { token: jwt, expiresAt: expiresAt.toISOString() }
}

export async function createRefreshToken(userId, deviceLabel = null) {
  const raw = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(raw)
  const familyId = randomBytes(8).toString('hex')
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
  const now = new Date().toISOString()

  useDb().insert(refreshTokens).values({
    id: generateId(),
    userId,
    tokenHash,
    familyId,
    expiresAt: expiresAt.toISOString(),
    deviceLabel,
    createdAt: now,
  }).run()

  return { refreshToken: raw, refreshExpiresAt: expiresAt.toISOString(), familyId }
}

export async function rotateRefreshToken(oldTokenHash, userId, deviceLabel = null) {
  const db = useDb()

  // Find the old token to get its familyId
  const old = db.select().from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, oldTokenHash))
    .get()

  if (!old) return null

  // Revoke the old token
  db.update(refreshTokens)
    .set({ revoked: 1 })
    .where(eq(refreshTokens.id, old.id))
    .run()

  // Create new token in the same family
  const raw = randomBytes(32).toString('base64url')
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  const now = new Date().toISOString()

  db.insert(refreshTokens).values({
    id: generateId(),
    userId,
    tokenHash,
    familyId: old.familyId,
    expiresAt: expiresAt.toISOString(),
    deviceLabel: deviceLabel || old.deviceLabel,
    createdAt: now,
  }).run()

  return { refreshToken: raw, refreshExpiresAt: expiresAt.toISOString() }
}

export async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, getSecret())
    return { userId: payload.sub, jti: payload.jti }
  } catch {
    return null
  }
}

export function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password) {
  return argon2.hash(password)
}

export async function verifyPassword(hash, password) {
  return argon2.verify(hash, password)
}

export function parseDeviceLabel(userAgent) {
  if (!userAgent) return 'Unknown device'
  const ua = userAgent.toLowerCase()

  let browser = 'Browser'
  if (ua.includes('shoulders')) return 'Shoulders Desktop'
  if (ua.includes('firefox')) browser = 'Firefox'
  else if (ua.includes('edg/')) browser = 'Edge'
  else if (ua.includes('chrome')) browser = 'Chrome'
  else if (ua.includes('safari')) browser = 'Safari'

  let os = ''
  if (ua.includes('mac')) os = 'macOS'
  else if (ua.includes('windows')) os = 'Windows'
  else if (ua.includes('linux')) os = 'Linux'
  else if (ua.includes('android')) os = 'Android'
  else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS'

  return os ? `${browser} on ${os}` : browser
}
