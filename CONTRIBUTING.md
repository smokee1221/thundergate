# Contributing to Thundergate

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

### Prerequisites

- Node.js 20+
- pnpm 9.x (`corepack enable`)
- Docker (for PostgreSQL)

### Getting Started

```bash
git clone https://github.com/dimitarrskv/thundergate.git
cd thundergate
pnpm install
docker compose up -d
cp .env.example .env
pnpm --filter @thundergate/db build
pnpm --filter @thundergate/db db:migrate
pnpm --filter @thundergate/db db:seed
pnpm dev
```

## Project Structure

This is a Turborepo monorepo with four packages:

| Package | What it does |
|---------|-------------|
| `packages/db` | Drizzle ORM schema, migrations, seed |
| `packages/engine` | Pure-function rule evaluation engine |
| `packages/proxy` | Fastify reverse proxy (agent-facing) |
| `packages/dashboard` | Next.js 14 operator UI |

## Common Commands

```bash
pnpm dev              # Start all services in dev mode
pnpm build            # Build all packages
pnpm test             # Run all unit tests
pnpm typecheck        # TypeScript type checking
pnpm lint             # ESLint
pnpm format           # Prettier
```

## Making Changes

1. **Fork & clone** the repo
2. **Create a branch** from `main`: `git checkout -b feat/my-feature`
3. **Make your changes** — keep commits focused and atomic
4. **Run checks** before pushing:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test && pnpm build
   ```
5. **Open a PR** against `main` with a clear description

## Code Style

- TypeScript strict mode everywhere
- Prettier handles formatting (single quotes, no semicolons, trailing commas)
- ESLint enforces `no-explicit-any` — use proper types
- `console.log` is banned in production code (use `console.warn`/`console.error` or Pino logger)

## Package Guidelines

- **`@thundergate/engine`** must remain a **pure package** — no database I/O, no network calls. This keeps it fast and testable.
- **`@thundergate/proxy`** owns all HTTP and database logic for the agent-facing API.
- **`@thundergate/dashboard`** owns the operator UI and its API routes.
- **`@thundergate/db`** is the single source of truth for schema — both proxy and dashboard depend on it.

## Testing

- Unit tests use **Vitest** — add tests alongside the code you change
- E2E tests use **Playwright** (in `packages/dashboard/e2e/`)
- Aim for tests that verify behavior, not implementation details

## Reporting Issues

- Use GitHub Issues for bugs and feature requests
- Include steps to reproduce for bugs
- For security vulnerabilities, see [SECURITY.md](SECURITY.md)
