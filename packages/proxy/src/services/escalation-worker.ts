import type { FastifyBaseLogger } from 'fastify'
import { getExpired, escalate, autoReject } from './queue.js'

const POLL_INTERVAL_MS = Number(process.env.TG_ESCALATION_POLL_MS ?? 30_000) // 30s

/**
 * Background escalation worker.
 *
 * Runs on a setInterval inside the proxy process.
 * - Polls for expired HITL queue items every 30 seconds
 * - Tier 0 expired → escalate to ADMIN (Tier 1)
 * - Tier 1+ expired → auto-reject with EXPIRED decision
 */
export function startEscalationWorker(log: FastifyBaseLogger): () => void {
  async function tick() {
    try {
      const expired = await getExpired()
      if (expired.length === 0) return

      log.info({ count: expired.length }, 'Processing expired HITL items')

      for (const item of expired) {
        try {
          if (item.escalationTier === 0) {
            // Tier 0 → Escalate to Admin
            const escalated = await escalate(item.id)
            if (escalated) {
              log.info(
                { queueId: item.id },
                'Escalated HITL item to Tier 1 (ADMIN)',
              )
            }
          } else {
            // Tier 1+ → Auto-reject
            await autoReject(item.id, item.auditLogId)
            log.info(
              { queueId: item.id },
              'Auto-rejected expired HITL item',
            )
          }
        } catch (err) {
          log.error(
            { queueId: item.id, err },
            'Failed to process expired HITL item',
          )
        }
      }
    } catch (err) {
      log.error({ err }, 'Escalation worker tick failed')
    }
  }

  const interval = setInterval(() => void tick(), POLL_INTERVAL_MS)

  // Run once immediately at startup
  void tick()

  log.info(
    { pollIntervalMs: POLL_INTERVAL_MS },
    'Escalation worker started',
  )

  // Return cleanup function
  return () => {
    clearInterval(interval)
    log.info('Escalation worker stopped')
  }
}
