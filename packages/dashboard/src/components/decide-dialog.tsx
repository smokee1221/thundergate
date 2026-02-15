'use client'

import { useState } from 'react'
import { CheckCircle, XCircle, Edit3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface DecideDialogProps {
  open: boolean
  onClose: () => void
  onDecide: (
    decision: 'APPROVED' | 'MODIFIED' | 'REJECTED',
    notes?: string,
    modifiedPayload?: unknown,
  ) => Promise<void>
  acting: boolean
  originalPayload?: unknown
}

export function DecideDialog({
  open,
  onClose,
  onDecide,
  acting,
  originalPayload,
}: DecideDialogProps) {
  const [decision, setDecision] = useState<'APPROVED' | 'MODIFIED' | 'REJECTED'>('APPROVED')
  const [notes, setNotes] = useState('')
  const [modifiedPayload, setModifiedPayload] = useState(
    originalPayload ? JSON.stringify(originalPayload, null, 2) : '',
  )
  const [payloadError, setPayloadError] = useState<string | null>(null)

  async function handleSubmit() {
    let parsedPayload: unknown = undefined

    if (decision === 'MODIFIED') {
      try {
        parsedPayload = JSON.parse(modifiedPayload)
        setPayloadError(null)
      } catch {
        setPayloadError('Invalid JSON')
        return
      }
    }

    await onDecide(decision, notes || undefined, parsedPayload)
  }

  const decisions = [
    {
      value: 'APPROVED' as const,
      label: 'Approve',
      icon: CheckCircle,
      color: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
      activeColor: 'ring-2 ring-emerald-500',
    },
    {
      value: 'MODIFIED' as const,
      label: 'Modify',
      icon: Edit3,
      color: 'border-primary/30 bg-primary/10 text-primary',
      activeColor: 'ring-2 ring-primary',
    },
    {
      value: 'REJECTED' as const,
      label: 'Reject',
      icon: XCircle,
      color: 'border-destructive/30 bg-destructive/10 text-red-400',
      activeColor: 'ring-2 ring-destructive',
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Decision</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Decision buttons */}
          <div className="grid grid-cols-3 gap-3">
            {decisions.map((d) => (
              <button
                key={d.value}
                onClick={() => setDecision(d.value)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
                  decision === d.value
                    ? `${d.color} ${d.activeColor}`
                    : 'border-border text-muted-foreground hover:border-muted-foreground/30',
                )}
              >
                <d.icon className="w-5 h-5" />
                <span className="text-xs font-medium">{d.label}</span>
              </button>
            ))}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for this decision..."
              rows={2}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
            />
          </div>

          {/* Modified payload editor (only for MODIFIED) */}
          {decision === 'MODIFIED' && (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">
                Modified Payload (JSON)
              </label>
              <textarea
                value={modifiedPayload}
                onChange={(e) => {
                  setModifiedPayload(e.target.value)
                  setPayloadError(null)
                }}
                rows={8}
                className={cn(
                  'w-full px-3 py-2 text-sm font-mono bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none',
                  payloadError
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border',
                )}
              />
              {payloadError && (
                <p className="mt-1 text-xs text-destructive">{payloadError}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={acting}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={acting}
            className={cn(
              decision === 'REJECTED'
                ? 'bg-destructive hover:bg-destructive/90'
                : decision === 'MODIFIED'
                  ? 'bg-primary hover:bg-primary/90'
                  : 'bg-emerald-600 hover:bg-emerald-700',
              'text-white',
            )}
          >
            {acting ? 'Submitting...' : `Submit ${decision}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
