import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { verifyHashChain } from '@/lib/data'

/**
 * POST /api/audit/verify — verify hash chain integrity.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { dateFrom?: string; dateTo?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine — verify all
  }

  try {
    const result = await verifyHashChain(
      body.dateFrom ? new Date(body.dateFrom) : undefined,
      body.dateTo ? new Date(body.dateTo) : undefined,
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('Verify error:', err)
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
  }
}
