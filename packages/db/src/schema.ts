import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  pgEnum,
  bigserial,
} from 'drizzle-orm/pg-core'

// Enums
export const ruleActionEnum = pgEnum('rule_action', [
  'ALLOW',
  'BLOCK',
  'FLAG_FOR_REVIEW',
  'MODIFY',
])

export const severityEnum = pgEnum('severity', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
])

export const engineDecisionEnum = pgEnum('engine_decision', [
  'ALLOW',
  'BLOCK',
  'FLAG_FOR_REVIEW',
  'MODIFY',
])

export const humanDecisionEnum = pgEnum('human_decision', [
  'APPROVED',
  'MODIFIED',
  'REJECTED',
  'EXPIRED',
])

export const queueStatusEnum = pgEnum('queue_status', [
  'PENDING',
  'CLAIMED',
  'APPROVED',
  'MODIFIED',
  'REJECTED',
  'ESCALATED',
  'EXPIRED',
])

export const operatorRoleEnum = pgEnum('operator_role', [
  'ADMIN',
  'OPERATOR',
  'VIEWER',
])

export const riskTierEnum = pgEnum('risk_tier', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
])

// Tables
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  apiKeyHash: varchar('api_key_hash', { length: 64 }).notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const rules = pgTable('rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  priority: integer('priority').notNull().default(100),
  conditions: jsonb('conditions').notNull(),
  action: ruleActionEnum('action').notNull(),
  severity: severityEnum('severity').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  createdBy: uuid('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const apiTargets = pgTable('api_targets', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  baseUrl: varchar('base_url', { length: 2048 }).notNull().unique(),
  riskTier: riskTierEnum('risk_tier').notNull().default('MEDIUM'),
  headers: jsonb('headers').default({}),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  sequenceNumber: bigserial('sequence_number', { mode: 'number' }).unique(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  ruleId: uuid('rule_id').references(() => rules.id),
  requestMethod: varchar('request_method', { length: 10 }).notNull(),
  requestUrl: varchar('request_url', { length: 2048 }).notNull(),
  requestHeaders: jsonb('request_headers').notNull(),
  requestPayload: jsonb('request_payload'),
  riskScore: integer('risk_score').notNull(),
  engineDecision: engineDecisionEnum('engine_decision').notNull(),
  humanDecision: humanDecisionEnum('human_decision'),
  operatorId: uuid('operator_id').references(() => operators.id),
  modifiedPayload: jsonb('modified_payload'),
  finalPayload: jsonb('final_payload').notNull(),
  responseStatus: integer('response_status'),
  responseBody: jsonb('response_body'),
  latencyMs: integer('latency_ms').notNull(),
  prevHash: varchar('prev_hash', { length: 64 }).notNull(),
  entryHash: varchar('entry_hash', { length: 64 }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const hitlQueue = pgTable('hitl_queue', {
  id: uuid('id').primaryKey().defaultRandom(),
  auditLogId: uuid('audit_log_id')
    .notNull()
    .unique()
    .references(() => auditLogs.id),
  status: queueStatusEnum('status').notNull().default('PENDING'),
  assignedTo: uuid('assigned_to').references(() => operators.id),
  escalatedTo: uuid('escalated_to').references(() => operators.id),
  operatorNotes: text('operator_notes'),
  escalationTier: integer('escalation_tier').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  claimedAt: timestamp('claimed_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const operators = pgTable('operators', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  role: operatorRoleEnum('role').notNull().default('OPERATOR'),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
