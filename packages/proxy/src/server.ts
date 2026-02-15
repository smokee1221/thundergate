import { randomUUID } from 'crypto'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import requestIdPlugin from './plugins/request-id.js'
import authPlugin from './plugins/auth.js'
import errorHandler from './plugins/error-handler.js'
import { healthRoute } from './routes/health.js'
import { proxyRoute } from './routes/proxy.js'
import { queueRoute } from './routes/queue.js'
import { startEscalationWorker } from './services/escalation-worker.js'
import { subscribeHitlEvents } from './services/pg-notify.js'
import { holdManager } from './services/connection-hold.js'

export interface ServerOptions {
  /** Disable auth for testing (mock agentId instead) */
  disableAuth?: boolean
  /** Disable rate limiting for testing */
  disableRateLimit?: boolean
  /** Disable HITL background services (escalation worker, PG NOTIFY) */
  disableHitlServices?: boolean
  /** Log level */
  logLevel?: string
}

export async function buildServer(options: ServerOptions = {}) {
  const server = Fastify({
    logger: {
      level: options.logLevel ?? process.env.TG_LOG_LEVEL ?? 'info',
    },
    bodyLimit: Number(process.env.TG_MAX_PAYLOAD_SIZE ?? 1048576), // 1MB default
    genReqId: () => randomUUID(), // Deterministic UUID instead of Fastify's auto-increment
  })

  // Request ID — generates or passes through X-Request-Id
  await server.register(requestIdPlugin)

  // Error handler (sanitizes errors in production)
  await server.register(errorHandler)

  // CORS
  await server.register(cors, {
    origin: process.env.TG_NEXTAUTH_URL ?? 'http://localhost:3000',
  })

  // Rate limiting
  if (!options.disableRateLimit) {
    await server.register(rateLimit, {
      max: Number(process.env.TG_DEFAULT_RATE_LIMIT ?? 100),
      timeWindow: '1 minute',
      keyGenerator: (request) => {
        // Rate limit per agent (using X-Agent-Key) or per IP
        return (request.headers['x-agent-key'] as string) ?? request.ip
      },
    })
  }

  // Agent auth
  if (!options.disableAuth) {
    await server.register(authPlugin)
  }

  // Content type parser for JSON bodies
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const parsed = body ? JSON.parse(body as string) : undefined
        done(null, parsed)
      } catch (err) {
        done(err as Error, undefined)
      }
    },
  )

  // Routes
  await server.register(healthRoute)
  await server.register(proxyRoute)
  await server.register(queueRoute)

  // HITL background services (escalation worker + PG NOTIFY listener)
  if (!options.disableHitlServices) {
    let stopWorker: (() => void) | undefined
    let unsubscribe: (() => Promise<void>) | undefined

    server.addHook('onReady', async () => {
      // Start escalation worker
      stopWorker = startEscalationWorker(server.log)

      // Subscribe to PG NOTIFY for real-time HITL events
      try {
        unsubscribe = await subscribeHitlEvents({
          onNew: (payload) => {
            server.log.info(
              { queueId: payload.id },
              'New HITL queue item',
            )
          },
          onUpdated: (payload) => {
            server.log.info(
              { queueId: payload.id, status: payload.status },
              'HITL queue item updated',
            )
            // Release held connections on terminal decisions
            holdManager.handleNotify(payload)
          },
        })
      } catch (err) {
        server.log.error(
          { err },
          'Failed to subscribe to PG NOTIFY — HITL real-time updates disabled',
        )
      }
    })

    server.addHook('onClose', async () => {
      stopWorker?.()
      holdManager.cancelAll()
      await unsubscribe?.()
    })
  }

  return server
}
