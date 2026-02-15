import { eq, and, lt, inArray, sql } from 'drizzle-orm'
import { db } from '@thundergate/db'
import { hitlQueue, auditLogs } from '@thundergate/db'

/** Default escalation timeouts in minutes. */
const T0_TIMEOUT_MIN = Number(process.env.TG_T0_TIMEOUT ?? 5) // Operator claim window
const T1_TIMEOUT_MIN = Number(process.env.TG_T1_TIMEOUT ?? 15) // Admin escalation window

export interface QueueEntry {
  id: string
  auditLogId: string
  status: string
  escalationTier: number
  assignedTo: string | null
  operatorNotes: string | null
  expiresAt: Date
  claimedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
}

export interface QueueDecision {
  decision: 'APPROVED' | 'MODIFIED' | 'REJECTED'
  modifiedPayload?: unknown
  notes?: string
}

/**
 * Enqueue a flagged request into the HITL queue.
 * Returns the queue entry ID.
 */
export async function enqueue(auditLogId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + T0_TIMEOUT_MIN * 60_000)

  const [entry] = await db
    .insert(hitlQueue)
    .values({
      auditLogId,
      status: 'PENDING',
      escalationTier: 0,
      expiresAt,
    })
    .returning({ id: hitlQueue.id })

  return entry!.id
}

/**
 * Claim a queue item for an operator.
 * Uses optimistic locking: only succeeds if status is PENDING or ESCALATED.
 * Returns true if claimed, false if already taken.
 */
export async function claim(
  queueId: string,
  operatorId: string,
): Promise<boolean> {
  const result = await db
    .update(hitlQueue)
    .set({
      status: 'CLAIMED',
      assignedTo: operatorId,
      claimedAt: new Date(),
    })
    .where(
      and(
        eq(hitlQueue.id, queueId),
        inArray(hitlQueue.status, ['PENDING', 'ESCALATED']),
      ),
    )
    .returning({ id: hitlQueue.id })

  return result.length > 0
}

/**
 * Submit a decision on a claimed queue item.
 * Updates the queue status and the corresponding audit log entry.
 * Returns the updated queue entry or null if not found/not claimable.
 */
export async function decide(
  queueId: string,
  operatorId: string,
  decision: QueueDecision,
): Promise<QueueEntry | null> {
  const now = new Date()

  // Map decision to queue status
  const statusMap: Record<QueueDecision['decision'], 'APPROVED' | 'MODIFIED' | 'REJECTED'> = {
    APPROVED: 'APPROVED',
    MODIFIED: 'MODIFIED',
    REJECTED: 'REJECTED',
  }

  const [updated] = await db
    .update(hitlQueue)
    .set({
      status: statusMap[decision.decision],
      operatorNotes: decision.notes ?? null,
      resolvedAt: now,
    })
    .where(
      and(
        eq(hitlQueue.id, queueId),
        eq(hitlQueue.status, 'CLAIMED'),
        eq(hitlQueue.assignedTo, operatorId),
      ),
    )
    .returning()

  if (!updated) return null

  // Also update the audit log with human decision details
  const humanDecisionMap: Record<QueueDecision['decision'], 'APPROVED' | 'MODIFIED' | 'REJECTED'> = {
    APPROVED: 'APPROVED',
    MODIFIED: 'MODIFIED',
    REJECTED: 'REJECTED',
  }

  await db
    .update(auditLogs)
    .set({
      humanDecision: humanDecisionMap[decision.decision],
      operatorId,
      modifiedPayload: decision.modifiedPayload ?? null,
    })
    .where(eq(auditLogs.id, updated.auditLogId))

  return {
    id: updated.id,
    auditLogId: updated.auditLogId,
    status: updated.status!,
    escalationTier: updated.escalationTier,
    assignedTo: updated.assignedTo,
    operatorNotes: updated.operatorNotes,
    expiresAt: updated.expiresAt,
    claimedAt: updated.claimedAt,
    resolvedAt: updated.resolvedAt,
    createdAt: updated.createdAt,
  }
}

/**
 * Get all expired queue items that need escalation or auto-rejection.
 * - Tier 0 expired → escalate to ADMIN (Tier 1)
 * - Tier 1 expired → auto-reject
 */
export async function getExpired(): Promise<QueueEntry[]> {
  const now = new Date()

  const rows = await db
    .select()
    .from(hitlQueue)
    .where(
      and(
        lt(hitlQueue.expiresAt, now),
        inArray(hitlQueue.status, ['PENDING', 'ESCALATED']),
      ),
    )

  return rows.map((r) => ({
    id: r.id,
    auditLogId: r.auditLogId,
    status: r.status!,
    escalationTier: r.escalationTier,
    assignedTo: r.assignedTo,
    operatorNotes: r.operatorNotes,
    expiresAt: r.expiresAt,
    claimedAt: r.claimedAt,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
  }))
}

/**
 * Escalate a Tier 0 item to Tier 1 (ADMIN review).
 * Extends the expiry by T1_TIMEOUT_MIN.
 */
export async function escalate(queueId: string): Promise<boolean> {
  const newExpiry = new Date(Date.now() + T1_TIMEOUT_MIN * 60_000)

  const result = await db
    .update(hitlQueue)
    .set({
      status: 'ESCALATED',
      escalationTier: 1,
      expiresAt: newExpiry,
    })
    .where(
      and(
        eq(hitlQueue.id, queueId),
        eq(hitlQueue.escalationTier, 0),
      ),
    )
    .returning({ id: hitlQueue.id })

  return result.length > 0
}

/**
 * Auto-reject a Tier 1+ expired item.
 * Updates both queue and audit log.
 */
export async function autoReject(queueId: string, auditLogId: string): Promise<void> {
  const now = new Date()

  await db
    .update(hitlQueue)
    .set({
      status: 'EXPIRED',
      resolvedAt: now,
    })
    .where(eq(hitlQueue.id, queueId))

  await db
    .update(auditLogs)
    .set({
      humanDecision: 'EXPIRED',
    })
    .where(eq(auditLogs.id, auditLogId))
}

/**
 * Get a single queue item by ID with audit log context.
 */
export async function getQueueItem(
  queueId: string,
): Promise<(QueueEntry & { auditLog?: unknown }) | null> {
  const [row] = await db
    .select()
    .from(hitlQueue)
    .where(eq(hitlQueue.id, queueId))
    .limit(1)

  if (!row) return null

  // Fetch associated audit log
  const [audit] = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.id, row.auditLogId))
    .limit(1)

  return {
    id: row.id,
    auditLogId: row.auditLogId,
    status: row.status!,
    escalationTier: row.escalationTier,
    assignedTo: row.assignedTo,
    operatorNotes: row.operatorNotes,
    expiresAt: row.expiresAt,
    claimedAt: row.claimedAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    auditLog: audit ?? undefined,
  }
}

/**
 * List queue items with optional status filter.
 */
export async function listQueue(
  statusFilter?: string[],
  limit = 50,
  offset = 0,
): Promise<{ items: QueueEntry[]; total: number }> {
  const conditions = statusFilter?.length
    ? inArray(hitlQueue.status, statusFilter as Array<'PENDING' | 'CLAIMED' | 'APPROVED' | 'MODIFIED' | 'REJECTED' | 'ESCALATED' | 'EXPIRED'>)
    : undefined

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hitlQueue)
    .where(conditions)

  const rows = await db
    .select()
    .from(hitlQueue)
    .where(conditions)
    .orderBy(sql`${hitlQueue.createdAt} DESC`)
    .limit(limit)
    .offset(offset)

  return {
    items: rows.map((r) => ({
      id: r.id,
      auditLogId: r.auditLogId,
      status: r.status!,
      escalationTier: r.escalationTier,
      assignedTo: r.assignedTo,
      operatorNotes: r.operatorNotes,
      expiresAt: r.expiresAt,
      claimedAt: r.claimedAt,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
    })),
    total: countResult?.count ?? 0,
  }
}

/**
 * Get queue statistics: pending count, avg resolution time, etc.
 */
export async function getQueueStats(): Promise<{
  pending: number
  claimed: number
  escalated: number
  resolvedToday: number
  avgResolutionMs: number | null
}> {
  const [stats] = await db
    .select({
      pending: sql<number>`count(*) filter (where ${hitlQueue.status} = 'PENDING')::int`,
      claimed: sql<number>`count(*) filter (where ${hitlQueue.status} = 'CLAIMED')::int`,
      escalated: sql<number>`count(*) filter (where ${hitlQueue.status} = 'ESCALATED')::int`,
      resolvedToday: sql<number>`count(*) filter (where ${hitlQueue.resolvedAt} >= current_date)::int`,
      avgResolutionMs: sql<number>`avg(extract(epoch from (${hitlQueue.resolvedAt} - ${hitlQueue.createdAt})) * 1000) filter (where ${hitlQueue.resolvedAt} is not null)`,
    })
    .from(hitlQueue)

  return {
    pending: stats?.pending ?? 0,
    claimed: stats?.claimed ?? 0,
    escalated: stats?.escalated ?? 0,
    resolvedToday: stats?.resolvedToday ?? 0,
    avgResolutionMs: stats?.avgResolutionMs ?? null,
  }
}
