import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { claimQueueItem } from '@/lib/data'

/**
 * POST /api/queue/:id/claim — claim a queue item for the current operator.
 */
export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const operatorId = session.user.id
  const role = session.user.role

  // Only ADMIN and OPERATOR can claim items
  if (role !== 'ADMIN' && role !== 'OPERATOR') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 },
    )
  }

  try {
    const claimed = await claimQueueItem(params.id, operatorId)

    if (!claimed) {
      return NextResponse.json(
        { error: 'Item is no longer available for claiming' },
        { status: 409 },
      )
    }

    return NextResponse.json({ status: 'claimed', queueId: params.id })
  } catch (err) {
    console.error('Claim API error:', err)
    return NextResponse.json(
      { error: 'Failed to claim queue item' },
      { status: 500 },
    )
  }
}
