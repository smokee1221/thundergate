# Rule Writing Guide

Rules are the core of Thundergate. They define what gets allowed, blocked, or escalated to a human operator. This guide covers everything you need to write effective rules.

---

## How Rules Work

Each rule has:

1. **Conditions** — What to match (URL, method, payload, headers)
2. **Action** — What to do when all conditions match (`ALLOW`, `BLOCK`, `FLAG_FOR_REVIEW`, `MODIFY`)
3. **Severity** — How risky the match is (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
4. **Priority** — Evaluation order (lower number = evaluated first)

### Evaluation Logic

- Rules are sorted by priority (ascending) and evaluated in order
- Within a single rule, all defined conditions must match (**AND** logic)
- Conditions that are not defined are skipped (not required to match)
- If multiple rules match, the **most restrictive action wins**: `BLOCK > FLAG_FOR_REVIEW > MODIFY > ALLOW`
- If no rules match, the request is **allowed by default** with risk score 0

---

## Conditions Reference

### `url_pattern` — URL Matching

Glob-style patterns matched against the full target URL (including scheme and host). Uses [picomatch](https://github.com/micromatch/picomatch) with `contains: true`, meaning the pattern can match anywhere in the URL.

| Pattern | Matches | Does Not Match |
|---------|---------|---------------|
| `*/users/*` | `https://api.example.com/users/123` | `https://api.example.com/posts/1` |
| `**/delete` | `https://api.example.com/v1/users/delete` | `https://api.example.com/v1/users/123` |
| `*api.stripe.com*` | `https://api.stripe.com/v1/charges` | `https://api.example.com/stripe` |
| `*/admin/*` | `https://app.internal.com/admin/settings` | `https://app.internal.com/users` |
| `*/v1/payments*` | `https://api.example.com/v1/payments` | `https://api.example.com/v2/payments` |

**Tips:**
- Use `*` to match any characters within a single path segment
- Use `**` to match across path separators
- Patterns are tested with `contains: true` — no need to match the entire URL
- Invalid glob patterns are silently treated as non-matching (they won't crash the engine)

### `methods` — HTTP Method Matching

An array of HTTP methods. The request method must be in this list for the condition to match. Case-insensitive.

```json
{
  "methods": ["DELETE", "PUT", "PATCH"]
}
```

Supported methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

### `payload_patterns` — Body Content Matching

An array of regex patterns scanned against the request body. The engine recursively extracts all string values (including object keys) from the JSON body and tests each pattern against the combined text.

```json
{
  "payload_patterns": [
    "\\b\\d{3}-\\d{2}-\\d{4}\\b",
    "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"
  ]
}
```

**How body scanning works:**

1. The entire JSON body is traversed recursively
2. All string values, numbers, booleans, and **object keys** are extracted
3. Everything is concatenated into a single text blob
4. Each regex pattern is tested against this text (case-insensitive)
5. If any pattern matches, the condition is satisfied

**Important:** Patterns use JavaScript regex syntax (not glob). Remember to double-escape backslashes in JSON (`\\b` not `\b`).

### `header_patterns` — Header Matching

A key-value object where keys are header names and values are regex patterns to match against the header values. Header name comparison is case-insensitive.

```json
{
  "header_patterns": {
    "authorization": "Bearer\\s+.{200,}",
    "x-custom-header": "dangerous-value"
  }
}
```

### `agent_ids` — Agent Scoping (Optional)

Restrict the rule to specific agents. If omitted, the rule applies to all agents.

```json
{
  "agent_ids": ["uuid-of-agent-1", "uuid-of-agent-2"]
}
```

### `risk_score_threshold` — Score-Based Triggering (Optional)

Trigger the rule only when the cumulative risk score from other matched rules exceeds this threshold.

```json
{
  "risk_score_threshold": 70
}
```

---

## Actions

| Action | Behavior |
|--------|----------|
| `ALLOW` | Forward the request to the target API |
| `BLOCK` | Return 403 to the agent, do not forward |
| `FLAG_FOR_REVIEW` | Queue for human operator review (connection held or 202 returned) |
| `MODIFY` | Placeholder for payload modification (treated as ALLOW in v0.1) |

When multiple rules match, the strictest action wins:

```
BLOCK (4) > FLAG_FOR_REVIEW (3) > MODIFY (2) > ALLOW (1)
```

---

## Severity and Risk Scoring

Each severity level has a base risk score. When a rule matches, its score is added to the cumulative total (capped at 100):

| Severity | Base Score |
|----------|-----------|
| `LOW` | 10 |
| `MEDIUM` | 30 |
| `HIGH` | 60 |
| `CRITICAL` | 90 |

Multiple matches stack. For example, if a `MEDIUM` (30) and `HIGH` (60) rule both match, the total risk score is **90**.

---

## Priority

Lower numbers are evaluated first. Use priority to control evaluation order when it matters:

| Priority | Typical Use |
|----------|------------|
| 1-10 | Emergency overrides (block everything from a compromised agent) |
| 10-50 | Critical security rules (PII detection, destructive actions) |
| 50-100 | Standard business rules |
| 100-500 | Informational / monitoring rules |
| 500-1000 | Catch-all fallback rules |

Default priority is **100**.

---

## Real-World Rule Recipes

### Block All DELETE Requests

```json
{
  "name": "Block all DELETE requests",
  "priority": 10,
  "conditions": {
    "methods": ["DELETE"]
  },
  "action": "BLOCK",
  "severity": "CRITICAL"
}
```

### Detect SSN Patterns in Request Bodies

```json
{
  "name": "Flag PII — SSN patterns",
  "priority": 20,
  "conditions": {
    "payload_patterns": ["\\b\\d{3}-\\d{2}-\\d{4}\\b"]
  },
  "action": "FLAG_FOR_REVIEW",
  "severity": "HIGH"
}
```

### Flag Requests to Payment APIs

```json
{
  "name": "Flag payment API requests",
  "priority": 30,
  "conditions": {
    "url_pattern": "*api.stripe.com*"
  },
  "action": "FLAG_FOR_REVIEW",
  "severity": "HIGH"
}
```

### Detect Email Addresses and Phone Numbers

```json
{
  "name": "Flag PII — email and phone",
  "priority": 25,
  "conditions": {
    "payload_patterns": [
      "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      "\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b"
    ]
  },
  "action": "FLAG_FOR_REVIEW",
  "severity": "MEDIUM"
}
```

### Block Destructive Operations on User Endpoints

```json
{
  "name": "Block DELETE on user endpoints",
  "priority": 10,
  "conditions": {
    "url_pattern": "*/users/*",
    "methods": ["DELETE"]
  },
  "action": "BLOCK",
  "severity": "CRITICAL"
}
```

Both conditions must be satisfied — the URL must match `*/users/*` **and** the method must be `DELETE`.

### Flag Suspiciously Large Authorization Tokens

```json
{
  "name": "Flag oversized auth tokens",
  "priority": 50,
  "conditions": {
    "header_patterns": {
      "authorization": "Bearer\\s+.{500,}"
    }
  },
  "action": "FLAG_FOR_REVIEW",
  "severity": "MEDIUM"
}
```

### Detect API Keys or Secrets in Payloads

```json
{
  "name": "Flag leaked secrets in body",
  "priority": 15,
  "conditions": {
    "payload_patterns": [
      "(?:api[_-]?key|secret|token|password)\\s*[=:]\\s*\\S+",
      "sk_live_[a-zA-Z0-9]{24,}",
      "ghp_[a-zA-Z0-9]{36}"
    ]
  },
  "action": "FLAG_FOR_REVIEW",
  "severity": "CRITICAL"
}
```

### Allow Read-Only Traffic (Low-Priority Fallback)

```json
{
  "name": "Allow read-only methods",
  "priority": 999,
  "conditions": {
    "methods": ["GET", "HEAD", "OPTIONS"]
  },
  "action": "ALLOW",
  "severity": "LOW"
}
```

### Restrict a Specific Agent to Read-Only

```json
{
  "name": "Restrict intern-bot to read-only",
  "priority": 5,
  "conditions": {
    "methods": ["POST", "PUT", "PATCH", "DELETE"],
    "agent_ids": ["uuid-of-intern-bot"]
  },
  "action": "BLOCK",
  "severity": "HIGH"
}
```

---

## Creating Rules

### Via Dashboard

1. Navigate to **Rules** → **Create New Rule**
2. Fill in the name, description, priority, conditions, action, and severity
3. Click **Save**

### Via API

```bash
curl -X POST http://localhost:3000/api/rules \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Block DELETE on user endpoints",
    "description": "Prevents agents from deleting user records",
    "priority": 10,
    "conditions": {
      "url_pattern": "*/users/*",
      "methods": ["DELETE"]
    },
    "action": "BLOCK",
    "severity": "CRITICAL"
  }'
```

---

## Testing Rules (Dry Run)

Always test your rules before deploying. The dry-run endpoint evaluates a synthetic request against all active rules without forwarding anything:

```bash
curl -X POST http://localhost:3000/api/rules/test \
  -H "Content-Type: application/json" \
  -d '{
    "method": "DELETE",
    "url": "https://api.example.com/users/123",
    "headers": {},
    "body": {}
  }'
```

The response shows which rules matched, the calculated risk score, and the final decision.

---

## Common Pitfalls

### 1. Regex Escaping in JSON

Backslashes must be double-escaped in JSON:

- ✅ `"\\b\\d{3}-\\d{2}-\\d{4}\\b"` (correct — becomes `\b\d{3}-\d{2}-\d{4}\b` in regex)
- ❌ `"\b\d{3}-\d{2}-\d{4}\b"` (wrong — backslashes are consumed by JSON parser)

### 2. Empty Conditions

A rule with no conditions defined (all fields empty or omitted) will **never match**. Every rule needs at least one defined condition.

### 3. Overly Broad URL Patterns

The pattern `*` matches everything. Be specific:

- ❌ `"url_pattern": "*"` — matches all requests
- ✅ `"url_pattern": "*/admin/*"` — matches only admin paths

### 4. AND Logic Within Rules

All defined conditions within a single rule are ANDed. If you need OR logic, create separate rules:

```
Rule A: Block DELETE on /users/*
Rule B: Block DELETE on /orders/*
```

---

## Further Reading

- [Integration Guide](./integration-guide.md) — Connect your agent to Thundergate
- [Deployment Guide](./deployment.md) — Deploy to production
- [OpenAPI Spec](./openapi.yaml) — Full API reference
