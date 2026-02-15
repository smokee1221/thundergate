# FAQ

Common questions about Thundergate.

---

### Does Thundergate add latency to my agent's requests?

The allow path (no rules matched, or rule matches with ALLOW action) adds **< 50ms** at p99, with rule evaluation itself taking **< 5ms**. The proxy is co-located with the rule engine in a single process — there's no extra network hop for evaluation.

Blocked requests are even faster since there's no downstream API call.

Flagged requests (FLAG_FOR_REVIEW) hold the connection until a human decides, which can take minutes. Use `X-Firewall-Mode: async` to get an immediate 202 response instead.

---

### Does Thundergate require an LLM or AI service?

No. The rule engine is entirely **deterministic** — it uses glob pattern matching, regex, and risk scoring. There are no LLM calls, no embeddings, and no AI dependencies. This makes evaluation fast, predictable, and auditable.

LLM-assisted risk scoring is on the [post-MVP roadmap](../ARCHITECTURE.md) as an optional enhancement, but the core engine will always remain deterministic.

---

### Can I use Thundergate with LangChain / CrewAI / AutoGPT / custom agents?

Yes — any agent that makes outbound HTTP calls can route through Thundergate. The proxy is protocol-agnostic. You just need to:

1. Set the `X-Agent-Key` header on every request
2. Set the `X-Target-URL` header to the downstream API's base URL
3. Send the request to `http://thundergate-host:3001/proxy/...`

See the [Integration Guide](./integration-guide.md) for language-specific examples including a LangChain tool wrapper.

---

### What happens if the dashboard goes down?

The proxy continues operating independently. Rules are cached in-memory (30-second TTL), so the proxy can evaluate requests even if the database is temporarily unreachable.

However, **FLAG_FOR_REVIEW requests will time out** if no operator is available to review them. The escalation worker will auto-reject them after the Tier 2 timeout (default: 15 minutes).

---

### What happens if the database goes down?

The proxy will fail to authenticate agents (API key lookup requires DB access) and fail to write audit logs. The rule cache will continue serving the last-fetched rules for up to 30 seconds.

If the database is down for more than 30 seconds, the proxy will be unable to load rules and will default to allowing all requests (no active rules = allow).

**Recommendation:** Use a managed PostgreSQL service with automated failover for production deployments.

---

### Is this production-ready?

Thundergate v0.1 is a functional MVP with a full feature set: proxy interception, rule evaluation, human-in-the-loop review, tamper-evident audit logging, and an operator dashboard. It's been tested with 92+ unit tests and load-tested to 500+ req/s.

That said, it's v0.1. See the [roadmap](../ARCHITECTURE.md) for post-MVP features like mTLS, multi-tenancy, and Helm charts. Evaluate against your requirements and security posture.

---

### Does this make my AI agents "safe"?

No — and any tool that claims to is overpromising. Thundergate is a **defense-in-depth layer**, not a comprehensive safety solution. It catches dangerous HTTP-level actions (destructive methods, PII patterns, requests to unauthorized APIs) but it cannot catch:

- Semantically valid but incorrect actions (e.g., charging the wrong customer with a correct API call)
- Contextual PII leakage that doesn't match regex patterns (e.g., "send John's diagnosis to analytics")
- Prompt injection or agent-internal reasoning errors
- Harmful content in correctly-formatted payloads

Think of it like a network firewall: it doesn't make your network "safe," but a network without one is reckless. Use Thundergate alongside prompt engineering, framework guardrails, and proper infrastructure security.

---

### Isn't this just a reverse proxy with a rule engine? How is it novel?

Honestly, yes — at its core, Thundergate is a reverse proxy + rule engine + dashboard. The individual components (proxy, regex scanning, hash-chained logs, human approval workflows) are all well-established techniques.

What's new is the **specialization and packaging**: these components are integrated into a single tool purpose-built for AI agent governance, with agent-aware authentication, per-agent rate limiting, connection holding for human review, and a dashboard designed for the operator workflow. You could build this yourself by combining Envoy + ModSecurity + a custom UI — Thundergate saves you that effort.

---

### Can regex really catch PII effectively?

Regex catches **structured PII patterns** well: Social Security numbers, email addresses, phone numbers, credit card numbers. It's fast and has zero false negatives for well-defined patterns.

Where regex falls short is **contextual or unstructured PII**: names, medical information, or sensitive details that don't follow a fixed pattern. For those, you'd need NLP or LLM-based scanning, which is on the post-MVP roadmap as an optional enhancement. In the meantime, regex-based scanning is a meaningful first line of defense — it catches a large category of accidental PII leakage.

---

### Does human-in-the-loop review scale?

Not infinitely. HITL is designed for **targeted, high-risk flagging** — the kind of requests where you genuinely want a human to look before execution (financial transactions, PII-containing payloads, destructive operations).

If you flag every request, operators will drown. The key is writing rules that are selective: flag DELETE on critical endpoints, flag requests to financial APIs, flag payloads matching PII patterns — but allow routine GETs to pass through automatically. At that point, you're reviewing tens to hundreds of items per day, which is manageable.

---

### How do I block all traffic from a compromised agent?

Two options:

1. **Deactivate the agent** in the dashboard (Agents → toggle inactive). This is immediate and returns 403 for all subsequent requests.
2. **Rotate the agent's API key** via the dashboard or API. The old key is immediately invalidated.

---

### Can rules use OR logic?

Within a single rule, conditions are ANDed (all must match). For OR logic, create separate rules:

- **Rule A:** Block DELETE on `/users/*`
- **Rule B:** Block DELETE on `/orders/*`

Both rules will be evaluated independently, and either can trigger a block.

---

### How does the escalation flow work?

When a request is flagged for review:

1. **Tier 0** — Any operator can claim and review it (default: 5-minute timeout)
2. **Tier 1** — If unclaimed after Tier 0 timeout, escalated to ADMIN-role operators (default: 15-minute timeout)
3. **Tier 2** — If still unresolved, the request is auto-rejected with reason `ESCALATION_TIMEOUT`

The agent's connection is held open (or returns 202 in async mode) throughout this process. Timeouts are configurable via `TG_HITL_TIER1_TIMEOUT_MS` and `TG_HITL_TIER2_TIMEOUT_MS`.

---

### How do audit log hash chains work?

Every audit log entry includes:

- A `sequence_number` (auto-incrementing)
- A `prev_hash` — the SHA-256 hash of the previous entry
- An `entry_hash` — SHA-256 of the current entry's key fields plus `prev_hash`

This forms a chain: if any entry is modified after the fact, its hash will no longer match what the next entry recorded as `prev_hash`, breaking the chain. The dashboard includes a **Verify Hash Chain** tool that checks the entire chain for tampering.

---

### Can I export audit logs for compliance?

Yes. The dashboard provides CSV and JSON export via the Audit Log Explorer, or programmatically:

```bash
# JSON export
curl "http://localhost:3000/api/audit/export?format=json&dateFrom=2026-01-01"

# CSV export
curl "http://localhost:3000/api/audit/export?format=csv&dateFrom=2026-01-01"
```

---

### How do I add custom rule matchers?

The rule engine supports four matcher types: URL (glob), method, payload (regex), and header (regex). For custom logic beyond these matchers, the post-MVP roadmap includes a TypeScript plugin interface.

In the current version, regex payload patterns are flexible enough to cover most use cases — you can detect PII patterns, API keys, sensitive keywords, and more.

---

### What's the maximum payload size?

Default is **1 MB** (`TG_MAX_PAYLOAD_SIZE=1048576`). Configurable via environment variables. Requests exceeding this limit are rejected with a 413 status.

---

### How are API keys stored?

Agent API keys are hashed with **SHA-256** before storage. The plaintext key is shown once at creation time and cannot be retrieved afterward. Key rotation generates a new key and immediately invalidates the old one.

---

### What databases are supported?

Thundergate requires **PostgreSQL 16+**. The ORM layer (Drizzle) is PostgreSQL-specific, and features like `LISTEN/NOTIFY`, `JSONB`, and `bigserial` depend on PostgreSQL.

---

## More Questions?

- Check the [Integration Guide](./integration-guide.md) for setup help
- Check the [Rule Writing Guide](./rule-writing-guide.md) for rule configuration
- Check the [Deployment Guide](./deployment.md) for production deployment
- Open an issue on [GitHub](https://github.com/dimitarrskv/thundergate/issues)
