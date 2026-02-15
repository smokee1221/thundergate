import picomatch from 'picomatch'
import type { RequestContext, RuleConditions } from '../types.js'

/**
 * Matches the request URL against a glob-style pattern.
 * Uses picomatch for fast, reliable glob matching.
 *
 * Examples:
 *   "* /users/*"         → matches /users/123, /users/delete
 *   "* /api/v1/payments" → matches /api/v1/payments
 *   "**​/delete"          → matches any path ending in /delete
 */
export function matchUrl(
  request: RequestContext,
  conditions: RuleConditions,
): { matched: boolean; reason?: string } {
  if (!conditions.url_pattern) {
    return { matched: false }
  }

  const pattern = conditions.url_pattern
  const url = request.url

  try {
    const isMatch = picomatch(pattern, { contains: true })
    if (isMatch(url)) {
      return {
        matched: true,
        reason: `URL "${url}" matches pattern "${pattern}"`,
      }
    }
  } catch {
    // Invalid glob pattern — treat as no match, don't crash
    return { matched: false }
  }

  return { matched: false }
}
