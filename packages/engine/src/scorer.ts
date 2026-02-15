import type { MatchResult, Severity } from './types.js'

const SEVERITY_BASE_SCORES: Record<Severity, number> = {
  LOW: 10,
  MEDIUM: 30,
  HIGH: 60,
  CRITICAL: 90,
}

/**
 * Calculates a cumulative risk score from matched rules.
 *
 * Scoring logic:
 * - Each matched rule contributes its severity base score
 * - Multiple matches stack (additive)
 * - Score is capped at 100
 *
 * This produces a 0-100 risk score that can be used for
 * threshold-based decisions and dashboard display.
 */
export function calculateRiskScore(matchedRules: MatchResult[]): number {
  if (matchedRules.length === 0) return 0

  let score = 0

  for (const match of matchedRules) {
    if (match.matched) {
      score += SEVERITY_BASE_SCORES[match.rule.severity] ?? 0
    }
  }

  return Math.min(score, 100)
}

export { SEVERITY_BASE_SCORES }
