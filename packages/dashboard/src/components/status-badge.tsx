import { cn } from '@/lib/utils'

type BadgeVariant = 'success' | 'destructive' | 'warning' | 'info' | 'muted'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  destructive: 'bg-destructive/10 text-red-400 border-destructive/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  info: 'bg-primary/10 text-primary border-primary/20',
  muted: 'bg-muted text-muted-foreground border-border',
}

const decisionVariant: Record<string, BadgeVariant> = {
  ALLOW: 'success',
  ALLOWED: 'success',
  APPROVED: 'success',
  BLOCK: 'destructive',
  BLOCKED: 'destructive',
  REJECTED: 'destructive',
  FLAG_FOR_REVIEW: 'warning',
  MODIFY: 'info',
  PENDING: 'warning',
  CLAIMED: 'info',
  ESCALATED: 'warning',
  MODIFIED: 'info',
  EXPIRED: 'muted',
  // Severity levels
  LOW: 'muted',
  MEDIUM: 'warning',
  HIGH: 'destructive',
  CRITICAL: 'destructive',
}

interface StatusBadgeProps {
  status: string
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const variant = decisionVariant[status] ?? 'muted'

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border',
        variantClasses[variant],
        className,
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}
