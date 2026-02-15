# Thundergate — Architecture & Requirements

> **Type:** Enterprise AI Agent Execution Firewall
> **Version:** 0.1.0

---

## 1. Vision

A real-time gateway that sits between autonomous AI agents and external APIs to **evaluate, modify, block, or escalate** actions to a human operator — ensuring no AI agent acts without oversight.

---

## 2. High-Level Architecture

```
                         ┌──────────────────────┐
                         │     AI AGENTS         │
                         │  (LLM tool-calls)     │
                         └──────────┬────────────┘
                                    │  HTTPS
                                    ▼
┌───────────────────────────────────────────────────────────────┐
│                     PROXY INTERCEPTOR                         │
│              Fastify reverse proxy (port 3001)                │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ Auth         │  │ Payload      │  │ Rate Limiter         │ │
│  │ Middleware   │  │ Extractor    │  │                      │ │
│  └──────┬──────┘  └──────┬───────┘  └──────────────────────┘ │
│         │                │                                    │
│         ▼                ▼                                    │
│  ┌─────────────────────────────────┐                          │
│  │       RULE ENGINE (in-process)  │◀── Zero network hop     │
│  │  Deterministic / Regex / JSON   │                          │
│  └──────────────┬──────────────────┘                          │
│                 │                                             │
│    ┌────────────┼────────────┐                                │
│    ▼            ▼            ▼                                │
│  ALLOW       BLOCK      FLAG_FOR_REVIEW                      │
│    │            │            │                                │
│    │            │            ▼                                │
│    │            │   ┌────────────────┐                        │
│    │            │   │  HITL QUEUE    │──── PG LISTEN/NOTIFY   │
│    │            │   │  (PostgreSQL)  │                        │
│    │            │   └───────┬────────┘                        │
│    │            │           │                                 │
│    ▼            ▼           ▼                                 │
│  Forward    Return 403   Wait for                            │
│  to Target               Human Decision                     │
└───────────────────────────────────────────────────────────────┘
        │                                      │
        ▼                                      ▼
┌───────────────┐                ┌──────────────────────────┐
│ TARGET API    │                │   AUDIT TELEMETRY        │
│ (downstream)  │                │   (append-only, hashed)  │
└───────────────┘                └──────────────────────────┘
                                               │
                                               ▼
                                 ┌──────────────────────────┐
                                 │   OPERATOR DASHBOARD     │
                                 │   Next.js (port 3000)    │
                                 │                          │
                                 │  - HITL Queue UI         │
                                 │  - Rule Management       │
                                 │  - Audit Log Explorer    │
                                 │  - Analytics Dashboard   │
                                 │  - Agent Management      │
                                 └──────────────────────────┘
```

---

## 3. Tech Stack

| Layer              | Technology                    | Rationale                                                              |
| ------------------ | ----------------------------- | ---------------------------------------------------------------------- |
| Proxy Interceptor  | Node.js + Fastify             | Sub-ms routing, streaming support, mature plugin ecosystem             |
| Rule Engine        | TypeScript (in-process)       | Co-located with proxy for zero-latency evaluation. No LLM dependency.  |
| Database           | PostgreSQL 16                 | JSONB payloads, append-only audit via triggers, LISTEN/NOTIFY for HITL |
| HITL Queue         | PostgreSQL + Socket.IO        | No Redis/RabbitMQ needed at MVP. PG-backed with WebSocket push.        |
| Dashboard          | Next.js 14 (App Router)      | RSC for performance, built-in API routes, excellent DX                 |
| Auth               | NextAuth.js (Auth.js v5)      | JWT sessions, expandable to SSO/SAML post-MVP                         |
| ORM                | Drizzle ORM                   | Type-safe, lightweight, superior PG support                           |
| Validation         | Zod                           | Runtime schema validation, shared between proxy and dashboard          |
| Testing            | Vitest + Playwright           | Fast unit/integration + E2E                                           |
| Monorepo           | Turborepo + pnpm workspaces   | 4 packages, cached builds, parallel execution                         |
| CI/CD              | GitHub Actions                | Lint → Test → Build → Deploy pipeline                                 |
| Containerization   | Docker + docker-compose       | Local dev parity, single-command startup                               |

---

## 4. Package Structure

```
thundergate/
├── ARCHITECTURE.md
├── turbo.json
├── pnpm-workspace.yaml
├── package.json
├── docker-compose.yml
├── .env.example
├── .github/
│   └── workflows/
│       └── ci.yml
├── packages/
│   ├── db/                          # Shared database layer
│   │   ├── src/
│   │   │   ├── schema.ts            # Drizzle schema definitions
│   │   │   ├── migrations/          # SQL migrations
│   │   │   ├── client.ts            # DB connection
│   │   │   └── index.ts             # Public exports
│   │   ├── drizzle.config.ts
│   │   └── package.json
│   │
│   ├── engine/                      # Deterministic rule engine
│   │   ├── src/
│   │   │   ├── evaluator.ts         # Core evaluation loop
│   │   │   ├── matchers/
│   │   │   │   ├── url.ts           # URL pattern matching
│   │   │   │   ├── method.ts        # HTTP method matching
│   │   │   │   ├── payload.ts       # Body regex/pattern matching
│   │   │   │   ├── header.ts        # Header inspection
│   │   │   │   └── index.ts
│   │   │   ├── scorer.ts            # Risk score calculator
│   │   │   ├── types.ts             # Shared types
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   ├── proxy/                       # Reverse proxy interceptor
│   │   ├── src/
│   │   │   ├── server.ts            # Fastify server setup
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts          # Agent API key validation
│   │   │   │   ├── extractor.ts     # Payload extraction
│   │   │   │   └── rate-limit.ts    # Rate limiting
│   │   │   ├── routes/
│   │   │   │   ├── proxy.ts         # Catch-all proxy route
│   │   │   │   └── health.ts        # Health check
│   │   │   ├── services/
│   │   │   │   ├── forwarder.ts     # Forward to target API
│   │   │   │   ├── queue.ts         # HITL queue operations
│   │   │   │   └── audit.ts         # Audit log writer
│   │   │   └── index.ts
│   │   ├── __tests__/
│   │   └── package.json
│   │
│   └── dashboard/                   # Operator web UI
│       ├── src/
│       │   ├── app/
│       │   │   ├── layout.tsx
│       │   │   ├── page.tsx              # Dashboard overview
│       │   │   ├── queue/
│       │   │   │   ├── page.tsx          # HITL queue list
│       │   │   │   └── [id]/page.tsx     # Queue item detail
│       │   │   ├── audit/
│       │   │   │   ├── page.tsx          # Audit log explorer
│       │   │   │   └── [id]/page.tsx     # Single log detail
│       │   │   ├── rules/
│       │   │   │   ├── page.tsx          # Rule management
│       │   │   │   └── [id]/page.tsx     # Rule editor
│       │   │   ├── agents/
│       │   │   │   └── page.tsx          # Agent management
│       │   │   └── api/                  # API routes
│       │   │       ├── queue/
│       │   │       ├── audit/
│       │   │       ├── rules/
│       │   │       ├── agents/
│       │   │       └── dashboard/
│       │   ├── components/
│       │   │   ├── ui/                   # Shared UI primitives
│       │   │   ├── queue/
│       │   │   ├── audit/
│       │   │   └── rules/
│       │   ├── lib/
│       │   │   ├── auth.ts
│       │   │   ├── socket.ts             # Socket.IO client
│       │   │   └── api.ts                # API client helpers
│       │   └── hooks/
│       ├── public/
│       └── package.json
```

---

## 5. Database Schema

### 5.1 `agents` — Registered AI Agent Identities

| Column       | Type         | Constraints                |
| ------------ | ------------ | -------------------------- |
| id           | uuid         | PK, default gen_random_uuid() |
| name         | varchar(255) | NOT NULL                   |
| description  | text         | nullable                   |
| api_key_hash | varchar(64)  | NOT NULL, UNIQUE           |
| is_active    | boolean      | NOT NULL, default true     |
| metadata     | jsonb        | default '{}'               |
| created_at   | timestamptz  | NOT NULL, default now()    |
| updated_at   | timestamptz  | NOT NULL, default now()    |

### 5.2 `rules` — Deterministic Evaluation Rules

| Column      | Type                                        | Constraints                    |
| ----------- | ------------------------------------------- | ------------------------------ |
| id          | uuid                                        | PK                             |
| name        | varchar(255)                                | NOT NULL                       |
| description | text                                        | nullable                       |
| priority    | integer                                     | NOT NULL, default 100          |
| conditions  | jsonb                                       | NOT NULL                       |
| action      | enum('ALLOW','BLOCK','FLAG_FOR_REVIEW','MODIFY') | NOT NULL                 |
| severity    | enum('LOW','MEDIUM','HIGH','CRITICAL')      | NOT NULL                       |
| enabled     | boolean                                     | NOT NULL, default true         |
| created_by  | uuid                                        | FK → operators                 |
| created_at  | timestamptz                                 | NOT NULL, default now()        |
| updated_at  | timestamptz                                 | NOT NULL, default now()        |

**Conditions JSONB structure:**

```jsonc
{
  "url_pattern": "*/users/*/delete",     // glob-style URL match
  "methods": ["DELETE", "PUT"],           // HTTP method whitelist
  "payload_patterns": [                   // regex array scanned against body
    "\\b\\d{3}-\\d{2}-\\d{4}\\b",        // SSN pattern
    "(?i)password|secret|token"           // sensitive keywords
  ],
  "header_patterns": {                    // header key-value regex
    "authorization": "Bearer\\s+.{200,}"  // suspiciously long tokens
  },
  "agent_ids": ["uuid1", "uuid2"],        // restrict to specific agents (optional)
  "risk_score_threshold": 70              // cumulative score trigger
}
```

### 5.3 `api_targets` — Registered Downstream APIs

| Column    | Type                                    | Constraints            |
| --------- | --------------------------------------- | ---------------------- |
| id        | uuid                                    | PK                     |
| name      | varchar(255)                            | NOT NULL               |
| base_url  | varchar(2048)                           | NOT NULL, UNIQUE       |
| risk_tier | enum('LOW','MEDIUM','HIGH','CRITICAL')  | NOT NULL, default 'MEDIUM' |
| headers   | jsonb                                   | default '{}' (default headers to forward) |
| is_active | boolean                                 | NOT NULL, default true |
| created_at| timestamptz                             | NOT NULL               |
| updated_at| timestamptz                             | NOT NULL               |

### 5.4 `audit_logs` — Immutable, Hash-Chained Event Log

| Column           | Type                                           | Constraints             |
| ---------------- | ---------------------------------------------- | ----------------------- |
| id               | uuid                                           | PK                      |
| sequence_number  | bigserial                                      | UNIQUE, auto-increment  |
| agent_id         | uuid                                           | FK → agents, NOT NULL   |
| rule_id          | uuid                                           | FK → rules, nullable    |
| request_method   | varchar(10)                                    | NOT NULL                |
| request_url      | varchar(2048)                                  | NOT NULL                |
| request_headers  | jsonb                                          | NOT NULL                |
| request_payload  | jsonb                                          | nullable                |
| risk_score       | integer                                        | NOT NULL, 0-100         |
| engine_decision  | enum('ALLOW','BLOCK','FLAG_FOR_REVIEW','MODIFY') | NOT NULL              |
| human_decision   | enum('APPROVED','MODIFIED','REJECTED','EXPIRED') | nullable              |
| operator_id      | uuid                                           | FK → operators, nullable|
| modified_payload | jsonb                                          | nullable                |
| final_payload    | jsonb                                          | NOT NULL                |
| response_status  | integer                                        | nullable                |
| response_body    | jsonb                                          | nullable                |
| latency_ms       | integer                                        | NOT NULL                |
| prev_hash        | varchar(64)                                    | NOT NULL                |
| entry_hash       | varchar(64)                                    | NOT NULL, UNIQUE        |
| created_at       | timestamptz                                    | NOT NULL, default now() |

**Immutability enforcement:**

```sql
-- Trigger: prevent UPDATE/DELETE on audit_logs
CREATE OR REPLACE FUNCTION prevent_audit_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only: % operations are prohibited', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_immutable
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
```

**Hash chain integrity:**

```
entry_hash = SHA-256(sequence_number || agent_id || request_url ||
                     request_payload || risk_score || engine_decision ||
                     final_payload || prev_hash)
```

### 5.5 `hitl_queue` — Human-in-the-Loop Review Queue

| Column         | Type                                               | Constraints             |
| -------------- | -------------------------------------------------- | ----------------------- |
| id             | uuid                                               | PK                      |
| audit_log_id   | uuid                                               | FK → audit_logs, UNIQUE |
| status         | enum('PENDING','CLAIMED','APPROVED','MODIFIED','REJECTED','ESCALATED','EXPIRED') | NOT NULL, default 'PENDING' |
| assigned_to    | uuid                                               | FK → operators, nullable |
| escalated_to   | uuid                                               | FK → operators, nullable |
| operator_notes | text                                               | nullable                |
| escalation_tier| integer                                            | NOT NULL, default 0     |
| expires_at     | timestamptz                                        | NOT NULL                |
| claimed_at     | timestamptz                                        | nullable                |
| resolved_at    | timestamptz                                        | nullable                |
| created_at     | timestamptz                                        | NOT NULL, default now() |

**Escalation logic (application-level):**

```
Tier 0: Any operator (T1 = 5 minutes)
  → If unclaimed/unresolved after T1:
Tier 1: Escalate to ADMIN role (T2 = 15 minutes)
  → If still unresolved after T2:
Tier 2: Auto-REJECT with reason "ESCALATION_TIMEOUT"
  → Full audit trail preserved at every tier
```

### 5.6 `operators` — Dashboard Users

| Column        | Type                               | Constraints                 |
| ------------- | ---------------------------------- | --------------------------- |
| id            | uuid                               | PK                          |
| email         | varchar(255)                       | NOT NULL, UNIQUE            |
| name          | varchar(255)                       | NOT NULL                    |
| role          | enum('ADMIN','OPERATOR','VIEWER')  | NOT NULL, default 'OPERATOR'|
| password_hash | varchar(255)                       | NOT NULL                    |
| is_active     | boolean                            | NOT NULL, default true      |
| last_login_at | timestamptz                        | nullable                    |
| created_at    | timestamptz                        | NOT NULL, default now()     |
| updated_at    | timestamptz                        | NOT NULL, default now()     |

---

## 6. API Design

### 6.1 Proxy Interceptor API (port 3001)

All agent-facing traffic flows through this gateway.

#### `POST /proxy/{target}/**`

Catch-all reverse proxy route. Intercepts, evaluates, and forwards (or queues) agent requests.

**Request Headers:**
```
X-Agent-Key: <api-key>          # Required: agent authentication
X-Target-Base: <target-id>      # Required: registered API target ID
Content-Type: application/json
```

**Flow:**
1. Authenticate agent via `X-Agent-Key`
2. Extract payload, method, URL, headers
3. Run through Rule Engine → get decision + risk score
4. If ALLOW → forward to target, log, return response
5. If BLOCK → return 403 with reason, log
6. If FLAG_FOR_REVIEW → enqueue in HITL, hold connection (or return 202 with queue ID)
7. If MODIFY → apply modifications, forward, log

**Responses:**
- `200` — Proxied response (pass-through from target)
- `202` — Queued for human review (`{ queueId, status, estimatedWait }`)
- `403` — Blocked by rule engine (`{ reason, ruleId, riskScore }`)
- `401` — Invalid agent key
- `408` — HITL timeout (escalation expired)
- `429` — Rate limited

#### `GET /proxy/health`

Returns proxy health status.

### 6.2 Dashboard API (port 3000)

All operator-facing APIs served by Next.js API routes.

#### Queue Endpoints

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | /api/queue               | List queue items (paginated, filtered)|
| GET    | /api/queue/:id           | Get queue item detail                |
| POST   | /api/queue/:id/claim     | Claim a queue item                   |
| POST   | /api/queue/:id/decide    | Submit decision (approve/modify/reject)|
| GET    | /api/queue/stats         | Queue metrics (pending, avg time)    |

**POST /api/queue/:id/decide body:**
```json
{
  "decision": "APPROVED | MODIFIED | REJECTED",
  "modified_payload": { },
  "notes": "Operator reasoning"
}
```

#### Audit Endpoints

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | /api/audit               | Query audit logs (paginated, filtered)|
| GET    | /api/audit/:id           | Single audit log with full detail    |
| GET    | /api/audit/export        | Export logs as CSV/JSON              |
| POST   | /api/audit/verify        | Verify hash chain integrity          |

#### Rule Endpoints

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | /api/rules               | List all rules (sorted by priority)  |
| GET    | /api/rules/:id           | Get rule detail                      |
| POST   | /api/rules               | Create new rule                      |
| PUT    | /api/rules/:id           | Update rule                          |
| DELETE | /api/rules/:id           | Soft-delete (set enabled=false)      |
| POST   | /api/rules/test          | Dry-run a rule against sample payload|

#### Agent Endpoints

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | /api/agents              | List registered agents               |
| POST   | /api/agents              | Register new agent (returns API key) |
| PUT    | /api/agents/:id          | Update agent config                  |
| POST   | /api/agents/:id/rotate   | Rotate API key                       |

#### Dashboard Endpoints

| Method | Path                     | Description                          |
| ------ | ------------------------ | ------------------------------------ |
| GET    | /api/dashboard/stats     | Aggregated metrics                   |
| GET    | /api/dashboard/timeline  | Actions over time (chart data)       |

### 6.3 WebSocket Events (Socket.IO)

| Event             | Direction        | Payload                              |
| ----------------- | ---------------- | ------------------------------------ |
| `hitl:new`        | Server → Client  | `{ queueItem, auditLog, riskScore }` |
| `hitl:claimed`    | Server → Client  | `{ queueId, operatorId }`            |
| `hitl:escalated`  | Server → Client  | `{ queueId, tier, reason }`          |
| `hitl:resolved`   | Server → Client  | `{ queueId, decision, operatorId }`  |
| `hitl:expired`    | Server → Client  | `{ queueId, reason }`               |
| `stats:update`    | Server → Client  | `{ pendingCount, avgResponseTime }`  |

---

## 7. User Stories

### 7.1 Agent Developer Stories

| ID    | Story                                                                                              | Priority |
| ----- | -------------------------------------------------------------------------------------------------- | -------- |
| AD-1  | As an agent developer, I can register my agent and receive an API key so I can route traffic through the firewall. | P0 |
| AD-2  | As an agent developer, I can send API requests through the proxy and receive the downstream response transparently when allowed. | P0 |
| AD-3  | As an agent developer, I receive a clear 403 response with reason and rule ID when my request is blocked. | P0 |
| AD-4  | As an agent developer, I receive a 202 with a queue ID when my request is flagged for human review, so I can poll or wait. | P0 |
| AD-5  | As an agent developer, I can rotate my agent's API key without downtime.                          | P1 |
| AD-6  | As an agent developer, I can query the status of a queued request to know if it's been approved, rejected, or is still pending. | P1 |

### 7.2 Operator Stories

| ID    | Story                                                                                              | Priority |
| ----- | -------------------------------------------------------------------------------------------------- | -------- |
| OP-1  | As an operator, I can log in to the dashboard and see an overview of system activity.              | P0 |
| OP-2  | As an operator, I receive real-time notifications when new items enter the HITL queue.             | P0 |
| OP-3  | As an operator, I can view the full context of a flagged request (agent, payload, matched rule, risk score). | P0 |
| OP-4  | As an operator, I can approve, reject, or modify a flagged request and provide reasoning.          | P0 |
| OP-5  | As an operator, I can claim a queue item so other operators know I'm reviewing it.                 | P0 |
| OP-6  | As an operator, I see escalation warnings when a queue item is approaching its timeout.            | P1 |
| OP-7  | As an operator, I can filter and search the HITL queue by status, severity, agent, and time range. | P1 |

### 7.3 Admin Stories

| ID    | Story                                                                                              | Priority |
| ----- | -------------------------------------------------------------------------------------------------- | -------- |
| AM-1  | As an admin, I can create, edit, enable/disable, and delete rules through the dashboard.           | P0 |
| AM-2  | As an admin, I can test a rule against a sample payload before activating it (dry-run).             | P1 |
| AM-3  | As an admin, I can register and manage AI agents (create, deactivate, rotate keys).                | P0 |
| AM-4  | As an admin, I can register and configure API targets with risk tiers.                             | P0 |
| AM-5  | As an admin, I can manage operator accounts and assign roles (Admin, Operator, Viewer).            | P1 |
| AM-6  | As an admin, I can configure escalation timeouts (T1, T2) globally or per-rule.                    | P1 |

### 7.4 Compliance Stories

| ID    | Story                                                                                              | Priority |
| ----- | -------------------------------------------------------------------------------------------------- | -------- |
| CO-1  | As a compliance officer, I can view the full audit trail of any agent action with immutable, hash-chained logs. | P0 |
| CO-2  | As a compliance officer, I can verify the integrity of the audit log chain via the dashboard.       | P0 |
| CO-3  | As a compliance officer, I can export audit logs as CSV or JSON for external review.               | P1 |
| CO-4  | As a compliance officer, I can filter audit logs by date range, agent, risk score, decision, and rule. | P0 |
| CO-5  | As a compliance officer, I can see who made each decision (operator ID) and when.                  | P0 |

---

## 8. Technical Requirements

### 8.1 Performance

| Metric                          | Target          |
| ------------------------------- | --------------- |
| Proxy latency (ALLOW path)      | < 50ms p99      |
| Rule engine evaluation time     | < 5ms p99       |
| HITL queue notification latency | < 500ms         |
| Dashboard page load             | < 2s             |
| Concurrent agent connections    | 100+             |
| Audit log write throughput      | 1,000 events/s  |

### 8.2 Security

- All agent API keys hashed with SHA-256 before storage
- Auth middleware validates every proxy request
- Dashboard protected by JWT sessions with httpOnly cookies
- CORS restricted to dashboard origin
- Rate limiting per agent (configurable, default 100 req/min)
- Request payload size limit (configurable, default 1MB)
- SQL injection prevention via parameterized queries (Drizzle ORM)
- No secrets in logs — payloads are logged but sensitive fields can be redacted via rules

### 8.3 Reliability

- Audit logs are append-only with DB-level trigger enforcement
- Hash chain provides tamper evidence
- HITL queue items have TTL with automatic escalation
- Graceful shutdown: proxy drains in-flight requests before stopping
- Health check endpoint for load balancer integration

### 8.4 Observability

- Structured JSON logging (pino via Fastify)
- Request correlation IDs propagated through entire flow
- Dashboard displays real-time metrics:
  - Requests/minute (total, allowed, blocked, flagged)
  - Average risk score
  - HITL queue depth and average resolution time
  - Top triggered rules

---

## 9. Non-Functional Requirements

| Requirement      | Detail                                                    |
| ---------------- | --------------------------------------------------------- |
| Deployment       | Docker Compose for local/staging; Kubernetes-ready via Helm charts (post-MVP) |
| Configuration    | Environment variables via `.env`, validated with Zod at startup |
| Data retention   | Audit logs retained indefinitely (MVP); configurable retention post-MVP |
| Browser support  | Dashboard: Chrome, Firefox, Safari (latest 2 versions)    |
| Accessibility    | Dashboard meets WCAG 2.1 AA                               |
| Documentation    | API documentation via OpenAPI 3.0 spec                    |

---

## 10. Future Roadmap (Post-MVP)

| Feature                      | Description                                              |
| ---------------------------- | -------------------------------------------------------- |
| Response body scanning       | Rule engine evaluates downstream API responses           |
| Custom rule plugins          | TypeScript plugin interface for complex business logic   |
| mTLS agent authentication    | Certificate-based auth for high-security environments    |
| Multi-tenancy                | Workspace isolation for multiple teams/orgs              |
| LLM-assisted risk scoring    | Optional LLM layer for nuanced risk assessment           |
| Webhook notifications        | Slack/Teams/PagerDuty integration for escalations        |
| Replay & simulation          | Re-run historical requests through updated rules         |
| SSO/SAML                     | Enterprise identity provider integration                 |
| Helm charts                  | Production Kubernetes deployment                         |
| SDK                          | Agent-side SDK for Python, TypeScript, Go                |
