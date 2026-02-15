import { createHash } from 'crypto'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { agents, operators, rules, apiTargets } from './schema.js'

const DATABASE_URL =
  process.env.TG_DATABASE_URL ??
  'postgresql://thundergate:thundergate@localhost:5432/thundergate'

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

async function seed() {
  const client = postgres(DATABASE_URL)
  const db = drizzle(client)

  console.log('Seeding database...')

  // 1. Create operators
  console.log('  → Creating operators...')
  const [admin] = await db
    .insert(operators)
    .values([
      {
        email: 'admin@thundergate.local',
        name: 'Admin User',
        role: 'ADMIN',
        passwordHash: sha256('admin123'), // Dev only — use bcrypt in production
      },
      {
        email: 'operator@thundergate.local',
        name: 'Jane Operator',
        role: 'OPERATOR',
        passwordHash: sha256('operator123'),
      },
      {
        email: 'viewer@thundergate.local',
        name: 'View Only',
        role: 'VIEWER',
        passwordHash: sha256('viewer123'),
      },
    ])
    .returning()

  // 2. Create a test agent
  // The raw API key is "test-agent-key-001" — agents send this in X-Agent-Key
  console.log('  → Creating test agent...')
  await db.insert(agents).values([
    {
      name: 'Test Agent',
      description: 'Development test agent for local testing',
      apiKeyHash: sha256('test-agent-key-001'),
      isActive: true,
      metadata: { environment: 'development' },
    },
    {
      name: 'CI Agent',
      description: 'Agent used in CI/CD pipeline testing',
      apiKeyHash: sha256('ci-agent-key-001'),
      isActive: true,
      metadata: { environment: 'ci' },
    },
  ])

  // 3. Create API targets
  console.log('  → Creating API targets...')
  await db.insert(apiTargets).values([
    {
      name: 'JSONPlaceholder (Low Risk)',
      baseUrl: 'https://jsonplaceholder.typicode.com',
      riskTier: 'LOW',
    },
    {
      name: 'Stripe API (High Risk)',
      baseUrl: 'https://api.stripe.com',
      riskTier: 'HIGH',
    },
    {
      name: 'Internal User Service (Medium Risk)',
      baseUrl: 'http://localhost:8080',
      riskTier: 'MEDIUM',
    },
  ])

  // 4. Create rules
  console.log('  → Creating rules...')
  await db.insert(rules).values([
    {
      name: 'Block DELETE on user endpoints',
      description:
        'Prevents AI agents from deleting user accounts without human approval',
      priority: 10,
      conditions: {
        url_pattern: '*/users/*',
        methods: ['DELETE'],
      },
      action: 'BLOCK',
      severity: 'CRITICAL',
      enabled: true,
      createdBy: admin!.id,
    },
    {
      name: 'Flag PII in request body (SSN)',
      description:
        'Detects Social Security Number patterns in outgoing payloads',
      priority: 20,
      conditions: {
        payload_patterns: ['\\b\\d{3}-\\d{2}-\\d{4}\\b'],
      },
      action: 'FLAG_FOR_REVIEW',
      severity: 'HIGH',
      enabled: true,
      createdBy: admin!.id,
    },
    {
      name: 'Flag PII in request body (email/phone)',
      description: 'Detects email addresses and phone numbers in payloads',
      priority: 30,
      conditions: {
        payload_patterns: [
          '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
          '\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b',
        ],
      },
      action: 'FLAG_FOR_REVIEW',
      severity: 'MEDIUM',
      enabled: true,
      createdBy: admin!.id,
    },
    {
      name: 'Flag high-risk API targets',
      description: 'All requests to HIGH/CRITICAL risk-tier APIs require review',
      priority: 40,
      conditions: {
        url_pattern: '*api.stripe.com*',
      },
      action: 'FLAG_FOR_REVIEW',
      severity: 'HIGH',
      enabled: true,
      createdBy: admin!.id,
    },
    {
      name: 'Allow GET requests to read-only APIs',
      description: 'Explicitly allows safe read operations',
      priority: 1000,
      conditions: {
        methods: ['GET', 'HEAD', 'OPTIONS'],
      },
      action: 'ALLOW',
      severity: 'LOW',
      enabled: true,
      createdBy: admin!.id,
    },
  ])

  console.log('Seed complete!')
  console.log('')
  console.log('Test credentials:')
  console.log('  Admin:    admin@thundergate.local / admin123')
  console.log('  Operator: operator@thundergate.local / operator123')
  console.log('  Viewer:   viewer@thundergate.local / viewer123')
  console.log('')
  console.log('Test agent API key: test-agent-key-001')
  console.log('  (send as X-Agent-Key header)')

  await client.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
