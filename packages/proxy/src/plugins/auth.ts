import { createHash } from 'crypto'
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { eq } from 'drizzle-orm'
import { db } from '@thundergate/db'
import { agents } from '@thundergate/db'

declare module 'fastify' {
  interface FastifyRequest {
    agentId?: string
    agentName?: string
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Auth plugin: validates X-Agent-Key header on /proxy/* routes.
 * Hashes the provided key and looks it up in the agents table.
 * Attaches agentId and agentName to the request for downstream use.
 */
const authPlugin: FastifyPluginAsync = async (server) => {
  server.decorateRequest('agentId', undefined)
  server.decorateRequest('agentName', undefined)

  server.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Skip auth for non-proxy routes (health, etc.)
      if (!request.url.startsWith('/proxy')) {
        return
      }

      const apiKey = request.headers['x-agent-key']
      if (!apiKey || typeof apiKey !== 'string') {
        reply.code(401).send({
          error: {
            code: 'MISSING_API_KEY',
            message: 'X-Agent-Key header is required',
          },
        })
        return
      }

      const keyHash = sha256(apiKey)

      const [agent] = await db
        .select({ id: agents.id, name: agents.name, isActive: agents.isActive })
        .from(agents)
        .where(eq(agents.apiKeyHash, keyHash))
        .limit(1)

      if (!agent) {
        reply.code(401).send({
          error: {
            code: 'INVALID_API_KEY',
            message: 'Invalid agent API key',
          },
        })
        return
      }

      if (!agent.isActive) {
        reply.code(403).send({
          error: {
            code: 'AGENT_INACTIVE',
            message: 'Agent is deactivated',
          },
        })
        return
      }

      request.agentId = agent.id
      request.agentName = agent.name
    },
  )
}

export default fp(authPlugin, { name: 'auth' })
