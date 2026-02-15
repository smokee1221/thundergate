import type { FastifyPluginAsync, FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'

/**
 * Global error handler that sanitizes error messages in production.
 * Prevents stack traces and internal details from leaking to clients.
 */
const errorHandler: FastifyPluginAsync = async (server) => {
  const isProd = process.env.NODE_ENV === 'production'

  server.setErrorHandler(
    (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
      const statusCode = error.statusCode ?? 500

      // Always log the full error server-side
      request.log.error(
        { err: error, statusCode },
        'Request error',
      )

      // Rate limit errors
      if (statusCode === 429) {
        reply.code(429).send({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests. Please slow down.',
          },
        })
        return
      }

      // Validation errors (Fastify schema validation)
      if (statusCode === 400 && error.validation) {
        reply.code(400).send({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: isProd ? undefined : error.validation,
          },
        })
        return
      }

      // Client errors (4xx)
      if (statusCode >= 400 && statusCode < 500) {
        reply.code(statusCode).send({
          error: {
            code: error.code ?? 'CLIENT_ERROR',
            message: error.message,
          },
        })
        return
      }

      // Server errors (5xx) — sanitize in production
      reply.code(statusCode).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: isProd
            ? 'An internal error occurred'
            : error.message,
          stack: isProd ? undefined : error.stack,
        },
      })
    },
  )
}

export default fp(errorHandler, { name: 'error-handler' })
