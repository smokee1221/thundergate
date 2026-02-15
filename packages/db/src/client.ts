import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

const connectionString =
  process.env.TG_DATABASE_URL ??
  'postgresql://thundergate:thundergate@localhost:5432/thundergate'

const client = postgres(connectionString)

export const db = drizzle(client, { schema })
export type Database = typeof db
