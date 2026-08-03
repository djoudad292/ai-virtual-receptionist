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
  type LucideIcon,
} from 'lucide-react'

export type Tab =
  | 'overview'
  | 'inbox'
  | 'knowledge'
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
  { id: 'leads', label: 'Leads', icon: Users },
  { id: 'appointments', label: 'Appointments', icon: CalendarClock },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'team', label: 'Team', icon: UserCog },
  { id: 'guide', label: 'Guide', icon: LifeBuoy },
  { id: 'settings', label: 'Settings', icon: Settings },
]
