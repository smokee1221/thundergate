'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { QueueListItem } from '@/lib/data'

interface QueueResponse {
  items: QueueListItem[]
  total: number
  limit: number
  offset: number
  stats?: {
    pending: number
    claimed: number
    escalated: number
    resolvedToday: number
    avgResolutionMs: number | null
  }
}

interface UseQueueOptions {
  statusFilter?: string[]
  limit?: number
  offset?: number
  pollInterval?: number // ms, 0 to disable
  includeStats?: boolean
}

/**
 * Client-side hook for fetching + polling the HITL queue.
 * Calls the Next.js API route which reads directly from DB.
 */
export function useQueue(options: UseQueueOptions = {}) {
  const {
    statusFilter,
    limit = 50,
    offset = 0,
    pollInterval = 3000,
    includeStats = true,
  } = options

  const [data, setData] = useState<QueueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchQueue = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter?.length) params.set('status', statusFilter.join(','))
      params.set('limit', String(limit))
      params.set('offset', String(offset))
      if (includeStats) params.set('stats', 'true')

      const response = await fetch(`/api/queue?${params}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const json = (await response.json()) as QueueResponse
      setData(json)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, limit, offset, includeStats])

  useEffect(() => {
    void fetchQueue()

    if (pollInterval > 0) {
      intervalRef.current = setInterval(() => void fetchQueue(), pollInterval)
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchQueue, pollInterval])

  return { data, loading, error, refetch: fetchQueue }
}

/**
 * Hook for queue actions (claim, decide).
 */
export function useQueueActions() {
  const [acting, setActing] = useState(false)

  const claimItem = useCallback(async (queueId: string) => {
    setActing(true)
    try {
      const response = await fetch(`/api/queue/${queueId}/claim`, {
        method: 'POST',
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
      }
      return true
    } catch (err) {
      throw err
    } finally {
      setActing(false)
    }
  }, [])

  const decideItem = useCallback(
    async (
      queueId: string,
      decision: 'APPROVED' | 'MODIFIED' | 'REJECTED',
      notes?: string,
      modifiedPayload?: unknown,
    ) => {
      setActing(true)
      try {
        const response = await fetch(`/api/queue/${queueId}/decide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision, notes, modifiedPayload }),
        })
        if (!response.ok) {
          const body = await response.json().catch(() => ({}))
          throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`)
        }
        return true
      } catch (err) {
        throw err
      } finally {
        setActing(false)
      }
    },
    [],
  )

  return { claimItem, decideItem, acting }
}
