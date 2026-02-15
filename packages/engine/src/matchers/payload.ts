import type { RequestContext, RuleConditions } from '../types.js'

/**
 * Recursively extracts all string values from a nested object/array.
 * Used to scan the entire request body for pattern matches.
 */
function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value]
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractStrings)
  }
  if (value !== null && typeof value === 'object') {
    const strings: string[] = []
    for (const key of Object.keys(value as Record<string, unknown>)) {
      // Include keys too — field names like "ssn" or "password" matter
      strings.push(key)
      strings.push(
        ...extractStrings((value as Record<string, unknown>)[key]),
      )
    }
    return strings
  }
  return []
}

/**
 * Matches request body content against regex patterns.
 * Recursively scans all string values (including keys) in the payload.
 *
 * Returns match details for each pattern that hit.
 */
export function matchPayload(
  request: RequestContext,
  conditions: RuleConditions,
): { matched: boolean; reasons: string[] } {
  if (
    !conditions.payload_patterns ||
    conditions.payload_patterns.length === 0
  ) {
    return { matched: false, reasons: [] }
  }

  if (request.body === null || request.body === undefined) {
    return { matched: false, reasons: [] }
  }

  const strings = extractStrings(request.body)
  if (strings.length === 0) {
    return { matched: false, reasons: [] }
  }

  const fullText = strings.join(' ')
  const reasons: string[] = []

  for (const pattern of conditions.payload_patterns) {
    try {
      const regex = new RegExp(pattern, 'i')
      const match = regex.exec(fullText)
      if (match) {
        reasons.push(
          `Payload matches pattern "${pattern}" (found: "${truncate(match[0], 50)}")`,
        )
      }
    } catch {
      // Invalid regex — skip, don't crash
      continue
    }
  }

  return {
    matched: reasons.length > 0,
    reasons,
  }
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

// Export for testing
export { extractStrings }
