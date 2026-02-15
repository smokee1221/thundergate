import type { RequestContext, RuleConditions } from '../types.js'

/**
 * Matches request headers against key/value regex patterns.
 * Header names are compared case-insensitively.
 * Header values are matched using the provided regex.
 */
export function matchHeaders(
  request: RequestContext,
  conditions: RuleConditions,
): { matched: boolean; reasons: string[] } {
  if (
    !conditions.header_patterns ||
    Object.keys(conditions.header_patterns).length === 0
  ) {
    return { matched: false, reasons: [] }
  }

  const reasons: string[] = []

  // Normalize request headers to lowercase keys
  const normalizedHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(request.headers)) {
    if (value !== undefined) {
      const strValue = Array.isArray(value) ? value.join(', ') : value
      normalizedHeaders[key.toLowerCase()] = strValue
    }
  }

  for (const [headerName, pattern] of Object.entries(
    conditions.header_patterns,
  )) {
    const normalizedName = headerName.toLowerCase()
    const headerValue = normalizedHeaders[normalizedName]

    if (headerValue === undefined) {
      continue
    }

    try {
      const regex = new RegExp(pattern, 'i')
      if (regex.test(headerValue)) {
        reasons.push(
          `Header "${normalizedName}" matches pattern "${pattern}"`,
        )
      }
    } catch {
      // Invalid regex — skip
      continue
    }
  }

  return {
    matched: reasons.length > 0,
    reasons,
  }
}
