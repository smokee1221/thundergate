import { drizzle } from 'drizzle-orm/postgres-js'
import { sql } from 'drizzle-orm'
import postgres from 'postgres'

const DATABASE_URL =
  process.env.TG_DATABASE_URL ??
  'postgresql://thundergate:thundergate@localhost:5432/thundergate'

async function reset() {
  const client = postgres(DATABASE_URL)
  const db = drizzle(client)

  console.log('Resetting database...')

  // Drop trigger first (so we can drop audit_logs)
  console.log('  → Dropping immutability trigger...')
  await db.execute(
    sql`DROP TRIGGER IF EXISTS audit_logs_immutable ON audit_logs`,
  )
  await db.execute(
    sql`DROP FUNCTION IF EXISTS prevent_audit_mutation()`,
  )

  // Drop all tables in correct order (respecting FKs)
  console.log('  → Dropping tables...')
  await db.execute(sql`DROP TABLE IF EXISTS hitl_queue CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS audit_logs CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS rules CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS api_targets CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS agents CASCADE`)
  await db.execute(sql`DROP TABLE IF EXISTS operators CASCADE`)

  // Drop enums
  console.log('  → Dropping enums...')
  await db.execute(sql`DROP TYPE IF EXISTS rule_action CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS severity CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS engine_decision CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS human_decision CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS queue_status CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS operator_role CASCADE`)
  await db.execute(sql`DROP TYPE IF EXISTS risk_tier CASCADE`)

  // Drop drizzle migration tracking table
  await db.execute(sql`DROP TABLE IF EXISTS __drizzle_migrations CASCADE`)

  console.log('Database reset complete.')
  console.log('Run the following to rebuild:')
  console.log('  pnpm --filter @thundergate/db db:migrate')
  console.log(
    '  psql < packages/db/src/migrations/0001_audit_immutability_trigger.sql',
  )
  console.log('  pnpm --filter @thundergate/db db:seed')

  await client.end()
}

reset().catch((err) => {
  console.error('Reset failed:', err)
  process.exit(1)
})
