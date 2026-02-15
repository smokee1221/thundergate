'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  Clock,
  Shield,
  AlertTriangle,
  User,
  CheckCircle,
  XCircle,
  Edit3,
  Keyboard,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { JsonViewer } from '@/components/json-viewer'
import { DecideDialog } from '@/components/decide-dialog'
import { KeyboardHelp } from '@/components/keyboard-help'
import { Button } from '@/components/ui/button'
import { useQueueActions } from '@/hooks/use-queue'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import type { QueueItemDetail } from '@/lib/data'

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleString()
}

function formatTimeRemaining(expiresAt: Date | string): string | null {
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const minutes = Math.floor(diff / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

function getRiskLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
  if (score >= 60) return { label: 'HIGH', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  if (score >= 40) return { label: 'MEDIUM', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
  return { label: 'LOW', color: 'text-muted-foreground bg-muted border-border' }
}

export default function QueueDetailPage() {
  const router = useRouter()
  const params = useParams()
  const queueId = params.id as string
  const { data: session } = useSession()

  const [item, setItem] = useState<QueueItemDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showDecideDialog, setShowDecideDialog] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null)

  const { claimItem, decideItem, acting } = useQueueActions()

  const canAct =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'OPERATOR'
  const isClaimable = item && ['PENDING', 'ESCALATED'].includes(item.status)
  const isClaimed =
    item?.status === 'CLAIMED' && item?.assignedTo === session?.user?.id
  const isResolved = item && ['APPROVED', 'MODIFIED', 'REJECTED', 'EXPIRED'].includes(item.status)

  // Fetch item data
  const fetchItem = useCallback(async () => {
    try {
      const response = await fetch(`/api/queue/${queueId}`)
      if (!response.ok) {
        if (response.status === 404) {
          setError('Queue item not found')
          return
        }
        throw new Error(`HTTP ${response.status}`)
      }
      const data = (await response.json()) as QueueItemDetail
      setItem(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load item')
    } finally {
      setLoading(false)
    }
  }, [queueId])

  useEffect(() => {
    void fetchItem()
    const interval = setInterval(() => void fetchItem(), 5000)
    return () => clearInterval(interval)
  }, [fetchItem])

  // Update countdown timer
  useEffect(() => {
    if (!item || isResolved) return
    function tick() {
      setTimeRemaining(formatTimeRemaining(item!.expiresAt))
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [item, isResolved])

  const handleClaim = useCallback(async () => {
    if (!canAct || !isClaimable) return
    try {
      setActionError(null)
      await claimItem(queueId)
      void fetchItem()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to claim')
    }
  }, [canAct, isClaimable, claimItem, queueId, fetchItem])

  const handleDecide = useCallback(
    async (
      decision: 'APPROVED' | 'MODIFIED' | 'REJECTED',
      notes?: string,
      modifiedPayload?: unknown,
    ) => {
      try {
        setActionError(null)
        await decideItem(queueId, decision, notes, modifiedPayload)
        setShowDecideDialog(false)
        void fetchItem()
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Failed to submit decision',
        )
      }
    },
    [decideItem, queueId, fetchItem],
  )

  const shortcutDefs = useMemo(
    () => [
      { key: 'a', description: 'Quick approve' },
      { key: 'r', description: 'Quick reject' },
      { key: 'c', description: 'Claim item' },
      { key: 'd', description: 'Open decide dialog' },
      { key: 'Escape', description: 'Go back' },
      { key: '?', description: 'Toggle shortcuts help' },
    ],
    [],
  )

  const shortcuts = useMemo(
    () => [
      {
        key: 'a',
        description: 'Quick approve',
        handler: () => {
          if (isClaimed) void handleDecide('APPROVED', 'Quick approved via keyboard')
        },
      },
      {
        key: 'r',
        description: 'Quick reject',
        handler: () => {
          if (isClaimed) void handleDecide('REJECTED', 'Quick rejected via keyboard')
        },
      },
      {
        key: 'c',
        description: 'Claim item',
        handler: () => void handleClaim(),
      },
      {
        key: 'd',
        description: 'Open decide dialog',
        handler: () => {
          if (isClaimed) setShowDecideDialog(true)
        },
      },
      {
        key: 'Escape',
        description: 'Go back',
        handler: () => router.push('/queue'),
      },
      {
        key: '?',
        description: 'Toggle shortcuts help',
        handler: () => setShowHelp((s) => !s),
      },
    ],
    [isClaimed, handleDecide, handleClaim, router],
  )

  useKeyboardShortcuts(shortcuts)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/queue')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Queue
        </button>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error ?? 'Queue item not found'}
        </div>
      </div>
    )
  }

  const risk = getRiskLabel(item.riskScore)

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push('/queue')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Queue
        </button>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Keyboard className="w-4 h-4" />
          Shortcuts
        </button>
      </div>

      {/* Header row */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-foreground">
              Queue Item
            </h2>
            <StatusBadge status={item.status} />
            {item.escalationTier >= 1 && !isResolved && (
              <span className="text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                Tier {item.escalationTier}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1 font-mono">{item.id}</p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {canAct && isClaimable && (
            <Button
              onClick={() => void handleClaim()}
              disabled={acting}
            >
              Claim
            </Button>
          )}
          {isClaimed && (
            <>
              <Button
                onClick={() => void handleDecide('APPROVED', 'Approved')}
                disabled={acting}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </Button>
              <Button
                onClick={() => void handleDecide('REJECTED', 'Rejected')}
                disabled={acting}
                variant="destructive"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </Button>
              <Button
                onClick={() => setShowDecideDialog(true)}
                disabled={acting}
                variant="secondary"
              >
                <Edit3 className="w-4 h-4" />
                Modify / Notes
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {actionError}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left column — request details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Request info */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                Request Details
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-muted-foreground">Method</span>
                  <p className="text-sm font-mono font-medium text-foreground mt-0.5">
                    {item.requestMethod}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Agent</span>
                  <p className="text-sm text-foreground mt-0.5">
                    {item.agentName ?? item.agentId.slice(0, 8)}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">URL</span>
                <p className="text-sm font-mono text-foreground mt-0.5 break-all">
                  {item.requestUrl}
                </p>
              </div>

              {/* Headers */}
              {item.requestHeaders ? (
                <JsonViewer
                  data={item.requestHeaders}
                  label="Request Headers"
                  collapsed
                />
              ) : null}

              {/* Body */}
              {item.requestPayload ? (
                <JsonViewer
                  data={item.requestPayload}
                  label="Request Body"
                />
              ) : null}
            </div>
          </div>

          {/* Matched Rule */}
          {item.ruleId && (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-5 py-4 border-b border-border flex items-center gap-2">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">
                  Matched Rule
                </h3>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-foreground">
                    {item.ruleName ?? 'Unknown Rule'}
                  </span>
                  {item.ruleSeverity && (
                    <StatusBadge status={item.ruleSeverity} />
                  )}
                </div>
                {item.ruleDescription && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {item.ruleDescription}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Operator Notes (if resolved) */}
          {item.operatorNotes && (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Operator Notes
                </h3>
              </div>
              <div className="p-5">
                <p className="text-sm text-foreground">{item.operatorNotes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right column — metadata */}
        <div className="space-y-5">
          {/* Risk score */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Risk Score
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground">
                {item.riskScore}
              </span>
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded border',
                  risk.color,
                )}
              >
                {risk.label}
              </span>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Timeline
              </h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">
                  {formatDate(item.createdAt)}
                </span>
              </div>
              {item.claimedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Claimed</span>
                  <span className="text-foreground">
                    {formatDate(item.claimedAt)}
                  </span>
                </div>
              )}
              {item.resolvedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Resolved</span>
                  <span className="text-foreground">
                    {formatDate(item.resolvedAt)}
                  </span>
                </div>
              )}
              {!isResolved && timeRemaining && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expires in</span>
                  <span
                    className={cn(
                      'font-medium',
                      timeRemaining === 'Expired'
                        ? 'text-destructive'
                        : 'text-amber-400',
                    )}
                  >
                    {timeRemaining}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="text-foreground">{item.latencyMs}ms</span>
              </div>
            </div>
          </div>

          {/* Assigned operator */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Assignment
              </h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Assigned To</span>
                <span className="text-foreground">
                  {item.assignedName ?? (item.assignedTo ? item.assignedTo.slice(0, 8) : '—')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Escalation Tier</span>
                <span className="text-foreground">
                  {item.escalationTier === 0 ? 'Standard' : `Tier ${item.escalationTier}`}
                </span>
              </div>
              {item.humanDecision && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Decision</span>
                  <StatusBadge status={item.humanDecision} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Decide dialog */}
      <DecideDialog
        open={showDecideDialog}
        onClose={() => setShowDecideDialog(false)}
        onDecide={handleDecide}
        acting={acting}
        originalPayload={item.requestPayload}
      />

      {/* Keyboard help */}
      <KeyboardHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        shortcuts={shortcutDefs}
      />
    </div>
  )
}
