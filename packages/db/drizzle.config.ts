import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/schema.ts',
  out: './src/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.TG_DATABASE_URL ??
      'postgresql://thundergate:thundergate@localhost:5432/thundergate',
  },
})
