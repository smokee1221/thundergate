import type { RequestContext, Rule, MatchResult } from '../types.js'
import { matchUrl } from './url.js'
import { matchMethod } from './method.js'
import { matchPayload } from './payload.js'
import { matchHeaders } from './header.js'

/**
 * Runs all matchers against a request for a single rule.
 * A rule matches if ALL its defined conditions are satisfied (AND logic).
 * Conditions that are not defined (undefined/empty) are skipped.
 */
export function matchRule(
  request: RequestContext,
  rule: Rule,
): MatchResult {
  const conditions = rule.conditions
  const reasons: string[] = []
  let hasAnyCondition = false
  let allDefinedConditionsMatch = true

  // URL pattern
  if (conditions.url_pattern) {
    hasAnyCondition = true
    const urlResult = matchUrl(request, conditions)
    if (urlResult.matched && urlResult.reason) {
      reasons.push(urlResult.reason)
    } else if (!urlResult.matched) {
      allDefinedConditionsMatch = false
    }
  }

  // HTTP method
  if (conditions.methods && conditions.methods.length > 0) {
    hasAnyCondition = true
    const methodResult = matchMethod(request, conditions)
    if (methodResult.matched && methodResult.reason) {
      reasons.push(methodResult.reason)
    } else if (!methodResult.matched) {
      allDefinedConditionsMatch = false
    }
  }

  // Payload patterns
  if (conditions.payload_patterns && conditions.payload_patterns.length > 0) {
    hasAnyCondition = true
    const payloadResult = matchPayload(request, conditions)
    if (payloadResult.matched) {
      reasons.push(...payloadResult.reasons)
    } else {
      allDefinedConditionsMatch = false
    }
  }

  // Header patterns
  if (
    conditions.header_patterns &&
    Object.keys(conditions.header_patterns).length > 0
  ) {
    hasAnyCondition = true
    const headerResult = matchHeaders(request, conditions)
    if (headerResult.matched) {
      reasons.push(...headerResult.reasons)
    } else {
      allDefinedConditionsMatch = false
    }
  }

  // A rule with no conditions never matches
  const matched = hasAnyCondition && allDefinedConditionsMatch

  return {
    matched,
    rule,
    reasons,
  }
}
