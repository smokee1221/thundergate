import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQueueItems, getQueueStats } from '@/lib/data'

/**
 * GET /api/queue — returns queue items with optional status filter.
 * Used by the client-side polling hook.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 200)
  const offset = Number(searchParams.get('offset') ?? 0)
  const includeStats = searchParams.get('stats') === 'true'

  const statusFilter = status?.split(',').filter(Boolean)

  try {
    const [queueResult, stats] = await Promise.all([
      getQueueItems(statusFilter, limit, offset),
      includeStats ? getQueueStats() : null,
    ])

    return NextResponse.json({
      items: queueResult.items,
      total: queueResult.total,
      limit,
      offset,
      ...(stats ? { stats } : {}),
    })
  } catch (err) {
    console.error('Queue API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch queue items' },
      { status: 500 },
    )
  }
}
