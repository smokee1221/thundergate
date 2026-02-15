import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

/**
 * Proxy integration tests.
 *
 * These tests use Fastify's .inject() — no real HTTP server started.
 * They DO require PostgreSQL running with seeded data
 * (pnpm --filter @thundergate/db db:seed).
 *
 * The test agent API key is: test-agent-key-001
 */
describe('Proxy Interceptor', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer({
      disableRateLimit: true,
      disableHitlServices: true,
      logLevel: 'error',
    })
  })

  afterAll(async () => {
    await server.close()
  })

  describe('authentication', () => {
    it('returns 401 when X-Agent-Key is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/proxy/test',
      })
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('MISSING_API_KEY')
    })

    it('returns 401 for invalid API key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/proxy/test',
        headers: { 'x-agent-key': 'bogus-key-000' },
      })
      expect(response.statusCode).toBe(401)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('INVALID_API_KEY')
    })

    it('passes auth with valid agent key', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/proxy/test',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
        },
      })
      // Should NOT be 401 — may be 200 or 502 depending on target
      expect(response.statusCode).not.toBe(401)
    })
  })

  describe('missing target URL', () => {
    it('returns 400 when X-Target-URL is missing', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/proxy/test',
        headers: { 'x-agent-key': 'test-agent-key-001' },
      })
      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('MISSING_TARGET_URL')
    })
  })

  describe('rule engine decisions', () => {
    it('blocks DELETE on user endpoints (BLOCK rule)', async () => {
      const response = await server.inject({
        method: 'DELETE',
        url: '/proxy/users/123',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
        },
      })
      expect(response.statusCode).toBe(403)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('BLOCKED_BY_RULE')
      expect(body.error.riskScore).toBeGreaterThanOrEqual(90)
    })

    it('flags requests with SSN in payload (FLAG_FOR_REVIEW, async mode)', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/proxy/api/reports',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
          'x-firewall-mode': 'async',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          user: { name: 'John', ssn: '123-45-6789' },
        }),
      })
      expect(response.statusCode).toBe(202)
      const body = JSON.parse(response.payload)
      expect(body.status).toBe('QUEUED_FOR_REVIEW')
      expect(body.riskScore).toBeGreaterThanOrEqual(60)
      expect(body.auditLogId).toBeDefined()
      expect(body.queueId).toBeDefined()
    })

    it('allows safe GET requests and forwards to target', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/proxy/todos/1',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
        },
      })
      // JSONPlaceholder returns 200 for GET /todos/1
      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body).toHaveProperty('id')
      expect(body).toHaveProperty('title')
    })
  })

  describe('forwarding', () => {
    it('returns 502 when target is unreachable', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/proxy/test',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'http://localhost:19999', // nothing listening
        },
      })
      expect(response.statusCode).toBe(502)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('TARGET_UNREACHABLE')
    })
  })

  describe('health endpoint still works', () => {
    it('returns ok without auth', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/health',
      })
      expect(response.statusCode).toBe(200)
    })
  })
})
