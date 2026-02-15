import { describe, it, expect } from 'vitest'
import { matchUrl } from '../../src/matchers/url.js'
import type { RequestContext, RuleConditions } from '../../src/types.js'

const baseRequest: RequestContext = {
  method: 'GET',
  url: '/api/users/123',
  headers: {},
  body: null,
}

describe('matchUrl', () => {
  it('returns no match when url_pattern is undefined', () => {
    const result = matchUrl(baseRequest, {})
    expect(result.matched).toBe(false)
  })

  it('matches a simple glob pattern', () => {
    const conditions: RuleConditions = { url_pattern: '*/users/*' }
    const result = matchUrl(baseRequest, conditions)
    expect(result.matched).toBe(true)
    expect(result.reason).toContain('/api/users/123')
  })

  it('matches a wildcard-all pattern', () => {
    const conditions: RuleConditions = { url_pattern: '**' }
    const result = matchUrl(baseRequest, conditions)
    expect(result.matched).toBe(true)
  })

  it('does not match a non-matching pattern', () => {
    const conditions: RuleConditions = { url_pattern: '*/payments/*' }
    const result = matchUrl(baseRequest, conditions)
    expect(result.matched).toBe(false)
  })

  it('matches a path ending pattern', () => {
    const request: RequestContext = {
      ...baseRequest,
      url: '/api/v1/users/456/delete',
    }
    const conditions: RuleConditions = { url_pattern: '**/delete' }
    const result = matchUrl(request, conditions)
    expect(result.matched).toBe(true)
  })

  it('handles an invalid glob pattern gracefully', () => {
    const conditions: RuleConditions = { url_pattern: '[invalid' }
    const result = matchUrl(baseRequest, conditions)
    // Should not throw, just return no match
    expect(result.matched).toBe(false)
  })

  it('matches exact path', () => {
    const request: RequestContext = {
      ...baseRequest,
      url: '/health',
    }
    const conditions: RuleConditions = { url_pattern: '/health' }
    const result = matchUrl(request, conditions)
    expect(result.matched).toBe(true)
  })

  it('matches stripe-like API URLs', () => {
    const request: RequestContext = {
      ...baseRequest,
      url: 'https://api.stripe.com/v1/refunds',
    }
    const conditions: RuleConditions = {
      url_pattern: '*api.stripe.com*',
    }
    const result = matchUrl(request, conditions)
    expect(result.matched).toBe(true)
  })
})
