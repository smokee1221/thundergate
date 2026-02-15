import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuditLogDetail } from '@/lib/data'

/**
 * GET /api/audit/:id — get a single audit log with full context.
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
    const item = await getAuditLogDetail(params.id)
    if (!item) {
      return NextResponse.json({ error: 'Audit log not found' }, { status: 404 })
    }
    return NextResponse.json(item)
  } catch (err) {
    console.error('Audit detail error:', err)
    return NextResponse.json({ error: 'Failed to fetch audit log' }, { status: 500 })
  }
}
