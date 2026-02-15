import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getApiTarget, updateApiTarget } from '@/lib/data'

/**
 * GET /api/targets/[id] — get target detail.
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
    const target = await getApiTarget(params.id)
    if (!target) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }
    return NextResponse.json(target)
  } catch (err) {
    console.error('Target detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch target' }, { status: 500 })
  }
}

/**
 * PUT /api/targets/[id] — update an API target.
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
    const body = await request.json() as {
      name?: string
      baseUrl?: string
      riskTier?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      headers?: Record<string, string>
      isActive?: boolean
    }

    const updated = await updateApiTarget(params.id, {
      name: body.name?.trim() || undefined,
      baseUrl: body.baseUrl?.trim() || undefined,
      riskTier: body.riskTier,
      headers: body.headers,
      isActive: body.isActive,
    })

    if (!updated) {
      return NextResponse.json({ error: 'Target not found' }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Target update error:', err)
    return NextResponse.json({ error: 'Failed to update target' }, { status: 500 })
  }
}
