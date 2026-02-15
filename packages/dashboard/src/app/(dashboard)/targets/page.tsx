'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  Plus,
  Wifi,
  WifiOff,
  RefreshCw,
  ExternalLink,
  Check,
  X,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { useToast } from '@/components/toast'
import { Button } from '@/components/ui/button'

interface ApiTarget {
  id: string
  name: string
  baseUrl: string
  riskTier: string
  headers: unknown
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface ConnectivityResult {
  ok: boolean
  statusCode?: number
  latencyMs: number
  error?: string
}

export default function TargetsPage() {
  const { addToast } = useToast()
  const [targets, setTargets] = useState<ApiTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, ConnectivityResult>>({})

  // Form state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formRisk, setFormRisk] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('MEDIUM')
  const [saving, setSaving] = useState(false)

  const fetchTargets = useCallback(async () => {
    try {
      const res = await fetch('/api/targets')
      if (!res.ok) throw new Error('Failed')
      const data = await res.json() as ApiTarget[]
      setTargets(data)
    } catch {
      addToast({ type: 'error', title: 'Failed to load targets' })
    } finally {
      setLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    void fetchTargets()
  }, [fetchTargets])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!formName.trim() || !formUrl.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          baseUrl: formUrl.trim(),
          riskTier: formRisk,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      addToast({ type: 'success', title: 'API target created' })
      setFormName('')
      setFormUrl('')
      setFormRisk('MEDIUM')
      setShowForm(false)
      void fetchTargets()
    } catch {
      addToast({ type: 'error', title: 'Failed to create target' })
    } finally {
      setSaving(false)
    }
  }

  async function handleTest(target: ApiTarget) {
    setTesting(target.id)
    try {
      const res = await fetch('/api/targets/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target.baseUrl }),
      })
      if (!res.ok) throw new Error('Failed')
      const result = (await res.json()) as ConnectivityResult
      setTestResults((prev) => ({ ...prev, [target.id]: result }))
      addToast({
        type: result.ok ? 'success' : 'warning',
        title: result.ok ? 'Connection successful' : 'Connection failed',
        description: result.ok
          ? `${target.name}: HTTP ${result.statusCode} in ${result.latencyMs}ms`
          : `${target.name}: ${result.error}`,
      })
    } catch {
      addToast({ type: 'error', title: 'Connectivity test failed' })
    } finally {
      setTesting(null)
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
          <h2 className="text-xl font-bold text-foreground">API Targets</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Manage downstream APIs that agents connect to through the firewall
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => void fetchTargets()}
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" />
            Add Target
          </Button>
        </div>
      </div>

      {/* Add Form */}
      {showForm && (
        <form
          onSubmit={(e) => void handleCreate(e)}
          className="bg-card rounded-xl border border-border p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-foreground">New API Target</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Name *</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g., OpenAI API"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Base URL *</label>
              <input
                type="url"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                placeholder="https://api.openai.com"
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Risk Tier</label>
              <select
                value={formRisk}
                onChange={(e) => setFormRisk(e.target.value as typeof formRisk)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
            <Button
              type="submit"
              disabled={saving || !formName.trim() || !formUrl.trim()}
            >
              {saving ? 'Creating...' : 'Create Target'}
            </Button>
          </div>
        </form>
      )}

      {/* Targets List */}
      {targets.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Globe className="w-12 h-12 text-muted-foreground/50 mx-auto" />
          <h3 className="mt-4 text-sm font-medium text-foreground">
            No API targets configured
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Add downstream APIs that agents will connect to through the firewall.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {targets.map((target) => {
            const testResult = testResults[target.id]
            return (
              <div
                key={target.id}
                className="bg-card rounded-xl border border-border p-5 hover:border-border/80 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        target.isActive
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {target.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
                          {target.baseUrl}
                        </code>
                        <a
                          href={target.baseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <StatusBadge status={target.riskTier} />
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 text-xs',
                            target.isActive ? 'text-emerald-400' : 'text-muted-foreground',
                          )}
                        >
                          {target.isActive ? (
                            <Wifi className="w-3 h-3" />
                          ) : (
                            <WifiOff className="w-3 h-3" />
                          )}
                          {target.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Test result indicator */}
                    {testResult && (
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border',
                          testResult.ok
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20',
                        )}
                      >
                        {testResult.ok ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        {testResult.ok
                          ? `${testResult.statusCode} · ${testResult.latencyMs}ms`
                          : 'Failed'}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleTest(target)}
                      disabled={testing === target.id}
                    >
                      {testing === target.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wifi className="w-3.5 h-3.5" />
                      )}
                      Test
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
