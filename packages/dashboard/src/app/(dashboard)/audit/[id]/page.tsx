'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  User,
  Hash,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusBadge } from '@/components/status-badge'
import { JsonViewer } from '@/components/json-viewer'
import type { AuditLogDetail } from '@/lib/data'

function formatDate(date: Date | string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleString()
}

function getRiskLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'CRITICAL', color: 'text-red-400 bg-red-500/10 border-red-500/20' }
  if (score >= 60) return { label: 'HIGH', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' }
  if (score >= 40) return { label: 'MEDIUM', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' }
  return { label: 'LOW', color: 'text-muted-foreground bg-muted border-border' }
}

export default function AuditDetailPage() {
  const router = useRouter()
  const params = useParams()
  const logId = params.id as string

  const [item, setItem] = useState<AuditLogDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDetail() {
      try {
        const response = await fetch(`/api/audit/${logId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Audit log not found')
            return
          }
          throw new Error(`HTTP ${response.status}`)
        }
        const data = (await response.json()) as AuditLogDetail
        setItem(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    void fetchDetail()
  }, [logId])

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
          onClick={() => router.push('/audit')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Audit Logs
        </button>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error ?? 'Not found'}
        </div>
      </div>
    )
  }

  const risk = getRiskLabel(item.riskScore)

  return (
    <div className="space-y-5">
      {/* Back nav */}
      <button
        onClick={() => router.push('/audit')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Audit Logs
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-foreground">
          Audit Entry #{item.sequenceNumber}
        </h2>
        <StatusBadge status={item.engineDecision} />
        {item.humanDecision && <StatusBadge status={item.humanDecision} />}
      </div>
      <p className="text-xs text-muted-foreground font-mono">{item.id}</p>

      {/* Timeline */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Request Timeline</h3>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <TimelineStep label="Received" time={formatDate(item.createdAt)} icon={<ArrowRight className="w-3 h-3" />} />
          <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
          <TimelineStep
            label="Evaluated"
            time={`${item.latencyMs}ms`}
            icon={<Shield className="w-3 h-3" />}
            color={item.engineDecision === 'ALLOW' ? 'text-emerald-400' : item.engineDecision === 'BLOCK' ? 'text-red-400' : 'text-amber-400'}
          />
          {item.humanDecision && (
            <>
              <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
              <TimelineStep
                label="Human Decision"
                time={item.humanDecision}
                icon={item.humanDecision === 'APPROVED' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                color={item.humanDecision === 'APPROVED' ? 'text-emerald-400' : 'text-red-400'}
              />
            </>
          )}
          {item.responseStatus && (
            <>
              <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
              <TimelineStep
                label="Response"
                time={`HTTP ${item.responseStatus}`}
                icon={<ArrowRight className="w-3 h-3" />}
                color={item.responseStatus < 400 ? 'text-emerald-400' : 'text-red-400'}
              />
            </>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Request details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Request */}
          <div className="bg-card rounded-xl border border-border">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Request</h3>
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
              {item.requestHeaders ? (
                <JsonViewer data={item.requestHeaders} label="Request Headers" collapsed />
              ) : null}
              {item.requestPayload ? (
                <JsonViewer data={item.requestPayload} label="Request Body" />
              ) : null}
            </div>
          </div>

          {/* Modified payload */}
          {item.modifiedPayload ? (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Modified Payload</h3>
              </div>
              <div className="p-5">
                <JsonViewer data={item.modifiedPayload} label="Modified Payload" />
              </div>
            </div>
          ) : null}

          {/* Final payload */}
          {item.finalPayload ? (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">Final Payload Sent</h3>
              </div>
              <div className="p-5">
                <JsonViewer data={item.finalPayload} label="Final Payload" />
              </div>
            </div>
          ) : null}

          {/* Response */}
          {item.responseStatus ? (
            <div className="bg-card rounded-xl border border-border">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">
                  Response (HTTP {item.responseStatus})
                </h3>
              </div>
              <div className="p-5">
                {item.responseBody ? (
                  <JsonViewer data={item.responseBody} label="Response Body" />
                ) : (
                  <p className="text-xs text-muted-foreground">No response body recorded</p>
                )}
              </div>
            </div>
          ) : null}
        </div>

        {/* Right: Metadata */}
        <div className="space-y-5">
          {/* Risk Score */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Risk Score</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold text-foreground">{item.riskScore}</span>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded border', risk.color)}>
                {risk.label}
              </span>
            </div>
          </div>

          {/* Rule */}
          {item.ruleId && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Matched Rule</h3>
              </div>
              <p className="text-sm font-medium text-foreground">
                {item.ruleName ?? 'Unknown'}
              </p>
              {item.ruleSeverity && (
                <StatusBadge status={item.ruleSeverity} className="mt-1" />
              )}
              {item.ruleDescription && (
                <p className="text-xs text-muted-foreground mt-2">{item.ruleDescription}</p>
              )}
            </div>
          )}

          {/* Operator */}
          {item.operatorId && (
            <div className="bg-card rounded-xl border border-border p-5">
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Operator Decision</h3>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Operator</span>
                  <span className="text-foreground">{item.operatorName ?? item.operatorId.slice(0, 8)}</span>
                </div>
                {item.humanDecision && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Decision</span>
                    <StatusBadge status={item.humanDecision} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Hash chain */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Hash Chain</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-xs text-muted-foreground">Sequence #</span>
                <p className="text-sm font-mono text-foreground mt-0.5">
                  {item.sequenceNumber}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Entry Hash</span>
                <p className="text-xs font-mono text-muted-foreground mt-0.5 break-all">
                  {item.entryHash}
                </p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Previous Hash</span>
                <p className="text-xs font-mono text-muted-foreground mt-0.5 break-all">
                  {item.prevHash}
                </p>
              </div>
            </div>
          </div>

          {/* Timing */}
          <div className="bg-card rounded-xl border border-border p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Timing</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created</span>
                <span className="text-foreground">{formatDate(item.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Latency</span>
                <span className="text-foreground">{item.latencyMs}ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function TimelineStep({
  label,
  time,
  icon,
  color = 'text-muted-foreground',
}: {
  label: string
  time: string
  icon: React.ReactNode
  color?: string
}) {
  return (
    <div className={cn('flex items-center gap-1.5 bg-muted px-3 py-1.5 rounded-lg', color)}>
      {icon}
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground">·</span>
      <span>{time}</span>
    </div>
  )
}
