import { describe, it, expect } from 'vitest'
import { matchHeaders } from '../../src/matchers/header.js'
import type { RequestContext, RuleConditions } from '../../src/types.js'

const baseRequest: RequestContext = {
  method: 'POST',
  url: '/api/data',
  headers: {
    'content-type': 'application/json',
    authorization:
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.TJVA95OrM7E2cBab30RMHrHDcEfxjoYZgeFONFh7HgQ',
    'x-custom': 'some-value',
  },
  body: null,
}

describe('matchHeaders', () => {
  it('returns no match when header_patterns is undefined', () => {
    const result = matchHeaders(baseRequest, {})
    expect(result.matched).toBe(false)
    expect(result.reasons).toEqual([])
  })

  it('returns no match when header_patterns is empty', () => {
    const result = matchHeaders(baseRequest, { header_patterns: {} })
    expect(result.matched).toBe(false)
  })

  it('matches authorization header pattern', () => {
    const conditions: RuleConditions = {
      header_patterns: { authorization: 'Bearer\\s+.{50,}' },
    }
    const result = matchHeaders(baseRequest, conditions)
    expect(result.matched).toBe(true)
    expect(result.reasons[0]).toContain('authorization')
  })

  it('does not match when header value does not match pattern', () => {
    const conditions: RuleConditions = {
      header_patterns: { authorization: 'Basic\\s+' },
    }
    const result = matchHeaders(baseRequest, conditions)
    expect(result.matched).toBe(false)
  })

  it('matches case-insensitively on header names', () => {
    const conditions: RuleConditions = {
      header_patterns: { 'Content-Type': 'application/json' },
    }
    const result = matchHeaders(baseRequest, conditions)
    expect(result.matched).toBe(true)
  })

  it('handles missing headers gracefully', () => {
    const conditions: RuleConditions = {
      header_patterns: { 'x-nonexistent': '.*' },
    }
    const result = matchHeaders(baseRequest, conditions)
    expect(result.matched).toBe(false)
  })

  it('handles invalid regex in header patterns', () => {
    const conditions: RuleConditions = {
      header_patterns: { authorization: '[invalid(' },
    }
    const result = matchHeaders(baseRequest, conditions)
    expect(result.matched).toBe(false)
  })

  it('matches multiple headers', () => {
    const conditions: RuleConditions = {
      header_patterns: {
        'content-type': 'json',
        'x-custom': 'some-value',
      },
    }
    const result = matchHeaders(baseRequest, conditions)
    expect(result.matched).toBe(true)
    expect(result.reasons.length).toBe(2)
  })

  it('handles array header values', () => {
    const request: RequestContext = {
      ...baseRequest,
      headers: {
        'set-cookie': ['a=1', 'b=2'],
      },
    }
    const conditions: RuleConditions = {
      header_patterns: { 'set-cookie': 'a=1' },
    }
    const result = matchHeaders(request, conditions)
    expect(result.matched).toBe(true)
  })
})
