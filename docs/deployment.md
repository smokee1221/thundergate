# Deployment Guide

This guide covers deploying Thundergate to production, from Docker Compose to cloud hosting with HTTPS.

---

## Quick Production Start (Docker Compose)

The fastest path to production is the included `docker-compose.prod.yml`:

```bash
# 1. Set production environment variables
export TG_DB_PASSWORD="your-strong-database-password"
export TG_NEXTAUTH_SECRET="$(openssl rand -hex 32)"
export TG_NEXTAUTH_URL="https://your-domain.com"

# 2. Build and start all services
docker compose -f docker-compose.prod.yml up -d --build
```

This starts three services:

| Service | Port | Description |
|---------|------|-------------|
| **PostgreSQL 16** | 5432 | Database with persistent volume |
| **Proxy** | 3001 | Agent-facing reverse proxy |
| **Dashboard** | 3000 | Operator-facing web UI |

All services include health checks and `restart: unless-stopped`.

---

## Pre-Deployment Checklist

Before going live, work through every item in this list:

### Secrets

- [ ] **Generate a strong `NEXTAUTH_SECRET`** — at least 32 random characters:
  ```bash
  openssl rand -hex 32
  ```
- [ ] **Change default database password** — set `TG_DB_PASSWORD` to something strong
- [ ] **Change default seed passwords** — the seed data creates users with `admin123`, `operator123`, `viewer123`. Change them immediately or re-seed with your own operator accounts.
- [ ] **Rotate test API keys** — the seed creates `test-agent-key-001` and `ci-agent-key-001`. Deactivate or delete these agents in production.

### Networking

- [ ] **Set `TG_NEXTAUTH_URL`** to your public dashboard URL (e.g., `https://dashboard.yourcompany.com`)
- [ ] **Set `NEXTAUTH_URL`** to the same value (NextAuth reads it directly from `process.env`)
- [ ] **Configure CORS** if the dashboard and proxy run on different domains
- [ ] **Enable HTTPS** — see the [TLS section](#tls--https) below

### Tuning

- [ ] **Set `TG_LOG_LEVEL`** to `info` or `warn` (not `debug`)
- [ ] **Tune rate limits** — `TG_DEFAULT_RATE_LIMIT` default is 100 req/min per agent
- [ ] **Tune HITL timeouts** — `TG_HITL_TIER1_TIMEOUT_MS` (5 min) and `TG_HITL_TIER2_TIMEOUT_MS` (15 min)
- [ ] **Tune payload size** — `TG_MAX_PAYLOAD_SIZE` default is 1 MB

---

## Environment Variable Reference

| Variable | Description | Default | Required in Prod? |
|----------|-------------|---------|-------------------|
| `TG_DATABASE_URL` | PostgreSQL connection string | `postgresql://thundergate:thundergate@localhost:5432/thundergate` | Yes |
| `TG_DB_PASSWORD` | Database password (used in docker-compose) | `thundergate` | Yes |
| `NEXTAUTH_SECRET` | JWT signing secret (NextAuth reads directly) | `change-me-to-a-random-32-char-string` | Yes |
| `NEXTAUTH_URL` | Dashboard public URL (NextAuth reads directly) | `http://localhost:3000` | Yes |
| `TG_NEXTAUTH_SECRET` | Same as NEXTAUTH_SECRET (used by docker-compose) | — | Yes |
| `TG_NEXTAUTH_URL` | Same as NEXTAUTH_URL (used by docker-compose) | — | Yes |
| `TG_PROXY_PORT` | Proxy listen port | `3001` | No |
| `TG_PROXY_HOST` | Proxy bind address | `0.0.0.0` | No |
| `TG_MAX_PAYLOAD_SIZE` | Max request body size (bytes) | `1048576` (1 MB) | No |
| `TG_DEFAULT_RATE_LIMIT` | Requests per minute per agent | `100` | No |
| `TG_HITL_TIER1_TIMEOUT_MS` | Tier 1 escalation timeout | `300000` (5 min) | No |
| `TG_HITL_TIER2_TIMEOUT_MS` | Tier 2 auto-reject timeout | `900000` (15 min) | No |
| `TG_LOG_LEVEL` | Log verbosity | `info` | No |
| `NODE_ENV` | Runtime environment | `production` | Set by Dockerfile |

---

## TLS / HTTPS

Thundergate does not terminate TLS itself. Use a reverse proxy in front of both the dashboard and the proxy.

### Caddy (Recommended — Automatic HTTPS)

```
# Caddyfile
dashboard.yourcompany.com {
    reverse_proxy localhost:3000
}

proxy.yourcompany.com {
    reverse_proxy localhost:3001
}
```

Caddy automatically provisions and renews Let's Encrypt certificates.

### Nginx

```nginx
# /etc/nginx/sites-available/thundergate

server {
    listen 443 ssl;
    server_name dashboard.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/dashboard.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dashboard.yourcompany.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl;
    server_name proxy.yourcompany.com;

    ssl_certificate /etc/letsencrypt/live/proxy.yourcompany.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/proxy.yourcompany.com/privkey.pem;

    # Increase timeouts for connection hold (HITL review)
    proxy_read_timeout 1200s;  # 20 minutes for HITL hold
    proxy_send_timeout 1200s;

    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Important:** The proxy's connection-hold feature keeps HTTP connections open for up to 20 minutes while waiting for human review. Set your reverse proxy's read timeout accordingly (`proxy_read_timeout 1200s` in Nginx).

---

## Database

### Backups

Set up automated PostgreSQL backups:

```bash
# Cron job: daily backup at 2 AM
0 2 * * * pg_dump -U thundergate -h localhost thundergate | gzip > /backups/thundergate-$(date +\%Y\%m\%d).sql.gz
```

For Docker:

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U thundergate thundergate | gzip > backup-$(date +%Y%m%d).sql.gz
```

### Restore

```bash
gunzip < backup-20260215.sql.gz | psql -U thundergate -h localhost thundergate
```

### Migrations

After upgrading Thundergate, run pending migrations:

```bash
pnpm --filter @thundergate/db db:migrate
```

In Docker, the proxy and dashboard images handle migrations at build time. For manual migration in a Docker environment:

```bash
docker compose -f docker-compose.prod.yml exec proxy \
  node -e "import('@thundergate/db').then(m => m.migrate())"
```

---

## Health Checks

Both services expose health check endpoints:

| Service | Endpoint | Expected Response |
|---------|----------|-------------------|
| Proxy | `GET http://localhost:3001/health` | `{"status": "ok"}` |
| Dashboard | `GET http://localhost:3000/api/auth/session` | `200 OK` |

### Monitoring Recommendations

- **Uptime monitoring** — Ping health endpoints every 30 seconds (UptimeRobot, Pingdom, or your own)
- **Log aggregation** — Proxy outputs structured JSON logs (Pino format). Forward to your log aggregation tool (e.g., Loki, Datadog, CloudWatch)
- **Database monitoring** — Track connection count, query latency, and disk usage
- **HITL queue depth** — Monitor `GET /api/queue/stats` for growing pending counts (indicates operators are overwhelmed or offline)

---

## Scaling Considerations

### Current Architecture (v0.1)

Thundergate v0.1 is designed for single-instance deployment:

- The rule engine runs in-process with the proxy (no network hop)
- The rule cache has a 30-second TTL (refreshed from PostgreSQL)
- The HITL queue uses PostgreSQL LISTEN/NOTIFY (single DB dependency)
- The escalation worker runs as a setInterval inside the proxy process

### When to Scale

| Signal | Action |
|--------|--------|
| Proxy latency > 100ms p99 | Profile queries, add DB connection pooling |
| > 500 req/s sustained | Consider horizontal proxy scaling (requires shared DB) |
| Dashboard slow to load | Standard Next.js optimization (caching, CDN) |
| HITL queue growing | Add more operators, tune escalation timeouts |

### Performance Targets

| Metric | Target |
|--------|--------|
| Proxy latency (ALLOW path) | < 50ms p99 |
| Rule engine evaluation | < 5ms p99 |
| HITL notification latency | < 500ms |
| Throughput | 500+ req/s (verified via load test) |

Run the included load test to verify:

```bash
pnpm load-test
```

---

## Upgrading

1. Pull the latest code:
   ```bash
   git pull origin main
   ```

2. Rebuild and restart services:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

3. Verify health:
   ```bash
   curl http://localhost:3001/health
   curl http://localhost:3000/api/auth/session
   ```

The Docker Compose setup handles graceful restarts. In-flight proxy connections are drained before shutdown.

---

## Further Reading

- [Integration Guide](./integration-guide.md) — Connect your agent
- [Rule Writing Guide](./rule-writing-guide.md) — Configure rules
- [SECURITY.md](../SECURITY.md) — Security policy and hardening checklist
