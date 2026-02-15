'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { RuleForm } from '@/components/rule-form'
import type { RuleFormData } from '@/lib/rule-schema'
import type { RuleDetail } from '@/lib/data'

export default function EditRulePage() {
  const router = useRouter()
  const params = useParams()
  const ruleId = params.id as string

  const [rule, setRule] = useState<RuleDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchRule() {
      try {
        const response = await fetch(`/api/rules/${ruleId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Rule not found')
            return
          }
          throw new Error(`HTTP ${response.status}`)
        }
        const data = (await response.json()) as RuleDetail
        setRule(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load rule')
      } finally {
        setLoading(false)
      }
    }
    void fetchRule()
  }, [ruleId])

  async function handleSubmit(data: RuleFormData) {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch(`/api/rules/${ruleId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }

      router.push('/rules')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update rule')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="inline-block w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !rule) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.push('/rules')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Rules
        </button>
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      </div>
    )
  }

  // Map rule to form data
  const initialData: RuleFormData | undefined = rule
    ? {
        name: rule.name,
        description: (rule.description as string) ?? '',
        priority: rule.priority,
        action: rule.action as RuleFormData['action'],
        severity: rule.severity as RuleFormData['severity'],
        enabled: rule.enabled,
        conditions: (rule.conditions as RuleFormData['conditions']) ?? {},
      }
    : undefined

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back nav */}
      <button
        onClick={() => router.push('/rules')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Rules
      </button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">Edit Rule</h2>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {initialData && (
        <RuleForm
          initialData={initialData}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          submitting={submitting}
        />
      )}
    </div>
  )
}
