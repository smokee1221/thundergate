'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Scroll,
  Search,
  Download,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import type { AuditLogListItem } from '@/lib/data'

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleString()
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'text-red-400 bg-red-500/10'
  if (score >= 60) return 'text-amber-400 bg-amber-500/10'
  if (score >= 40) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-muted-foreground bg-muted'
}

const DECISIONS = ['All', 'ALLOW', 'BLOCK', 'FLAG_FOR_REVIEW', 'MODIFY']
const PAGE_SIZE = 50

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [decision, setDecision] = useState('All')
  const [agentId, setAgentId] = useState('')
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(0)

  // Filter options
  const [agentOptions, setAgentOptions] = useState<{ id: string; name: string }[]>([])

  // Verification
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState<{
    valid: boolean; checked: number; errors: { sequenceNumber: number; id: string; reason: string }[]
  } | null>(null)

  // Load filter options
  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch('/api/audit/filters')
        if (response.ok) {
          const data = await response.json() as { agents: { id: string; name: string }[] }
          setAgentOptions(data.agents)
        }
      } catch { /* ignore */ }
    })()
  }, [])

  const fetchLogs = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (decision !== 'All') params.set('decision', decision)
      if (agentId) params.set('agentId', agentId)
      params.set('sortBy', sortBy)
      params.set('sortDir', sortDir)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))

      const response = await fetch(`/api/audit?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = await response.json() as { items: AuditLogListItem[]; total: number }
      setItems(data.items)
      setTotal(data.total)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs')
    } finally {
      setLoading(false)
    }
  }, [search, decision, agentId, sortBy, sortDir, page])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  function handleSearch() {
    setSearch(searchInput)
    setPage(0)
  }

  function handleSort(column: string) {
    if (sortBy === column) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(column)
      setSortDir('desc')
    }
    setPage(0)
  }

  async function handleVerify() {
    setVerifying(true)
    setVerifyResult(null)
    try {
      const response = await fetch('/api/audit/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!response.ok) throw new Error('Verification failed')
      const result = await response.json() as typeof verifyResult
      setVerifyResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  function handleExport(format: 'csv' | 'json') {
    const params = new URLSearchParams()
    params.set('format', format)
    if (decision !== 'All') params.set('decision', decision)
    window.open(`/api/audit/export?${params}`, '_blank')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Scroll className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Full audit trail · {total} entries
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleVerify()}
            disabled={verifying}
          >
            <ShieldCheck className="w-4 h-4" />
            {verifying ? 'Verifying...' : 'Verify Integrity'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('csv')}
          >
            <Download className="w-4 h-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport('json')}
          >
            <Download className="w-4 h-4" />
            JSON
          </Button>
        </div>
      </div>

      {/* Verification result */}
      {verifyResult && (
        <div
          className={cn(
            'border rounded-lg px-4 py-3 text-sm',
            verifyResult.valid
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive',
          )}
        >
          {verifyResult.valid ? (
            <span>✓ Hash chain verified — {verifyResult.checked} entries checked, no issues found.</span>
          ) : (
            <div>
              <p className="font-medium">✗ Hash chain verification failed — {verifyResult.errors.length} error(s) found:</p>
              <ul className="mt-2 space-y-1">
                {verifyResult.errors.slice(0, 5).map((err, i) => (
                  <li key={i} className="text-xs">
                    Seq #{err.sequenceNumber} ({err.id.slice(0, 8)}...): {err.reason}
                  </li>
                ))}
                {verifyResult.errors.length > 5 && (
                  <li className="text-xs">...and {verifyResult.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Search + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[250px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
              placeholder="Search URL or payload..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <Button
            onClick={handleSearch}
            size="sm"
          >
            Search
          </Button>
        </div>

        {/* Decision filter */}
        <div className="flex gap-1">
          {DECISIONS.map((d) => (
            <button
              key={d}
              onClick={() => { setDecision(d); setPage(0) }}
              className={cn(
                'px-2.5 py-1.5 text-xs font-medium rounded transition-colors',
                decision === d
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-muted-foreground border border-border hover:bg-accent',
              )}
            >
              {d === 'FLAG_FOR_REVIEW' ? 'FLAG' : d}
            </button>
          ))}
        </div>

        {/* Agent filter */}
        {agentOptions.length > 0 && (
          <select
            value={agentId}
            onChange={(e) => { setAgentId(e.target.value); setPage(0) }}
            className="px-3 py-2 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Agents</option>
            {agentOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}
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
          <p className="mt-3 text-sm text-muted-foreground">Loading audit logs...</p>
        </div>
      )}

      {/* Table */}
      {!loading && items.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted border-b border-border">
                <SortableHeader label="Time" column="createdAt" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Agent</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Request</th>
                <SortableHeader label="Risk" column="riskScore" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Decision</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Human</th>
                <SortableHeader label="Latency" column="latencyMs" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((item) => (
                <tr
                  key={item.id}
                  className={cn(
                    'transition-colors hover:bg-white/[0.02]',
                  )}
                >
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{formatDate(item.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-foreground">
                      {item.agentName ?? item.agentId.slice(0, 8)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {item.requestMethod}
                      </span>
                      <span className="text-xs font-mono text-muted-foreground truncate max-w-[220px]">
                        {item.requestUrl}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('text-xs font-bold px-2 py-0.5 rounded', getRiskColor(item.riskScore))}>
                      {item.riskScore}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.engineDecision} />
                  </td>
                  <td className="px-4 py-3">
                    {item.humanDecision ? (
                      <StatusBadge status={item.humanDecision} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground">{item.latencyMs}ms</span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/audit/${item.id}`}
                      className="text-xs text-primary hover:text-primary/80 font-medium"
                    >
                      Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty */}
      {!loading && items.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <Scroll className="w-10 h-10 text-muted-foreground/50 mx-auto" />
          <h3 className="mt-3 text-sm font-medium text-foreground">No audit logs found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Audit entries will appear here when requests flow through the proxy.
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Page {page + 1} of {totalPages} · {total} entries
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="w-3 h-3" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              Next
              <ChevronRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableHeader({
  label,
  column,
  sortBy,
  sortDir,
  onSort,
}: {
  label: string
  column: string
  sortBy: string
  sortDir: string
  onSort: (col: string) => void
}) {
  const isActive = sortBy === column
  return (
    <th className="text-left px-4 py-3">
      <button
        onClick={() => onSort(column)}
        className={cn(
          'flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition-colors',
          isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {label}
        <ArrowUpDown className="w-3 h-3" />
        {isActive && (
          <span className="text-[10px]">{sortDir === 'asc' ? '↑' : '↓'}</span>
        )}
      </button>
    </th>
  )
}
