'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import Sidebar from '@/components/sidebar'
import MobileSidebar from '@/components/mobile-sidebar'
import { Menu, Loader2 } from 'lucide-react'

interface Summary {
  total: number
  active: number
  aiHandled: number
  humanHandled: number
  unresolved: number
  leads: number
  appointments: number
}

export default function AnalyticsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [stats, setStats] = useState<Summary>({ total: 0, active: 0, aiHandled: 0, humanHandled: 0, unresolved: 0, leads: 0, appointments: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/analytics/summary')
        .then((data) => setStats(data))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const aiPercent = stats.total > 0 ? Math.round((stats.aiHandled / stats.total) * 100) : 0
  const humanPercent = stats.total > 0 ? Math.round((stats.humanHandled / stats.total) * 100) : 0
  const resolved = stats.total - stats.unresolved

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Analytics</h1>
        </header>

        <div className="p-6 space-y-6">
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
      </div>
    </div>
  )
}
