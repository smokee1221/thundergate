import type { FastifyPluginAsync } from 'fastify'
import { db } from '@thundergate/db'
import { sql } from 'drizzle-orm'
import { holdManager } from '../services/connection-hold.js'

const startedAt = Date.now()

export const healthRoute: FastifyPluginAsync = async (server) => {
  /**
   * Basic liveness check — always returns 200 if the process is running.
   * Used by Docker HEALTHCHECK and load-balancer probes.
   */
  server.get('/health', async () => {
    return {
      status: 'ok',
      service: 'thundergate-proxy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
    }
  })

  /**
   * Deep readiness check — verifies database connectivity and reports
   * held-connection count. Returns 503 if the database is unreachable.
   * Useful for Kubernetes readiness probes or operator dashboards.
   */
  server.get('/health/ready', async (_request, reply) => {
    const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {}

    // Database connectivity
    const dbStart = Date.now()
    try {
      await db.execute(sql`SELECT 1`)
      checks.database = { status: 'ok', latencyMs: Date.now() - dbStart }
    } catch (err) {
      checks.database = {
        status: 'error',
        latencyMs: Date.now() - dbStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      }
    }

    const allOk = Object.values(checks).every((c) => c.status === 'ok')

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ok' : 'degraded',
      service: 'thundergate-proxy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      heldConnections: holdManager.activeCount,
      checks,
    })
  })
}
