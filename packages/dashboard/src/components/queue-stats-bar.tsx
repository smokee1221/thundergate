'use client'

import { Clock, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react'

interface QueueStatsBarProps {
  stats: {
    pending: number
    claimed: number
    escalated: number
    resolvedToday: number
    avgResolutionMs: number | null
  } | null
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—'
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export function QueueStatsBar({ stats }: QueueStatsBarProps) {
  if (!stats) return null

  const items = [
    {
      label: 'Pending',
      value: stats.pending,
      icon: Clock,
      color: 'text-amber-400',
    },
    {
      label: 'Claimed',
      value: stats.claimed,
      icon: UserCheck,
      color: 'text-primary',
    },
    {
      label: 'Escalated',
      value: stats.escalated,
      icon: AlertTriangle,
      color: 'text-destructive',
    },
    {
      label: 'Resolved Today',
      value: stats.resolvedToday,
      icon: CheckCircle,
      color: 'text-emerald-400',
    },
    {
      label: 'Avg Resolution',
      value: formatDuration(stats.avgResolutionMs),
      icon: Clock,
      color: 'text-muted-foreground',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="bg-card rounded-lg border border-border px-4 py-3 flex items-center gap-3"
        >
          <item.icon className={`w-4 h-4 ${item.color}`} />
          <div>
            <p className="text-lg font-bold text-foreground">{item.value}</p>
            <p className="text-xs text-muted-foreground">{item.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
