# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-15

### Added

- **Proxy Interceptor** — Fastify reverse proxy that intercepts all outbound AI agent requests
- **Rule Engine** — Configurable rules with URL pattern, HTTP method, header, and payload matchers
- **Risk Scoring** — Weighted risk score computation with configurable thresholds
- **Human-in-the-Loop Queue** — Real-time escalation with Tier 0 (operator) and Tier 1 (admin) review
- **Connection Hold** — Holds agent HTTP connections while awaiting human decisions
- **Escalation Worker** — Background worker that auto-escalates and auto-rejects expired items
- **PG NOTIFY** — Real-time PostgreSQL LISTEN/NOTIFY for instant HITL event propagation
- **Operator Dashboard** — Next.js 14 dashboard with audit logs, queue management, rule builder, agent management, and hash chain verification
- **Audit Logging** — Append-only, hash-chained audit trail with tamper-evident integrity
- **Agent Authentication** — API key auth via `X-Agent-Key` header with SHA-256 hashed storage
- **Operator Authentication** — NextAuth.js with JWT sessions and role-based access control
- **Rate Limiting** — Per-agent rate limiting via `@fastify/rate-limit`
- **Docker Support** — Multi-stage Dockerfiles for proxy and dashboard
- **CI Pipeline** — GitHub Actions with lint, typecheck, test, and build stages

[0.1.0]: https://github.com/dimitarrskv/thundergate/releases/tag/v0.1.0
