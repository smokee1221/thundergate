<h1 align="center">Thundergate</h1>

<p align="center">
  <strong>A real-time execution firewall for autonomous AI agents.</strong>
</p>

<p align="center">
  <a href="https://github.com/dimitarrskv/thundergate/actions/workflows/ci.yml"><img src="https://github.com/dimitarrskv/thundergate/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node.js" />
  <img src="https://img.shields.io/badge/pnpm-9.15-blue" alt="pnpm" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
</p>

<p align="center">
  Thundergate sits between your AI agents and external APIs to <strong>evaluate, modify, block, or escalate</strong> every outbound action to a human operator before it reaches the real world. No AI agent acts without oversight.
</p>

<p align="center">
  <img src="assets/request_flow_diagram.png" alt="Thundergate Request Flow — AI Agent → Proxy → Rule Engine → Allow / Block / Flag for Human Review" width="800" />
</p>

---

## Why Thundergate?

As AI agents gain the ability to call APIs, send emails, execute transactions, and modify data autonomously, organizations need a **governance layer** that can:

- **Block dangerous actions** before they happen (DELETE on production user records)
- **Detect PII leakage** in real-time (SSNs, emails, phone numbers in request bodies)
- **Escalate high-risk requests** to human operators with full context
- **Produce tamper-evident audit trails** with SHA-256 hash chains for compliance
- **Rate-limit and authenticate** every agent with unique API keys

---

## Architecture

<!-- See assets/ for diagram source files -->

### Monorepo Packages

| Package | Description | Stack |
|---------|-------------|-------|
| `@thundergate/db` | Schema, migrations, seed data | Drizzle ORM, PostgreSQL 16 |
| `@thundergate/engine` | Deterministic rule evaluation engine | Pure TypeScript, picomatch |
| `@thundergate/proxy` | Agent-facing reverse proxy | Fastify, Undici, PG LISTEN/NOTIFY |
| `@thundergate/dashboard` | Operator-facing web UI | Next.js 14, NextAuth.js, Tailwind CSS |

---

## Features

### Rule Engine
- **URL pattern matching** with glob wildcards (`*/users/*`, `**/delete`)
- **HTTP method filtering** (whitelist/blacklist GET, POST, DELETE, etc.)
- **Payload regex scanning** with recursive JSON traversal (detects SSNs, emails, phone numbers)
- **Header pattern matching** (regex on key/value pairs)
- **Risk scoring** (0-100 scale, severity-weighted, additive stacking)
- **Deterministic evaluation** — pure functions, no I/O side effects, fully testable

### Proxy Interceptor
- **Agent authentication** via `X-Agent-Key` header (SHA-256 hashed keys)
- **Per-agent rate limiting** (configurable, default 100 req/min)
- **In-process rule evaluation** with 30-second rule cache (zero network hop)
- **Connection holding** for FLAG_FOR_REVIEW — keeps the agent's HTTP connection open while a human reviews
- **Automatic escalation** — timed-out HITL items escalate to higher tiers
- **Real-time notifications** via PostgreSQL LISTEN/NOTIFY

<p align="center">
  <img src="assets/hitl_escalation_flow.png" alt="HITL Escalation Flow — Tier 0 (Operator) → Tier 1 (Admin) → Auto-Reject" width="600" />
</p>

### Dashboard
- **Live metrics** — Total requests, allowed, blocked, flagged (24h window)
- **Rule management** — Create, edit, toggle, dry-run test rules
- **HITL queue** — Claim, review, approve/reject/modify flagged requests with keyboard shortcuts (`j`/`k`/`c`/`Enter`)
- **Audit log explorer** — Search, filter, paginate, verify hash chains, export CSV
- **Agent management** — Register agents, rotate API keys, toggle active/inactive
- **API target management** — Define downstream APIs with risk tiers, test connectivity
- **Role-based access** — ADMIN, OPERATOR, VIEWER roles with scoped permissions

<!-- TODO: Add dashboard screenshots
<p align="center">
  <img src="assets/dashboard_overview.png" alt="Thundergate Dashboard — Live metrics, rule management, HITL queue" width="800" />
</p>
-->

### Security & Compliance
- **Tamper-evident audit logs** — SHA-256 hash chain (each entry hashes the previous)
- **Hash chain verification** — Detect any post-hoc log tampering
- **API key rotation** — Generate new keys without downtime
- **No plaintext secrets** — All API keys stored as SHA-256 hashes

<p align="center">
  <img src="assets/audit_hash_chain.png" alt="Tamper-Evident Audit Hash Chain — Each entry hashes the previous, any tampering breaks the chain" width="800" />
</p>
- **Production error sanitization** — No stack traces leak in production

---

## Quick Start

### Prerequisites

- Node.js >= 20
- pnpm 9.x
- Docker & Docker Compose (for PostgreSQL)

### 1. Clone & Install

```bash
git clone https://github.com/dimitarrskv/thundergate.git
cd thundergate
pnpm install
```

### 2. Start PostgreSQL

```bash
docker compose up -d
```

### 3. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your own NEXTAUTH_SECRET for production
```

### 4. Initialize Database

```bash
pnpm --filter @thundergate/db build
pnpm --filter @thundergate/db db:migrate # Apply schema to database
pnpm --filter @thundergate/db db:seed   # Seed with sample data
```

### 5. Build & Run

```bash
pnpm build                           # Build all packages
pnpm dev                             # Start proxy (:3001) + dashboard (:3000)
```

### 6. Sign In

Open [http://localhost:3000](http://localhost:3000) and log in:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@thundergate.local` | `admin123` |
| Operator | `operator@thundergate.local` | `operator123` |
| Viewer | `viewer@thundergate.local` | `viewer123` |

### 7. Send a Test Request

```bash
curl -X POST http://localhost:3001/proxy/https://jsonplaceholder.typicode.com/posts \
  -H "X-Agent-Key: test-agent-key-001" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello from AI Agent", "body": "This request was evaluated by Thundergate"}'
```

---

## Usage Examples

### Block Dangerous Actions

A rule named **"Block DELETE on user endpoints"** automatically blocks:

```bash
# This request gets blocked with 403 Forbidden
curl -X DELETE http://localhost:3001/proxy/https://api.example.com/users/123 \
  -H "X-Agent-Key: test-agent-key-001"
```

### Detect PII Leakage

A rule with payload pattern `\b\d{3}-\d{2}-\d{4}\b` flags requests containing SSNs:

```bash
# This request gets flagged for human review
curl -X POST http://localhost:3001/proxy/https://api.example.com/submit \
  -H "X-Agent-Key: test-agent-key-001" \
  -H "Content-Type: application/json" \
  -d '{"data": "SSN is 123-45-6789"}'
```

The agent's connection is held open until a human operator approves, modifies, or rejects the request in the dashboard.

---

## Default Seed Rules

| # | Rule | Action | Severity | What it catches |
|---|------|--------|----------|-----------------|
| 1 | Block DELETE on user endpoints | BLOCK | CRITICAL | `DELETE */users/*` |
| 2 | Flag PII - SSN patterns | FLAG_FOR_REVIEW | HIGH | `\b\d{3}-\d{2}-\d{4}\b` in body |
| 3 | Flag PII - Email & Phone | FLAG_FOR_REVIEW | MEDIUM | Email/phone regex in body |
| 4 | Flag high-risk API targets | FLAG_FOR_REVIEW | HIGH | Requests to `*api.stripe.com*` |
| 5 | Allow read-only methods | ALLOW | LOW | `GET`, `HEAD`, `OPTIONS` (fallback) |

---

## Project Structure

```
thundergate/
├── packages/
│   ├── db/                      # Database package
│   │   ├── src/
│   │   │   ├── schema.ts        # Drizzle ORM schema (6 tables, 7 enums)
│   │   │   ├── seed.ts          # Dev seed data
│   │   │   └── index.ts         # DB connection & exports
│   │   └── drizzle.config.ts
│   │
│   ├── engine/                  # Rule evaluation engine
│   │   └── src/
│   │       ├── evaluate.ts      # Core evaluator (pure function)
│   │       └── matchers/        # URL, method, payload, header, scorer
│   │
│   ├── proxy/                   # Fastify reverse proxy
│   │   └── src/
│   │       ├── server.ts        # Fastify server setup
│   │       ├── routes/
│   │       │   └── proxy.ts     # Main /proxy/* catch-all route
│   │       ├── services/
│   │       │   ├── auth.ts      # X-Agent-Key validation
│   │       │   ├── forwarder.ts # HTTP forwarding (Undici)
│   │       │   ├── rule-cache.ts# In-memory rule cache (30s TTL)
│   │       │   ├── queue.ts     # HITL queue operations
│   │       │   ├── audit.ts     # Hash-chained audit logging
│   │       │   ├── pg-notify.ts # PG LISTEN/NOTIFY
│   │       │   ├── connection-hold.ts
│   │       │   └── escalation-worker.ts
│   │       └── plugins/
│   │           └── error-handler.ts
│   │
│   └── dashboard/               # Next.js 14 operator UI
│       ├── src/app/
│       │   ├── (dashboard)/     # Protected routes
│       │   │   ├── page.tsx     # Main dashboard (metrics)
│       │   │   ├── rules/       # Rule management
│       │   │   ├── queue/       # HITL queue
│       │   │   ├── audit/       # Audit log explorer
│       │   │   ├── agents/      # Agent management
│       │   │   ├── targets/     # API target config
│       │   │   └── settings/    # System settings
│       │   └── api/             # API route handlers
│       └── e2e/                 # Playwright E2E tests
│
├── scripts/
│   └── load-test.mjs            # Autocannon load testing
├── docs/
│   └── openapi.yaml             # OpenAPI 3.0 specification
├── docker-compose.yml           # Dev PostgreSQL
├── docker-compose.prod.yml      # Full production stack
├── turbo.json
└── package.json
```

---

## Database Schema

Six tables with hash-chained audit logging:

```
┌─────────┐     ┌──────────┐     ┌────────────┐
│ agents  │────▶│ audit    │◀────│  rules     │
│         │     │ _logs    │     │            │
└─────────┘     └────┬─────┘     └────────────┘
                     │
                     ▼
                ┌──────────┐     ┌────────────┐
                │ hitl     │────▶│ operators  │
                │ _queue   │     │            │
                └──────────┘     └────────────┘

                ┌────────────┐
                │ api        │
                │ _targets   │
                └────────────┘
```

| Table | Purpose |
|-------|---------|
| `agents` | Registered AI agents (name, hashed API key, active status) |
| `rules` | Firewall rules (conditions, action, severity, priority) |
| `audit_logs` | Immutable request log (SHA-256 hash chain, sequence numbers) |
| `hitl_queue` | Human review queue (status, assignment, escalation tier) |
| `operators` | Dashboard users (email, role, password hash) |
| `api_targets` | Downstream APIs (base URL, risk tier, auth headers) |

---

## API Reference

Full OpenAPI 3.0 spec available at [`docs/openapi.yaml`](docs/openapi.yaml).

### Proxy Endpoints (`:3001`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/proxy/*` | Intercept and evaluate agent request |
| `GET` | `/health` | Health check |

### Dashboard API (`:3000`)

| Method | Path | Description |
|--------|------|-------------|
| `GET/POST` | `/api/agents` | List / create agents |
| `POST` | `/api/agents/:id/toggle` | Activate / deactivate agent |
| `POST` | `/api/agents/:id/rotate-key` | Rotate API key |
| `GET/POST` | `/api/rules` | List / create rules |
| `PUT` | `/api/rules/:id` | Update rule |
| `POST` | `/api/rules/:id/toggle` | Enable / disable rule |
| `POST` | `/api/rules/test` | Dry-run rule evaluation |
| `GET` | `/api/queue` | List HITL queue items |
| `POST` | `/api/queue/:id/claim` | Claim queue item |
| `POST` | `/api/queue/:id/decide` | Approve / reject / modify |
| `GET` | `/api/audit` | Query audit logs |
| `POST` | `/api/audit/verify` | Verify hash chain integrity |
| `GET` | `/api/audit/export` | Export as CSV |
| `GET/POST` | `/api/targets` | List / create API targets |
| `POST` | `/api/targets/test` | Test target connectivity |

---

## Testing

```bash
# Unit tests (Vitest) — 92 tests across all packages
pnpm test

# Coverage report
pnpm test:coverage

# E2E tests (Playwright — requires running app)
pnpm --filter @thundergate/dashboard test:e2e

# Load testing (autocannon — target: 500 req/s)
pnpm load-test
```

---

## Production Deployment

### Docker Compose

```bash
# Build and start all services (PostgreSQL + Proxy + Dashboard)
pnpm docker:prod
```

This starts:
- **PostgreSQL 16** on port 5432 with persistent volume
- **Proxy** on port 3001 with health checks
- **Dashboard** on port 3000 with health checks

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `TG_DATABASE_URL` | PostgreSQL connection string | `postgresql://thundergate:thundergate@localhost:5432/thundergate` |
| `NEXTAUTH_SECRET` | JWT signing secret (change in production!) | `dev-secret-change-in-production` |
| `NEXTAUTH_URL` | Dashboard public URL | `http://localhost:3000` |
| `TG_PROXY_PORT` | Proxy listen port | `3001` |
| `TG_PROXY_HOST` | Proxy bind address | `0.0.0.0` |
| `TG_MAX_PAYLOAD_SIZE` | Max request body size (bytes) | `1048576` (1 MB) |
| `TG_DEFAULT_RATE_LIMIT` | Requests per minute per agent | `100` |
| `TG_HITL_TIER1_TIMEOUT_MS` | Tier 1 escalation timeout | `300000` (5 min) |
| `TG_HITL_TIER2_TIMEOUT_MS` | Tier 2 escalation timeout | `900000` (15 min) |
| `TG_LOG_LEVEL` | Log verbosity | `debug` |

---

## How Is This Different from an API Gateway?

API gateways (Kong, Envoy, AWS API Gateway) are designed for **inbound** traffic — routing external requests to your services. Thundergate is designed for **outbound** traffic — intercepting requests that AI agents make to external APIs.

| Capability | API Gateways | Thundergate |
|-----------|-------------|-------------|
| Direction | Inbound (clients → your services) | Outbound (your agents → external APIs) |
| Rule engine | Rate limiting, auth, routing | Payload regex scanning, PII detection, risk scoring |
| Human-in-the-loop | No | Yes — real-time operator review with connection hold |
| Audit trail | Basic access logs | Tamper-evident hash-chained audit logs |
| AI agent awareness | No | Per-agent keys, per-agent rate limits, agent management UI |
| Escalation | No | Tiered escalation with auto-reject timeouts |

If your use case is "make sure an AI agent doesn't do something dangerous before it talks to the outside world," Thundergate is purpose-built for that.

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Integration Guide](docs/integration-guide.md) | Connect your AI agent to Thundergate with code examples |
| [Rule Writing Guide](docs/rule-writing-guide.md) | Write effective rules with real-world recipes |
| [Deployment Guide](docs/deployment.md) | Deploy to production with Docker, TLS, backups |
| [FAQ](docs/faq.md) | Common questions and answers |
| [Architecture](ARCHITECTURE.md) | Full system design, database schema, API spec |
| [OpenAPI Spec](docs/openapi.yaml) | Machine-readable API reference |
| [Security Policy](SECURITY.md) | Vulnerability reporting, threat model, hardening checklist |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo + pnpm workspaces |
| Language | TypeScript 5.7 (strict mode) |
| Database | PostgreSQL 16 + Drizzle ORM |
| Proxy | Fastify + Undici |
| Dashboard | Next.js 14 (App Router) + React 18 |
| Auth | NextAuth.js v4 (JWT strategy) |
| Styling | Tailwind CSS 3.4 |
| Testing | Vitest + Playwright |
| CI/CD | Docker multi-stage builds |
| API Spec | OpenAPI 3.0 |

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code style, and PR guidelines.

---

## License

MIT
