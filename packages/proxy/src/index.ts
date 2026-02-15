import { validateEnv } from './env.js'
import { buildServer } from './server.js'

// Validate environment variables at startup (fail fast)
const env = validateEnv()

async function main() {
  const server = await buildServer()

  // ── Graceful shutdown ─────────────────────────────────
  const SHUTDOWN_TIMEOUT_MS = 15_000 // 15 seconds max for graceful shutdown

  async function shutdown(signal: string) {
    server.log.info({ signal }, 'Received shutdown signal — draining connections…')

    // Force-exit safety net in case close() hangs
    const forceTimer = setTimeout(() => {
      server.log.error('Graceful shutdown timed out — forcing exit')
      process.exit(1)
    }, SHUTDOWN_TIMEOUT_MS)
    forceTimer.unref() // Don't keep process alive just for the timer

    try {
      await server.close() // Triggers onClose hooks (stops workers, PG listeners, held connections)
      server.log.info('Graceful shutdown complete')
      process.exit(0)
    } catch (err) {
      server.log.error({ err }, 'Error during graceful shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  // ── Start listening ───────────────────────────────────
  try {
    await server.listen({ port: env.TG_PROXY_PORT, host: env.TG_PROXY_HOST })
    server.log.info(
      `Proxy interceptor running on ${env.TG_PROXY_HOST}:${env.TG_PROXY_PORT} [${env.NODE_ENV}]`,
    )
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }
}

main()
