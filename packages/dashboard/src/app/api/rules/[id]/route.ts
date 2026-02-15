import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRuleById, updateRule } from '@/lib/data'
import { ruleFormSchema } from '@/lib/rule-schema'

/**
 * GET /api/rules/:id — get a single rule.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const rule = await getRuleById(params.id)
    if (!rule) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }
    return NextResponse.json(rule)
  } catch (err) {
    console.error('Rule detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch rule' }, { status: 500 })
  }
}

/**
 * PUT /api/rules/:id — update a rule.
 */
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
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
    const updated = await updateRule(params.id, {
      ...parsed.data,
      description: parsed.data.description || null,
      conditions: parsed.data.conditions,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }

    return NextResponse.json({ status: 'updated', id: params.id })
  } catch (err) {
    console.error('Update rule error:', err)
    return NextResponse.json({ error: 'Failed to update rule' }, { status: 500 })
  }
}
