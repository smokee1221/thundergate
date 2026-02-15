# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Thundergate, please report it responsibly.

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email: **rskv.dimitar@gmail.com**

Include:
- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgment within 48 hours and a detailed response within 5 business days.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.x.x   | Yes (current) |

---

## Threat Model

### What Thundergate Protects Against

Thundergate is designed to mitigate risks from **autonomous AI agents making outbound API calls**:

| Threat | Mitigation |
|--------|-----------|
| Agent performs destructive actions (DELETE, bulk updates) | Rule engine blocks or flags based on HTTP method and URL patterns |
| Agent leaks PII in request bodies (SSNs, emails, phone numbers) | Regex payload scanning with human review escalation |
| Agent sends requests to unauthorized APIs | URL pattern matching and API target registration |
| Agent is compromised or behaves unexpectedly | Per-agent API keys, rate limiting, instant deactivation |
| Audit logs are tampered with after the fact | SHA-256 hash chain with sequence numbers, append-only enforcement |
| Operator disputes about what was approved | Every decision is logged with operator ID, timestamp, and notes |

### What Is Out of Scope (v0.1)

- **Response body scanning** — Thundergate currently evaluates outbound requests only. Scanning downstream API responses is on the roadmap.
- **DDoS protection** — Per-agent rate limiting is included, but Thundergate is not a WAF or DDoS mitigation tool. Use a dedicated solution (Cloudflare, AWS Shield) in front of it.
- **Network-level security** — Thundergate operates at the application layer (HTTP). Network segmentation, VPN, and firewall rules are your responsibility.
- **Agent-side integrity** — Thundergate trusts that the agent is who it claims to be (via API key). If an agent's key is compromised, the agent should be deactivated and the key rotated.

---

## Security Architecture

### API Key Storage
- Agent API keys are stored as **SHA-256 hashes** — plaintext keys are never persisted
- Keys are displayed once at creation time and cannot be retrieved afterward
- Key rotation generates a new key and invalidates the old one immediately

### Audit Log Integrity
- Audit logs are **append-only** with sequential numbering
- Each entry contains a **SHA-256 hash** of the previous entry, forming a tamper-evident chain
- A PostgreSQL trigger prevents UPDATE and DELETE operations on the `audit_logs` table
- The dashboard includes a hash chain verification tool to detect any tampering

### Authentication & Authorization
- **Agent auth:** API key via `X-Agent-Key` header, validated on every `/proxy/*` request
- **Dashboard auth:** NextAuth.js with JWT session strategy (httpOnly cookies)
- **Sessions:** Expire after 8 hours
- **Roles:** ADMIN, OPERATOR, VIEWER — scoped permissions for dashboard actions
- **Passwords:** Hashed before storage (SHA-256 in development; **upgrade to bcrypt for production**)

### Input Validation
- All API inputs are validated with **Zod** schemas at the boundary
- Request payload size is capped (default: 1 MB, configurable via `TG_MAX_PAYLOAD_SIZE`)
- SQL injection is prevented by Drizzle ORM's parameterized queries

### Error Handling
- Production error responses never include stack traces, internal paths, or database errors
- The error handler plugin sanitizes all error responses in production mode
- Structured logging (Pino) keeps internal details in server logs only

### Rate Limiting
- Per-agent rate limiting via `@fastify/rate-limit` (default: 100 req/min)
- Configurable via `TG_DEFAULT_RATE_LIMIT`
- Rate-limited requests receive HTTP 429

---

## Dependency Security

- Dependencies are locked via `pnpm-lock.yaml` with `--frozen-lockfile` in CI
- The project uses a minimal dependency tree (e.g., the rule engine has a single runtime dependency: `picomatch`)
- We recommend enabling **Dependabot** or **GitHub security alerts** on your fork to track CVEs in dependencies

---

## Production Hardening Checklist

Before deploying to production, ensure:

- [ ] `NEXTAUTH_SECRET` is set to a strong random string (at least 32 characters)
- [ ] Default seed passwords (`admin123`, `operator123`, `viewer123`) are changed
- [ ] Default test API keys (`test-agent-key-001`, `ci-agent-key-001`) are rotated or removed
- [ ] Database credentials are not using the defaults (`thundergate`/`thundergate`)
- [ ] HTTPS is enabled for both the proxy and dashboard (see [Deployment Guide](docs/deployment.md))
- [ ] Rate limits are tuned for your expected traffic
- [ ] Error handler plugin is active (no stack traces in production responses)
- [ ] `TG_LOG_LEVEL` is set to `info` or `warn` (not `debug`)
- [ ] Password hashing is upgraded to bcrypt for operator accounts
- [ ] Database backups are configured and tested
- [ ] Health check monitoring is set up for proxy (`:3001/health`) and dashboard (`:3000/api/auth/session`)
