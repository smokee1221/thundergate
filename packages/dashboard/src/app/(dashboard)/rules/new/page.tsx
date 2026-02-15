'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Plus } from 'lucide-react'
import { RuleForm } from '@/components/rule-form'
import type { RuleFormData } from '@/lib/rule-schema'

export default function NewRulePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: RuleFormData) {
    setSubmitting(true)
    setError(null)
    try {
      const response = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string; details?: unknown }
        throw new Error(body.error ?? `HTTP ${response.status}`)
      }

      router.push('/rules')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule')
    } finally {
      setSubmitting(false)
    }
  }

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
        <Plus className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground">New Rule</h2>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <RuleForm
        onSubmit={handleSubmit}
        submitLabel="Create Rule"
        submitting={submitting}
      />
    </div>
  )
}
