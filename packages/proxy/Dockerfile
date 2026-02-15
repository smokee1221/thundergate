# ─── Stage 1: Build ────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace root config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./

# Copy package manifests (for dependency resolution)
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
COPY packages/proxy/package.json packages/proxy/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/db/ packages/db/
COPY packages/engine/ packages/engine/
COPY packages/proxy/ packages/proxy/

# Build all dependencies and proxy
RUN pnpm turbo build --filter=@thundergate/proxy

# ─── Stage 2: Production ──────────────────────────────────
FROM node:22-alpine AS runner

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

ENV NODE_ENV=production

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy built packages
COPY --from=builder /app/packages/db/package.json packages/db/
COPY --from=builder /app/packages/db/dist/ packages/db/dist/
COPY --from=builder /app/packages/engine/package.json packages/engine/
COPY --from=builder /app/packages/engine/dist/ packages/engine/dist/
COPY --from=builder /app/packages/proxy/package.json packages/proxy/
COPY --from=builder /app/packages/proxy/dist/ packages/proxy/dist/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "packages/proxy/dist/index.js"]
