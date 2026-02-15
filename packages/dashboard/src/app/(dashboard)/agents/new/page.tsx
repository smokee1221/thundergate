'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Bot } from 'lucide-react'
import { useToast } from '@/components/toast'
import { ApiKeyDisplay } from '@/components/api-key-display'
import { Button } from '@/components/ui/button'

export default function NewAgentPage() {
  const router = useRouter()
  const { addToast } = useToast()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [newAgentId, setNewAgentId] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const data = await res.json() as { error: string }
        throw new Error(data.error || 'Failed to create agent')
      }

      const data = (await res.json()) as { id: string; apiKey: string }
      setNewApiKey(data.apiKey)
      setNewAgentId(data.id)
      addToast({ type: 'success', title: 'Agent registered successfully' })
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Failed to register agent',
        description: err instanceof Error ? err.message : undefined,
      })
    } finally {
      setSaving(false)
    }
  }

  // After creation, show the API key
  if (newApiKey && newAgentId) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <button
          onClick={() => router.push('/agents')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Agents
        </button>

        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Bot className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-foreground mt-4">
            Agent Registered
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Your agent has been created. Save the API key below.
          </p>
        </div>

        <ApiKeyDisplay apiKey={newApiKey} />

        <div className="bg-card rounded-xl border border-border p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Quick Start
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Use this API key in your agent&apos;s requests to authenticate with the firewall:
          </p>
          <pre className="bg-[#0a0a0a] text-green-400 text-xs p-4 rounded-lg overflow-x-auto">
{`curl -X POST http://localhost:3001/proxy/your-api \\
  -H "Authorization: Bearer ${newApiKey.slice(0, 12)}..." \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Hello from agent"}'`}
          </pre>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => router.push('/agents')}
          >
            Back to Agents
          </Button>
          <Button
            onClick={() => router.push(`/agents/${newAgentId}`)}
          >
            View Agent
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <button
        onClick={() => router.push('/agents')}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Agents
      </button>

      <div>
        <h2 className="text-xl font-bold text-foreground">Register New Agent</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new AI agent and generate an API key for authentication.
        </p>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <div className="bg-card rounded-xl border border-border p-5 space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Agent Name *
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Research Assistant"
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none"
              required
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="block text-sm font-medium text-foreground mb-1"
            >
              Description
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this agent do?"
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-background text-foreground focus:ring-2 focus:ring-primary focus:border-primary outline-none resize-none"
            />
          </div>
        </div>

        <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 text-sm text-primary">
          <p className="font-medium">What happens next?</p>
          <ul className="mt-1 text-xs space-y-0.5 list-disc list-inside">
            <li>An API key will be generated for this agent</li>
            <li>The key will be shown once — make sure to save it</li>
            <li>The agent can immediately start sending requests through the firewall</li>
          </ul>
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/agents')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || saving}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            Register Agent
          </Button>
        </div>
      </form>
    </div>
  )
}
