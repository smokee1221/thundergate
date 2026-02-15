'use client'

import { useState, useEffect } from 'react'
import {
  Settings,
  Clock,
  Zap,
  Database,
  Server,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/toast'
import { Button } from '@/components/ui/button'

interface SystemHealth {
  database: { status: 'ok' | 'error'; latencyMs: number }
  proxy: { status: 'ok' | 'error'; latencyMs: number }
  queueDepth: number
}

export default function SettingsPage() {
  const { addToast } = useToast()
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)

  // Settings state (stored locally for MVP; would be persisted in production)
  const [escalationT1, setEscalationT1] = useState(300)
  const [escalationT2, setEscalationT2] = useState(600)
  const [rateLimit, setRateLimit] = useState(100)
  const [maxPayload, setMaxPayload] = useState(1024)

  async function checkHealth() {
    setCheckingHealth(true)
    try {
      // Check database via any API call
      const dbStart = Date.now()
      const dbRes = await fetch('/api/audit?limit=1')
      const dbLatency = Date.now() - dbStart

      // Check proxy
      const proxyStart = Date.now()
      let proxyStatus: 'ok' | 'error' = 'error'
      let proxyLatency = 0
      try {
        const proxyRes = await fetch('/api/queue/stats')
        proxyLatency = Date.now() - proxyStart
        proxyStatus = proxyRes.ok ? 'ok' : 'error'
      } catch {
        proxyLatency = Date.now() - proxyStart
      }

      // Queue depth
      let queueDepth = 0
      try {
        const statsRes = await fetch('/api/queue/stats')
        if (statsRes.ok) {
          const stats = (await statsRes.json()) as { pending: number; escalated: number }
          queueDepth = stats.pending + stats.escalated
        }
      } catch {
        // ignore
      }

      setHealth({
        database: { status: dbRes.ok ? 'ok' : 'error', latencyMs: dbLatency },
        proxy: { status: proxyStatus, latencyMs: proxyLatency },
        queueDepth,
      })
    } catch {
      addToast({ type: 'error', title: 'Health check failed' })
    } finally {
      setCheckingHealth(false)
    }
  }

  useEffect(() => {
    void checkHealth()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleSave() {
    // In MVP, settings are ephemeral (would persist to DB in production)
    addToast({
      type: 'info',
      title: 'Settings saved',
      description: 'Settings are stored for this session. Persistent storage coming in production.',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          System configuration and health monitoring
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Escalation Timeouts */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Escalation Timeouts
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Tier 1 Timeout (seconds)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={60}
                  max={1800}
                  step={60}
                  value={escalationT1}
                  onChange={(e) => setEscalationT1(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-foreground w-16 text-right">
                  {escalationT1}s
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Time before unclaimed items are escalated ({Math.floor(escalationT1 / 60)}m)
              </p>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Tier 2 Timeout (seconds)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={60}
                  max={3600}
                  step={60}
                  value={escalationT2}
                  onChange={(e) => setEscalationT2(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-foreground w-16 text-right">
                  {escalationT2}s
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Time before escalated items auto-reject ({Math.floor(escalationT2 / 60)}m)
              </p>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="bg-card rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              Rate Limiting
            </h3>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Default Rate Limit (req/s per agent)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={1000}
                  step={10}
                  value={rateLimit}
                  onChange={(e) => setRateLimit(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-foreground w-20 text-right">
                  {rateLimit} req/s
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">
                Max Payload Size (KB)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={64}
                  max={10240}
                  step={64}
                  value={maxPayload}
                  onChange={(e) => setMaxPayload(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono text-foreground w-20 text-right">
                  {maxPayload} KB
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          Save Settings
        </Button>
      </div>

      {/* System Health */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">System Health</h3>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void checkHealth()}
            disabled={checkingHealth}
          >
            <RefreshCw
              className={cn('w-3.5 h-3.5', checkingHealth && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>

        {health ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Database */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <Database
                className={cn(
                  'w-5 h-5',
                  health.database.status === 'ok'
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              />
              <div>
                <p className="text-sm font-medium text-foreground">Database</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {health.database.status === 'ok' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {health.database.status === 'ok' ? 'Connected' : 'Error'}
                    {' · '}
                    {health.database.latencyMs}ms
                  </span>
                </div>
              </div>
            </div>

            {/* API Service */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <Server
                className={cn(
                  'w-5 h-5',
                  health.proxy.status === 'ok'
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              />
              <div>
                <p className="text-sm font-medium text-foreground">API Service</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {health.proxy.status === 'ok' ? (
                    <CheckCircle className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3 h-3 text-red-400" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {health.proxy.status === 'ok' ? 'Running' : 'Error'}
                    {' · '}
                    {health.proxy.latencyMs}ms
                  </span>
                </div>
              </div>
            </div>

            {/* Queue */}
            <div className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border">
              <Zap
                className={cn(
                  'w-5 h-5',
                  health.queueDepth > 50
                    ? 'text-amber-400'
                    : 'text-emerald-400',
                )}
              />
              <div>
                <p className="text-sm font-medium text-foreground">Queue Depth</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {health.queueDepth} pending items
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-6">
            <div className="inline-block w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}
