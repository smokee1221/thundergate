# ─── Stage 1: Dependencies ─────────────────────────────────
FROM node:22-alpine AS deps

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

# Copy workspace root config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./

# Copy package manifests
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
COPY packages/dashboard/package.json packages/dashboard/

# Install all dependencies
RUN pnpm install --frozen-lockfile

# ─── Stage 2: Build ────────────────────────────────────────
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/engine/node_modules ./packages/engine/node_modules
COPY --from=deps /app/packages/dashboard/node_modules ./packages/dashboard/node_modules

# Copy workspace config
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json tsconfig.base.json ./

# Copy source files
COPY packages/db/ packages/db/
COPY packages/engine/ packages/engine/
COPY packages/dashboard/ packages/dashboard/

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build dependencies first, then dashboard
RUN pnpm turbo build --filter=@thundergate/dashboard

# ─── Stage 3: Production ──────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built dashboard
COPY --from=builder /app/packages/dashboard/public ./packages/dashboard/public
COPY --from=builder --chown=nextjs:nodejs /app/packages/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/dashboard/.next/static ./packages/dashboard/.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/auth/session || exit 1

CMD ["node", "packages/dashboard/server.js"]
