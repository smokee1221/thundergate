import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { buildServer } from '../src/server.js'
import { holdManager } from '../src/services/connection-hold.js'
import { db, operators } from '@thundergate/db'
import type { FastifyInstance } from 'fastify'

/**
 * HITL Queue integration tests.
 *
 * These tests use Fastify's .inject() — no real HTTP server started.
 * They DO require PostgreSQL running with seeded data.
 *
 * Test agent API key: test-agent-key-001
 */
describe('HITL Queue', () => {
  let server: FastifyInstance
  let operatorId: string

  beforeAll(async () => {
    server = await buildServer({
      disableRateLimit: true,
      disableHitlServices: true, // We test queue operations directly
      logLevel: 'error',
    })

    // Fetch the real admin operator ID from seeded data
    const [admin] = await db
      .select({ id: operators.id })
      .from(operators)
      .where(eq(operators.email, 'admin@thundergate.local'))
      .limit(1)

    operatorId = admin!.id
  })

  afterAll(async () => {
    holdManager.cancelAll()
    await server.close()
  })

  describe('async mode (X-Firewall-Mode: async)', () => {
    it('returns 202 with queueId for flagged requests', async () => {
      const response = await server.inject({
        method: 'POST',
        url: '/proxy/api/data',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
          'x-firewall-mode': 'async',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          user: { ssn: '999-88-7777' },
        }),
      })

      expect(response.statusCode).toBe(202)
      const body = JSON.parse(response.payload)
      expect(body.status).toBe('QUEUED_FOR_REVIEW')
      expect(body.queueId).toBeDefined()
      expect(body.auditLogId).toBeDefined()
      expect(body.riskScore).toBeGreaterThan(0)
    })
  })

  describe('queue API routes', () => {
    let queueId: string

    it('GET /api/queue lists queue items', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/queue',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body).toHaveProperty('items')
      expect(body).toHaveProperty('total')
      expect(Array.isArray(body.items)).toBe(true)
      expect(body.total).toBeGreaterThan(0)
    })

    it('GET /api/queue?status=PENDING filters by status', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/queue?status=PENDING',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      for (const item of body.items) {
        expect(item.status).toBe('PENDING')
      }
    })

    it('GET /api/queue/stats returns statistics', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/queue/stats',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body).toHaveProperty('pending')
      expect(body).toHaveProperty('claimed')
      expect(body).toHaveProperty('escalated')
      expect(body).toHaveProperty('resolvedToday')
      expect(typeof body.pending).toBe('number')
    })

    it('GET /api/queue/:id returns queue item detail', async () => {
      // Create a fresh flagged request for a known queue item
      const flagResponse = await server.inject({
        method: 'POST',
        url: '/proxy/api/check',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
          'x-firewall-mode': 'async',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          data: { ssn: '111-22-3333' },
        }),
      })

      const flagBody = JSON.parse(flagResponse.payload)
      queueId = flagBody.queueId

      const response = await server.inject({
        method: 'GET',
        url: `/api/queue/${queueId}`,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.id).toBe(queueId)
      expect(body.status).toBe('PENDING')
      expect(body).toHaveProperty('auditLog')
    })

    it('GET /api/queue/:id returns 404 for non-existent item', async () => {
      const response = await server.inject({
        method: 'GET',
        url: '/api/queue/00000000-0000-0000-0000-000000000000',
      })

      expect(response.statusCode).toBe(404)
    })

    it('POST /api/queue/:id/claim claims a pending item', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/claim`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ operatorId }),
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.status).toBe('claimed')
    })

    it('POST /api/queue/:id/claim prevents double claiming', async () => {
      // Fetch a different operator
      const [op2] = await db
        .select({ id: operators.id })
        .from(operators)
        .where(eq(operators.email, 'operator@thundergate.local'))
        .limit(1)

      const response = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/claim`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operatorId: op2!.id,
        }),
      })

      expect(response.statusCode).toBe(409)
      const body = JSON.parse(response.payload)
      expect(body.error.code).toBe('CLAIM_FAILED')
    })

    it('POST /api/queue/:id/decide rejects missing decision field', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/decide`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ operatorId }),
      })

      expect(response.statusCode).toBe(400)
    })

    it('POST /api/queue/:id/decide submits APPROVED decision', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/decide`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operatorId,
          decision: 'APPROVED',
          notes: 'Verified — safe to proceed',
        }),
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.payload)
      expect(body.status).toBe('decided')
      expect(body.decision).toBe('APPROVED')
      expect(body.resolvedAt).toBeDefined()
    })

    it('POST /api/queue/:id/decide fails on already-resolved item', async () => {
      const response = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/decide`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operatorId,
          decision: 'REJECTED',
        }),
      })

      expect(response.statusCode).toBe(409)
    })
  })

  describe('connection hold mechanism', () => {
    it('releases held connection on APPROVED decision', async () => {
      const flagResponse = await server.inject({
        method: 'POST',
        url: '/proxy/api/test-hold',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
          'x-firewall-mode': 'async',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          sensitive: { ssn: '555-66-7777' },
        }),
      })
      const { queueId } = JSON.parse(flagResponse.payload) as { queueId: string }

      // Simulate holding a connection
      const holdPromise = holdManager.hold(queueId, 5000)

      // Release it with APPROVED
      setTimeout(() => {
        holdManager.release(queueId, { status: 'APPROVED' })
      }, 50)

      const resolution = await holdPromise
      expect(resolution.status).toBe('APPROVED')
    })

    it('releases held connection on REJECTED decision', async () => {
      const flagResponse = await server.inject({
        method: 'POST',
        url: '/proxy/api/test-hold2',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
          'x-firewall-mode': 'async',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({
          sensitive: { ssn: '444-33-2222' },
        }),
      })
      const { queueId } = JSON.parse(flagResponse.payload) as { queueId: string }

      const holdPromise = holdManager.hold(queueId, 5000)

      setTimeout(() => {
        holdManager.release(queueId, { status: 'REJECTED' })
      }, 50)

      const resolution = await holdPromise
      expect(resolution.status).toBe('REJECTED')
    })

    it('times out if no decision arrives', async () => {
      const holdPromise = holdManager.hold(
        'timeout-test-' + Date.now(),
        100, // 100ms timeout for test
      )

      const resolution = await holdPromise
      expect(resolution.status).toBe('TIMEOUT')
    })

    it('cancels all connections on shutdown', () => {
      const promises: Promise<{ status: string }>[] = []

      // Hold a few connections
      promises.push(holdManager.hold('shutdown-1', 5000))
      promises.push(holdManager.hold('shutdown-2', 5000))

      expect(holdManager.activeCount).toBe(2)

      // Cancel all
      holdManager.cancelAll()
      expect(holdManager.activeCount).toBe(0)

      // All should resolve with SHUTDOWN
      return Promise.all(promises).then((results) => {
        for (const r of results) {
          expect(r.status).toBe('SHUTDOWN')
        }
      })
    })
  })

  describe('full HITL flow: claim → decide → release', () => {
    it('claim + REJECTED decision releases held connection', async () => {
      // 1. Create a flagged request (async) to get a queue item
      const flagResp = await server.inject({
        method: 'POST',
        url: '/proxy/api/full-flow',
        headers: {
          'x-agent-key': 'test-agent-key-001',
          'x-target-url': 'https://jsonplaceholder.typicode.com',
          'x-firewall-mode': 'async',
          'content-type': 'application/json',
        },
        payload: JSON.stringify({ user: { ssn: '888-77-6666' } }),
      })

      const { queueId } = JSON.parse(flagResp.payload) as { queueId: string }

      // 2. Simulate a held connection
      const holdPromise = holdManager.hold(queueId, 5000)

      // 3. Claim the item via API
      const claimResp = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/claim`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({ operatorId }),
      })
      expect(claimResp.statusCode).toBe(200)

      // 4. Decide REJECTED via API (this also releases the held connection)
      const decideResp = await server.inject({
        method: 'POST',
        url: `/api/queue/${queueId}/decide`,
        headers: { 'content-type': 'application/json' },
        payload: JSON.stringify({
          operatorId,
          decision: 'REJECTED',
          notes: 'Contains PII — not allowed',
        }),
      })
      expect(decideResp.statusCode).toBe(200)

      // 5. The held connection should be released with REJECTED
      const resolution = await holdPromise
      expect(resolution.status).toBe('REJECTED')
    })
  })
})
