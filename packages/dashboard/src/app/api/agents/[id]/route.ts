import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAgentDetail, updateAgent, getAgentRecentRequests } from '@/lib/data'

/**
 * GET /api/agents/[id] — get agent detail with stats.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [detail, recentRequests] = await Promise.all([
      getAgentDetail(params.id),
      getAgentRecentRequests(params.id),
    ])

    if (!detail) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({ ...detail, recentRequests })
  } catch (err) {
    console.error('Agent detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch agent' }, { status: 500 })
  }
}

/**
 * PUT /api/agents/[id] — update agent name/description.
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
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json() as { name?: string; description?: string | null }

    const updated = await updateAgent(params.id, {
      name: body.name?.trim() || undefined,
      description: body.description !== undefined ? body.description : undefined,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Agent update error:', err)
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 })
  }
}
