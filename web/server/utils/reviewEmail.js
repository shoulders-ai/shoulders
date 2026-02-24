import { Resend } from 'resend'

function getResend() {
  const config = useRuntimeConfig()
  if (!config.resendApiKey) return null
  return new Resend(config.resendApiKey)
}

function getBaseUrl() {
  return useRuntimeConfig().baseUrl
}

export async function sendReviewEmail(email, slug, status) {
  if (!email) return
  const resend = getResend()
  if (!resend) {
    console.warn('[reviewEmail] No RESEND_API_KEY configured, skipping email')
    return
  }

  const url = `${getBaseUrl()}/review/${slug}`
  const isSuccess = status === 'complete'

  const subject = isSuccess
    ? 'Your peer review is ready — Shoulders'
    : "We couldn't review your document — Shoulders"

  const body = isSuccess
    ? `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <p style="color: #44403c; font-size: 15px; margin: 0 0 16px;">Your AI peer review is ready.</p>
        <a href="${url}" style="display: inline-block; background: #1c1917; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin: 8px 0 24px;">View Review</a>
        <p style="color: #78716c; font-size: 13px; margin: 0;">This review will be available for 48 hours.</p>
      </div>
    `
    : `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 400px; margin: 0 auto; padding: 40px 20px;">
        <p style="color: #44403c; font-size: 15px; margin: 0 0 16px;">We couldn't complete the review of your document. This may happen with very short documents or non-research content.</p>
        <a href="${getBaseUrl()}/review" style="display: inline-block; background: #1c1917; color: #ffffff; padding: 10px 24px; border-radius: 6px; text-decoration: none; font-size: 14px; font-weight: 500; margin: 8px 0 24px;">Try Again</a>
      </div>
    `

  try {
    await resend.emails.send({
      from: 'Shoulders <noreply@mail.shoulde.rs>',
      to: email,
      subject,
      html: body,
    })
  } catch (e) {
    console.error('[reviewEmail] Failed to send:', e.message)
  }
}
