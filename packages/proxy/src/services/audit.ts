import { createHash } from 'crypto'
import { desc } from 'drizzle-orm'
import { db } from '@thundergate/db'
import { auditLogs } from '@thundergate/db'
import type { RuleAction } from '@thundergate/engine'

export interface AuditEntry {
  agentId: string
  ruleId?: string
  requestMethod: string
  requestUrl: string
  requestHeaders: Record<string, unknown>
  requestPayload: unknown
  riskScore: number
  engineDecision: RuleAction
  humanDecision?: 'APPROVED' | 'MODIFIED' | 'REJECTED' | 'EXPIRED'
  operatorId?: string
  modifiedPayload?: unknown
  finalPayload: unknown
  responseStatus?: number
  responseBody?: unknown
  latencyMs: number
}

/**
 * Computes the SHA-256 hash for an audit log entry.
 * Includes the previous hash to form a chain.
 */
function computeEntryHash(entry: AuditEntry, prevHash: string): string {
  const data = [
    entry.agentId,
    entry.requestMethod,
    entry.requestUrl,
    JSON.stringify(entry.requestPayload),
    String(entry.riskScore),
    entry.engineDecision,
    JSON.stringify(entry.finalPayload),
    prevHash,
  ].join('|')

  return createHash('sha256').update(data).digest('hex')
}

/**
 * Writes an immutable, hash-chained audit log entry.
 * Async — never blocks the proxy response path.
 * Returns the created audit log ID.
 */
export async function writeAuditLog(entry: AuditEntry): Promise<string> {
  // Fetch previous hash for chain continuity
  const [lastLog] = await db
    .select({ entryHash: auditLogs.entryHash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.sequenceNumber))
    .limit(1)

  const prevHash = lastLog?.entryHash ?? 'genesis'
  const entryHash = computeEntryHash(entry, prevHash)

  const [inserted] = await db
    .insert(auditLogs)
    .values({
      agentId: entry.agentId,
      ruleId: entry.ruleId ?? null,
      requestMethod: entry.requestMethod,
      requestUrl: entry.requestUrl,
      requestHeaders: entry.requestHeaders,
      requestPayload: entry.requestPayload ?? null,
      riskScore: entry.riskScore,
      engineDecision: entry.engineDecision as 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY',
      humanDecision: entry.humanDecision ?? null,
      operatorId: entry.operatorId ?? null,
      modifiedPayload: entry.modifiedPayload ?? null,
      finalPayload: entry.finalPayload,
      responseStatus: entry.responseStatus ?? null,
      responseBody: entry.responseBody ?? null,
      latencyMs: entry.latencyMs,
      prevHash,
      entryHash,
    })
    .returning({ id: auditLogs.id })

  return inserted!.id
}
