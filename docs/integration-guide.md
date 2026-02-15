# Integration Guide

This guide walks you through connecting an AI agent to Thundergate, handling all three response types, and writing your first custom rule.

---

## Overview

Thundergate acts as a transparent HTTP proxy between your AI agent and the APIs it calls. Your agent sends requests to Thundergate instead of directly to the target API. Thundergate evaluates each request against your rules and either forwards it, blocks it, or queues it for human review.

```
Your AI Agent  →  Thundergate Proxy (:3001)  →  Target API
                        │
                   Rule Engine
                   evaluates every
                   outbound request
```

---

## 1. Register Your Agent

Before your agent can send requests, register it in the Thundergate dashboard.

### Via Dashboard UI

1. Sign in at `http://localhost:3000`
2. Navigate to **Agents** → **Register New Agent**
3. Enter a name and optional description
4. Copy the generated API key — **it's shown only once**

### Via API

```bash
curl -X POST http://localhost:3000/api/agents \
  -H "Content-Type: application/json" \
  -d '{"name": "my-langchain-agent", "description": "Production RAG assistant"}'
```

Response:

```json
{
  "data": {
    "id": "a1b2c3d4-...",
    "apiKey": "tg_sk_a1b2c3d4e5f6..."
  }
}
```

Store this API key securely. It is SHA-256 hashed before storage and cannot be retrieved later.

---

## 2. Route Requests Through the Proxy

Instead of calling the target API directly, route through Thundergate's proxy endpoint.

### Required Headers

| Header | Description |
|--------|-------------|
| `X-Agent-Key` | Your agent's API key (required) |
| `X-Target-URL` | Base URL of the target API (required) |
| `Content-Type` | Standard content type header |
| `X-Firewall-Mode` | Set to `async` for non-blocking mode (optional) |

### Basic Example

**Before (direct call):**

```bash
curl -X POST https://api.example.com/users \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

**After (through Thundergate):**

```bash
curl -X POST http://localhost:3001/proxy/users \
  -H "X-Agent-Key: tg_sk_a1b2c3d4e5f6..." \
  -H "X-Target-URL: https://api.example.com" \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com"}'
```

The proxy reconstructs the full URL as `https://api.example.com/users` and forwards the request after evaluation.

---

## 3. Handle Response Types

Thundergate returns different HTTP status codes depending on the rule engine's decision.

### 200 — Request Allowed

The request was forwarded to the target API. The response body is the target's actual response, passed through transparently.

```json
{
  "id": 42,
  "name": "Alice",
  "email": "alice@example.com"
}
```

### 403 — Request Blocked

A rule matched and blocked the request. The response includes the reason and matched rule.

```json
{
  "error": {
    "code": "BLOCKED_BY_RULE",
    "message": "Request blocked by firewall rule",
    "ruleId": "uuid-of-matching-rule",
    "riskScore": 90,
    "reasons": [
      "URL \"/users/123\" matches pattern \"*/users/*\"",
      "HTTP method \"DELETE\" matches rule methods [DELETE]"
    ]
  }
}
```

### 202 — Queued for Human Review (async mode)

The request was flagged for human review. Only returned when you send the `X-Firewall-Mode: async` header.

```json
{
  "status": "QUEUED_FOR_REVIEW",
  "queueId": "uuid-of-queue-item",
  "auditLogId": "uuid-of-audit-entry",
  "riskScore": 65,
  "reasons": ["Payload matches pattern \"\\b\\d{3}-\\d{2}-\\d{4}\\b\" (found: \"123-45-6789\")"]
}
```

### Connection Hold (default mode)

Without `X-Firewall-Mode: async`, Thundergate holds the HTTP connection open while a human operator reviews the flagged request. The connection resolves when the operator:

- **Approves** → Request is forwarded, you receive the target's response (200)
- **Modifies** → Modified request is forwarded, you receive the target's response (200)
- **Rejects** → You receive a 403 with `REJECTED_BY_OPERATOR`
- **Times out** → You receive a 408 with `REVIEW_TIMEOUT`

### Other Status Codes

| Code | Meaning |
|------|---------|
| `401` | Missing or invalid `X-Agent-Key` |
| `400` | Missing `X-Target-URL` header |
| `408` | HITL review timed out (escalation expired) |
| `429` | Rate limit exceeded for this agent |
| `502` | Target API unreachable |

---

## 4. Choosing Sync vs. Async Mode

### Synchronous (Connection Hold) — Default

Best for agents that need an immediate answer. The proxy holds the connection open (up to 20 minutes) while a human reviews.

```bash
# Agent blocks until decision is made
curl -X POST http://localhost:3001/proxy/submit \
  -H "X-Agent-Key: tg_sk_..." \
  -H "X-Target-URL: https://api.example.com" \
  -d '{"data": "sensitive payload"}'
```

### Asynchronous (Polling)

Best for long-running agents or batch processing. Get an immediate 202, then poll the queue.

```bash
# 1. Send request with async mode
curl -X POST http://localhost:3001/proxy/submit \
  -H "X-Agent-Key: tg_sk_..." \
  -H "X-Target-URL: https://api.example.com" \
  -H "X-Firewall-Mode: async" \
  -d '{"data": "sensitive payload"}'

# Response: 202 with queueId

# 2. Poll for decision (from dashboard API)
curl http://localhost:3000/api/queue/{queueId}
```

---

## 5. Language Examples

### Python

```python
import requests

THUNDERGATE_URL = "http://localhost:3001"
AGENT_KEY = "tg_sk_a1b2c3d4e5f6..."
TARGET_API = "https://api.example.com"

def call_api(method, path, data=None):
    """Route an API call through Thundergate."""
    response = requests.request(
        method=method,
        url=f"{THUNDERGATE_URL}/proxy{path}",
        headers={
            "X-Agent-Key": AGENT_KEY,
            "X-Target-URL": TARGET_API,
            "Content-Type": "application/json",
        },
        json=data,
    )

    if response.status_code == 403:
        error = response.json().get("error", {})
        raise PermissionError(
            f"Blocked by Thundergate: {error.get('message')} "
            f"(risk score: {error.get('riskScore')})"
        )

    if response.status_code == 202:
        queue_info = response.json()
        print(f"Request queued for review: {queue_info['queueId']}")
        return None

    response.raise_for_status()
    return response.json()

# Usage
result = call_api("POST", "/users", {"name": "Alice"})
```

### TypeScript / Node.js

```typescript
const THUNDERGATE_URL = 'http://localhost:3001'
const AGENT_KEY = 'tg_sk_a1b2c3d4e5f6...'
const TARGET_API = 'https://api.example.com'

async function callApi(method: string, path: string, body?: unknown) {
  const res = await fetch(`${THUNDERGATE_URL}/proxy${path}`, {
    method,
    headers: {
      'X-Agent-Key': AGENT_KEY,
      'X-Target-URL': TARGET_API,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 403) {
    const { error } = await res.json()
    throw new Error(`Blocked: ${error.message} (score: ${error.riskScore})`)
  }

  if (res.status === 202) {
    const queue = await res.json()
    console.log(`Queued for review: ${queue.queueId}`)
    return null
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
```

### LangChain (Python) — Custom Tool Wrapper

```python
from langchain.tools import tool
import requests

THUNDERGATE_URL = "http://localhost:3001"
AGENT_KEY = "tg_sk_a1b2c3d4e5f6..."

@tool
def call_external_api(method: str, url: str, body: dict = None) -> str:
    """Call an external API through Thundergate firewall."""
    # Extract base URL and path
    from urllib.parse import urlparse
    parsed = urlparse(url)
    base_url = f"{parsed.scheme}://{parsed.netloc}"
    path = parsed.path

    response = requests.request(
        method=method,
        url=f"{THUNDERGATE_URL}/proxy{path}",
        headers={
            "X-Agent-Key": AGENT_KEY,
            "X-Target-URL": base_url,
            "Content-Type": "application/json",
        },
        json=body,
    )

    if response.status_code == 403:
        return f"BLOCKED: {response.json()['error']['message']}"

    if response.status_code == 202:
        return f"PENDING REVIEW: {response.json()['queueId']}"

    return response.text
```

---

## 6. Rate Limiting

Each agent is rate-limited independently. The default is **100 requests per minute**. When exceeded, you receive:

```
HTTP 429 Too Many Requests
```

The rate limit is configurable via `TG_DEFAULT_RATE_LIMIT` in your environment.

---

## 7. API Key Rotation

Rotate keys without downtime via the dashboard or API:

```bash
curl -X POST http://localhost:3000/api/agents/{agent-id}/rotate-key
```

The response contains the new key (shown once). The old key is immediately invalidated.

---

## 8. Testing Your Integration

### Dry-Run Rule Testing

Before deploying, test how your requests will be evaluated:

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

This returns the evaluation result without forwarding anything.

### Health Check

Verify the proxy is running:

```bash
curl http://localhost:3001/health
# {"status": "ok"}
```

---

## Next Steps

- [Rule Writing Guide](./rule-writing-guide.md) — Learn how to create rules for your use case
- [Deployment Guide](./deployment.md) — Deploy Thundergate to production
- [FAQ](./faq.md) — Common questions and answers
