import { useDb } from '../../../db/index.js'
import { apiCalls } from '../../../db/schema.js'
import { eq, and, gte, sql } from 'drizzle-orm'

export default defineEventHandler((event) => {
  const user = event.context.user
  if (!user) {
    setResponseStatus(event, 401)
    return { error: 'Authentication required' }
  }

  const db = useDb()
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const result = db
    .select({
      totalCalls: sql`COUNT(*)`.as('totalCalls'),
      totalCredits: sql`COALESCE(SUM(${apiCalls.creditsUsed}), 0)`.as('totalCredits'),
    })
    .from(apiCalls)
    .where(
      and(
        eq(apiCalls.userId, user.id),
        gte(apiCalls.createdAt, monthStart)
      )
    )
    .get()

  return {
    month,
    totalCalls: result?.totalCalls ?? 0,
    totalCredits: result?.totalCredits ?? 0,
  }
})
