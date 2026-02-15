import { eq } from 'drizzle-orm'
import { db } from '@thundergate/db'
import { rules } from '@thundergate/db'
import type { Rule } from '@thundergate/engine'

const CACHE_TTL_MS = 30_000 // 30 seconds

let cachedRules: Rule[] = []
let lastFetched = 0

/**
 * Returns active rules from the DB, with in-memory caching (30s TTL).
 * Avoids hitting the DB on every proxy request.
 */
export async function getActiveRules(): Promise<Rule[]> {
  const now = Date.now()
  if (cachedRules.length > 0 && now - lastFetched < CACHE_TTL_MS) {
    return cachedRules
  }

  const rows = await db
    .select()
    .from(rules)
    .where(eq(rules.enabled, true))

  cachedRules = rows.map((r) => ({
    id: r.id,
    name: r.name,
    priority: r.priority,
    conditions: r.conditions as Rule['conditions'],
    action: r.action as Rule['action'],
    severity: r.severity as Rule['severity'],
    enabled: r.enabled,
  }))

  lastFetched = now
  return cachedRules
}

/** Force-invalidate the cache (used after rule updates). */
export function invalidateRuleCache(): void {
  cachedRules = []
  lastFetched = 0
}
