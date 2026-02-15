'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bot,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Activity,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/toast'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Button } from '@/components/ui/button'

interface Agent {
  id: string
  name: string
  description: string | null
  isActive: boolean
  metadata: unknown
  createdAt: string
  updatedAt: string
  requestCount24h: number
  lastActiveAt: string | null
}

function timeAgo(date: string | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function AgentsPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<string | null>(null)
  const [confirmToggle, setConfirmToggle] = useState<Agent | null>(null)

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json() as Agent[]
      setAgents(data)
    } catch {
      addToast({ type: 'error', title: 'Failed to load agents' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  async function handleToggle(agent: Agent) {
    setConfirmToggle(null)
    setToggling(agent.id)
    try {
      const res = await fetch(`/api/agents/${agent.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !agent.isActive }),
      })
      if (!res.ok) throw new Error('Failed')
      addToast({
        type: 'success',
        title: `Agent ${agent.isActive ? 'deactivated' : 'activated'}`,
        description: agent.name,
      })
      void fetchAgents()
    } catch {
      addToast({ type: 'error', title: 'Failed to toggle agent' })
    } finally {
      setToggling(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Agents</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage registered AI agents and their API keys
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchAgents()}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => router.push('/agents/new')}>
            <Plus className="w-4 h-4" />
            Register Agent
          </Button>
        </div>
      </div>

      {/* Agents Table */}
      {agents.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Bot className="w-12 h-12 text-muted-foreground/50 mx-auto" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            No agents registered
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Register an agent to get started with the firewall.
          </p>
          <Button
            onClick={() => router.push('/agents/new')}
            className="mt-4"
          >
            <Plus className="w-4 h-4" />
            Register Agent
          </Button>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                  Agent
                </th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                  <div className="flex items-center justify-end gap-1">
                    <Activity className="w-3.5 h-3.5" />
                    24h Requests
                  </div>
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                  <div className="flex items-center justify-end gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Last Active
                  </div>
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                  Created
                </th>
                <th className="text-right px-5 py-3 font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agents.map((agent) => (
                <tr
                  key={agent.id}
                  className="hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => router.push(`/agents/${agent.id}`)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center',
                          agent.isActive
                            ? 'bg-primary/10 text-primary'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        <Bot className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{agent.name}</p>
                        {agent.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">
                            {agent.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full',
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
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="font-mono text-foreground">
                      {agent.requestCount24h.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    {timeAgo(agent.lastActiveAt)}
                  </td>
                  <td className="px-5 py-3 text-right text-muted-foreground">
                    {new Date(agent.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setConfirmToggle(agent)
                      }}
                      disabled={toggling === agent.id}
                      className={cn(
                        'p-1.5 rounded-lg border transition-colors',
                        agent.isActive
                          ? 'text-red-400 border-red-500/20 hover:bg-red-500/10'
                          : 'text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10',
                        toggling === agent.id && 'opacity-50',
                      )}
                      title={agent.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {agent.isActive ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirm toggle dialog */}
      {confirmToggle && (
        <ConfirmDialog
          open
          title={`${confirmToggle.isActive ? 'Deactivate' : 'Activate'} Agent`}
          description={
            confirmToggle.isActive
              ? `Deactivating "${confirmToggle.name}" will block all requests from this agent. Are you sure?`
              : `Reactivating "${confirmToggle.name}" will allow it to send requests through the firewall.`
          }
          confirmLabel={confirmToggle.isActive ? 'Deactivate' : 'Activate'}
          variant={confirmToggle.isActive ? 'danger' : 'default'}
          onConfirm={() => void handleToggle(confirmToggle)}
          onCancel={() => setConfirmToggle(null)}
        />
      )}
    </div>
  )
}
