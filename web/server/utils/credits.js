import { eq, sql } from 'drizzle-orm'
import { useDb } from '../db/index.js'
import { users } from '../db/schema.js'
import { calculateCostCentsWithSurcharge } from './pricing.js'

/**
 * Calculate real cost in cents based on model-specific pricing + surcharge.
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @param {string} model - model ID (e.g. 'claude-sonnet-4-5-20250929')
 * @returns {number} cents (rounded to 2 decimal places)
 */
export function calculateCredits(inputTokens, outputTokens, model) {
  return calculateCostCentsWithSurcharge(inputTokens, outputTokens, model)
}

export async function deductCredits(userId, amount) {
  const db = useDb()
  const result = db
    .update(users)
    .set({ credits: sql`credits - ${amount}`, updatedAt: new Date().toISOString() })
    .where(sql`${users.id} = ${userId} AND ${users.credits} >= ${amount}`)
    .run()

  return result.changes > 0
}
