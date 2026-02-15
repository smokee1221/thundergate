import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { evaluate } from '@thundergate/engine'
import type { RequestContext, Rule, MatchResult } from '@thundergate/engine'
import { getRules, getRuleById } from '@/lib/data'

/**
 * POST /api/rules/test — dry-run a sample request against all active rules.
 * Body: { method, url, headers, body }
 * Returns the evaluation result.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    method: string
    url: string
    headers?: Record<string, string>
    body?: unknown
  }

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.method || !body.url) {
    return NextResponse.json(
      { error: 'method and url are required' },
      { status: 400 },
    )
  }

  try {
    // Fetch all rules (list only has metadata, need conditions from detail)
    const allRules = await getRules()

    const fullRules: Rule[] = []
    for (const r of allRules) {
      const detail = await getRuleById(r.id)
      if (detail) {
        fullRules.push({
          id: detail.id,
          name: detail.name,
          priority: detail.priority,
          conditions: detail.conditions as Rule['conditions'],
          action: detail.action as Rule['action'],
          severity: detail.severity as Rule['severity'],
          enabled: detail.enabled,
        })
      }
    }

    const requestContext: RequestContext = {
      method: body.method.toUpperCase(),
      url: body.url,
      headers: body.headers ?? {},
      body: body.body,
    }

    const result = evaluate(requestContext, fullRules)

    return NextResponse.json({
      decision: result.decision,
      riskScore: result.riskScore,
      matchedRules: result.matchedRules.map((m: MatchResult) => ({
        ruleId: m.rule.id,
        ruleName: m.rule.name,
        action: m.rule.action,
        severity: m.rule.severity,
        reasons: m.reasons,
      })),
      reasons: result.reasons,
      totalRulesEvaluated: fullRules.filter((r) => r.enabled).length,
    })
  } catch (err) {
    console.error('Rule test error:', err)
    return NextResponse.json({ error: 'Failed to evaluate' }, { status: 500 })
  }
}
