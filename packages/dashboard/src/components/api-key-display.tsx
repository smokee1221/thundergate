'use client'

import { useState } from 'react'
import { Copy, Check, AlertTriangle } from 'lucide-react'

interface ApiKeyDisplayProps {
  apiKey: string
  onDismiss?: () => void
}

export function ApiKeyDisplay({ apiKey, onDismiss }: ApiKeyDisplayProps) {
  const [copied, setCopied] = useState(false)

  function copyKey() {
    navigator.clipboard.writeText(apiKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-amber-300">
            API Key Generated
          </h3>
          <p className="text-xs text-amber-400/80 mt-1">
            Copy this key now. It will not be shown again.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <code className="flex-1 bg-background border border-border text-sm font-mono text-foreground px-3 py-2 rounded-lg break-all select-all">
          {apiKey}
        </code>
        <button
          onClick={copyKey}
          className="flex-shrink-0 p-2 rounded-lg border border-amber-500/20 bg-background hover:bg-accent text-amber-400"
          title="Copy API key"
        >
          {copied ? (
            <Check className="w-4 h-4 text-emerald-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </button>
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-xs text-amber-400/80 hover:text-amber-300 underline"
        >
          I&apos;ve copied the key, dismiss this notice
        </button>
      )}
    </div>
  )
}
