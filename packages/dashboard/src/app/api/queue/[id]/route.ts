import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQueueItemDetail } from '@/lib/data'

/**
 * GET /api/queue/:id — returns a single queue item with full context.
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
    const item = await getQueueItemDetail(params.id)
    if (!item) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 },
      )
    }

    return NextResponse.json(item)
  } catch (err) {
    console.error('Queue detail API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch queue item' },
      { status: 500 },
    )
  }
}
