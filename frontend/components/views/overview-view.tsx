'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, paginate } from '@/lib/api'
import type { Tab } from '@/lib/workspace'
import { MessageSquare, BookOpen, Users, CalendarClock, BarChart3, Loader2, CheckCircle2, Circle, LifeBuoy } from 'lucide-react'

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

export default function OverviewView({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { isAuthenticated } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [docCount, setDocCount] = useState(0)
  const [summary, setSummary] = useState<Summary>({ total: 0, active: 0, aiHandled: 0, humanHandled: 0, unresolved: 0, leads: 0, appointments: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/conversations')
        .then((data) => setConversations(paginate<Conversation>(data).items))
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

  const stats = [
    { label: 'Total Conversations', value: summary.total, color: 'text-blue-400' },
    { label: 'Active Chats', value: summary.active, color: 'text-green-400' },
    { label: 'Leads Captured', value: summary.leads, color: 'text-purple-400' },
    { label: 'Appointments', value: summary.appointments, color: 'text-orange-400' },
  ]

  const recentConversations = conversations.slice(0, 5)

  const setupSteps = [
    { label: 'Add knowledge base documents', done: docCount > 0, tab: 'knowledge' as Tab, hint: 'Give the AI the facts it needs to answer' },
    { label: 'Embed the chat widget on your site', done: summary.total > 0, tab: 'settings' as Tab, hint: 'Copy the code from Settings' },
    { label: 'Chat with the AI to test it', done: summary.total > 0, tab: 'inbox' as Tab, hint: 'Open a conversation to see how it responds' },
    { label: 'Review captured leads', done: summary.leads > 0, tab: 'leads' as Tab, hint: 'Contacts the AI captured from visitors' },
  ]
  const completedSteps = setupSteps.filter((s) => s.done).length
  const allDone = completedSteps === setupSteps.length

  const quickActions: { label: string; desc: string; tab: Tab; icon: typeof MessageSquare; color: string }[] = [
    { label: 'Open Inbox', desc: 'View and manage conversations', tab: 'inbox', icon: MessageSquare, color: 'bg-primary/10 text-primary' },
    { label: 'View Leads', desc: 'Contacts captured by the AI', tab: 'leads', icon: Users, color: 'bg-purple-500/10 text-purple-400' },
    { label: 'Appointments', desc: 'Meetings booked by the AI', tab: 'appointments', icon: CalendarClock, color: 'bg-orange-500/10 text-orange-400' },
    { label: 'Knowledge Base', desc: 'Manage your AI training docs', tab: 'knowledge', icon: BookOpen, color: 'bg-green-500/10 text-green-400' },
    { label: 'View Analytics', desc: 'Track performance metrics', tab: 'analytics', icon: BarChart3, color: 'bg-blue-500/10 text-blue-400' },
    { label: 'Read the Guide', desc: 'How to use every feature', tab: 'guide', icon: LifeBuoy, color: 'bg-slate-500/10 text-slate-400' },
  ]

  return (
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
            <button
              onClick={() => onNavigate('guide')}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              Full guide
            </button>
          </div>
          <div className="space-y-2">
            {setupSteps.map((step) => (
              <button
                key={step.label}
                onClick={() => onNavigate(step.tab)}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-secondary"
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
              </button>
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
                <button
                  key={conv.id}
                  onClick={() => onNavigate('inbox')}
                  className="flex w-full items-center justify-between rounded-lg bg-secondary px-4 py-3 text-left transition-colors hover:bg-secondary/80"
                >
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
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">Quick Actions</h2>
          <div className="space-y-3">
            {quickActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={action.label}
                  onClick={() => onNavigate(action.tab)}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-secondary p-4 text-left transition-colors hover:border-primary/50"
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${action.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-muted-foreground">{action.desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
