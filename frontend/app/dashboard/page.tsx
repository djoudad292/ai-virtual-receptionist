'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import Sidebar from '@/components/sidebar'
import MobileSidebar from '@/components/mobile-sidebar'
import ChatWidgetPreview from '@/components/chat-widget-preview'
import { MessageSquare, BookOpen, Users, CalendarClock, BarChart3, Menu, Loader2, CheckCircle2, Circle, LifeBuoy } from 'lucide-react'

interface Conversation {
  id: string
  title: string
  status: string
  department?: string | null
  handledBy?: string | null
  lastMessage?: string | null
  createdAt: string
}

interface Summary {
  total: number
  active: number
  aiHandled: number
  humanHandled: number
  unresolved: number
  leads: number
  appointments: number
}

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [docCount, setDocCount] = useState(0)
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, aiHandled: 0, humanHandled: 0, unresolved: 0, leads: 0, appointments: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/conversations')
        .then((data) => setConversations(Array.isArray(data) ? data : data.conversations || []))
        .catch(() => {})
      apiFetch('/analytics/summary')
        .then((data) => setSummary(data))
        .catch(() => {})
      apiFetch('/knowledge-base')
        .then((data) => setDocCount((Array.isArray(data) ? data : data.documents || []).length))
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

  const stats = [
    { label: 'Total Conversations', value: summary.total, color: 'text-blue-400' },
    { label: 'Active Chats', value: summary.active, color: 'text-green-400' },
    { label: 'Leads Captured', value: summary.leads, color: 'text-purple-400' },
    { label: 'Appointments', value: summary.appointments, color: 'text-orange-400' },
  ]

  const recentConversations = conversations.slice(0, 5)

  const setupSteps = [
    { label: 'Add knowledge base documents', done: docCount > 0, href: '/knowledge-base', hint: 'Give the AI the facts it needs to answer' },
    { label: 'Embed the chat widget on your site', done: summary.total > 0, href: '/settings', hint: 'Copy the code from Settings' },
    { label: 'Chat with the AI to test it', done: summary.total > 0, href: '/inbox', hint: 'Open a conversation to see how it responds' },
    { label: 'Review captured leads', done: summary.leads > 0, href: '/leads', hint: 'Contacts the AI captured from visitors' },
  ]
  const completedSteps = setupSteps.filter((s) => s.done).length
  const allDone = completedSteps === setupSteps.length

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
        </header>

        <div className="p-6">
          {!allDone && (
            <div className="mb-8 rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Getting Started</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {completedSteps} of {setupSteps.length} steps done &mdash; follow these to get your receptionist running
                  </p>
                </div>
                <Link
                  href="/guide"
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <LifeBuoy className="h-3.5 w-3.5" />
                  Full guide
                </Link>
              </div>
              <div className="space-y-2">
                {setupSteps.map((step) => (
                  <Link
                    key={step.label}
                    href={step.href}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary"
                  >
                    {step.done ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-green-400" />
                    ) : (
                      <Circle className="h-5 w-5 shrink-0 text-muted-foreground/50" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm ${step.done ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                        {step.label}
                      </p>
                      <p className="text-xs text-muted-foreground">{step.hint}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className={`mt-2 text-3xl font-bold ${stat.color}`}>{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Recent Conversations</h2>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : recentConversations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No conversations yet</p>
              ) : (
                <div className="space-y-3">
                  {recentConversations.map((conv) => (
                    <div key={conv.id} className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">{conv.title || 'Untitled'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(conv.createdAt).toLocaleDateString()}
                          {conv.department ? ` · ${conv.department}` : ''}
                          {conv.lastMessage ? ` · ${conv.lastMessage.slice(0, 60)}` : ''}
                        </p>
                      </div>
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        conv.status === 'active' ? 'bg-green-500/10 text-green-400' :
                        conv.status === 'resolved' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {conv.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold text-foreground">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/inbox"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MessageSquare className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Open Inbox</p>
                    <p className="text-xs text-muted-foreground">View and manage conversations</p>
                  </div>
                </Link>
                <Link
                  href="/leads"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">View Leads</p>
                    <p className="text-xs text-muted-foreground">Contacts captured by the AI</p>
                  </div>
                </Link>
                <Link
                  href="/appointments"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Appointments</p>
                    <p className="text-xs text-muted-foreground">Meetings booked by the AI</p>
                  </div>
                </Link>
                <Link
                  href="/knowledge-base"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-400">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Knowledge Base</p>
                    <p className="text-xs text-muted-foreground">Manage your AI training docs</p>
                  </div>
                </Link>
                <Link
                  href="/analytics"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">View Analytics</p>
                    <p className="text-xs text-muted-foreground">Track performance metrics</p>
                  </div>
                </Link>
                <Link
                  href="/guide"
                  className="flex items-center gap-3 rounded-xl border border-border bg-secondary p-4 transition-colors hover:border-primary/50"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/10 text-slate-400">
                    <LifeBuoy className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Read the Guide</p>
                    <p className="text-xs text-muted-foreground">How to use every feature</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ChatWidgetPreview companyId={user?.companyId || 'preview'} title="Test your AI" />
    </div>
  )
}
