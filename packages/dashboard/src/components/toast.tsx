'use client'

import { toast } from 'sonner'

type ToastType = 'success' | 'error' | 'warning' | 'info'

export function useToast() {
  return {
    addToast: ({
      type,
      title,
      description,
    }: {
      type: ToastType
      title: string
      description?: string
    }) => {
      const method =
        type === 'error'
          ? toast.error
          : type === 'success'
            ? toast.success
            : type === 'warning'
              ? toast.warning
              : toast.info
      method(title, { description })
    },
  }
}
