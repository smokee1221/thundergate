'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface KeyboardHelpProps {
  open: boolean
  onClose: () => void
  shortcuts: { key: string; description: string }[]
}

export function KeyboardHelp({ open, onClose, shortcuts }: KeyboardHelpProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-border">
          {shortcuts.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-between py-2.5"
            >
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <kbd className="px-2 py-1 text-xs font-mono bg-muted border border-border rounded text-muted-foreground">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>
        <div className="text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 bg-muted rounded">?</kbd> to
          toggle this overlay
        </div>
      </DialogContent>
    </Dialog>
  )
}
