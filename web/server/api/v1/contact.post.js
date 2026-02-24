import { useDb } from '../../db/index.js'
import { contactSubmissions } from '../../db/schema.js'
import { generateId } from '../../utils/id.js'

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export default defineEventHandler(async (event) => {
  const { institution, name, email, teamSize, needs } = await readBody(event)

  if (!institution || !name || !email) {
    setResponseStatus(event, 400)
    return { error: 'Institution, name, and email are required' }
  }

  if (name.length > 200) {
    setResponseStatus(event, 400)
    return { error: 'Name must be 200 characters or fewer' }
  }
  if (institution.length > 500) {
    setResponseStatus(event, 400)
    return { error: 'Institution must be 500 characters or fewer' }
  }
  if (needs && needs.length > 5000) {
    setResponseStatus(event, 400)
    return { error: 'Needs must be 5000 characters or fewer' }
  }

  const id = generateId()
  const db = useDb()

  db.insert(contactSubmissions).values({
    id,
    institution: institution.trim(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    teamSize: teamSize?.trim() || null,
    needs: needs?.trim() || null,
  }).run()

  // Send notification email if Resend is configured
  try {
    const config = useRuntimeConfig()
    if (config.resendApiKey) {
      const { Resend } = await import('resend')
      const resend = new Resend(config.resendApiKey)
      const safeName = escapeHtml(name.trim())
      const safeInstitution = escapeHtml(institution.trim())
      const safeEmail = escapeHtml(email.trim())
      const safeTeamSize = teamSize ? escapeHtml(teamSize.trim()) : null
      const safeNeeds = needs ? escapeHtml(needs.trim()) : null

      await resend.emails.send({
        from: 'Shoulders <noreply@shoulde.rs>',
        to: 'contact@shoulde.rs',
        subject: `Enterprise enquiry — ${safeInstitution}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 520px; padding: 24px;">
            <p style="margin: 0 0 16px;"><strong>${safeName}</strong> from <strong>${safeInstitution}</strong></p>
            <p style="margin: 0 0 4px; color: #666;">Email: ${safeEmail}</p>
            ${safeTeamSize ? `<p style="margin: 0 0 4px; color: #666;">Team size: ${safeTeamSize}</p>` : ''}
            ${safeNeeds ? `<p style="margin: 16px 0 0; white-space: pre-wrap;">${safeNeeds}</p>` : ''}
          </div>
        `,
      })
    }
  } catch (e) {
    console.error('[contact] Failed to send notification email:', e)
  }

  return { ok: true }
})
