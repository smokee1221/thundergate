import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rotateAgentKey } from '@/lib/data'

/**
 * POST /api/agents/[id]/rotate-key — rotate API key.
 * Returns new plain-text key (shown once).
 */
export async function POST(
  _request: Request,
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
    const newKey = await rotateAgentKey(params.id)
    if (!newKey) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json({ apiKey: newKey })
  } catch (err) {
    console.error('Key rotation error:', err)
    return NextResponse.json({ error: 'Failed to rotate key' }, { status: 500 })
  }
}
