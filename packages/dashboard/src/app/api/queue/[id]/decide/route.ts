import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { decideQueueItem } from '@/lib/data'
import { fetchFromProxy } from '@/lib/api'

/**
 * POST /api/queue/:id/decide — submit a decision on a claimed queue item.
 * Also notifies the proxy to release any held connection.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const operatorId = session.user.id
  const role = session.user.role

  if (role !== 'ADMIN' && role !== 'OPERATOR') {
    return NextResponse.json(
      { error: 'Insufficient permissions' },
      { status: 403 },
    )
  }

  let body: {
    decision: 'APPROVED' | 'MODIFIED' | 'REJECTED'
    notes?: string
    modifiedPayload?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const validDecisions = ['APPROVED', 'MODIFIED', 'REJECTED']
  if (!body.decision || !validDecisions.includes(body.decision)) {
    return NextResponse.json(
      { error: 'decision must be one of: APPROVED, MODIFIED, REJECTED' },
      { status: 400 },
    )
  }

  try {
    const decided = await decideQueueItem(
      params.id,
      operatorId,
      body.decision,
      body.notes,
      body.modifiedPayload,
    )

    if (!decided) {
      return NextResponse.json(
        { error: 'Item is not in CLAIMED state or not assigned to you' },
        { status: 409 },
      )
    }

    // Also notify the proxy to release any held agent connection
    try {
      await fetchFromProxy(`/api/queue/${params.id}/decide`, {
        method: 'POST',
        body: JSON.stringify({
          operatorId,
          decision: body.decision,
          modifiedPayload: body.modifiedPayload,
          notes: body.notes,
        }),
      })
    } catch {
      // Non-critical — proxy may not have a held connection
    }

    return NextResponse.json({
      status: 'decided',
      queueId: params.id,
      decision: body.decision,
    })
  } catch (err) {
    console.error('Decide API error:', err)
    return NextResponse.json(
      { error: 'Failed to submit decision' },
      { status: 500 },
    )
  }
}
