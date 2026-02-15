import type { FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Request ID plugin — attaches a unique correlation ID to every request.
 *
 * - Uses the incoming X-Request-Id header if provided (pass-through from agent)
 * - Otherwise generates a new UUID v4
 * - Sets the X-Request-Id response header for the caller
 * - Available as `request.id` for structured logging (Fastify's built-in property)
 */
const requestIdPlugin: FastifyPluginAsync = async (server) => {
  // Use X-Request-Id from the client, or generate a fresh one
  server.addHook('onRequest', async (request, reply) => {
    const incomingId = request.headers['x-request-id']
    if (typeof incomingId === 'string' && incomingId.length > 0) {
      // Override Fastify's auto-generated ID with the client-supplied one
      ;(request as { id: string }).id = incomingId
    }

    // Always echo back the request ID so the caller can correlate
    void reply.header('x-request-id', request.id)
  })
}

export default fp(requestIdPlugin, { name: 'request-id' })
