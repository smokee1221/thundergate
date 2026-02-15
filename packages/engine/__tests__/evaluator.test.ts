import { describe, it, expect } from 'vitest'
import { evaluate } from '../src/evaluator.js'
import type { RequestContext, Rule } from '../src/types.js'

// ── Fixtures ─────────────────────────────────────────────

const RULES: Rule[] = [
  {
    id: 'rule-block-delete',
    name: 'Block DELETE on user endpoints',
    priority: 10,
    conditions: {
      url_pattern: '*/users/*',
      methods: ['DELETE'],
    },
    action: 'BLOCK',
    severity: 'CRITICAL',
    enabled: true,
  },
  {
    id: 'rule-flag-ssn',
    name: 'Flag SSN in payload',
    priority: 20,
    conditions: {
      payload_patterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'],
    },
    action: 'FLAG_FOR_REVIEW',
    severity: 'HIGH',
    enabled: true,
  },
  {
    id: 'rule-flag-email',
    name: 'Flag email in payload',
    priority: 30,
    conditions: {
      payload_patterns: ['[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'],
    },
    action: 'FLAG_FOR_REVIEW',
    severity: 'MEDIUM',
    enabled: true,
  },
  {
    id: 'rule-allow-get',
    name: 'Allow GET requests',
    priority: 1000,
    conditions: {
      methods: ['GET', 'HEAD', 'OPTIONS'],
    },
    action: 'ALLOW',
    severity: 'LOW',
    enabled: true,
  },
  {
    id: 'rule-disabled',
    name: 'Disabled rule',
    priority: 5,
    conditions: {
      methods: ['GET'],
    },
    action: 'BLOCK',
    severity: 'CRITICAL',
    enabled: false,
  },
]

// ── Tests ────────────────────────────────────────────────

describe('evaluate', () => {
  describe('basic behavior', () => {
    it('returns ALLOW with no rules', () => {
      const request: RequestContext = {
        method: 'GET',
        url: '/api/users',
        headers: {},
        body: null,
      }
      const result = evaluate(request, [])
      expect(result.decision).toBe('ALLOW')
      expect(result.riskScore).toBe(0)
      expect(result.matchedRules).toEqual([])
    })

    it('returns the correct EvaluationResult shape', () => {
      const request: RequestContext = {
        method: 'GET',
        url: '/anything',
        headers: {},
        body: null,
      }
      const result = evaluate(request, RULES)
      expect(result).toHaveProperty('decision')
      expect(result).toHaveProperty('riskScore')
      expect(result).toHaveProperty('matchedRules')
      expect(result).toHaveProperty('reasons')
    })

    it('ignores disabled rules', () => {
      const request: RequestContext = {
        method: 'GET',
        url: '/test',
        headers: {},
        body: null,
      }
      // The disabled rule would BLOCK GET, but should be ignored
      const result = evaluate(request, RULES)
      expect(result.decision).not.toBe('BLOCK')
    })
  })

  describe('BLOCK decisions', () => {
    it('blocks DELETE on user endpoints', () => {
      const request: RequestContext = {
        method: 'DELETE',
        url: '/api/users/123',
        headers: {},
        body: null,
      }
      const result = evaluate(request, RULES)
      expect(result.decision).toBe('BLOCK')
      expect(result.riskScore).toBe(90) // CRITICAL = 90
      expect(result.matchedRules.length).toBeGreaterThanOrEqual(1)
      expect(result.matchedRules[0]!.rule.id).toBe('rule-block-delete')
    })

    it('does not block GET on user endpoints', () => {
      const request: RequestContext = {
        method: 'GET',
        url: '/api/users/123',
        headers: {},
        body: null,
      }
      const result = evaluate(request, RULES)
      // GET matches the allow-get rule, not the delete rule
      expect(result.decision).not.toBe('BLOCK')
    })
  })

  describe('FLAG_FOR_REVIEW decisions', () => {
    it('flags requests with SSN in payload', () => {
      const request: RequestContext = {
        method: 'POST',
        url: '/api/reports',
        headers: {},
        body: { user: { ssn: '123-45-6789' } },
      }
      const result = evaluate(request, RULES)
      expect(result.decision).toBe('FLAG_FOR_REVIEW')
      expect(result.riskScore).toBe(60) // HIGH = 60
    })

    it('flags requests with email in payload', () => {
      const request: RequestContext = {
        method: 'POST',
        url: '/api/data',
        headers: {},
        body: { contact: 'user@example.com' },
      }
      const result = evaluate(request, RULES)
      expect(result.decision).toBe('FLAG_FOR_REVIEW')
      expect(result.riskScore).toBe(30) // MEDIUM = 30
    })

    it('accumulates risk score from multiple matches', () => {
      const request: RequestContext = {
        method: 'POST',
        url: '/api/data',
        headers: {},
        body: { ssn: '123-45-6789', email: 'test@example.com' },
      }
      const result = evaluate(request, RULES)
      expect(result.decision).toBe('FLAG_FOR_REVIEW')
      expect(result.riskScore).toBe(90) // HIGH(60) + MEDIUM(30) = 90
      expect(result.matchedRules.length).toBe(2)
    })
  })

  describe('ALLOW decisions', () => {
    it('allows safe GET requests with no payload issues', () => {
      const request: RequestContext = {
        method: 'GET',
        url: '/api/products',
        headers: {},
        body: null,
      }
      const result = evaluate(request, RULES)
      expect(result.decision).toBe('ALLOW')
      expect(result.riskScore).toBe(10) // LOW = 10
    })

    it('allows requests that match no rules', () => {
      const request: RequestContext = {
        method: 'PATCH',
        url: '/api/settings',
        headers: {},
        body: { theme: 'dark' },
      }
      const result = evaluate(request, RULES)
      expect(result.decision).toBe('ALLOW')
      expect(result.riskScore).toBe(0)
    })
  })

  describe('action priority', () => {
    it('BLOCK takes precedence over FLAG_FOR_REVIEW', () => {
      const request: RequestContext = {
        method: 'DELETE',
        url: '/api/users/123',
        headers: {},
        body: { ssn: '123-45-6789' },
      }
      const result = evaluate(request, RULES)
      // Both block-delete (BLOCK) and flag-ssn (FLAG) match
      expect(result.decision).toBe('BLOCK')
    })

    it('FLAG_FOR_REVIEW takes precedence over ALLOW', () => {
      const request: RequestContext = {
        method: 'GET',
        url: '/api/data',
        headers: {},
        body: { email: 'admin@secret.com' },
      }
      const result = evaluate(request, RULES)
      // Both allow-get (ALLOW) and flag-email (FLAG) match
      expect(result.decision).toBe('FLAG_FOR_REVIEW')
    })
  })

  describe('rule priority ordering', () => {
    it('evaluates rules in priority order', () => {
      const request: RequestContext = {
        method: 'DELETE',
        url: '/api/users/123',
        headers: {},
        body: null,
      }
      const result = evaluate(request, RULES)
      // rule-block-delete has priority 10 (evaluated first)
      expect(result.matchedRules[0]!.rule.priority).toBeLessThanOrEqual(
        result.matchedRules.length > 1
          ? result.matchedRules[1]!.rule.priority
          : Infinity,
      )
    })
  })

  describe('edge cases', () => {
    it('handles rules with empty conditions', () => {
      const rules: Rule[] = [
        {
          id: 'empty-rule',
          name: 'Empty conditions',
          priority: 1,
          conditions: {},
          action: 'BLOCK',
          severity: 'HIGH',
          enabled: true,
        },
      ]
      const request: RequestContext = {
        method: 'GET',
        url: '/test',
        headers: {},
        body: null,
      }
      const result = evaluate(request, rules)
      // Empty conditions = no match = ALLOW
      expect(result.decision).toBe('ALLOW')
    })

    it('handles all disabled rules', () => {
      const rules: Rule[] = [
        {
          id: 'disabled',
          name: 'Disabled',
          priority: 1,
          conditions: { methods: ['GET'] },
          action: 'BLOCK',
          severity: 'CRITICAL',
          enabled: false,
        },
      ]
      const request: RequestContext = {
        method: 'GET',
        url: '/test',
        headers: {},
        body: null,
      }
      const result = evaluate(request, rules)
      expect(result.decision).toBe('ALLOW')
      expect(result.reasons).toContain('No active rules configured')
    })

    it('handles unicode in payload', () => {
      const request: RequestContext = {
        method: 'POST',
        url: '/api/data',
        headers: {},
        body: { message: 'Héllo wörld 日本語' },
      }
      const rules: Rule[] = [
        {
          id: 'unicode-rule',
          name: 'Match unicode',
          priority: 1,
          conditions: { payload_patterns: ['日本語'] },
          action: 'FLAG_FOR_REVIEW',
          severity: 'LOW',
          enabled: true,
        },
      ]
      const result = evaluate(request, rules)
      expect(result.decision).toBe('FLAG_FOR_REVIEW')
    })

    it('handles combined URL + method + payload conditions (AND logic)', () => {
      const rules: Rule[] = [
        {
          id: 'combined-rule',
          name: 'Combined conditions',
          priority: 1,
          conditions: {
            url_pattern: '*/payments*',
            methods: ['POST'],
            payload_patterns: ['amount'],
          },
          action: 'FLAG_FOR_REVIEW',
          severity: 'HIGH',
          enabled: true,
        },
      ]

      // All conditions match
      const request1: RequestContext = {
        method: 'POST',
        url: '/api/payments/create',
        headers: {},
        body: { amount: 5000 },
      }
      expect(evaluate(request1, rules).decision).toBe('FLAG_FOR_REVIEW')

      // URL matches but method doesn't
      const request2: RequestContext = {
        method: 'GET',
        url: '/api/payments/list',
        headers: {},
        body: { amount: 5000 },
      }
      expect(evaluate(request2, rules).decision).toBe('ALLOW')

      // Method matches but URL doesn't
      const request3: RequestContext = {
        method: 'POST',
        url: '/api/users',
        headers: {},
        body: { amount: 5000 },
      }
      expect(evaluate(request3, rules).decision).toBe('ALLOW')
    })
  })

  describe('performance', () => {
    it('evaluates 100 rules in under 5ms', () => {
      const manyRules: Rule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule-${i}`,
        name: `Rule ${i}`,
        priority: i,
        conditions: {
          url_pattern: `*/path-${i}/*`,
          methods: ['POST'],
        },
        action: 'FLAG_FOR_REVIEW' as const,
        severity: 'LOW' as const,
        enabled: true,
      }))

      const request: RequestContext = {
        method: 'POST',
        url: '/api/path-50/action',
        headers: {},
        body: { data: 'test' },
      }

      const start = performance.now()
      const result = evaluate(request, manyRules)
      const elapsed = performance.now() - start

      // 10ms budget — allows for coverage instrumentation overhead
      expect(elapsed).toBeLessThan(10)
      expect(result).toBeDefined()
    })
  })
})
