import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAgentList, getRuleList } from '@/lib/data'

/**
 * GET /api/audit/filters — get available filter options (agents, rules).
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [agentsList, rulesList] = await Promise.all([
      getAgentList(),
      getRuleList(),
    ])

    return NextResponse.json({ agents: agentsList, rules: rulesList })
  } catch (err) {
    console.error('Filters API error:', err)
    return NextResponse.json({ error: 'Failed to fetch filters' }, { status: 500 })
  }
}
