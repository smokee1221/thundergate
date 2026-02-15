import type {
  RequestContext,
  Rule,
  RuleAction,
  EvaluationResult,
  MatchResult,
} from './types.js'
import { matchRule } from './matchers/index.js'
import { calculateRiskScore } from './scorer.js'

/**
 * Priority ranking for rule actions.
 * Higher number = takes precedence in final decision.
 * BLOCK > FLAG_FOR_REVIEW > MODIFY > ALLOW
 */
const ACTION_PRIORITY: Record<RuleAction, number> = {
  BLOCK: 4,
  FLAG_FOR_REVIEW: 3,
  MODIFY: 2,
  ALLOW: 1,
}

/**
 * Evaluates a request against a set of rules and returns a decision.
 *
 * Algorithm:
 * 1. Filter to enabled rules, sort by priority (lower number = evaluated first)
 * 2. Run each rule's matchers against the request
 * 3. Collect all matched rules
 * 4. Calculate cumulative risk score from matches
 * 5. Determine final decision: highest-severity action wins
 * 6. If no rules match, default to ALLOW with risk score 0
 *
 * This is a pure function — no I/O, no side effects.
 */
export function evaluate(
  request: RequestContext,
  rules: Rule[],
): EvaluationResult {
  // Filter to enabled rules and sort by priority (ascending)
  const activeRules = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.priority - b.priority)

  if (activeRules.length === 0) {
    return {
      decision: 'ALLOW',
      riskScore: 0,
      matchedRules: [],
      reasons: ['No active rules configured'],
    }
  }

  // Evaluate all rules
  const allResults: MatchResult[] = []
  const matchedResults: MatchResult[] = []

  for (const rule of activeRules) {
    const result = matchRule(request, rule)
    allResults.push(result)
    if (result.matched) {
      matchedResults.push(result)
    }
  }

  // No matches → allow
  if (matchedResults.length === 0) {
    return {
      decision: 'ALLOW',
      riskScore: 0,
      matchedRules: [],
      reasons: ['No rules matched'],
    }
  }

  // Calculate risk score from all matched rules
  const riskScore = calculateRiskScore(matchedResults)

  // Determine final decision: highest-priority action wins
  let finalDecision: RuleAction = 'ALLOW'
  let highestPriority = 0

  for (const match of matchedResults) {
    const actionPriority = ACTION_PRIORITY[match.rule.action]
    if (actionPriority > highestPriority) {
      highestPriority = actionPriority
      finalDecision = match.rule.action
    }
  }

  // Collect all reasons from matched rules
  const reasons = matchedResults.flatMap((m) => m.reasons)

  return {
    decision: finalDecision,
    riskScore,
    matchedRules: matchedResults,
    reasons,
  }
}

export { ACTION_PRIORITY }
