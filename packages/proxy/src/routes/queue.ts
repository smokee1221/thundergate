import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import {
  listQueue,
  getQueueItem,
  claim,
  decide,
  getQueueStats,
} from '../services/queue.js'
import { holdManager } from '../services/connection-hold.js'

/**
 * Queue API routes for operators (consumed by the dashboard).
 *
 * All routes are under /api/queue/* and will require
 * operator auth via NextAuth session cookie.
 */
export const queueRoute: FastifyPluginAsync = async (server) => {
  /**
   * GET /api/queue — list queue items with optional status filter
   */
  server.get('/api/queue', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as {
      status?: string
      limit?: string
      offset?: string
    }

    const statusFilter = query.status?.split(',').filter(Boolean)
    const limit = Math.min(Number(query.limit ?? 50), 200)
    const offset = Number(query.offset ?? 0)

    const result = await listQueue(statusFilter, limit, offset)

    reply.send({
      items: result.items,
      total: result.total,
      limit,
      offset,
    })
  })

  /**
   * GET /api/queue/stats — queue statistics
   */
  server.get('/api/queue/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const stats = await getQueueStats()
    reply.send(stats)
  })

  /**
   * GET /api/queue/:id — single queue item with audit log context
   */
  server.get('/api/queue/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const item = await getQueueItem(id)

    if (!item) {
      reply.code(404).send({
        error: {
          code: 'QUEUE_ITEM_NOT_FOUND',
          message: 'Queue item not found',
        },
      })
      return
    }

    reply.send(item)
  })

  /**
   * POST /api/queue/:id/claim — claim a queue item
   */
  server.post('/api/queue/:id/claim', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { operatorId: string } | undefined

    if (!body?.operatorId) {
      reply.code(400).send({
        error: {
          code: 'MISSING_OPERATOR_ID',
          message: 'operatorId is required',
        },
      })
      return
    }

    const claimed = await claim(id, body.operatorId)

    if (!claimed) {
      reply.code(409).send({
        error: {
          code: 'CLAIM_FAILED',
          message: 'Item is no longer available for claiming (already claimed or resolved)',
        },
      })
      return
    }

    reply.code(200).send({ status: 'claimed', queueId: id })
  })

  /**
   * POST /api/queue/:id/decide — submit a decision on a claimed item
   */
  server.post('/api/queue/:id/decide', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string }
    const body = request.body as {
      operatorId: string
      decision: 'APPROVED' | 'MODIFIED' | 'REJECTED'
      modifiedPayload?: unknown
      notes?: string
    } | undefined

    if (!body?.operatorId || !body?.decision) {
      reply.code(400).send({
        error: {
          code: 'INVALID_DECISION',
          message: 'operatorId and decision (APPROVED|MODIFIED|REJECTED) are required',
        },
      })
      return
    }

    const validDecisions = ['APPROVED', 'MODIFIED', 'REJECTED']
    if (!validDecisions.includes(body.decision)) {
      reply.code(400).send({
        error: {
          code: 'INVALID_DECISION',
          message: `decision must be one of: ${validDecisions.join(', ')}`,
        },
      })
      return
    }

    const result = await decide(id, body.operatorId, {
      decision: body.decision,
      modifiedPayload: body.modifiedPayload,
      notes: body.notes,
    })

    if (!result) {
      reply.code(409).send({
        error: {
          code: 'DECIDE_FAILED',
          message: 'Item is not in CLAIMED state or not assigned to this operator',
        },
      })
      return
    }

    // Release the held connection (if any agent is waiting)
    holdManager.release(id, {
      status: body.decision,
      modifiedPayload: body.modifiedPayload,
    })

    reply.code(200).send({
      status: 'decided',
      queueId: id,
      decision: body.decision,
      resolvedAt: result.resolvedAt,
    })
  })
}
