'use client'

import { Sidebar } from './sidebar'
import { Topbar } from './topbar'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Topbar />
        <main className="flex-1 p-6 bg-background overflow-auto scrollbar-thin">
          {children}
        </main>
      </div>
    </div>
  )
}
