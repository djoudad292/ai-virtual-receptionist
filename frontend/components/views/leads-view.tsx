'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, paginate } from '@/lib/api'
import { useToast } from '@/components/toast'
import { truncateText } from '@/lib/utils'
import { Loader2, Users, Mail, Phone, MessageSquare } from 'lucide-react'

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

export default function LeadsView() {
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/leads')
        .then((data) => setLeads(paginate<Lead>(data).items))
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

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-foreground">Captured Leads</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          The AI receptionist captures contacts automatically when visitors share their name, email or phone in chat.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <Users className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No leads captured yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Chat with the AI and share your email or phone to see a lead appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <div
              key={lead.id}
              className="group rounded-xl border border-border/50 bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                    {(lead.name || lead.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{lead.name || 'Anonymous'}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {new Date(lead.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                <select
                  value={lead.status}
                  onChange={(e) => updateStatus(lead.id, e.target.value)}
                  className="shrink-0 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
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
                    <Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{lead.email}</span>
                  </p>
                )}
                {lead.phone && (
                  <p className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 shrink-0" /> <span className="truncate">{lead.phone}</span>
                  </p>
                )}
                  {lead.message && (
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MessageSquare className="h-4 w-4 shrink-0 mt-0.5" /> <span className="line-clamp-2 text-xs">{truncateText(lead.message, 100)}</span>
                    </p>
                  )}
                {lead.department && (
                  <p className="flex items-center gap-2 text-muted-foreground/60">
                    <Users className="h-4 w-4 shrink-0" /> <span className="truncate">{lead.department}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}