'use client'

import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  key: string
  description: string
  handler: () => void
  /** Only trigger if no input is focused */
  requireNoFocus?: boolean
}

/**
 * Hook for registering keyboard shortcuts.
 * Automatically ignores events when input/textarea/select is focused (unless overridden).
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Don't trigger shortcuts while typing in inputs
      const target = event.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable

      for (const shortcut of shortcuts) {
        if (shortcut.requireNoFocus !== false && isInput) continue
        if (event.key.toLowerCase() === shortcut.key.toLowerCase()) {
          event.preventDefault()
          shortcut.handler()
          return
        }
      }
    },
    [shortcuts],
  )

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
