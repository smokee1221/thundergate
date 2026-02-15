import { describe, it, expect } from 'vitest'
import { matchMethod } from '../../src/matchers/method.js'
import type { RequestContext, RuleConditions } from '../../src/types.js'

const baseRequest: RequestContext = {
  method: 'DELETE',
  url: '/api/users/123',
  headers: {},
  body: null,
}

describe('matchMethod', () => {
  it('returns no match when methods is undefined', () => {
    const result = matchMethod(baseRequest, {})
    expect(result.matched).toBe(false)
  })

  it('returns no match when methods is empty', () => {
    const result = matchMethod(baseRequest, { methods: [] })
    expect(result.matched).toBe(false)
  })

  it('matches when method is in the list', () => {
    const conditions: RuleConditions = { methods: ['DELETE', 'PUT'] }
    const result = matchMethod(baseRequest, conditions)
    expect(result.matched).toBe(true)
    expect(result.reason).toContain('DELETE')
  })

  it('does not match when method is not in the list', () => {
    const conditions: RuleConditions = { methods: ['GET', 'POST'] }
    const result = matchMethod(baseRequest, conditions)
    expect(result.matched).toBe(false)
  })

  it('matches case-insensitively', () => {
    const request: RequestContext = { ...baseRequest, method: 'delete' }
    const conditions: RuleConditions = { methods: ['DELETE'] }
    const result = matchMethod(request, conditions)
    expect(result.matched).toBe(true)
  })

  it('handles lowercase rule methods', () => {
    const conditions: RuleConditions = { methods: ['delete', 'put'] }
    const result = matchMethod(baseRequest, conditions)
    expect(result.matched).toBe(true)
  })

  it('matches HEAD requests', () => {
    const request: RequestContext = { ...baseRequest, method: 'HEAD' }
    const conditions: RuleConditions = {
      methods: ['GET', 'HEAD', 'OPTIONS'],
    }
    const result = matchMethod(request, conditions)
    expect(result.matched).toBe(true)
  })
})
