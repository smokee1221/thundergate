import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { testApiTargetConnectivity } from '@/lib/data'

/**
 * POST /api/targets/test — test connectivity to a URL.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json() as { url: string }

    if (!body.url?.trim()) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const result = await testApiTargetConnectivity(body.url.trim())
    return NextResponse.json(result)
  } catch (err) {
    console.error('Connectivity test error:', err)
    return NextResponse.json({ error: 'Test failed' }, { status: 500 })
  }
}
