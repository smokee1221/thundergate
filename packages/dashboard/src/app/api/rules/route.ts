import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRules, createRule } from '@/lib/data'
import { ruleFormSchema } from '@/lib/rule-schema'

/**
 * GET /api/rules — list all rules with optional filters.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Only ADMIN can manage rules
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') ?? undefined
  const severity = searchParams.get('severity') ?? undefined
  const enabled = searchParams.get('enabled')

  try {
    const items = await getRules({
      action,
      severity,
      enabled: enabled !== null ? enabled === 'true' : undefined,
    })
    return NextResponse.json({ items })
  } catch (err) {
    console.error('Rules API error:', err)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

/**
 * POST /api/rules — create a new rule.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = ruleFormSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  try {
    const id = await createRule({
      ...parsed.data,
      description: parsed.data.description || undefined,
      conditions: parsed.data.conditions,
      createdBy: session.user.id,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('Create rule error:', err)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}
