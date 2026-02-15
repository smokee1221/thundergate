'use client'

import { useState } from 'react'
import { Plus, Trash2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JsonViewer } from './json-viewer'
import { Button } from '@/components/ui/button'
import type { RuleFormData, RuleConditions } from '@/lib/rule-schema'

interface RuleFormProps {
  initialData?: RuleFormData
  onSubmit: (data: RuleFormData) => Promise<void>
  submitLabel: string
  submitting: boolean
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
const ACTIONS = ['ALLOW', 'BLOCK', 'FLAG_FOR_REVIEW', 'MODIFY'] as const
const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const

const defaultConditions: RuleConditions = {
  url_pattern: '',
  methods: [],
  payload_patterns: [],
  header_patterns: {},
}

export function RuleForm({
  initialData,
  onSubmit,
  submitLabel,
  submitting,
}: RuleFormProps) {
  const [name, setName] = useState(initialData?.name ?? '')
  const [description, setDescription] = useState(initialData?.description ?? '')
  const [priority, setPriority] = useState(initialData?.priority ?? 100)
  const [action, setAction] = useState<(typeof ACTIONS)[number]>(
    initialData?.action ?? 'FLAG_FOR_REVIEW',
  )
  const [severity, setSeverity] = useState<(typeof SEVERITIES)[number]>(
    initialData?.severity ?? 'MEDIUM',
  )
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true)
  const [conditions, setConditions] = useState<RuleConditions>(
    initialData?.conditions ?? defaultConditions,
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Header patterns management
  const [newHeaderKey, setNewHeaderKey] = useState('')
  const [newHeaderValue, setNewHeaderValue] = useState('')

  // Payload patterns management
  const [newPayloadPattern, setNewPayloadPattern] = useState('')

  function validateRegex(pattern: string): boolean {
    try {
      new RegExp(pattern)
      return true
    } catch {
      return false
    }
  }

  function addPayloadPattern() {
    if (!newPayloadPattern) return
    if (!validateRegex(newPayloadPattern)) {
      setErrors((e) => ({ ...e, payloadPattern: 'Invalid regex pattern' }))
      return
    }
    setErrors((e) => { const { payloadPattern: _, ...rest } = e; return rest })
    setConditions((c) => ({
      ...c,
      payload_patterns: [...(c.payload_patterns ?? []), newPayloadPattern],
    }))
    setNewPayloadPattern('')
  }

  function removePayloadPattern(index: number) {
    setConditions((c) => ({
      ...c,
      payload_patterns: (c.payload_patterns ?? []).filter((_, i) => i !== index),
    }))
  }

  function addHeaderPattern() {
    if (!newHeaderKey || !newHeaderValue) return
    setConditions((c) => ({
      ...c,
      header_patterns: {
        ...(c.header_patterns ?? {}),
        [newHeaderKey]: newHeaderValue,
      },
    }))
    setNewHeaderKey('')
    setNewHeaderValue('')
  }

  function removeHeaderPattern(key: string) {
    setConditions((c) => {
      const updated = { ...(c.header_patterns ?? {}) }
      delete updated[key]
      return { ...c, header_patterns: updated }
    })
  }

  type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

  function toggleMethod(method: HttpMethod) {
    setConditions((c) => {
      const current = c.methods ?? []
      const next = current.includes(method)
        ? current.filter((m) => m !== method)
        : [...current, method]
      return { ...c, methods: next as HttpMethod[] }
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})

    // Basic validation
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (priority < 1 || priority > 10000) newErrors.priority = 'Priority must be 1-10000'

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    // Clean conditions — remove empty arrays/strings
    const cleanConditions: RuleConditions = {}
    if (conditions.url_pattern) cleanConditions.url_pattern = conditions.url_pattern
    if (conditions.methods?.length) cleanConditions.methods = conditions.methods as RuleConditions['methods']
    if (conditions.payload_patterns?.length) cleanConditions.payload_patterns = conditions.payload_patterns
    if (conditions.header_patterns && Object.keys(conditions.header_patterns).length > 0) {
      cleanConditions.header_patterns = conditions.header_patterns
    }
    if (conditions.risk_score_threshold !== undefined && conditions.risk_score_threshold > 0) {
      cleanConditions.risk_score_threshold = conditions.risk_score_threshold
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || '',
      priority,
      action,
      severity,
      enabled,
      conditions: cleanConditions,
    })
  }

  // Build preview JSON for conditions
  const conditionsPreview: Record<string, unknown> = {}
  if (conditions.url_pattern) conditionsPreview.url_pattern = conditions.url_pattern
  if (conditions.methods?.length) conditionsPreview.methods = conditions.methods
  if (conditions.payload_patterns?.length) conditionsPreview.payload_patterns = conditions.payload_patterns
  if (conditions.header_patterns && Object.keys(conditions.header_patterns).length > 0) {
    conditionsPreview.header_patterns = conditions.header_patterns
  }
  if (conditions.risk_score_threshold) conditionsPreview.risk_score_threshold = conditions.risk_score_threshold

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
      {/* Basic info */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Block DELETE on user endpoints"
            className={cn(
              'w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground',
              errors.name ? 'border-destructive' : 'border-border',
            )}
          />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this rule does and why..."
            rows={2}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground resize-none"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              min={1}
              max={10000}
              className={cn(
                'w-full px-3 py-2 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground',
                errors.priority ? 'border-destructive' : 'border-border',
              )}
            />
            <p className="mt-1 text-xs text-muted-foreground">Lower = evaluated first</p>
            {errors.priority && <p className="mt-1 text-xs text-destructive">{errors.priority}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as (typeof ACTIONS)[number])}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value as (typeof SEVERITIES)[number])}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="rounded border-border"
          />
          <label htmlFor="enabled" className="text-sm text-foreground">
            Enabled
          </label>
        </div>
      </div>

      {/* Conditions */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Conditions</h3>
          <div className="group relative">
            <Info className="w-3.5 h-3.5 text-muted-foreground" />
            <div className="hidden group-hover:block absolute left-0 top-5 z-10 w-64 p-2 text-xs text-muted-foreground bg-card border border-border rounded-lg shadow-lg">
              Rules match when ALL specified conditions are met. Leave a condition empty to skip it.
            </div>
          </div>
        </div>

        {/* URL Pattern */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">URL Pattern</label>
          <input
            type="text"
            value={conditions.url_pattern ?? ''}
            onChange={(e) => setConditions((c) => ({ ...c, url_pattern: e.target.value }))}
            placeholder="e.g. */users/*, *api.stripe.com*"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground font-mono"
          />
          <p className="mt-1 text-xs text-muted-foreground">Use * as wildcard for glob matching</p>
        </div>

        {/* HTTP Methods */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">HTTP Methods</label>
          <div className="flex flex-wrap gap-2">
            {HTTP_METHODS.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => toggleMethod(method)}
                className={cn(
                  'px-3 py-1.5 text-xs font-mono font-medium rounded-lg border transition-colors',
                  conditions.methods?.includes(method)
                    ? 'bg-primary/10 text-primary border-primary/20'
                    : 'bg-background text-muted-foreground border-border hover:bg-accent',
                )}
              >
                {method}
              </button>
            ))}
          </div>
        </div>

        {/* Payload Patterns */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Payload Patterns (Regex)
          </label>
          <div className="space-y-2">
            {(conditions.payload_patterns ?? []).map((pattern, index) => (
              <div key={index} className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted border border-border rounded px-3 py-1.5 font-mono text-foreground">
                  {pattern}
                </code>
                <button
                  type="button"
                  onClick={() => removePayloadPattern(index)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPayloadPattern}
                onChange={(e) => {
                  setNewPayloadPattern(e.target.value)
                  setErrors((er) => { const { payloadPattern: _, ...rest } = er; return rest })
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addPayloadPattern() }}}
                placeholder="e.g. \b\d{3}-\d{2}-\d{4}\b (SSN)"
                className={cn(
                  'flex-1 px-3 py-1.5 text-xs font-mono bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground',
                  errors.payloadPattern ? 'border-destructive' : 'border-border',
                )}
              />
              <button
                type="button"
                onClick={addPayloadPattern}
                className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/10"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {errors.payloadPattern && (
              <p className="text-xs text-destructive">{errors.payloadPattern}</p>
            )}
          </div>
        </div>

        {/* Header Patterns */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">Header Patterns</label>
          <div className="space-y-2">
            {Object.entries(conditions.header_patterns ?? {}).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <code className="text-xs bg-muted border border-border rounded px-3 py-1.5 font-mono text-foreground">
                  {key}: {value}
                </code>
                <button
                  type="button"
                  onClick={() => removeHeaderPattern(key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                type="text"
                value={newHeaderKey}
                onChange={(e) => setNewHeaderKey(e.target.value)}
                placeholder="Header name"
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              />
              <input
                type="text"
                value={newHeaderValue}
                onChange={(e) => setNewHeaderValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addHeaderPattern() }}}
                placeholder="Pattern (regex)"
                className="flex-1 px-3 py-1.5 text-xs font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
              />
              <button
                type="button"
                onClick={addHeaderPattern}
                className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/20 rounded-lg hover:bg-primary/10"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Risk Score Threshold */}
        <div>
          <label className="block text-xs font-medium text-foreground mb-1">
            Risk Score Threshold
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={100}
              value={conditions.risk_score_threshold ?? 0}
              onChange={(e) =>
                setConditions((c) => ({
                  ...c,
                  risk_score_threshold: Number(e.target.value),
                }))
              }
              className="flex-1"
            />
            <span className="text-sm font-mono text-foreground w-8 text-right">
              {conditions.risk_score_threshold ?? 0}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            0 = disabled. Rule triggers when score exceeds this value.
          </p>
        </div>
      </div>

      {/* JSON Preview */}
      <JsonViewer
        data={conditionsPreview}
        label="Conditions JSON Preview"
        collapsed
      />

      {/* Submit */}
      <div className="flex items-center justify-end gap-3">
        <Button
          type="submit"
          disabled={submitting}
        >
          {submitting ? 'Saving...' : submitLabel}
        </Button>
      </div>
    </form>
  )
}
