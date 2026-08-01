'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import Sidebar from '@/components/sidebar'
import MobileSidebar from '@/components/mobile-sidebar'
import { useToast } from '@/components/toast'
import { Menu, Loader2, Users, Mail, Phone, MessageSquare } from 'lucide-react'

interface Lead {
  id: string
  name?: string | null
  email?: string | null
  phone?: string | null
  message?: string | null
  source?: string
  status: string
  department?: string | null
  createdAt: string
}

export default function LeadsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/leads')
        .then((data) => setLeads(Array.isArray(data) ? data : []))
        .catch(() => addToast('Failed to load leads', 'error'))
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, addToast])

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/leads/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)))
      addToast('Lead updated', 'success')
    } catch {
      addToast('Failed to update lead', 'error')
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 md:ml-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Leads</h1>
        </header>

        <div className="p-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
              <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">No leads captured yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                The AI receptionist captures leads automatically when visitors share their contact info.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leads.map((lead) => (
                <div key={lead.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                        {(lead.name || lead.email || '?').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{lead.name || 'Anonymous'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(lead.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className="rounded-lg border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="new">new</option>
                      <option value="contacted">contacted</option>
                      <option value="qualified">qualified</option>
                      <option value="closed">closed</option>
                    </select>
                  </div>

                  <div className="mt-4 space-y-2 text-sm">
                    {lead.email && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-4 w-4" /> {lead.email}
                      </p>
                    )}
                    {lead.phone && (
                      <p className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4" /> {lead.phone}
                      </p>
                    )}
                    {lead.message && (
                      <p className="flex items-start gap-2 text-muted-foreground">
                        <MessageSquare className="h-4 w-4 mt-0.5 shrink-0" />
                        <span className="line-clamp-3">{lead.message}</span>
                      </p>
                    )}
                  </div>

                  {lead.department && (
                    <span className="mt-4 inline-block rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400">
                      {lead.department}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
