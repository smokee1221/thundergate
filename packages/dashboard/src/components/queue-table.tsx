'use client'

import Link from 'next/link'
import { Clock, AlertTriangle, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from './status-badge'
import type { QueueListItem } from '@/lib/data'

interface QueueTableProps {
  items: QueueListItem[]
  selectedId?: string
  onSelect?: (id: string) => void
}

function formatTimeAgo(date: Date): string {
  const now = Date.now()
  const diff = now - new Date(date).getTime()
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatTimeRemaining(expiresAt: Date): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function getRiskColor(score: number): string {
  if (score >= 80) return 'text-red-400 bg-destructive/10'
  if (score >= 60) return 'text-amber-400 bg-amber-500/10'
  if (score >= 40) return 'text-yellow-400 bg-yellow-500/10'
  return 'text-muted-foreground bg-muted'
}

export function QueueTable({ items, selectedId, onSelect }: QueueTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-12 text-center">
        <AlertTriangle className="w-10 h-10 text-muted-foreground/50 mx-auto" />
        <h3 className="mt-3 text-sm font-medium text-foreground">
          No queue items
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Items will appear here when requests are flagged for review.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-muted border-b border-border">
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Time
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Agent
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Request
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Risk
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Status
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Assigned
            </th>
            <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Expires
            </th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => {
            const isActive = ['PENDING', 'ESCALATED', 'CLAIMED'].includes(item.status)
            const timeRemaining = isActive
              ? formatTimeRemaining(item.expiresAt)
              : null

            return (
              <tr
                key={item.id}
                onClick={() => onSelect?.(item.id)}
                className={cn(
                  'transition-colors cursor-pointer',
                  selectedId === item.id
                    ? 'bg-primary/5'
                    : 'hover:bg-white/[0.02]',
                  item.escalationTier >= 1 && isActive && 'bg-amber-500/5',
                )}
              >
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {formatTimeAgo(item.createdAt)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-foreground font-medium">
                    {item.agentName ?? item.agentId.slice(0, 8)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                      {item.requestMethod}
                    </span>
                    <span className="text-xs font-mono text-muted-foreground truncate max-w-[250px]">
                      {item.requestUrl}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'text-xs font-bold px-2 py-0.5 rounded',
                      getRiskColor(item.riskScore),
                    )}
                  >
                    {item.riskScore}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <StatusBadge status={item.status} />
                    {item.escalationTier >= 1 && isActive && (
                      <span className="text-xs text-amber-400 font-medium">
                        T{item.escalationTier}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    {item.assignedName ?? (item.assignedTo ? item.assignedTo.slice(0, 8) : '—')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {timeRemaining ? (
                    <span
                      className={cn(
                        'text-xs flex items-center gap-1',
                        timeRemaining === 'Expired'
                          ? 'text-destructive font-medium'
                          : 'text-muted-foreground',
                      )}
                    >
                      <Clock className="w-3 h-3" />
                      {timeRemaining}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/queue/${item.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-primary hover:text-primary/80"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
