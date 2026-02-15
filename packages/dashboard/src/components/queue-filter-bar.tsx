'use client'

import { cn } from '@/lib/utils'

interface QueueFilterBarProps {
  activeFilter: string[]
  onFilterChange: (filter: string[]) => void
  stats?: {
    pending: number
    claimed: number
    escalated: number
    resolvedToday: number
  } | null
}

const filterOptions = [
  { label: 'All', value: [] as string[] },
  { label: 'Pending', value: ['PENDING'] },
  { label: 'Escalated', value: ['ESCALATED'] },
  { label: 'Claimed', value: ['CLAIMED'] },
  { label: 'Resolved', value: ['APPROVED', 'MODIFIED', 'REJECTED', 'EXPIRED'] },
]

export function QueueFilterBar({
  activeFilter,
  onFilterChange,
  stats,
}: QueueFilterBarProps) {
  const filterKey = activeFilter.join(',')

  function getCount(filter: string[]): number | null {
    if (!stats) return null
    if (filter.length === 0) return null
    if (filter.includes('PENDING')) return stats.pending
    if (filter.includes('ESCALATED')) return stats.escalated
    if (filter.includes('CLAIMED')) return stats.claimed
    if (filter.includes('APPROVED')) return stats.resolvedToday
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {filterOptions.map((option) => {
        const isActive = option.value.join(',') === filterKey
        const count = getCount(option.value)

        return (
          <button
            key={option.label}
            onClick={() => onFilterChange(option.value)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground border border-border hover:bg-accent',
            )}
          >
            {option.label}
            {count !== null && count > 0 && (
              <span
                className={cn(
                  'ml-1.5 text-xs px-1.5 py-0.5 rounded-full',
                  isActive
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
