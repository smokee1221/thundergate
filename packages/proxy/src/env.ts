import { z } from 'zod'

/**
 * Environment variable validation.
 * Parsed at startup — fails fast if required vars are missing.
 */
const envSchema = z.object({
  TG_DATABASE_URL: z.string().url().default('postgresql://thundergate:thundergate@localhost:5432/thundergate'),
  TG_PROXY_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  TG_PROXY_HOST: z.string().default('0.0.0.0'),
  TG_MAX_PAYLOAD_SIZE: z.coerce.number().int().min(1024).default(1048576),
  TG_DEFAULT_RATE_LIMIT: z.coerce.number().int().min(1).default(100),
  TG_HITL_TIER1_TIMEOUT_MS: z.coerce.number().int().min(10000).default(300000),
  TG_HITL_TIER2_TIMEOUT_MS: z.coerce.number().int().min(10000).default(900000),
  TG_LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  TG_NEXTAUTH_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type Env = z.infer<typeof envSchema>

let _env: Env | null = null

export function validateEnv(): Env {
  if (_env) return _env

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    console.error('❌ Invalid environment variables:')
    for (const issue of result.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`)
    }
    process.exit(1)
  }

  _env = result.data
  return _env
}

export function getEnv(): Env {
  if (!_env) return validateEnv()
  return _env
}
