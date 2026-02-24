import { Resend } from 'resend'
import { generateId } from './id.js'
import { hashToken } from './auth.js'
import { useDb } from '../db/index.js'
import { verificationTokens } from '../db/schema.js'

function getResend() {
  const config = useRuntimeConfig()
  if (!config.resendApiKey) return null
  return new Resend(config.resendApiKey)
}

function getBaseUrl() {
  return useRuntimeConfig().baseUrl
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export async function sendVerificationCode(userId, email) {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] No RESEND_API_KEY configured, skipping verification code')
    return null
  }

  const code = generateCode()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

  const db = useDb()
  db.insert(verificationTokens).values({
    id: generateId(),
    userId,
    tokenHash: hashToken(code),
    type: 'email_verify',
    expiresAt,
    createdAt: new Date().toISOString(),
  }).run()

  const { error } = await resend.emails.send({
    from: 'Shoulders <noreply@mail.shoulde.rs>',
    to: email,
    subject: 'Your verification code — Shoulders',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <p style="color: #44403c; font-size: 15px; margin: 0 0 24px;">Your verification code is:</p>
        <div style="background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
          <span style="font-family: 'SF Mono', 'Cascadia Mono', 'Consolas', monospace; font-size: 32px; font-weight: 600; letter-spacing: 8px; color: #1c1917;">${code}</span>
        </div>
        <p style="color: #78716c; font-size: 13px; margin: 0;">This code expires in 10 minutes. If you didn't create a Shoulders account, ignore this email.</p>
      </div>
    `,
  })

  if (error) console.error('[email] Failed to send verification code:', error)
  return error ? null : code
}

export async function sendPasswordResetEmail(userId, email) {
  const resend = getResend()
  if (!resend) {
    console.warn('[email] No RESEND_API_KEY configured, skipping reset email')
    return null
  }

  const token = generateId() + generateId()
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

  const db = useDb()
  db.insert(verificationTokens).values({
    id: generateId(),
    userId,
    tokenHash: hashToken(token),
    type: 'password_reset',
    expiresAt,
    createdAt: new Date().toISOString(),
  }).run()

  const resetUrl = `${getBaseUrl()}/reset-password?token=${token}`

  const { error } = await resend.emails.send({
    from: 'Shoulders <noreply@mail.shoulde.rs>',
    to: email,
    subject: 'Reset your password — Shoulders',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <p style="color: #44403c; font-size: 15px; margin: 0 0 16px;">Click the button below to reset your password.</p>
        <a href="${resetUrl}" style="display: inline-block; background: #1c1917; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin: 8px 0 24px;">Reset Password</a>
        <p style="color: #78716c; font-size: 13px; margin: 0;">This link expires in 1 hour. If you didn't request a reset, ignore this email.</p>
      </div>
    `,
  })

  if (error) console.error('[email] Failed to send reset:', error)
  return error ? null : token
}
