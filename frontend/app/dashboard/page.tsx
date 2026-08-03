'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import Sidebar from '@/components/sidebar'
import MobileSidebar from '@/components/mobile-sidebar'
import ChatWidgetPreview from '@/components/chat-widget-preview'
import { Menu, Loader2 } from 'lucide-react'
import { TABS, type Tab } from '@/lib/workspace'
import OverviewView from '@/components/views/overview-view'
import InboxView from '@/components/views/inbox-view'
import KnowledgeBaseView from '@/components/views/knowledge-base-view'
import LeadsView from '@/components/views/leads-view'
import AppointmentsView from '@/components/views/appointments-view'
import AnalyticsView from '@/components/views/analytics-view'
import TeamView from '@/components/views/team-view'
import GuideView from '@/components/views/guide-view'
import SettingsView from '@/components/views/settings-view'

export default function DashboardPage() {
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [authLoading, isAuthenticated, router])

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  const activeLabel = TABS.find((t) => t.id === activeTab)?.label || 'Dashboard'

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar active={activeTab} onNavigate={setActiveTab} />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} active={activeTab} onNavigate={setActiveTab} />

      <div className="flex flex-1 flex-col md:ml-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-4 py-3 md:px-6 md:py-4">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">{activeLabel}</h1>
        </header>

        <div className="flex-1 overflow-hidden">
          {activeTab === 'overview' && <OverviewView onNavigate={setActiveTab} />}
          {activeTab === 'inbox' && <InboxView />}
          {activeTab === 'knowledge' && <KnowledgeBaseView />}
          {activeTab === 'leads' && <LeadsView />}
          {activeTab === 'appointments' && <AppointmentsView />}
          {activeTab === 'analytics' && <AnalyticsView />}
          {activeTab === 'team' && <TeamView />}
          {activeTab === 'guide' && <GuideView onNavigate={setActiveTab} />}
          {activeTab === 'settings' && <SettingsView />}
        </div>
      </div>

      <ChatWidgetPreview companyId={user?.companyId || 'preview'} title="Test your AI" />
    </div>
  )
}
