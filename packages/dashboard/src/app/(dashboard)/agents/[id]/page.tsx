'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Bot,
  Activity,
  Shield,
  Key,
  Power,
  PowerOff,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { useToast } from '@/components/toast'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { ApiKeyDisplay } from '@/components/api-key-display'
import { Button } from '@/components/ui/button'

interface AgentDetailData {
  id: string
  name: string
  description: string | null
  isActive: boolean
  metadata: unknown
  createdAt: string
  updatedAt: string
  totalRequests: number
  requestCount24h: number
  lastActiveAt: string | null
  decisionBreakdown: {
    allowed: number
    blocked: number
    flagged: number
    modified: number
  }
  topRules: { ruleId: string; ruleName: string; count: number }[]
  recentRequests: {
    id: string
    requestMethod: string
    requestUrl: string
    riskScore: number
    engineDecision: string
    humanDecision: string | null
    latencyMs: number
    createdAt: string
  }[]
}

export default function AgentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const agentId = params.id as string
  const { addToast } = useToast()

  const [agent, setAgent] = useState<AgentDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [showRotateConfirm, setShowRotateConfirm] = useState(false)
  const [showToggleConfirm, setShowToggleConfirm] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    async function fetchAgent() {
      try {
        const res = await fetch(`/api/agents/${agentId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setError('Agent not found')
            return
          }
          throw new Error(`HTTP ${res.status}`)
        }
        const data = (await res.json()) as AgentDetailData
        setAgent(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    void fetchAgent()
  }, [agentId])

  async function handleRotateKey() {
    setShowRotateConfirm(false)
    setRotating(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/rotate-key`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed')
      const data = (await res.json()) as { apiKey: string }
      setNewApiKey(data.apiKey)
      addToast({ type: 'success', title: 'API key rotated successfully' })
    } catch {
      addToast({ type: 'error', title: 'Failed to rotate API key' })
    } finally {
      setRotating(false)
    }
  }

  async function handleToggle() {
    if (!agent) return
    setShowToggleConfirm(false)
    setToggling(true)
    try {
      const res = await fetch(`/api/agents/${agentId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !agent.isActive }),
      })
      if (!res.ok) throw new Error('Failed')
      setAgent((prev) => (prev ? { ...prev, isActive: !prev.isActive } : null))
      addToast({
        type: 'success',
        title: `Agent ${agent.isActive ? 'deactivated' : 'activated'}`,
      })
    } catch {
      addToast({ type: 'error', title: 'Failed to toggle agent' })
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/agents')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </button>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error ?? 'Not found'}
        </div>
      </div>
    )
  }

  const total =
    agent.decisionBreakdown.allowed +
    agent.decisionBreakdown.blocked +
    agent.decisionBreakdown.flagged +
    agent.decisionBreakdown.modified

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <button
        onClick={() => router.push('/agents')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Agents
      </button>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              agent.isActive
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{agent.name}</h2>
            {agent.description && (
              <p className="text-sm text-muted-foreground">{agent.description}</p>
            )}
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ml-2',
              agent.isActive
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-muted text-muted-foreground border border-border',
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                agent.isActive ? 'bg-emerald-500' : 'bg-muted-foreground',
              )}
            />
            {agent.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowRotateConfirm(true)}
            disabled={rotating}
          >
            <Key className="w-4 h-4" />
            Rotate Key
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowToggleConfirm(true)}
            disabled={toggling}
            className={cn(
              agent.isActive
                ? 'text-red-400 border-red-500/20 hover:bg-red-500/10'
                : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10',
            )}
          >
            {agent.isActive ? (
              <>
                <PowerOff className="w-4 h-4" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="w-4 h-4" />
                Activate
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground font-mono">{agent.id}</p>

      {/* New API key banner */}
      {newApiKey && (
        <ApiKeyDisplay apiKey={newApiKey} onDismiss={() => setNewApiKey(null)} />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Main content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">Total Requests</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {agent.totalRequests.toLocaleString()}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-muted-foreground font-medium">24h Requests</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {agent.requestCount24h.toLocaleString()}
              </p>
            </div>
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">Last Active</span>
              </div>
              <p className="text-sm font-medium text-foreground mt-1">
                {agent.lastActiveAt
                  ? new Date(agent.lastActiveAt).toLocaleString()
                  : 'Never'}
              </p>
            </div>
          </div>

          {/* Decision breakdown */}
          {total > 0 && (
            <div className="bg-card rounded-xl border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Decision Breakdown
              </h3>
              <div className="space-y-3">
                {[
                  {
                    label: 'Allowed',
                    value: agent.decisionBreakdown.allowed,
                    color: 'bg-emerald-500',
                    icon: CheckCircle,
                  },
                  {
                    label: 'Blocked',
                    value: agent.decisionBreakdown.blocked,
                    color: 'bg-destructive',
                    icon: XCircle,
                  },
                  {
                    label: 'Flagged',
                    value: agent.decisionBreakdown.flagged,
                    color: 'bg-amber-500',
                    icon: AlertTriangle,
                  },
                  {
                    label: 'Modified',
                    value: agent.decisionBreakdown.modified,
                    color: 'bg-primary',
                    icon: Pencil,
                  },
                ].map(({ label, value, color, icon: Icon }) => (
                  <div key={label} className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground w-20">{label}</span>
                    <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', color)}
                        style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-mono text-foreground w-16 text-right">
                      {value.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Requests */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Recent Requests
              </h3>
            </div>
            <div className="divide-y divide-border">
              {agent.recentRequests.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  No requests yet from this agent.
                </div>
              ) : (
                agent.recentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-white/[0.02] cursor-pointer transition-colors"
                    onClick={() => router.push(`/audit/${req.id}`)}
                  >
                    <StatusBadge status={req.engineDecision} />
                    <span className="font-mono text-xs text-muted-foreground w-14">
                      {req.requestMethod}
                    </span>
                    <span className="flex-1 truncate text-foreground font-mono text-xs">
                      {req.requestUrl}
                    </span>
                    <span
                      className={cn(
                        'text-xs font-medium px-1.5 py-0.5 rounded',
                        req.riskScore >= 80
                          ? 'bg-red-500/10 text-red-400'
                          : req.riskScore >= 60
                            ? 'bg-amber-500/10 text-amber-400'
                            : req.riskScore >= 40
                              ? 'bg-yellow-500/10 text-yellow-400'
                              : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {req.riskScore}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {req.latencyMs}ms
                    </span>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {new Date(req.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-5">
          {/* Top Matched Rules */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Top Matched Rules
              </h3>
            </div>
            {agent.topRules.length === 0 ? (
              <p className="text-xs text-muted-foreground">No rules matched yet</p>
            ) : (
              <div className="space-y-2">
                {agent.topRules.map((rule) => (
                  <div
                    key={rule.ruleId}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground truncate flex-1">
                      {rule.ruleName}
                    </span>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                      {rule.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Details</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">
                  {new Date(agent.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Updated</span>
                <span className="text-foreground">
                  {new Date(agent.updatedAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm dialogs */}
      <ConfirmDialog
        open={showRotateConfirm}
        title="Rotate API Key"
        description="This will generate a new API key and invalidate the current one. The agent will need to be updated with the new key. Continue?"
        confirmLabel="Rotate Key"
        variant="warning"
        onConfirm={() => void handleRotateKey()}
        onCancel={() => setShowRotateConfirm(false)}
      />
      <ConfirmDialog
        open={showToggleConfirm}
        title={`${agent.isActive ? 'Deactivate' : 'Activate'} Agent`}
        description={
          agent.isActive
            ? `Deactivating "${agent.name}" will block all requests from this agent immediately.`
            : `Reactivating "${agent.name}" will allow it to send requests through the firewall.`
        }
        confirmLabel={agent.isActive ? 'Deactivate' : 'Activate'}
        variant={agent.isActive ? 'danger' : 'default'}
        onConfirm={() => void handleToggle()}
        onCancel={() => setShowToggleConfirm(false)}
      />
    </div>
  )
}
