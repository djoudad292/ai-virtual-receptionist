'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { Loader2 } from 'lucide-react'

interface Summary {
  total: number
  active: number
  aiHandled: number
  humanHandled: number
  unresolved: number
  leads: number
  appointments: number
}

interface Detail {
  conversationsByDay: { day: string; count: number }[]
  leadsByDay: { day: string; count: number }[]
  leadsByDepartment: { name: string; count: number }[]
}

const DEPT_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#14b8a6', '#6366f1']

function Sparkline({ points, color = '#3b82f6' }: { points: { day: string; count: number }[]; color?: string }) {
  const values = points.map((p) => p.count)
  const max = Math.max(...values, 1)
  const w = 100
  const h = 44
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const coords = values.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * (h - 6) - 3).toFixed(1)}`)
  const polyline = coords.join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 90 }}>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={polyline}
      />
      <polyline
        fill={color}
        opacity="0.12"
        points={`0,${h} ${polyline} ${w},${h}`}
        stroke="none"
      />
    </svg>
  )
}

function BarChart({ data }: { data: { name: string; count: number }[] }) {
  const total = data.reduce((s, d) => s + d.count, 0)
  if (total === 0) return <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="space-y-3">
      {data.map((d, i) => (
        <div key={d.name}>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-muted-foreground truncate">{d.name}</span>
            <span className="text-foreground font-medium">{d.count}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${(d.count / max) * 100}%`, backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsView() {
  const { isAuthenticated } = useAuth()
  const [stats, setStats] = useState<Summary>({ total: 0, active: 0, aiHandled: 0, humanHandled: 0, unresolved: 0, leads: 0, appointments: 0 })
  const [detail, setDetail] = useState<Detail>({ conversationsByDay: [], leadsByDay: [], leadsByDepartment: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/analytics/summary')
        .then((data) => setStats(data))
        .catch(() => {})
      apiFetch('/analytics/detail')
        .then((data) => setDetail(data))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated])

  const aiPercent = stats.total > 0 ? Math.round((stats.aiHandled / stats.total) * 100) : 0
  const humanPercent = stats.total > 0 ? Math.round((stats.humanHandled / stats.total) * 100) : 0
  const resolved = Math.max(stats.total - stats.unresolved, 0)

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Analytics</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          How your receptionist is performing. Data updates as visitors chat with your widget.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Total Chats</p>
              <p className="mt-2 text-3xl font-bold text-blue-400">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">AI Handled</p>
              <p className="mt-2 text-3xl font-bold text-purple-400">
                {aiPercent}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">{stats.aiHandled} conversations</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Leads Captured</p>
              <p className="mt-2 text-3xl font-bold text-orange-400">{stats.leads}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Appointments</p>
              <p className="mt-2 text-3xl font-bold text-green-400">{stats.appointments}</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Conversations (last 14 days)</h2>
              <Sparkline points={detail.conversationsByDay} color="#3b82f6" />
              {detail.conversationsByDay.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{detail.conversationsByDay[0]?.day}</span>
                  <span>{detail.conversationsByDay[detail.conversationsByDay.length - 1]?.day}</span>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Leads (last 14 days)</h2>
              <Sparkline points={detail.leadsByDay} color="#f59e0b" />
              {detail.leadsByDay.length > 0 && (
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{detail.leadsByDay[0]?.day}</span>
                  <span>{detail.leadsByDay[detail.leadsByDay.length - 1]?.day}</span>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold text-foreground">Leads by Department</h2>
            <BarChart data={detail.leadsByDepartment} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">AI vs Human Handled Ratio</h2>
              <div className="flex h-8 w-full overflow-hidden rounded-lg bg-secondary">
                <div
                  className="flex items-center justify-center bg-purple-500 text-xs font-medium text-white transition-all"
                  style={{ width: `${aiPercent}%` }}
                >
                  {aiPercent > 10 && `AI ${aiPercent}%`}
                </div>
                <div
                  className="flex items-center justify-center bg-orange-500 text-xs font-medium text-white transition-all"
                  style={{ width: `${humanPercent}%` }}
                >
                  {humanPercent > 10 && `Human ${humanPercent}%`}
                </div>
              </div>
              {stats.total === 0 && (
                <p className="mt-3 text-xs text-muted-foreground text-center">No data yet</p>
              )}
              <div className="mt-4 flex items-center justify-center gap-6">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-purple-500" />
                  <span className="text-xs text-muted-foreground">AI ({stats.aiHandled})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-orange-500" />
                  <span className="text-xs text-muted-foreground">Human ({stats.humanHandled})</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Conversation Status</h2>
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Active</span>
                    <span className="text-foreground font-medium">{stats.active}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{ width: `${stats.total > 0 ? (stats.active / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Resolved</span>
                    <span className="text-foreground font-medium">{resolved}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{ width: `${stats.total > 0 ? (resolved / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Unresolved</span>
                    <span className="text-foreground font-medium">{stats.unresolved}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-red-500 transition-all"
                      style={{ width: `${stats.total > 0 ? (stats.unresolved / stats.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
