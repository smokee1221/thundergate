import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getApiTargets, createApiTarget } from '@/lib/data'

/**
 * GET /api/targets — list all API targets.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const targets = await getApiTargets()
    return NextResponse.json(targets)
  } catch (err) {
    console.error('Targets list error:', err)
    return NextResponse.json({ error: 'Failed to fetch targets' }, { status: 500 })
  }
}

/**
 * POST /api/targets — create a new API target.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json() as {
      name: string
      baseUrl: string
      riskTier: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      headers?: Record<string, string>
    }

    if (!body.name?.trim() || !body.baseUrl?.trim()) {
      return NextResponse.json({ error: 'Name and baseUrl are required' }, { status: 400 })
    }

    const id = await createApiTarget({
      name: body.name.trim(),
      baseUrl: body.baseUrl.trim(),
      riskTier: body.riskTier ?? 'MEDIUM',
      headers: body.headers ?? {},
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('Target create error:', err)
    return NextResponse.json({ error: 'Failed to create target' }, { status: 500 })
  }
}
