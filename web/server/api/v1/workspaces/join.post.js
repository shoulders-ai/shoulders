import { useDb } from '../../../db/index.js'
import { workspaces, workspaceMembers, workspaceInvites } from '../../../db/schema.js'
import { generateId } from '../../../utils/id.js'
import { eq, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const { token } = await readBody(event)

  if (!token || typeof token !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Invite token is required' })
  }

  const db = useDb()

  // Look up the invite
  const invite = db.select().from(workspaceInvites)
    .where(eq(workspaceInvites.token, token.trim()))
    .get()

  if (!invite) {
    throw createError({ statusCode: 404, statusMessage: 'Invalid invite token' })
  }

  // Check expiry
  if (invite.expiresAt) {
    const now = Math.floor(Date.now() / 1000)
    if (now > invite.expiresAt) {
      throw createError({ statusCode: 410, statusMessage: 'Invite has expired' })
    }
  }

  // Check if user is already a member
  const existing = db.select().from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, invite.workspaceId),
      eq(workspaceMembers.userId, user.id),
    ))
    .get()

  if (existing) {
    throw createError({ statusCode: 409, statusMessage: 'You are already a member of this workspace' })
  }

  const config = useRuntimeConfig()

  // Get workspace details
  const workspace = db.select().from(workspaces)
    .where(eq(workspaces.id, invite.workspaceId))
    .get()

  if (!workspace) {
    throw createError({ statusCode: 404, statusMessage: 'Workspace not found' })
  }

  // Add user as editor
  const now = Math.floor(Date.now() / 1000)
  db.insert(workspaceMembers).values({
    id: generateId(),
    workspaceId: invite.workspaceId,
    userId: user.id,
    role: 'editor',
    joinedAt: now,
  }).run()

  return {
    id: workspace.id,
    name: workspace.name,
    gitUrl: `${config.gitServerUrl}/git/${workspace.id}.git`,
  }
})
