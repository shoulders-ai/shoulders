import { useDb } from '../../../db/index.js'
import { workspaces, workspaceMembers } from '../../../db/schema.js'
import { eq, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const db = useDb()

  // Get all workspaces where user is a member, with their role and member count
  const rows = db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
      memberCount: sql`(SELECT COUNT(*) FROM workspace_members WHERE workspace_id = ${workspaces.id})`.as('member_count'),
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .all()

  return {
    workspaces: rows.map(r => ({
      id: r.id,
      name: r.name,
      role: r.role,
      memberCount: r.memberCount,
      createdAt: r.createdAt,
    })),
  }
})
