import type { RequestContext, RuleConditions } from '../types.js'

/**
 * Matches the HTTP method against an allowed/blocked list.
 * Methods are compared case-insensitively.
 *
 * If conditions.methods is defined, the request method must be in the list to match.
 */
export function matchMethod(
  request: RequestContext,
  conditions: RuleConditions,
): { matched: boolean; reason?: string } {
  if (!conditions.methods || conditions.methods.length === 0) {
    return { matched: false }
  }

  const requestMethod = request.method.toUpperCase()
  const targetMethods = conditions.methods.map((m) => m.toUpperCase())

  if (targetMethods.includes(requestMethod)) {
    return {
      matched: true,
      reason: `HTTP method "${requestMethod}" matches rule methods [${targetMethods.join(', ')}]`,
    }
  }

  return { matched: false }
}
