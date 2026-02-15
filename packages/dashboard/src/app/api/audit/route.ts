import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAuditLogs } from '@/lib/data'

/**
 * GET /api/audit — list audit logs with filters and pagination.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)

  try {
    const result = await getAuditLogs({
      search: searchParams.get('search') ?? undefined,
      agentId: searchParams.get('agentId') ?? undefined,
      decision: searchParams.get('decision') ?? undefined,
      ruleId: searchParams.get('ruleId') ?? undefined,
      riskScoreMin: searchParams.get('riskScoreMin')
        ? Number(searchParams.get('riskScoreMin'))
        : undefined,
      riskScoreMax: searchParams.get('riskScoreMax')
        ? Number(searchParams.get('riskScoreMax'))
        : undefined,
      dateFrom: searchParams.get('dateFrom')
        ? new Date(searchParams.get('dateFrom')!)
        : undefined,
      dateTo: searchParams.get('dateTo')
        ? new Date(searchParams.get('dateTo')!)
        : undefined,
      sortBy: searchParams.get('sortBy') ?? undefined,
      sortDir: (searchParams.get('sortDir') as 'asc' | 'desc') ?? undefined,
      limit: Number(searchParams.get('limit') ?? 50),
      offset: Number(searchParams.get('offset') ?? 0),
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Audit API error:', err)
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 })
  }
}
