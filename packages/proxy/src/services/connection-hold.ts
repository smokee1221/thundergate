import { EventEmitter } from 'events'
import type { HitlUpdatedPayload } from './pg-notify.js'

/**
 * Manages held HTTP connections waiting for HITL decisions.
 *
 * When a request is flagged (FLAG_FOR_REVIEW), the proxy holds the connection
 * open instead of immediately returning 202. It waits for:
 * - An operator decision (APPROVED/MODIFIED/REJECTED) via PG NOTIFY
 * - A timeout (max hold time = T1+T2 window, default 20min)
 *
 * On resolution, the held connection is released with the appropriate response.
 */

export interface HoldResolution {
  status: string
  modifiedPayload?: unknown
  operatorNotes?: string | null
}

interface PendingConnection {
  resolve: (resolution: HoldResolution) => void
  timer: ReturnType<typeof setTimeout>
}

const DEFAULT_MAX_HOLD_MS = Number(process.env.TG_MAX_HOLD_MS ?? 20 * 60_000) // 20 minutes

class ConnectionHoldManager extends EventEmitter {
  private pending = new Map<string, PendingConnection>()

  /**
   * Hold a connection for a queue item.
   * Returns a Promise that resolves when:
   * - An operator decision arrives (via `release`)
   * - The hold timeout expires
   */
  hold(queueId: string, maxHoldMs = DEFAULT_MAX_HOLD_MS): Promise<HoldResolution> {
    return new Promise<HoldResolution>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(queueId)
        resolve({ status: 'TIMEOUT' })
      }, maxHoldMs)

      this.pending.set(queueId, { resolve, timer })
    })
  }

  /**
   * Release a held connection with a decision.
   * Called when a PG NOTIFY arrives with a terminal status.
   */
  release(queueId: string, resolution: HoldResolution): boolean {
    const conn = this.pending.get(queueId)
    if (!conn) return false

    clearTimeout(conn.timer)
    this.pending.delete(queueId)
    conn.resolve(resolution)
    return true
  }

  /**
   * Handle a PG NOTIFY hitl_updated event.
   * If the status is terminal, release the held connection.
   */
  handleNotify(payload: HitlUpdatedPayload): void {
    const terminalStatuses = ['APPROVED', 'MODIFIED', 'REJECTED', 'EXPIRED']
    if (!terminalStatuses.includes(payload.status)) return

    this.release(payload.id, {
      status: payload.status,
    })
  }

  /** Number of currently held connections. */
  get activeCount(): number {
    return this.pending.size
  }

  /** Cancel all held connections (for graceful shutdown). */
  cancelAll(): void {
    for (const [, conn] of this.pending) {
      clearTimeout(conn.timer)
      conn.resolve({ status: 'SHUTDOWN' })
    }
    this.pending.clear()
  }
}

/** Singleton hold manager — shared across the proxy process. */
export const holdManager = new ConnectionHoldManager()
