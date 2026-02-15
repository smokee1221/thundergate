import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server.js'
import type { FastifyInstance } from 'fastify'

describe('GET /health', () => {
  let server: FastifyInstance

  beforeAll(async () => {
    server = await buildServer({
      disableAuth: true,
      disableRateLimit: true,
      disableHitlServices: true,
      logLevel: 'error',
    })
  })

  afterAll(async () => {
    await server.close()
  })

  it('returns status ok', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/health',
    })

    expect(response.statusCode).toBe(200)

    const body = JSON.parse(response.payload)
    expect(body.status).toBe('ok')
    expect(body.service).toBe('thundergate-proxy')
    expect(body).toHaveProperty('timestamp')
    expect(body).toHaveProperty('uptime')
    expect(typeof body.uptime).toBe('number')
  })
})
