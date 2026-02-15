import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { toggleRule } from '@/lib/data'

/**
 * POST /api/rules/:id/toggle — toggle a rule's enabled status.
 */
export async function POST(
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

  let body: { enabled: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'enabled must be a boolean' },
      { status: 400 },
    )
  }

  try {
    const toggled = await toggleRule(params.id, body.enabled)
    if (!toggled) {
      return NextResponse.json({ error: 'Rule not found' }, { status: 404 })
    }
    return NextResponse.json({ status: 'toggled', enabled: body.enabled })
  } catch (err) {
    console.error('Toggle rule error:', err)
    return NextResponse.json({ error: 'Failed to toggle rule' }, { status: 500 })
  }
}
