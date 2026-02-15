import { sql, eq, gte, lte, desc, and, inArray, asc } from 'drizzle-orm'
import { createHash, randomBytes } from 'crypto'
import { db, auditLogs, hitlQueue, rules, operators, agents, apiTargets } from '@thundergate/db'

/**
 * Dashboard overview metrics.
 * Fetched server-side via React Server Components.
 */
export async function getDashboardMetrics() {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      allowed: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'ALLOW')::int`,
      blocked: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'BLOCK')::int`,
      flagged: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'FLAG_FOR_REVIEW')::int`,
    })
    .from(auditLogs)
    .where(gte(auditLogs.createdAt, since24h))

  return {
    totalRequests: counts?.total ?? 0,
    allowed: counts?.allowed ?? 0,
    blocked: counts?.blocked ?? 0,
    flagged: counts?.flagged ?? 0,
  }
}

/**
 * Pending queue count for the sidebar badge.
 */
export async function getPendingQueueCount(): Promise<number> {
  const [result] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hitlQueue)
    .where(
      sql`${hitlQueue.status} IN ('PENDING', 'ESCALATED')`,
    )

  return result?.count ?? 0
}

/**
 * Recent audit log entries for the activity feed.
 */
export async function getRecentActivity(limit = 20) {
  const rows = await db
    .select({
      id: auditLogs.id,
      agentId: auditLogs.agentId,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      humanDecision: auditLogs.humanDecision,
      latencyMs: auditLogs.latencyMs,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)

  return rows
}

/**
 * Top triggered rules (by count of audit log matches).
 */
export async function getTopRules(limit = 5) {
  const rows = await db
    .select({
      ruleId: auditLogs.ruleId,
      ruleName: rules.name,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogs)
    .innerJoin(rules, eq(auditLogs.ruleId, rules.id))
    .groupBy(auditLogs.ruleId, rules.name)
    .orderBy(sql`count(*) DESC`)
    .limit(limit)

  return rows
}

// ─── HITL Queue data functions ─────────────────────────────

export interface QueueListItem {
  id: string
  auditLogId: string
  status: string
  escalationTier: number
  assignedTo: string | null
  assignedName: string | null
  operatorNotes: string | null
  expiresAt: Date
  claimedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  // Joined from audit_logs
  agentId: string
  agentName: string | null
  requestMethod: string
  requestUrl: string
  riskScore: number
  engineDecision: string
}

/**
 * List HITL queue items with optional status filter and audit log context.
 */
export async function getQueueItems(
  statusFilter?: string[],
  limit = 50,
  offset = 0,
): Promise<{ items: QueueListItem[]; total: number }> {
  const conditions = statusFilter?.length
    ? inArray(
        hitlQueue.status,
        statusFilter as Array<
          'PENDING' | 'CLAIMED' | 'APPROVED' | 'MODIFIED' | 'REJECTED' | 'ESCALATED' | 'EXPIRED'
        >,
      )
    : undefined

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(hitlQueue)
    .where(conditions)

  const rows = await db
    .select({
      id: hitlQueue.id,
      auditLogId: hitlQueue.auditLogId,
      status: hitlQueue.status,
      escalationTier: hitlQueue.escalationTier,
      assignedTo: hitlQueue.assignedTo,
      assignedName: operators.name,
      operatorNotes: hitlQueue.operatorNotes,
      expiresAt: hitlQueue.expiresAt,
      claimedAt: hitlQueue.claimedAt,
      resolvedAt: hitlQueue.resolvedAt,
      createdAt: hitlQueue.createdAt,
      agentId: auditLogs.agentId,
      agentName: agents.name,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
    })
    .from(hitlQueue)
    .innerJoin(auditLogs, eq(hitlQueue.auditLogId, auditLogs.id))
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .leftJoin(operators, eq(hitlQueue.assignedTo, operators.id))
    .where(conditions)
    .orderBy(desc(hitlQueue.createdAt))
    .limit(limit)
    .offset(offset)

  return {
    items: rows.map((r) => ({
      id: r.id,
      auditLogId: r.auditLogId,
      status: r.status!,
      escalationTier: r.escalationTier,
      assignedTo: r.assignedTo,
      assignedName: r.assignedName,
      operatorNotes: r.operatorNotes,
      expiresAt: r.expiresAt,
      claimedAt: r.claimedAt,
      resolvedAt: r.resolvedAt,
      createdAt: r.createdAt,
      agentId: r.agentId,
      agentName: r.agentName,
      requestMethod: r.requestMethod,
      requestUrl: r.requestUrl,
      riskScore: r.riskScore,
      engineDecision: r.engineDecision!,
    })),
    total: countResult?.count ?? 0,
  }
}

/**
 * Queue statistics for the queue page header.
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

export interface QueueItemDetail {
  id: string
  auditLogId: string
  status: string
  escalationTier: number
  assignedTo: string | null
  assignedName: string | null
  operatorNotes: string | null
  expiresAt: Date
  claimedAt: Date | null
  resolvedAt: Date | null
  createdAt: Date
  // Audit log context
  agentId: string
  agentName: string | null
  requestMethod: string
  requestUrl: string
  requestHeaders: unknown
  requestPayload: unknown
  riskScore: number
  engineDecision: string
  humanDecision: string | null
  ruleId: string | null
  ruleName: string | null
  ruleSeverity: string | null
  ruleDescription: string | null
  latencyMs: number
}

/**
 * Get a single queue item with full audit log and rule context.
 */
export async function getQueueItemDetail(
  queueId: string,
): Promise<QueueItemDetail | null> {
  const [row] = await db
    .select({
      id: hitlQueue.id,
      auditLogId: hitlQueue.auditLogId,
      status: hitlQueue.status,
      escalationTier: hitlQueue.escalationTier,
      assignedTo: hitlQueue.assignedTo,
      assignedName: operators.name,
      operatorNotes: hitlQueue.operatorNotes,
      expiresAt: hitlQueue.expiresAt,
      claimedAt: hitlQueue.claimedAt,
      resolvedAt: hitlQueue.resolvedAt,
      createdAt: hitlQueue.createdAt,
      agentId: auditLogs.agentId,
      agentName: agents.name,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      requestHeaders: auditLogs.requestHeaders,
      requestPayload: auditLogs.requestPayload,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      humanDecision: auditLogs.humanDecision,
      ruleId: auditLogs.ruleId,
      ruleName: rules.name,
      ruleSeverity: rules.severity,
      ruleDescription: rules.description,
      latencyMs: auditLogs.latencyMs,
    })
    .from(hitlQueue)
    .innerJoin(auditLogs, eq(hitlQueue.auditLogId, auditLogs.id))
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .leftJoin(operators, eq(hitlQueue.assignedTo, operators.id))
    .leftJoin(rules, eq(auditLogs.ruleId, rules.id))
    .where(eq(hitlQueue.id, queueId))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    auditLogId: row.auditLogId,
    status: row.status!,
    escalationTier: row.escalationTier,
    assignedTo: row.assignedTo,
    assignedName: row.assignedName,
    operatorNotes: row.operatorNotes,
    expiresAt: row.expiresAt,
    claimedAt: row.claimedAt,
    resolvedAt: row.resolvedAt,
    createdAt: row.createdAt,
    agentId: row.agentId,
    agentName: row.agentName,
    requestMethod: row.requestMethod,
    requestUrl: row.requestUrl,
    requestHeaders: row.requestHeaders,
    requestPayload: row.requestPayload,
    riskScore: row.riskScore,
    engineDecision: row.engineDecision!,
    humanDecision: row.humanDecision,
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    ruleSeverity: row.ruleSeverity,
    ruleDescription: row.ruleDescription,
    latencyMs: row.latencyMs,
  }
}

/**
 * Claim a queue item for an operator.
 * Delegates to the DB directly (server-side only).
 */
export async function claimQueueItem(
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
 * Updates both queue and audit log.
 */
export async function decideQueueItem(
  queueId: string,
  operatorId: string,
  decision: 'APPROVED' | 'MODIFIED' | 'REJECTED',
  notes?: string,
  modifiedPayload?: unknown,
): Promise<boolean> {
  const now = new Date()

  const [updated] = await db
    .update(hitlQueue)
    .set({
      status: decision,
      operatorNotes: notes ?? null,
      resolvedAt: now,
    })
    .where(
      and(
        eq(hitlQueue.id, queueId),
        eq(hitlQueue.status, 'CLAIMED'),
        eq(hitlQueue.assignedTo, operatorId),
      ),
    )
    .returning({ auditLogId: hitlQueue.auditLogId })

  if (!updated) return false

  // Update the audit log with human decision
  await db
    .update(auditLogs)
    .set({
      humanDecision: decision === 'APPROVED' ? 'APPROVED' : decision === 'MODIFIED' ? 'MODIFIED' : 'REJECTED',
      operatorId,
      modifiedPayload: modifiedPayload ?? null,
    })
    .where(eq(auditLogs.id, updated.auditLogId))

  return true
}

// ─── Rule management data functions ────────────────────────

export interface RuleListItem {
  id: string
  name: string
  description: string | null
  priority: number
  action: string
  severity: string
  enabled: boolean
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
  hitCount: number
  lastTriggeredAt: Date | null
}

/**
 * List all rules with hit counts and last triggered time.
 */
export async function getRules(filters?: {
  action?: string
  severity?: string
  enabled?: boolean
}): Promise<RuleListItem[]> {
  // Build conditions array
  const conditions = []
  if (filters?.action) {
    conditions.push(eq(rules.action, filters.action as 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY'))
  }
  if (filters?.severity) {
    conditions.push(eq(rules.severity, filters.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'))
  }
  if (filters?.enabled !== undefined) {
    conditions.push(eq(rules.enabled, filters.enabled))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      id: rules.id,
      name: rules.name,
      description: rules.description,
      priority: rules.priority,
      action: rules.action,
      severity: rules.severity,
      enabled: rules.enabled,
      createdBy: rules.createdBy,
      createdAt: rules.createdAt,
      updatedAt: rules.updatedAt,
      hitCount: sql<number>`(
        SELECT count(*)::int FROM audit_logs WHERE audit_logs.rule_id = ${rules.id}
      )`,
      lastTriggeredAt: sql<Date | null>`(
        SELECT max(audit_logs.created_at) FROM audit_logs WHERE audit_logs.rule_id = ${rules.id}
      )`,
    })
    .from(rules)
    .where(whereClause)
    .orderBy(asc(rules.priority))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    priority: r.priority,
    action: r.action!,
    severity: r.severity!,
    enabled: r.enabled,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    hitCount: r.hitCount,
    lastTriggeredAt: r.lastTriggeredAt,
  }))
}

export interface RuleDetail {
  id: string
  name: string
  description: string | null
  priority: number
  conditions: unknown
  action: string
  severity: string
  enabled: boolean
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Get a single rule by ID.
 */
export async function getRuleById(ruleId: string): Promise<RuleDetail | null> {
  const [row] = await db
    .select()
    .from(rules)
    .where(eq(rules.id, ruleId))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    priority: row.priority,
    conditions: row.conditions,
    action: row.action!,
    severity: row.severity!,
    enabled: row.enabled,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Create a new rule.
 */
export async function createRule(data: {
  name: string
  description?: string
  priority: number
  conditions: unknown
  action: 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  enabled: boolean
  createdBy?: string
}): Promise<string> {
  const [row] = await db
    .insert(rules)
    .values({
      name: data.name,
      description: data.description ?? null,
      priority: data.priority,
      conditions: data.conditions,
      action: data.action,
      severity: data.severity,
      enabled: data.enabled,
      createdBy: data.createdBy ?? null,
    })
    .returning({ id: rules.id })

  return row!.id
}

/**
 * Update an existing rule.
 */
export async function updateRule(
  ruleId: string,
  data: {
    name?: string
    description?: string | null
    priority?: number
    conditions?: unknown
    action?: 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY'
    severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    enabled?: boolean
  },
): Promise<boolean> {
  const result = await db
    .update(rules)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(rules.id, ruleId))
    .returning({ id: rules.id })

  return result.length > 0
}

/**
 * Toggle a rule's enabled status.
 */
export async function toggleRule(ruleId: string, enabled: boolean): Promise<boolean> {
  const result = await db
    .update(rules)
    .set({ enabled, updatedAt: new Date() })
    .where(eq(rules.id, ruleId))
    .returning({ id: rules.id })

  return result.length > 0
}

// ─── Audit Log data functions ──────────────────────────────

export interface AuditLogListItem {
  id: string
  sequenceNumber: number
  agentId: string
  agentName: string | null
  ruleId: string | null
  ruleName: string | null
  requestMethod: string
  requestUrl: string
  riskScore: number
  engineDecision: string
  humanDecision: string | null
  latencyMs: number
  createdAt: Date
}

/**
 * List audit logs with filters, search, and pagination.
 */
export async function getAuditLogs(filters?: {
  search?: string
  agentId?: string
  decision?: string
  ruleId?: string
  riskScoreMin?: number
  riskScoreMax?: number
  dateFrom?: Date
  dateTo?: Date
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  limit?: number
  offset?: number
}): Promise<{ items: AuditLogListItem[]; total: number }> {
  const limit = Math.min(filters?.limit ?? 50, 200)
  const offset = filters?.offset ?? 0

  const conditions = []

  if (filters?.search) {
    conditions.push(
      sql`(${auditLogs.requestUrl} ILIKE ${'%' + filters.search + '%'} OR ${auditLogs.requestPayload}::text ILIKE ${'%' + filters.search + '%'})`,
    )
  }
  if (filters?.agentId) {
    conditions.push(eq(auditLogs.agentId, filters.agentId))
  }
  if (filters?.decision) {
    conditions.push(eq(auditLogs.engineDecision, filters.decision as 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY'))
  }
  if (filters?.ruleId) {
    conditions.push(eq(auditLogs.ruleId, filters.ruleId))
  }
  if (filters?.riskScoreMin !== undefined) {
    conditions.push(gte(auditLogs.riskScore, filters.riskScoreMin))
  }
  if (filters?.riskScoreMax !== undefined) {
    conditions.push(lte(auditLogs.riskScore, filters.riskScoreMax))
  }
  if (filters?.dateFrom) {
    conditions.push(gte(auditLogs.createdAt, filters.dateFrom))
  }
  if (filters?.dateTo) {
    conditions.push(lte(auditLogs.createdAt, filters.dateTo))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Sort
  const sortColumn = filters?.sortBy === 'riskScore' ? auditLogs.riskScore
    : filters?.sortBy === 'latencyMs' ? auditLogs.latencyMs
    : auditLogs.createdAt
  const sortOrder = filters?.sortDir === 'asc' ? asc(sortColumn) : desc(sortColumn)

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(whereClause)

  const rows = await db
    .select({
      id: auditLogs.id,
      sequenceNumber: auditLogs.sequenceNumber,
      agentId: auditLogs.agentId,
      agentName: agents.name,
      ruleId: auditLogs.ruleId,
      ruleName: rules.name,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      humanDecision: auditLogs.humanDecision,
      latencyMs: auditLogs.latencyMs,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .leftJoin(rules, eq(auditLogs.ruleId, rules.id))
    .where(whereClause)
    .orderBy(sortOrder)
    .limit(limit)
    .offset(offset)

  return {
    items: rows.map((r) => ({
      id: r.id,
      sequenceNumber: r.sequenceNumber,
      agentId: r.agentId,
      agentName: r.agentName,
      ruleId: r.ruleId,
      ruleName: r.ruleName,
      requestMethod: r.requestMethod,
      requestUrl: r.requestUrl,
      riskScore: r.riskScore,
      engineDecision: r.engineDecision!,
      humanDecision: r.humanDecision,
      latencyMs: r.latencyMs,
      createdAt: r.createdAt,
    })),
    total: countResult?.count ?? 0,
  }
}

export interface AuditLogDetail {
  id: string
  sequenceNumber: number
  agentId: string
  agentName: string | null
  ruleId: string | null
  ruleName: string | null
  ruleSeverity: string | null
  ruleDescription: string | null
  requestMethod: string
  requestUrl: string
  requestHeaders: unknown
  requestPayload: unknown
  riskScore: number
  engineDecision: string
  humanDecision: string | null
  operatorId: string | null
  operatorName: string | null
  modifiedPayload: unknown
  finalPayload: unknown
  responseStatus: number | null
  responseBody: unknown
  latencyMs: number
  prevHash: string
  entryHash: string
  createdAt: Date
}

/**
 * Get a single audit log entry with full context.
 */
export async function getAuditLogDetail(logId: string): Promise<AuditLogDetail | null> {
  const [row] = await db
    .select({
      id: auditLogs.id,
      sequenceNumber: auditLogs.sequenceNumber,
      agentId: auditLogs.agentId,
      agentName: agents.name,
      ruleId: auditLogs.ruleId,
      ruleName: rules.name,
      ruleSeverity: rules.severity,
      ruleDescription: rules.description,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      requestHeaders: auditLogs.requestHeaders,
      requestPayload: auditLogs.requestPayload,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      humanDecision: auditLogs.humanDecision,
      operatorId: auditLogs.operatorId,
      operatorName: operators.name,
      modifiedPayload: auditLogs.modifiedPayload,
      finalPayload: auditLogs.finalPayload,
      responseStatus: auditLogs.responseStatus,
      responseBody: auditLogs.responseBody,
      latencyMs: auditLogs.latencyMs,
      prevHash: auditLogs.prevHash,
      entryHash: auditLogs.entryHash,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .leftJoin(rules, eq(auditLogs.ruleId, rules.id))
    .leftJoin(operators, eq(auditLogs.operatorId, operators.id))
    .where(eq(auditLogs.id, logId))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    sequenceNumber: row.sequenceNumber,
    agentId: row.agentId,
    agentName: row.agentName,
    ruleId: row.ruleId,
    ruleName: row.ruleName,
    ruleSeverity: row.ruleSeverity,
    ruleDescription: row.ruleDescription,
    requestMethod: row.requestMethod,
    requestUrl: row.requestUrl,
    requestHeaders: row.requestHeaders,
    requestPayload: row.requestPayload,
    riskScore: row.riskScore,
    engineDecision: row.engineDecision!,
    humanDecision: row.humanDecision,
    operatorId: row.operatorId,
    operatorName: row.operatorName,
    modifiedPayload: row.modifiedPayload,
    finalPayload: row.finalPayload,
    responseStatus: row.responseStatus,
    responseBody: row.responseBody,
    latencyMs: row.latencyMs,
    prevHash: row.prevHash,
    entryHash: row.entryHash,
    createdAt: row.createdAt,
  }
}

/**
 * Get audit logs for export (all columns, no pagination limit).
 */
export async function getAuditLogsForExport(filters?: {
  dateFrom?: Date
  dateTo?: Date
  decision?: string
}): Promise<AuditLogDetail[]> {
  const conditions = []
  if (filters?.dateFrom) conditions.push(gte(auditLogs.createdAt, filters.dateFrom))
  if (filters?.dateTo) conditions.push(lte(auditLogs.createdAt, filters.dateTo))
  if (filters?.decision) {
    conditions.push(eq(auditLogs.engineDecision, filters.decision as 'ALLOW' | 'BLOCK' | 'FLAG_FOR_REVIEW' | 'MODIFY'))
  }
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      id: auditLogs.id,
      sequenceNumber: auditLogs.sequenceNumber,
      agentId: auditLogs.agentId,
      agentName: agents.name,
      ruleId: auditLogs.ruleId,
      ruleName: rules.name,
      ruleSeverity: rules.severity,
      ruleDescription: rules.description,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      requestHeaders: auditLogs.requestHeaders,
      requestPayload: auditLogs.requestPayload,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      humanDecision: auditLogs.humanDecision,
      operatorId: auditLogs.operatorId,
      operatorName: operators.name,
      modifiedPayload: auditLogs.modifiedPayload,
      finalPayload: auditLogs.finalPayload,
      responseStatus: auditLogs.responseStatus,
      responseBody: auditLogs.responseBody,
      latencyMs: auditLogs.latencyMs,
      prevHash: auditLogs.prevHash,
      entryHash: auditLogs.entryHash,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .innerJoin(agents, eq(auditLogs.agentId, agents.id))
    .leftJoin(rules, eq(auditLogs.ruleId, rules.id))
    .leftJoin(operators, eq(auditLogs.operatorId, operators.id))
    .where(whereClause)
    .orderBy(asc(auditLogs.sequenceNumber))
    .limit(10000)

  return rows.map((r) => ({
    id: r.id,
    sequenceNumber: r.sequenceNumber,
    agentId: r.agentId,
    agentName: r.agentName,
    ruleId: r.ruleId,
    ruleName: r.ruleName,
    ruleSeverity: r.ruleSeverity,
    ruleDescription: r.ruleDescription,
    requestMethod: r.requestMethod,
    requestUrl: r.requestUrl,
    requestHeaders: r.requestHeaders,
    requestPayload: r.requestPayload,
    riskScore: r.riskScore,
    engineDecision: r.engineDecision!,
    humanDecision: r.humanDecision,
    operatorId: r.operatorId,
    operatorName: r.operatorName,
    modifiedPayload: r.modifiedPayload,
    finalPayload: r.finalPayload,
    responseStatus: r.responseStatus,
    responseBody: r.responseBody,
    latencyMs: r.latencyMs,
    prevHash: r.prevHash,
    entryHash: r.entryHash,
    createdAt: r.createdAt,
  }))
}

/**
 * Verify the hash chain integrity for a date range.
 * Returns verification result with any broken links.
 */
export async function verifyHashChain(dateFrom?: Date, dateTo?: Date): Promise<{
  valid: boolean
  checked: number
  errors: { sequenceNumber: number; id: string; reason: string }[]
}> {
  const conditions = []
  if (dateFrom) conditions.push(gte(auditLogs.createdAt, dateFrom))
  if (dateTo) conditions.push(lte(auditLogs.createdAt, dateTo))
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select({
      id: auditLogs.id,
      sequenceNumber: auditLogs.sequenceNumber,
      agentId: auditLogs.agentId,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      prevHash: auditLogs.prevHash,
      entryHash: auditLogs.entryHash,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(whereClause)
    .orderBy(asc(auditLogs.sequenceNumber))
    .limit(10000)

  const errors: { sequenceNumber: number; id: string; reason: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const entry = rows[i]!

    // Verify the entry hash is correct
    const hashInput = [
      entry.id,
      entry.sequenceNumber,
      entry.agentId,
      entry.requestMethod,
      entry.requestUrl,
      entry.riskScore,
      entry.engineDecision,
      entry.prevHash,
      entry.createdAt.toISOString(),
    ].join('|')

    const expectedHash = createHash('sha256').update(hashInput).digest('hex')
    if (entry.entryHash !== expectedHash) {
      errors.push({
        sequenceNumber: entry.sequenceNumber,
        id: entry.id,
        reason: 'Entry hash mismatch — data may have been tampered with',
      })
    }

    // Verify chain link: current prevHash should match previous entryHash
    if (i > 0) {
      const prev = rows[i - 1]!
      if (entry.prevHash !== prev.entryHash) {
        errors.push({
          sequenceNumber: entry.sequenceNumber,
          id: entry.id,
          reason: `Chain broken: prevHash does not match entry #${prev.sequenceNumber}`,
        })
      }
    }
  }

  return {
    valid: errors.length === 0,
    checked: rows.length,
    errors,
  }
}

/**
 * Get list of distinct agents for filter dropdowns.
 */
export async function getAgentList(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: agents.id, name: agents.name })
    .from(agents)
    .orderBy(asc(agents.name))

  return rows
}

/**
 * Get list of rules for filter dropdowns.
 */
export async function getRuleList(): Promise<{ id: string; name: string }[]> {
  const rows = await db
    .select({ id: rules.id, name: rules.name })
    .from(rules)
    .orderBy(asc(rules.name))

  return rows
}

// ─── Agent management data functions ────────────────────────

export interface AgentListItem {
  id: string
  name: string
  description: string | null
  isActive: boolean
  metadata: unknown
  createdAt: Date
  updatedAt: Date
  requestCount24h: number
  lastActiveAt: Date | null
}

/**
 * List all agents with request counts and last activity.
 */
export async function getAgents(): Promise<AgentListItem[]> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const rows = await db
    .select({
      id: agents.id,
      name: agents.name,
      description: agents.description,
      isActive: agents.isActive,
      metadata: agents.metadata,
      createdAt: agents.createdAt,
      updatedAt: agents.updatedAt,
      requestCount24h: sql<number>`(
        SELECT count(*)::int FROM audit_logs
        WHERE audit_logs.agent_id = ${agents.id}
          AND audit_logs.created_at >= ${since24h}
      )`,
      lastActiveAt: sql<Date | null>`(
        SELECT max(audit_logs.created_at) FROM audit_logs
        WHERE audit_logs.agent_id = ${agents.id}
      )`,
    })
    .from(agents)
    .orderBy(asc(agents.name))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isActive: r.isActive,
    metadata: r.metadata,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    requestCount24h: r.requestCount24h,
    lastActiveAt: r.lastActiveAt,
  }))
}

export interface AgentDetail {
  id: string
  name: string
  description: string | null
  isActive: boolean
  metadata: unknown
  createdAt: Date
  updatedAt: Date
  totalRequests: number
  requestCount24h: number
  lastActiveAt: Date | null
  decisionBreakdown: {
    allowed: number
    blocked: number
    flagged: number
    modified: number
  }
  topRules: { ruleId: string; ruleName: string; count: number }[]
}

/**
 * Get a single agent with full detail and statistics.
 */
export async function getAgentDetail(agentId: string): Promise<AgentDetail | null> {
  const [agent] = await db
    .select()
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1)

  if (!agent) return null

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const [stats] = await db
    .select({
      totalRequests: sql<number>`count(*)::int`,
      requestCount24h: sql<number>`count(*) filter (where ${auditLogs.createdAt} >= ${since24h})::int`,
      lastActiveAt: sql<Date | null>`max(${auditLogs.createdAt})`,
      allowed: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'ALLOW')::int`,
      blocked: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'BLOCK')::int`,
      flagged: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'FLAG_FOR_REVIEW')::int`,
      modified: sql<number>`count(*) filter (where ${auditLogs.engineDecision} = 'MODIFY')::int`,
    })
    .from(auditLogs)
    .where(eq(auditLogs.agentId, agentId))

  const topRuleRows = await db
    .select({
      ruleId: auditLogs.ruleId,
      ruleName: rules.name,
      count: sql<number>`count(*)::int`,
    })
    .from(auditLogs)
    .innerJoin(rules, eq(auditLogs.ruleId, rules.id))
    .where(eq(auditLogs.agentId, agentId))
    .groupBy(auditLogs.ruleId, rules.name)
    .orderBy(sql`count(*) DESC`)
    .limit(5)

  return {
    id: agent.id,
    name: agent.name,
    description: agent.description,
    isActive: agent.isActive,
    metadata: agent.metadata,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    totalRequests: stats?.totalRequests ?? 0,
    requestCount24h: stats?.requestCount24h ?? 0,
    lastActiveAt: stats?.lastActiveAt ?? null,
    decisionBreakdown: {
      allowed: stats?.allowed ?? 0,
      blocked: stats?.blocked ?? 0,
      flagged: stats?.flagged ?? 0,
      modified: stats?.modified ?? 0,
    },
    topRules: topRuleRows.map((r) => ({
      ruleId: r.ruleId!,
      ruleName: r.ruleName,
      count: r.count,
    })),
  }
}

/**
 * Register a new agent. Returns the plain-text API key (shown once) and agent ID.
 */
export async function createAgent(data: {
  name: string
  description?: string
  metadata?: unknown
}): Promise<{ id: string; apiKey: string }> {
  // Generate a random 32-byte API key
  const apiKey = `af_${randomBytes(32).toString('hex')}`
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  const [row] = await db
    .insert(agents)
    .values({
      name: data.name,
      description: data.description ?? null,
      apiKeyHash,
      metadata: data.metadata ?? {},
    })
    .returning({ id: agents.id })

  return { id: row!.id, apiKey }
}

/**
 * Toggle agent active status.
 */
export async function toggleAgent(agentId: string, isActive: boolean): Promise<boolean> {
  const result = await db
    .update(agents)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning({ id: agents.id })

  return result.length > 0
}

/**
 * Update agent name and description.
 */
export async function updateAgent(
  agentId: string,
  data: { name?: string; description?: string | null },
): Promise<boolean> {
  const result = await db
    .update(agents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning({ id: agents.id })

  return result.length > 0
}

/**
 * Rotate API key: generate new key and update hash.
 * Returns the new plain-text key (shown once).
 */
export async function rotateAgentKey(agentId: string): Promise<string | null> {
  const apiKey = `af_${randomBytes(32).toString('hex')}`
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex')

  const result = await db
    .update(agents)
    .set({ apiKeyHash, updatedAt: new Date() })
    .where(eq(agents.id, agentId))
    .returning({ id: agents.id })

  return result.length > 0 ? apiKey : null
}

/**
 * Get recent requests for an agent (for detail page).
 */
export async function getAgentRecentRequests(
  agentId: string,
  limit = 20,
): Promise<{
  id: string
  requestMethod: string
  requestUrl: string
  riskScore: number
  engineDecision: string
  humanDecision: string | null
  latencyMs: number
  createdAt: Date
}[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      requestMethod: auditLogs.requestMethod,
      requestUrl: auditLogs.requestUrl,
      riskScore: auditLogs.riskScore,
      engineDecision: auditLogs.engineDecision,
      humanDecision: auditLogs.humanDecision,
      latencyMs: auditLogs.latencyMs,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(eq(auditLogs.agentId, agentId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    requestMethod: r.requestMethod,
    requestUrl: r.requestUrl,
    riskScore: r.riskScore,
    engineDecision: r.engineDecision!,
    humanDecision: r.humanDecision,
    latencyMs: r.latencyMs,
    createdAt: r.createdAt,
  }))
}

// ─── API Target management data functions ────────────────────

export interface ApiTargetListItem {
  id: string
  name: string
  baseUrl: string
  riskTier: string
  headers: unknown
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

/**
 * List all API targets.
 */
export async function getApiTargets(): Promise<ApiTargetListItem[]> {
  const rows = await db
    .select()
    .from(apiTargets)
    .orderBy(asc(apiTargets.name))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    baseUrl: r.baseUrl,
    riskTier: r.riskTier!,
    headers: r.headers,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

/**
 * Get a single API target.
 */
export async function getApiTarget(targetId: string): Promise<ApiTargetListItem | null> {
  const [row] = await db
    .select()
    .from(apiTargets)
    .where(eq(apiTargets.id, targetId))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    baseUrl: row.baseUrl,
    riskTier: row.riskTier!,
    headers: row.headers,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

/**
 * Create a new API target.
 */
export async function createApiTarget(data: {
  name: string
  baseUrl: string
  riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  headers?: unknown
}): Promise<string> {
  const [row] = await db
    .insert(apiTargets)
    .values({
      name: data.name,
      baseUrl: data.baseUrl,
      riskTier: data.riskTier,
      headers: data.headers ?? {},
    })
    .returning({ id: apiTargets.id })

  return row!.id
}

/**
 * Update an API target.
 */
export async function updateApiTarget(
  targetId: string,
  data: {
    name?: string
    baseUrl?: string
    riskTier?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
    headers?: unknown
    isActive?: boolean
  },
): Promise<boolean> {
  const result = await db
    .update(apiTargets)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(apiTargets.id, targetId))
    .returning({ id: apiTargets.id })

  return result.length > 0
}

/**
 * Test connectivity to an API target.
 */
export async function testApiTargetConnectivity(baseUrl: string): Promise<{
  ok: boolean
  statusCode?: number
  latencyMs: number
  error?: string
}> {
  const start = Date.now()
  try {
    const response = await fetch(baseUrl, {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    })
    return {
      ok: response.ok,
      statusCode: response.status,
      latencyMs: Date.now() - start,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : 'Connection failed',
    }
  }
}
