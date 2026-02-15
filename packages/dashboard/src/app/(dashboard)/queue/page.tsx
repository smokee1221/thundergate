'use client'

import { useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ListChecks, Keyboard } from 'lucide-react'
import { useQueue, useQueueActions } from '@/hooks/use-queue'
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { QueueTable } from '@/components/queue-table'
import { QueueFilterBar } from '@/components/queue-filter-bar'
import { QueueStatsBar } from '@/components/queue-stats-bar'
import { KeyboardHelp } from '@/components/keyboard-help'

export default function QueuePage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const [showHelp, setShowHelp] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { data, loading, error, refetch } = useQueue({
    statusFilter: statusFilter.length > 0 ? statusFilter : undefined,
    pollInterval: 3000,
    includeStats: true,
  })

  const { claimItem } = useQueueActions()

  const canAct =
    session?.user?.role === 'ADMIN' || session?.user?.role === 'OPERATOR'

  const handleClaim = useCallback(async () => {
    if (!selectedId || !canAct) return
    try {
      setActionError(null)
      await claimItem(selectedId)
      void refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to claim')
    }
  }, [selectedId, canAct, claimItem, refetch])

  const handleNavigateDetail = useCallback(() => {
    if (selectedId) router.push(`/queue/${selectedId}`)
  }, [selectedId, router])

  const handleNavigateUp = useCallback(() => {
    if (!data?.items.length) return
    const currentIndex = data.items.findIndex((i) => i.id === selectedId)
    const newIndex = Math.max(0, currentIndex - 1)
    setSelectedId(data.items[newIndex]?.id)
  }, [data, selectedId])

  const handleNavigateDown = useCallback(() => {
    if (!data?.items.length) return
    const currentIndex = data.items.findIndex((i) => i.id === selectedId)
    const newIndex = Math.min(data.items.length - 1, currentIndex + 1)
    setSelectedId(data.items[newIndex]?.id)
  }, [data, selectedId])

  const shortcutDefs = useMemo(
    () => [
      { key: 'j', description: 'Next item' },
      { key: 'k', description: 'Previous item' },
      { key: 'c', description: 'Claim selected item' },
      { key: 'Enter', description: 'Open item detail' },
      { key: '?', description: 'Toggle shortcuts help' },
    ],
    [],
  )

  const shortcuts = useMemo(
    () => [
      { key: 'j', description: 'Next item', handler: handleNavigateDown },
      { key: 'k', description: 'Previous item', handler: handleNavigateUp },
      { key: 'c', description: 'Claim selected item', handler: () => void handleClaim() },
      { key: 'Enter', description: 'Open item detail', handler: handleNavigateDetail },
      { key: '?', description: 'Toggle shortcuts help', handler: () => setShowHelp((s) => !s) },
    ],
    [handleNavigateDown, handleNavigateUp, handleClaim, handleNavigateDetail],
  )

  useKeyboardShortcuts(shortcuts)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ListChecks className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-xl font-bold text-foreground">HITL Queue</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Review and action flagged requests
              {data?.total ? ` · ${data.total} total` : ''}
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowHelp(true)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Keyboard shortcuts"
        >
          <Keyboard className="w-4 h-4" />
          Shortcuts
        </button>
      </div>

      {/* Stats */}
      <QueueStatsBar stats={data?.stats ?? null} />

      {/* Filters */}
      <QueueFilterBar
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        stats={data?.stats ?? null}
      />

      {/* Error */}
      {(error || actionError) && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {actionError ?? error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="bg-card rounded-xl border border-border p-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-muted-foreground">Loading queue...</p>
        </div>
      )}

      {/* Table */}
      {data && (
        <QueueTable
          items={data.items}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      )}

      {/* Pagination info */}
      {data && data.total > data.limit && (
        <div className="text-xs text-muted-foreground text-center">
          Showing {data.items.length} of {data.total} items
        </div>
      )}

      {/* Keyboard help overlay */}
      <KeyboardHelp
        open={showHelp}
        onClose={() => setShowHelp(false)}
        shortcuts={shortcutDefs}
      />
    </div>
  )
}
