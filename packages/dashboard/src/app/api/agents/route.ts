import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAgents, createAgent } from '@/lib/data'

/**
 * GET /api/agents — list all agents.
 */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const agentsList = await getAgents()
    return NextResponse.json(agentsList)
  } catch (err) {
    console.error('Agents list error:', err)
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 })
  }
}

/**
 * POST /api/agents — register a new agent.
 * Only ADMIN can register agents.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json() as { name: string; description?: string }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const result = await createAgent({
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (err) {
    console.error('Agent create error:', err)
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
  }
}
