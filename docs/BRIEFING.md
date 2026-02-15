# Thundergate — Comprehensive Briefing Document

> This document is designed to give a full, self-contained understanding of Thundergate to anyone (human or AI) who needs to generate content about it: blog posts, social media threads, video scripts, comparisons, pitch decks, or technical analysis. Everything you need is here.

---

## 1. What Is Thundergate?

Thundergate is an **open-source, real-time execution firewall for autonomous AI agents**. It sits as a reverse proxy between your AI agents and the external APIs they call, intercepting every outbound request to evaluate, block, modify, or escalate it to a human operator before it reaches the real world.

**One-sentence pitch:** Thundergate is an outbound HTTP proxy purpose-built for AI agents — it intercepts API calls, applies configurable rules, escalates risky actions to human operators, and produces tamper-evident audit trails, all with sub-50ms latency.

**GitHub:** https://github.com/dimitarrskv/thundergate
**License:** MIT (fully open source)
**Version:** 0.1.0 (first public release, February 2025)
**Author:** Dimitar Ruskov (@dimitarrskv)

---

## 2. The Problem It Solves

### The Landscape

AI agents (LangChain, CrewAI, AutoGPT, custom tool-calling LLM systems) are increasingly being given the ability to take real-world actions: calling APIs, sending emails, executing database queries, processing payments, and modifying data. These agents operate autonomously, often making dozens or hundreds of API calls per session.

### The Risk

Without a governance layer, a single hallucinated or misinterpreted instruction can cause an agent to:

- **Delete production data** — An agent instructed to "clean up old records" interprets this as `DELETE /users/123`
- **Leak personally identifiable information (PII)** — An agent sends a user's Social Security number, email, or phone number to a third-party API in a request body
- **Make unauthorized financial transactions** — An agent calls Stripe's charge endpoint or initiates a bank transfer
- **Access restricted services** — An agent sends requests to internal APIs or services it shouldn't have access to
- **Overwhelm downstream APIs** — An agent enters a loop and hammers an external service with thousands of requests

### Why Existing Solutions Aren't Tailored for This

The individual components of Thundergate are not new — reverse proxies, rule engines, DLP systems, audit logs, and human approval workflows all exist independently. What doesn't exist is a **ready-to-deploy, integrated package designed specifically for the AI agent use case.** Here's how existing tools compare:

| Solution | Gap for AI Agent Governance |
|----------|-------------------|
| **API Gateways / Egress Proxies** (Kong, Envoy, Istio egress) | Can technically filter outbound traffic, but lack agent-aware features: no per-agent identity, no payload regex scanning for PII, no human-in-the-loop, no agent-specific audit trails. Would require significant custom configuration to achieve what Thundergate does out of the box. |
| **WAFs / DLP Systems** (ModSecurity, enterprise DLP) | Designed for different threat models (inbound attacks, document classification). Not designed to intercept and hold an agent's HTTP connection while a human reviews. |
| **Prompt engineering / system prompts** | Important as a first layer, but not enforceable — agents can still hallucinate or misinterpret. Prompts are suggestions; Thundergate is enforcement at the network layer. Best used together. |
| **Agent framework guardrails** (LangChain callbacks, etc.) | Framework-specific, not protocol-level. No unified audit trail across multiple agents or frameworks. |
| **Logging and monitoring** | Detects problems after the fact. Thundergate prevents them in real time. |

Thundergate's value is **specialization and packaging**: it takes proven security concepts and adapts them into an integrated tool purpose-built for AI agent governance. It operates at the **HTTP protocol level** — it doesn't care what framework, language, or LLM provider your agent uses.

---

## 3. How It Works

### The Request Flow

```
AI Agent sends HTTP request
        │
        ▼
┌─────────────────────┐
│  THUNDERGATE PROXY   │  (port 3001)
│                      │
│  1. Authenticate     │  ← Validates X-Agent-Key header (SHA-256 hash lookup)
│  2. Rate limit       │  ← Per-agent, configurable (default 100 req/min)
│  3. Extract payload  │  ← Parses method, URL, headers, body
│  4. Evaluate rules   │  ← Pure function, < 5ms, no network hop
│                      │
│  Decision:           │
│  ├── ALLOW ─────────►│──► Forward to target API → Return response to agent
│  ├── BLOCK ─────────►│──► Return 403 with reason to agent
│  ├── FLAG_FOR_REVIEW─►│──► Hold connection, notify human operator
│  └── MODIFY ────────►│──► Apply modifications, forward to target
│                      │
│  5. Write audit log  │  ← SHA-256 hash-chained, append-only
└─────────────────────┘
```

### Key Concepts

**Rule Engine** — A deterministic evaluation engine that checks every request against a set of configurable rules. No LLM, no AI, no external dependencies. Rules use glob patterns for URLs, regex for payload scanning, and HTTP method filters. Each rule produces an action (ALLOW, BLOCK, FLAG_FOR_REVIEW, MODIFY) and contributes to a cumulative risk score (0-100).

**Human-in-the-Loop (HITL)** — When a request is flagged for review, the agent's HTTP connection is held open while a human operator in the dashboard reviews the full context (agent identity, payload, matched rule, risk score). The operator can approve, reject, or modify the request. If no one responds, the request escalates through tiers and eventually auto-rejects.

**Escalation Tiers:**
- Tier 0: Any operator can review (5-minute timeout)
- Tier 1: Escalated to admin-role operators (15-minute timeout)
- Tier 2: Auto-rejected with full audit trail

**Audit Logging** — Every request, decision, and human action is recorded in an append-only audit log. Each entry contains a SHA-256 hash that includes the hash of the previous entry, forming a tamper-evident chain. This is a well-established technique (hash-chained logging dates back to the 1990s), applied here to give AI agent operations the same auditability that financial systems have had for decades. A PostgreSQL trigger prevents any UPDATE or DELETE on the audit table. The dashboard includes a hash chain verification tool.

**Risk Scoring** — Each rule has a severity level (LOW=10, MEDIUM=30, HIGH=60, CRITICAL=90). When multiple rules match a request, their scores are additive, capped at 100. This allows nuanced evaluation: a request might match a LOW-severity rule and a MEDIUM-severity rule, giving a combined score of 40, which could be below the threshold for blocking but enough to trigger a flag for review.

---

## 4. Features in Detail

### 4.1 Rule Engine
- URL pattern matching with glob wildcards (`*/users/*`, `**/delete`)
- HTTP method filtering (whitelist/blacklist specific methods)
- Payload regex scanning with recursive JSON traversal — detects SSNs, emails, phone numbers, API keys, or any custom pattern in nested request bodies
- Header pattern matching (regex on header key/value pairs)
- Risk scoring: severity-weighted (LOW/MEDIUM/HIGH/CRITICAL), additive stacking, 0-100 scale
- Conditions within a single rule are ANDed; across rules, the highest-severity action wins (BLOCK > FLAG_FOR_REVIEW > MODIFY > ALLOW)
- Entirely deterministic: a pure function with no side effects, no I/O, no LLM calls — this makes it fast (< 5ms), predictable, and fully testable

### 4.2 Proxy Interceptor
- Fastify-based reverse proxy with sub-50ms p99 latency on the allow path
- Agent authentication via `X-Agent-Key` header (SHA-256 hashed key storage)
- Per-agent rate limiting (default 100 req/min, configurable)
- In-process rule evaluation with 30-second rule cache (zero network hop — the engine is a library loaded into the proxy's process)
- Connection hold mode: keeps the agent's HTTP connection open while a human reviews a flagged request
- Async mode: returns 202 immediately, agent polls for decision
- Automatic escalation worker: monitors HITL queue, escalates timed-out items

### 4.3 Operator Dashboard
- Built with Next.js 14 (App Router), React 18, Tailwind CSS
- **Live metrics dashboard** — total requests, allowed, blocked, flagged counts (24h window)
- **Rule management** — create, edit, toggle, dry-run test rules against sample payloads
- **HITL queue** — real-time queue of flagged requests, claim/review/decide with keyboard shortcuts (j/k to navigate, c to claim, Enter to decide)
- **Audit log explorer** — search, filter, paginate, verify hash chains, export to CSV/JSON
- **Agent management** — register agents, rotate API keys, toggle active/inactive, view per-agent metrics
- **API target management** — define downstream APIs with risk tiers, test connectivity
- **Role-based access control** — ADMIN, OPERATOR, VIEWER roles with scoped permissions
- **Real-time updates** — PostgreSQL LISTEN/NOTIFY pushes HITL events to the dashboard via Socket.IO

### 4.4 Security & Compliance
- Tamper-evident audit logs with SHA-256 hash chains and sequence numbers
- Append-only enforcement via PostgreSQL trigger (prevents UPDATE/DELETE on audit_logs table)
- Hash chain verification tool in the dashboard to detect any post-hoc tampering
- API key rotation without downtime
- No plaintext secrets stored anywhere — all keys are SHA-256 hashed
- Production error sanitization — stack traces and internal details never leak to clients
- Input validation via Zod schemas on all API boundaries
- CORS restricted to dashboard origin only

---

## 5. Architecture & Tech Stack

### Monorepo Structure

Thundergate is a Turborepo monorepo with pnpm workspaces, containing four packages:

| Package | What It Does | Key Technology |
|---------|-------------|----------------|
| `@thundergate/db` | Database schema, migrations, seed data, connection client | Drizzle ORM, PostgreSQL 16 |
| `@thundergate/engine` | Deterministic rule evaluation engine (pure functions) | TypeScript, picomatch (single runtime dependency) |
| `@thundergate/proxy` | Agent-facing reverse proxy interceptor | Fastify, Undici, @fastify/rate-limit |
| `@thundergate/dashboard` | Operator-facing web UI | Next.js 14, NextAuth.js, Tailwind CSS, Socket.IO |

### Full Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | TypeScript 5.7 (strict mode, ESM) |
| Monorepo | Turborepo + pnpm workspaces |
| Database | PostgreSQL 16 (JSONB, LISTEN/NOTIFY, bigserial) |
| ORM | Drizzle ORM (type-safe, lightweight) |
| Proxy | Fastify + Undici |
| Dashboard | Next.js 14 (App Router) + React 18 |
| Auth | NextAuth.js v4 (JWT strategy, httpOnly cookies) |
| Styling | Tailwind CSS 3.4 |
| Validation | Zod (runtime schema validation) |
| Pattern matching | picomatch (glob matching for URLs) |
| Testing | Vitest (92+ unit tests) + Playwright (E2E) |
| CI/CD | GitHub Actions (lint, typecheck, test, build) |
| Containerization | Docker multi-stage builds + Docker Compose |
| API Spec | OpenAPI 3.0 |

### Key Architectural Decisions & Why

1. **Rule engine runs in-process with the proxy** — No separate service, no network hop. Evaluation is a function call that takes < 5ms. This keeps the allow-path latency under 50ms p99.

2. **No LLM dependency in the core engine** — The rule engine is entirely deterministic (regex, glob patterns, arithmetic). This makes it fast, predictable, auditable, and eliminates any dependency on external AI services. LLM-assisted risk scoring is on the roadmap as an optional enhancement.

3. **PostgreSQL LISTEN/NOTIFY for real-time events** — Instead of adding Redis or a message broker, HITL events are pushed to the dashboard using PostgreSQL's built-in pub/sub. This keeps the infrastructure simple (just Postgres) without sacrificing real-time capabilities.

4. **SHA-256 hash-chained audit logs** — Each audit entry hashes the previous entry's hash, forming a verifiable chain. Combined with a PostgreSQL trigger that prevents mutation, this provides tamper-evident logging that is verifiable without any external service. The formula: `entry_hash = SHA-256(sequence_number || agent_id || request_url || request_payload || risk_score || engine_decision || final_payload || prev_hash)`.

5. **Connection hold for HITL** — Instead of returning immediately and requiring the agent to poll, Thundergate holds the agent's HTTP connection open while a human reviews. This means agents can treat flagged requests the same as normal requests — they just take longer. Agents that prefer non-blocking behavior can use the `X-Firewall-Mode: async` header.

6. **Tiered escalation with auto-reject** — Ensures no request sits in the queue forever. Operator (5min) → Admin (15min) → Auto-reject. All timeouts are configurable.

---

## 6. Database Schema

Six PostgreSQL tables:

| Table | Purpose |
|-------|---------|
| `agents` | Registered AI agents (name, SHA-256 hashed API key, active status, metadata) |
| `rules` | Firewall rules (conditions as JSONB, action, severity, priority, enabled flag) |
| `audit_logs` | Immutable request log (full request/response, risk score, decisions, hash chain) |
| `hitl_queue` | Human review queue (status, assignment, escalation tier, expiry) |
| `operators` | Dashboard users (email, name, role, password hash, last login) |
| `api_targets` | Downstream APIs (base URL, risk tier, default headers, active status) |

The `audit_logs` table is the most critical — it records every request that passes through the proxy, every rule engine decision, every human decision, and links them all together with a tamper-evident hash chain.

---

## 7. Default Rules (Shipped with Seed Data)

| Rule | Action | Severity | What It Catches |
|------|--------|----------|-----------------|
| Block DELETE on user endpoints | BLOCK | CRITICAL | Any DELETE request to URLs matching `*/users/*` |
| Flag PII - SSN patterns | FLAG_FOR_REVIEW | HIGH | Request bodies containing SSN-like patterns (`\b\d{3}-\d{2}-\d{4}\b`) |
| Flag PII - Email & Phone | FLAG_FOR_REVIEW | MEDIUM | Request bodies containing email addresses or phone numbers |
| Flag high-risk API targets | FLAG_FOR_REVIEW | HIGH | Requests to `*api.stripe.com*` (financial APIs) |
| Allow read-only methods | ALLOW | LOW | GET, HEAD, OPTIONS requests (safe fallback) |

---

## 8. Who Is This For?

### Primary Audience
- **Engineering teams deploying AI agents in production** — Anyone using LangChain, CrewAI, AutoGPT, or custom tool-calling LLM systems that make outbound API calls
- **DevOps / Platform engineers** responsible for governing agent behavior at scale
- **Security engineers** who need audit trails and governance for autonomous AI systems

### Secondary Audience
- **Compliance officers** who need tamper-evident audit logs and verifiable decision trails
- **CTOs / Engineering leaders** evaluating AI governance solutions
- **AI safety researchers** interested in practical, deployable agent oversight mechanisms

### Framework Compatibility
Thundergate works with any agent that makes HTTP calls — it's protocol-level, not framework-specific:
- LangChain / LangGraph
- CrewAI
- AutoGPT / AutoGen
- OpenAI function-calling agents
- Anthropic tool-use agents
- Custom agents in any language (Python, TypeScript, Go, etc.)

---

## 9. What Makes Thundergate Different (Honest Assessment)

### What Thundergate Is NOT

Let's be upfront about what this isn't:

- **Not a new security paradigm.** The individual components (reverse proxy, rule engine, hash-chained logs, human approval workflows) are well-established techniques. Thundergate's contribution is packaging them into an integrated, agent-specific tool.
- **Not a complete AI safety solution.** It's a guardrail for HTTP-level actions, not a comprehensive governance framework. It can't catch bad decisions that look like valid requests (e.g., charging the wrong customer with a correctly-formatted Stripe API call).
- **Not a replacement for prompt engineering.** System prompts and Thundergate are complementary layers. Use both.

### What It Actually Is

Thundergate is best described as: **a WAF / egress proxy specialized for AI agents, packaged as an integrated open-source tool with an operator dashboard.**

The value proposition is not that any single feature is novel — it's that the combination is purpose-built for AI agent governance and works out of the box:

| Capability | Exists Elsewhere? | Thundergate's Value-Add |
|-----------|-------------------|------------------------|
| Outbound HTTP interception | Yes (Envoy egress, Squid, etc.) | Pre-configured for agent auth, per-agent rate limiting, agent-specific audit trails |
| Payload regex scanning | Yes (WAFs, DLP systems) | Applied specifically to AI agent request bodies with recursive JSON traversal |
| Human approval workflows | Yes (change management, PR reviews) | Integrated into the HTTP request lifecycle — holds the agent's connection while a human reviews |
| Hash-chained audit logs | Yes (secure logging, 1990s concept) | Applied to every agent action with a verification UI in the dashboard |
| PII detection | Yes (enterprise DLP) | Regex-based pattern matching — catches structured PII (SSNs, emails, phone numbers) but NOT semantic PII (see Limitations) |

### Compared to Configuring Existing Tools

Could you achieve similar results by combining Envoy + ModSecurity + a custom dashboard + a Slack bot + append-only logging? Technically, yes. Thundergate's argument is: **you shouldn't have to**. It's a single `docker compose up` that gives you all of this, designed for the specific workflow of "AI agent makes API call → evaluate → allow/block/ask a human."

### Compared to Framework Guardrails (LangChain callbacks, etc.)

Framework guardrails work within one framework. If you have agents across LangChain, CrewAI, and custom code, you need separate implementations. Thundergate operates at the protocol level — one proxy, one set of rules, one audit trail for all agents.

---

## 10. Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| Proxy latency (allow path) | < 50ms p99 | Rule evaluation + forwarding |
| Rule engine evaluation | < 5ms p99 | Pure function, in-process, no I/O |
| HITL notification latency | < 500ms | PostgreSQL NOTIFY → Socket.IO → Dashboard |
| Throughput | 500+ req/s | Load-tested with autocannon |
| Concurrent agent connections | 100+ | Node.js async I/O |
| Audit log write throughput | 1,000 events/s | Async, fire-and-forget (never blocks proxy) |

---

## 11. Limitations & Honest Scope

Thundergate is a useful layer of defense, not a magic safety system. These are its real limitations:

### What It Cannot Catch

| Limitation | Explanation |
|-----------|-------------|
| **Semantically valid but wrong actions** | If an agent charges the wrong customer via Stripe but the request format is correct, Thundergate will allow it. It inspects structure and patterns, not intent or business logic correctness. |
| **Contextual PII leakage** | Regex catches structured patterns (SSNs, emails, phone numbers). It will NOT catch: "Send John's cancer diagnosis to the analytics endpoint." Semantic understanding requires NLP/LLM, which is on the roadmap but not in v0.1. |
| **Prompt injection** | Thundergate doesn't see what happens inside the agent. If an agent is prompt-injected into making a harmful-but-structurally-valid API call, Thundergate only sees the HTTP request. |
| **Agent-internal bad decisions** | Thundergate operates at the HTTP boundary. Everything that happens before the agent makes an API call (reasoning, planning, tool selection) is outside its scope. |
| **Data exfiltration via allowed endpoints** | If an agent is allowed to call `api.example.com`, it can send any data to that endpoint. Thundergate can scan payloads for patterns, but if the exfiltrated data doesn't match a rule, it passes through. |
| **Harmful content that looks valid** | An agent writing a correctly-formatted but harmful email, or posting inappropriate content to a social media API — if the payload doesn't match a regex rule, Thundergate won't catch it. |

### Operational Limitations

| Limitation | Explanation |
|-----------|-------------|
| **Human review doesn't scale** | HITL works at tens or hundreds of flagged requests per day. At 50,000 agent actions/day, human review becomes a bottleneck. Thundergate is designed for targeted flagging (high-risk actions only), not comprehensive review. |
| **Only works if agents route through it** | If a developer forgets to configure one API client to use the proxy, those requests bypass Thundergate entirely. There's no network-level enforcement (that's your infrastructure's job via egress policies). |
| **Single point of failure** | If the proxy goes down, agent traffic either fails (if agents require Thundergate) or bypasses it (if agents have fallback direct access). Production deployments should run multiple proxy instances behind a load balancer. |
| **Regex has limits** | Regex patterns can produce false positives (flagging phone numbers in timestamps) and false negatives (missing PII in unusual formats). Rules need ongoing tuning. |

### What It IS Good At

Despite these limitations, Thundergate provides meaningful value as a **defense-in-depth layer**:

- Catching obvious dangerous actions (DELETE on critical endpoints, requests to unauthorized APIs)
- Catching structured PII patterns in request bodies (SSNs, emails, phone numbers)
- Rate-limiting runaway agents
- Producing an auditable record of every agent action and every human decision
- Giving human operators a way to review high-risk actions before they execute
- Providing a single pane of glass for managing multiple agents across frameworks

The right mental model: **Thundergate is to AI agents what a firewall is to network traffic.** A firewall doesn't make your network "safe" — but a network without one is reckless.

---

## 12. Getting Started (Quick Start Summary)

```bash
# Clone
git clone https://github.com/dimitarrskv/thundergate.git && cd thundergate

# Install
pnpm install

# Start PostgreSQL
docker compose up -d

# Set up environment
cp .env.example .env

# Initialize database
pnpm --filter @thundergate/db build
pnpm --filter @thundergate/db db:migrate
pnpm --filter @thundergate/db db:seed

# Start everything
pnpm dev
# Proxy runs on :3001, Dashboard on :3000
```

Then send a test request:
```bash
curl -X POST http://localhost:3001/proxy/https://jsonplaceholder.typicode.com/posts \
  -H "X-Agent-Key: test-agent-key-001" \
  -H "Content-Type: application/json" \
  -d '{"title": "Hello from AI Agent", "body": "Evaluated by Thundergate"}'
```

---

## 13. Roadmap (Post-MVP)

| Feature | Description |
|---------|-------------|
| Response body scanning | Evaluate downstream API responses, not just outbound requests |
| Custom rule plugins | TypeScript plugin interface for complex business logic beyond regex |
| mTLS agent authentication | Certificate-based auth for high-security environments |
| Multi-tenancy | Workspace isolation for multiple teams or organizations |
| LLM-assisted risk scoring | Optional LLM layer for nuanced, context-aware risk assessment |
| Webhook notifications | Slack, Teams, PagerDuty integration for escalation alerts |
| Replay & simulation | Re-run historical requests through updated rule sets |
| SSO/SAML | Enterprise identity provider integration |
| Helm charts | Production Kubernetes deployment |
| Agent SDKs | Client libraries for Python, TypeScript, and Go |

---

## 14. Key Talking Points (For Content Generation)

### The "Why Now" Angle
AI agents are transitioning from read-only (RAG, search, analysis) to read-write (API calls, transactions, data modification). This is happening faster than governance tooling can keep up. While the individual security techniques aren't new, there's no off-the-shelf open-source tool that packages them specifically for AI agent oversight. Thundergate fills that gap.

### The "Why Open Source" Angle
AI governance tooling should be inspectable. Organizations need to see exactly how their agent traffic is being evaluated, what rules are applied, and how decisions are made. Open source means full transparency, no vendor lock-in, and the ability to self-host in air-gapped environments.

### The "No LLM Required" Angle
The rule engine is entirely deterministic — regex, glob patterns, and arithmetic. This is intentional: a safety layer that can hallucinate is not a safety layer. Deterministic evaluation means the same input always produces the same output. This is a deliberate trade-off: you gain speed (< 5ms), predictability, and auditability, but you lose the ability to catch semantic issues (see Limitations section). LLM-assisted scoring is on the roadmap as an optional enhancement.

### The "Human in the Loop" Angle
This is arguably the most genuinely useful part of the project. Thundergate doesn't just block or allow — it can pause. When a request is ambiguous or high-risk, the agent's connection is held open while a human reviews the full context. This is effectively "pull request reviews for AI actions" — a concept that's increasingly important as agents take more consequential actions.

### The "Compliance" Angle
The tamper-evident audit log (SHA-256 hash chains, append-only enforcement, sequence numbers) uses a well-established cryptographic technique to provide a verifiable record of every agent action and human decision. This is useful for regulated industries where you need to prove what happened and who authorized it. The technique isn't new; applying it to AI agent operations is the contribution.

### The Developer Experience Angle
Integration is minimal: change your base URL and add one HTTP header. The proxy is transparent — allowed requests return the target API's actual response. One `docker compose up` gives you the full stack. No need to stitch together five different tools.

### The "Honest Positioning" Angle
When writing about Thundergate, the most credible framing is: "This is a specialized tool that adapts proven security concepts for a new problem space." Don't oversell it as revolutionary — the audience (especially technical audiences on HN, Reddit, etc.) will see through it immediately and dismiss the project. Undersell and overdeliver.

---

## 15. Example Scenarios

### Scenario 1: Preventing Data Deletion
An AI customer support agent is instructed by a user to "remove my account." The agent interprets this as `DELETE /users/12345`. Thundergate's rule engine matches the DELETE method + `/users/*` URL pattern, blocks the request with a 403, and logs the attempt. The agent receives a clear error and can inform the user that account deletion requires a different process.

### Scenario 2: Catching PII Leakage
An AI data processing agent is sending extracted information to a third-party analytics API. One request body accidentally contains a Social Security number (123-45-6789). Thundergate's payload regex scanner detects the SSN pattern, flags the request for human review, and holds the connection. An operator reviews the payload, sees the SSN, rejects the request, and notes that the data pipeline needs sanitization.

### Scenario 3: Governing Financial API Access
An AI agent that manages subscriptions is sending requests to Stripe's API. Thundergate has a rule that flags all requests to `*api.stripe.com*` for human review. An operator sees each charge request, verifies the amount and customer, and approves or rejects. Every decision is recorded in the tamper-evident audit log.

### Scenario 4: Rate-Limiting a Runaway Agent
An AI agent enters a retry loop and starts hammering an external API with hundreds of requests per second. Thundergate's per-agent rate limiter kicks in after 100 requests/minute (configurable), returning 429 for subsequent requests. The operator notices the spike in the dashboard metrics and investigates.

---

## 16. Content Format Suggestions

When using this document to generate content, consider these angles:

| Format | Suggested Angle |
|--------|----------------|
| **Hacker News "Show HN"** | Lead with the problem (AI agents can go rogue), the technical approach (deterministic rule engine, no LLM), and the architecture decisions. HN values technical depth. |
| **Twitter/X thread** | Problem → Solution → Key features (3-4) → "It's open source" → Link. Use the dashboard screenshot. |
| **Reddit (r/artificial, r/MachineLearning)** | "I built this because..." personal story. What problem you encountered, why existing solutions didn't work, what you built. |
| **LinkedIn** | Enterprise angle. AI governance, compliance, risk management. Mention the audit trail and HITL features. |
| **Dev.to / Hashnode blog** | Technical deep-dive: "How I built a tamper-evident audit log with SHA-256 hash chains" or "Why your AI agents need a firewall (and how to build one)." |
| **Product Hunt** | Focus on the dashboard UI, ease of setup (Docker Compose), and the "no AI agent acts without oversight" tagline. |
| **YouTube / video** | Live demo: set up Thundergate, create a rule, send a request that gets blocked, send one that gets flagged, approve it from the dashboard. Show the audit log verification. |

---

*This document is maintained alongside the Thundergate source code. For the latest information, see the [GitHub repository](https://github.com/dimitarrskv/thundergate).*
