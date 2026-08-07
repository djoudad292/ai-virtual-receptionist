import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  Users,
  CalendarClock,
  BarChart3,
  Settings,
  LifeBuoy,
  UserCog,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type Tab =
  | 'overview'
  | 'inbox'
  | 'knowledge'
  | 'ask'
  | 'summaries'
  | 'leads'
  | 'appointments'
  | 'analytics'
  | 'team'
  | 'guide'
  | 'settings'

export interface TabDef {
  id: Tab
  label: string
  icon: LucideIcon
}

export const TABS: TabDef[] = [
  { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'inbox', label: 'Inbox', icon: MessageSquare },
  { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen },
  { id: 'ask', label: 'Ask', icon: Search },
  { id: 'summaries', label: 'Summaries', icon: Sparkles },
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'team', label: 'Team', icon: UserCog },
  { id: 'guide', label: 'Guide', icon: LifeBuoy },
  { id: 'settings', label: 'Settings', icon: Settings },
]
