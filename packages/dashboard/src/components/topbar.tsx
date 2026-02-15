'use client'

import { useSession, signOut } from 'next-auth/react'
import { LogOut, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const roleBadgeColors: Record<string, string> = {
  ADMIN: 'bg-purple-500/10 text-purple-400',
  OPERATOR: 'bg-primary/10 text-primary',
  VIEWER: 'bg-muted text-muted-foreground',
}

export function Topbar() {
  const { data: session } = useSession()

  return (
    <header className="h-14 bg-card/50 backdrop-blur-sm border-b border-border flex items-center justify-between px-6">
      <div />

      <div className="flex items-center gap-3">
        {session?.user && (
          <>
            <div className="flex items-center gap-2.5 text-sm">
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                <User className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <span className="text-foreground font-medium text-sm">
                {session.user.name}
              </span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-[11px] font-medium',
                  roleBadgeColors[session.user.role] ?? roleBadgeColors.VIEWER,
                )}
              >
                {session.user.role}
              </span>
            </div>

            <div className="w-px h-5 bg-border" />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign out
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
