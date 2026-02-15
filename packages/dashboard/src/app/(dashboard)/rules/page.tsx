'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  ShieldCheck,
  Plus,
  FlaskConical,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { RuleListItem } from '@/lib/data'

const actionOptions = ['All', 'ALLOW', 'BLOCK', 'FLAG_FOR_REVIEW', 'MODIFY']
const severityOptions = ['All', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL']

function formatTimeAgo(date: Date | string | null): string {
  if (!date) return 'Never'
  const diff = Date.now() - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function RulesPage() {
  const [rules, setRules] = useState<RuleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionFilter, setActionFilter] = useState('All')
  const [severityFilter, setSeverityFilter] = useState('All')
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all')

  const fetchRules = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (actionFilter !== 'All') params.set('action', actionFilter)
      if (severityFilter !== 'All') params.set('severity', severityFilter)
      if (enabledFilter !== 'all') params.set('enabled', enabledFilter === 'enabled' ? 'true' : 'false')

      const response = await fetch(`/api/rules?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = (await response.json()) as { items: RuleListItem[] }
      setRules(data.items)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules')
    } finally {
      setLoading(false)
    }
  }, [actionFilter, severityFilter, enabledFilter])

  useEffect(() => {
    void fetchRules()
  }, [fetchRules])

  async function handleToggle(ruleId: string, currentEnabled: boolean) {
    try {
      const response = await fetch(`/api/rules/${ruleId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled }),
      })
      if (!response.ok) throw new Error('Failed to toggle')
      setRules((prev) =>
        prev.map((r) =>
          r.id === ruleId ? { ...r, enabled: !currentEnabled } : r,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle rule')
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Rules</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage firewall evaluation rules · {rules.length} total
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/rules/test" className="gap-1.5">
              <FlaskConical className="w-4 h-4" />
              Dry Run
            </Link>
          </Button>
          <Button asChild>
            <Link href="/rules/new" className="gap-1.5">
              <Plus className="w-4 h-4" />
              New Rule
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Action:</span>
          <div className="flex gap-1">
            {actionOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setActionFilter(opt)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  actionFilter === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground border border-border hover:bg-accent',
                )}
              >
                {opt === 'FLAG_FOR_REVIEW' ? 'FLAG' : opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Severity:</span>
          <div className="flex gap-1">
            {severityOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => setSeverityFilter(opt)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  severityFilter === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground border border-border hover:bg-accent',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Status:</span>
          <div className="flex gap-1">
            {(['all', 'enabled', 'disabled'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => setEnabledFilter(opt)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors',
                  enabledFilter === opt
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-muted-foreground border border-border hover:bg-accent',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Loading rules...</p>
        </div>
      )}

      {/* Empty */}
      {!loading && rules.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <ShieldCheck className="w-10 h-10 text-muted-foreground/50 mx-auto" />
          <h3 className="mt-3 text-sm font-medium text-foreground">No rules found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Create your first rule to start protecting agent requests.
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && rules.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted border-b border-border">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Priority
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Action
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Severity
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Hits
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Triggered
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Enabled
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rules.map((rule) => (
                <tr
                  key={rule.id}
                  className={cn(
                    'transition-colors hover:bg-white/[0.02]',
                    !rule.enabled && 'opacity-60',
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {rule.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <Link
                        href={`/rules/${rule.id}`}
                        className="text-sm font-medium text-foreground hover:text-primary"
                      >
                        {rule.name}
                      </Link>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]">
                          {rule.description}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rule.action} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rule.severity} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground font-medium">
                      {rule.hitCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(rule.lastTriggeredAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => void handleToggle(rule.id, rule.enabled)}
                      className="text-muted-foreground hover:text-foreground"
                      title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                    >
                      {rule.enabled ? (
                        <ToggleRight className="w-6 h-6 text-emerald-400" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/rules/${rule.id}`}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
