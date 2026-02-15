import postgres from 'postgres'

export type HitlNewPayload = {
  id: string
  audit_log_id: string
  status: string
  escalation_tier: number
  expires_at: string
}

export type HitlUpdatedPayload = {
  id: string
  audit_log_id: string
  status: string
  escalation_tier: number
  assigned_to: string | null
  resolved_at: string | null
}

export type HitlEventHandler = {
  onNew?: (payload: HitlNewPayload) => void
  onUpdated?: (payload: HitlUpdatedPayload) => void
}

/**
 * Subscribes to PostgreSQL LISTEN/NOTIFY channels for HITL queue events.
 * Uses a dedicated connection (separate from the query pool).
 * Returns a cleanup function to unsubscribe.
 */
export async function subscribeHitlEvents(
  handlers: HitlEventHandler,
): Promise<() => Promise<void>> {
  const connectionString =
    process.env.TG_DATABASE_URL ??
    'postgresql://thundergate:thundergate@localhost:5432/thundergate'

  // Dedicated connection for LISTEN — postgres.js supports it natively
  const listener = postgres(connectionString, {
    max: 1, // Single connection for LISTEN
  })

  await listener.listen('hitl_new', (payload) => {
    try {
      const data = JSON.parse(payload) as HitlNewPayload
      handlers.onNew?.(data)
    } catch {
      // Ignore malformed payloads
    }
  })

  await listener.listen('hitl_updated', (payload) => {
    try {
      const data = JSON.parse(payload) as HitlUpdatedPayload
      handlers.onUpdated?.(data)
    } catch {
      // Ignore malformed payloads
    }
  })

  // Return cleanup function
  return async () => {
    await listener.end()
  }
}
