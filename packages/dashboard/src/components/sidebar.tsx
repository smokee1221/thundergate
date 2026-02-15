'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  LayoutDashboard,
  ListChecks,
  Scroll,
  ShieldCheck,
  Bot,
  Zap,
  Globe,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles?: ('ADMIN' | 'OPERATOR' | 'VIEWER')[]
}

const navItems: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    label: 'HITL Queue',
    href: '/queue',
    icon: ListChecks,
    roles: ['ADMIN', 'OPERATOR'],
  },
  {
    label: 'Rules',
    href: '/rules',
    icon: ShieldCheck,
    roles: ['ADMIN'],
  },
  {
    label: 'Audit Logs',
    href: '/audit',
    icon: Scroll,
  },
  {
    label: 'Agents',
    href: '/agents',
    icon: Bot,
    roles: ['ADMIN'],
  },
  {
    label: 'API Targets',
    href: '/targets',
    icon: Globe,
    roles: ['ADMIN'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
    roles: ['ADMIN'],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const userRole = session?.user?.role ?? 'VIEWER'

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(userRole),
  )

  return (
    <aside className="w-64 bg-[#0a0a0a] text-muted-foreground flex flex-col min-h-screen border-r border-border">
      {/* Brand */}
      <div className="px-6 py-5 border-b border-border">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative">
            <div className="absolute inset-0 rounded-lg bg-primary/25 blur-md group-hover:bg-primary/40 transition-all duration-300" />
            <div className="relative w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground tracking-tight">Thundergate</h1>
            <p className="text-[11px] text-muted-foreground">Operator Dashboard</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border text-[11px] text-muted-foreground/60">
        v0.1.0
      </div>
    </aside>
  )
}
