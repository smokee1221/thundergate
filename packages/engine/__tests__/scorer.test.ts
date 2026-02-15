import { describe, it, expect } from 'vitest'
import { calculateRiskScore } from '../src/scorer.js'
import type { MatchResult, Rule } from '../src/types.js'

function makeRule(severity: Rule['severity'], action: Rule['action']): Rule {
  return {
    id: 'test-rule',
    name: 'Test Rule',
    priority: 100,
    conditions: {},
    action,
    severity,
    enabled: true,
  }
}

function makeMatch(rule: Rule): MatchResult {
  return { matched: true, rule, reasons: ['test'] }
}

describe('calculateRiskScore', () => {
  it('returns 0 for no matches', () => {
    expect(calculateRiskScore([])).toBe(0)
  })

  it('returns 10 for a LOW severity match', () => {
    const score = calculateRiskScore([makeMatch(makeRule('LOW', 'ALLOW'))])
    expect(score).toBe(10)
  })

  it('returns 30 for a MEDIUM severity match', () => {
    const score = calculateRiskScore([makeMatch(makeRule('MEDIUM', 'FLAG_FOR_REVIEW'))])
    expect(score).toBe(30)
  })

  it('returns 60 for a HIGH severity match', () => {
    const score = calculateRiskScore([makeMatch(makeRule('HIGH', 'FLAG_FOR_REVIEW'))])
    expect(score).toBe(60)
  })

  it('returns 90 for a CRITICAL severity match', () => {
    const score = calculateRiskScore([makeMatch(makeRule('CRITICAL', 'BLOCK'))])
    expect(score).toBe(90)
  })

  it('stacks scores from multiple matches', () => {
    const matches = [
      makeMatch(makeRule('LOW', 'ALLOW')),
      makeMatch(makeRule('MEDIUM', 'FLAG_FOR_REVIEW')),
    ]
    expect(calculateRiskScore(matches)).toBe(40) // 10 + 30
  })

  it('caps score at 100', () => {
    const matches = [
      makeMatch(makeRule('CRITICAL', 'BLOCK')),
      makeMatch(makeRule('HIGH', 'FLAG_FOR_REVIEW')),
    ]
    expect(calculateRiskScore(matches)).toBe(100) // 90 + 60 = 150, capped
  })

  it('ignores non-matched results', () => {
    const notMatched: MatchResult = {
      matched: false,
      rule: makeRule('CRITICAL', 'BLOCK'),
      reasons: [],
    }
    expect(calculateRiskScore([notMatched])).toBe(0)
  })
})
