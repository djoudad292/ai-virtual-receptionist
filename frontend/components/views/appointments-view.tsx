'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, paginate } from '@/lib/api'
import { useToast } from '@/components/toast'
import { Loader2, CalendarClock, Plus, X } from 'lucide-react'

interface Appointment {
  id: string
  customerName?: string | null
  customerEmail?: string | null
  title?: string | null
  notes?: string | null
  startTime: string
  endTime: string
  status: string
}

export default function AppointmentsView() {
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ customerName: '', customerEmail: '', title: '', startTime: '', durationMinutes: '30' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/appointments')
        .then((data) => setAppointments(paginate<Appointment>(data).items))
        .catch(() => addToast('Failed to load appointments', 'error'))
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, addToast])

  const createAppointment = async () => {
    if (!form.customerName.trim() || !form.startTime) {
      addToast('Name and start time are required', 'error')
      return
    }
    setSubmitting(true)
    try {
      const appt = await apiFetch('/appointments', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      setAppointments((prev) => [...prev, appt])
      setShowModal(false)
      setForm({ customerName: '', customerEmail: '', title: '', startTime: '', durationMinutes: '30' })
      addToast('Appointment created', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to create appointment', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const updateStatus = async (id: string, status: string) => {
    try {
      await apiFetch(`/appointments/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      })
      setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
      addToast('Appointment updated', 'success')
    } catch {
      addToast('Failed to update appointment', 'error')
    }
  }

  const statusColor: Record<string, string> = {
    requested: 'bg-amber-500/10 text-amber-400',
    confirmed: 'bg-green-500/10 text-green-400',
    completed: 'bg-blue-500/10 text-blue-400',
    cancelled: 'bg-red-500/10 text-red-400',
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Appointments</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Meetings booked by the AI in chat, plus any you create manually.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" /> New Appointment
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-16">
          <CalendarClock className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No appointments yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Ask the AI to "book me tomorrow at 14:00" in chat, or create one manually.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {appointments.map((appt) => (
            <div key={appt.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <CalendarClock className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{appt.title || 'Meeting'}</p>
                    <p className="truncate text-xs text-muted-foreground">{appt.customerName || 'Anonymous'}</p>
                  </div>
                </div>
                <select
                  value={appt.status}
                  onChange={(e) => updateStatus(appt.id, e.target.value)}
                  className="shrink-0 rounded-lg border border-border bg-secondary px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="requested">requested</option>
                  <option value="confirmed">confirmed</option>
                  <option value="completed">completed</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>

              <div className="mt-4 space-y-1.5 text-sm">
                <p className="font-medium text-foreground">
                  {new Date(appt.startTime).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(appt.startTime).toLocaleDateString(undefined, { weekday: 'long' })}
                  {' · '}
                  {Math.round((new Date(appt.endTime).getTime() - new Date(appt.startTime).getTime()) / 60000)} min
                </p>
                {appt.customerEmail && (
                  <p className="text-xs text-muted-foreground mt-2">{appt.customerEmail}</p>
                )}
              </div>

              <span className={`mt-4 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[appt.status] || 'bg-muted text-muted-foreground'}`}>
                {appt.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">New Appointment</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close dialog" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Customer name"
                aria-label="Customer name"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                placeholder="Customer email"
                aria-label="Customer email"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                placeholder="Title (e.g. Sales call)"
                aria-label="Appointment title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                type="datetime-local"
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <select
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="15">15 min</option>
                <option value="30">30 min</option>
                <option value="45">45 min</option>
                <option value="60">60 min</option>
              </select>
              <button
                onClick={createAppointment}
                disabled={submitting}
                className="mt-2 w-full rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Create Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
