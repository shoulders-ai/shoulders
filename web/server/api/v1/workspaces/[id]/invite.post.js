import { useDb } from '../../../../db/index.js'
import { workspaceMembers, workspaceInvites } from '../../../../db/schema.js'
import { generateId } from '../../../../utils/id.js'
import { eq, and } from 'drizzle-orm'
import { randomBytes } from 'crypto'

function generateInviteToken() {
  return randomBytes(12).toString('hex') // 24-char hex token
}

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const workspaceId = getRouterParam(event, 'id')
  if (!workspaceId) {
    throw createError({ statusCode: 400, statusMessage: 'Workspace ID is required' })
  }

  const db = useDb()

  // Check user is admin of this workspace
  const membership = db.select().from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, user.id),
    ))
    .get()

  if (!membership) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  if (membership.role !== 'admin') {
    throw createError({ statusCode: 403, statusMessage: 'Only admins can create invite links' })
  }

  // Parse optional expiresIn (hours)
  const body = await readBody(event).catch(() => ({})) || {}
  const expiresInHours = body.expiresIn

  const now = Math.floor(Date.now() / 1000)
  const token = generateInviteToken()
  let expiresAt = null

  if (expiresInHours && typeof expiresInHours === 'number' && expiresInHours > 0) {
    expiresAt = now + Math.floor(expiresInHours * 3600)
  }

  db.insert(workspaceInvites).values({
    id: generateId(),
    workspaceId,
    token,
    createdBy: user.id,
    createdAt: now,
    expiresAt,
  }).run()

  return {
    token,
    url: `https://shoulde.rs/join/${token}`,
  }
})
