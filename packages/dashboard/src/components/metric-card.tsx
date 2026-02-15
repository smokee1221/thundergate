import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MetricCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: 'up' | 'down' | 'neutral'
  color?: 'blue' | 'red' | 'amber' | 'green' | 'slate'
}

const colorMap = {
  blue: 'bg-primary/10 text-primary',
  red: 'bg-destructive/10 text-destructive',
  amber: 'bg-amber-500/10 text-amber-400',
  green: 'bg-emerald-500/10 text-emerald-400',
  slate: 'bg-muted text-muted-foreground',
}

export function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue',
}: MetricCardProps) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:border-border/80 hover:bg-card/80 transition-all duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-foreground mt-1.5 tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground/70 mt-1">{subtitle}</p>
          )}
        </div>
        <div
          className={cn(
            'w-10 h-10 rounded-lg flex items-center justify-center',
            colorMap[color],
          )}
        >
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </div>
  )
}
