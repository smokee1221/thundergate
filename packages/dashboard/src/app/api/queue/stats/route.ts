import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getQueueStats } from '@/lib/data'

/**
 * GET /api/queue/stats — queue statistics for the dashboard.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const stats = await getQueueStats()
    return NextResponse.json(stats)
  } catch (err) {
    console.error('Queue stats API error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch queue stats' },
      { status: 500 },
    )
  }
}
