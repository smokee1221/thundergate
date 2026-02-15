'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, FlaskConical, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { JsonViewer } from '@/components/json-viewer'
import { Button } from '@/components/ui/button'

interface TestResult {
  decision: string
  riskScore: number
  matchedRules: {
    ruleId: string
    ruleName: string
    action: string
    severity: string
    reasons: string[]
  }[]
  reasons: string[]
  totalRulesEvaluated: number
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'text-red-400'
  if (score >= 60) return 'text-amber-400'
  if (score >= 40) return 'text-yellow-400'
  return 'text-emerald-400'
}

export default function RuleTestPage() {
  const router = useRouter()
  const [method, setMethod] = useState('POST')
  const [url, setUrl] = useState('https://jsonplaceholder.typicode.com/users/1')
  const [headersText, setHeadersText] = useState('{}')
  const [bodyText, setBodyText] = useState(
    JSON.stringify({ user: { ssn: '123-45-6789' } }, null, 2),
  )
  const [result, setResult] = useState<TestResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleRun() {
    setRunning(true)
    setError(null)
    setResult(null)

    let parsedHeaders: Record<string, string> = {}
    let parsedBody: unknown

    try {
      parsedHeaders = JSON.parse(headersText || '{}')
    } catch {
      setError('Invalid JSON in headers')
      setRunning(false)
      return
    }

    try {
      parsedBody = bodyText.trim() ? JSON.parse(bodyText) : undefined
    } catch {
      setError('Invalid JSON in body')
      setRunning(false)
      return
    }

    try {
      const response = await fetch('/api/rules/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          method,
          url,
          headers: parsedHeaders,
          body: parsedBody,
        }),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }

      const data = (await response.json()) as TestResult
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run test')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <button
        onClick={() => router.push('/rules')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rules
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="w-5 h-5 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Rule Dry Run</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Test a sample request against all active rules
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Input */}
        <div className="space-y-4">
          <div className="bg-card rounded-xl border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Sample Request</h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-foreground mb-1">URL</label>
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Headers (JSON)</label>
              <textarea
                value={headersText}
                onChange={(e) => setHeadersText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Body (JSON)</label>
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>

            <Button
              onClick={() => void handleRun()}
              disabled={running || !url}
              className="w-full"
            >
              <Play className="w-4 h-4" />
              {running ? 'Evaluating...' : 'Run Evaluation'}
            </Button>
          </div>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {result && (
            <>
              {/* Decision card */}
              <div className="bg-card rounded-xl border border-border p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Result</h3>
                <div className="flex items-center gap-4">
                  <StatusBadge status={result.decision} className="text-sm px-3 py-1" />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Risk Score:</span>
                    <span className={cn('text-lg font-bold', getRiskColor(result.riskScore))}>
                      {result.riskScore}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {result.totalRulesEvaluated} rules evaluated
                  </span>
                </div>
              </div>

              {/* Matched rules */}
              {result.matchedRules.length > 0 && (
                <div className="bg-card rounded-xl border border-border p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-3">
                    Matched Rules ({result.matchedRules.length})
                  </h3>
                  <div className="space-y-3">
                    {result.matchedRules.map((rule) => (
                      <div
                        key={rule.ruleId}
                        className="border border-border rounded-lg p-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {rule.ruleName}
                          </span>
                          <StatusBadge status={rule.action} />
                          <StatusBadge status={rule.severity} />
                        </div>
                        {rule.reasons.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {rule.reasons.map((reason, i) => (
                              <li key={i} className="text-xs text-muted-foreground">
                                • {reason}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All reasons */}
              {result.reasons.length > 0 && (
                <JsonViewer data={result.reasons} label="All Reasons" collapsed />
              )}

              {/* Full result JSON */}
              <JsonViewer data={result} label="Full Evaluation Result" collapsed />
            </>
          )}

          {!result && !error && (
            <div className="bg-card rounded-xl border border-border p-12 text-center">
              <FlaskConical className="w-10 h-10 text-muted-foreground/50 mx-auto" />
              <h3 className="mt-3 text-sm font-medium text-foreground">
                Configure a sample request
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Fill in the request details and click &ldquo;Run Evaluation&rdquo; to test against active rules.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
