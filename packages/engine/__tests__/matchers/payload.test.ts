import { describe, it, expect } from 'vitest'
import { matchPayload, extractStrings } from '../../src/matchers/payload.js'
import type { RequestContext, RuleConditions } from '../../src/types.js'

const baseRequest: RequestContext = {
  method: 'POST',
  url: '/api/users',
  headers: {},
  body: null,
}

describe('extractStrings', () => {
  it('extracts strings from simple values', () => {
    expect(extractStrings('hello')).toEqual(['hello'])
    expect(extractStrings(42)).toEqual(['42'])
    expect(extractStrings(true)).toEqual(['true'])
  })

  it('extracts strings from arrays', () => {
    expect(extractStrings(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('extracts strings from nested objects including keys', () => {
    const result = extractStrings({ name: 'John', age: 30 })
    expect(result).toContain('name')
    expect(result).toContain('John')
    expect(result).toContain('age')
    expect(result).toContain('30')
  })

  it('extracts from deeply nested structures', () => {
    const result = extractStrings({
      user: { details: { ssn: '123-45-6789' } },
    })
    expect(result).toContain('123-45-6789')
    expect(result).toContain('ssn')
  })

  it('returns empty array for null/undefined', () => {
    expect(extractStrings(null)).toEqual([])
    expect(extractStrings(undefined)).toEqual([])
  })
})

describe('matchPayload', () => {
  it('returns no match when payload_patterns is undefined', () => {
    const result = matchPayload(baseRequest, {})
    expect(result.matched).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it('returns no match when body is null', () => {
    const conditions: RuleConditions = {
      payload_patterns: ['\\d{3}-\\d{2}-\\d{4}'],
    }
    const result = matchPayload(baseRequest, conditions)
    expect(result.matched).toBe(false)
  })

  it('detects SSN pattern in request body', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: { data: { ssn: '123-45-6789' } },
    }
    const conditions: RuleConditions = {
      payload_patterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(true)
    expect(result.reasons.length).toBe(1)
    expect(result.reasons[0]).toContain('123-45-6789')
  })

  it('detects email addresses in payload', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: { contact: 'user@example.com' },
    }
    const conditions: RuleConditions = {
      payload_patterns: ['[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}'],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(true)
    expect(result.reasons[0]).toContain('user@example.com')
  })

  it('matches multiple patterns and reports all', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: { ssn: '123-45-6789', email: 'test@test.com' },
    }
    const conditions: RuleConditions = {
      payload_patterns: [
        '\\d{3}-\\d{2}-\\d{4}',
        '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
      ],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(true)
    expect(result.reasons.length).toBe(2)
  })

  it('does not match when no patterns hit', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: { name: 'John', action: 'read' },
    }
    const conditions: RuleConditions = {
      payload_patterns: ['\\d{3}-\\d{2}-\\d{4}'],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(false)
  })

  it('handles invalid regex gracefully', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: { data: 'test' },
    }
    const conditions: RuleConditions = {
      payload_patterns: ['[invalid regex('],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(false)
  })

  it('scans array bodies', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: ['secret-token-abc123', 'normal-data'],
    }
    const conditions: RuleConditions = {
      payload_patterns: ['secret-token'],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(true)
  })

  it('detects sensitive keywords in object keys', () => {
    const request: RequestContext = {
      ...baseRequest,
      body: { password: 'mysecretpass' },
    }
    const conditions: RuleConditions = {
      payload_patterns: ['password|secret|token'],
    }
    const result = matchPayload(request, conditions)
    expect(result.matched).toBe(true)
  })
})
