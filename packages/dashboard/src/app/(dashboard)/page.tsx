import {
  Activity,
  ShieldOff,
  AlertTriangle,
  CheckCircle,
  Clock,
} from 'lucide-react'
import { MetricCard } from '@/components/metric-card'
import { StatusBadge } from '@/components/status-badge'
import { getDashboardMetrics, getRecentActivity, getTopRules } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  let metrics = { totalRequests: 0, allowed: 0, blocked: 0, flagged: 0 }
  let recentActivity: Awaited<ReturnType<typeof getRecentActivity>> = []
  let topRules: Awaited<ReturnType<typeof getTopRules>> = []
  let dataError = false

  try {
    ;[metrics, recentActivity, topRules] = await Promise.all([
      getDashboardMetrics(),
      getRecentActivity(15),
      getTopRules(5),
    ])
  } catch {
    dataError = true
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Last 24 hours overview
        </p>
      </div>

      {dataError && (
        <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm px-4 py-3 rounded-lg">
          Unable to connect to database. Metrics may be unavailable.
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Requests"
          value={metrics.totalRequests}
          subtitle="Last 24 hours"
          icon={Activity}
          color="blue"
        />
        <MetricCard
          title="Allowed"
          value={metrics.allowed}
          icon={CheckCircle}
          color="green"
        />
        <MetricCard
          title="Blocked"
          value={metrics.blocked}
          icon={ShieldOff}
          color="red"
        />
        <MetricCard
          title="Flagged for Review"
          value={metrics.flagged}
          icon={AlertTriangle}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Recent Activity
            </h3>
          </div>
          <div className="divide-y divide-border">
            {recentActivity.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No activity yet. Requests will appear here as agents
                interact with the firewall.
              </div>
            ) : (
              recentActivity.map((log) => (
                <div
                  key={log.id}
                  className="px-5 py-3 flex items-center gap-4 text-sm hover:bg-white/[0.02] transition-colors"
                >
                  <StatusBadge status={log.engineDecision} />
                  <span className="font-mono text-xs text-muted-foreground w-14">
                    {log.requestMethod}
                  </span>
                  <span className="flex-1 truncate text-foreground font-mono text-xs">
                    {log.requestUrl}
                  </span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {log.latencyMs}ms
                  </span>
                  <span className="text-xs text-muted-foreground w-20 text-right">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Rules */}
        <div className="bg-card rounded-xl border border-border">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">
              Top Triggered Rules
            </h3>
          </div>
          <div className="divide-y divide-border">
            {topRules.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                No rules triggered yet.
              </div>
            ) : (
              topRules.map((rule) => (
                <div
                  key={rule.ruleId}
                  className="px-5 py-3 flex items-center justify-between text-sm hover:bg-white/[0.02] transition-colors"
                >
                  <span className="text-foreground truncate flex-1">
                    {rule.ruleName}
                  </span>
                  <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-2">
                    {rule.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
