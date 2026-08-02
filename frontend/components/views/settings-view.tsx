'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/toast'
import { Loader2, Copy, Check, Plus, Trash2 } from 'lucide-react'

interface CompanySettings {
  id?: string
  name?: string
  settings?: Record<string, any>
}

interface Department {
  id: string
  name: string
  description?: string | null
  keywords: string[]
  email?: string | null
}

export default function SettingsView() {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [settingsJson, setSettingsJson] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [departments, setDepartments] = useState<Department[]>([])
  const [deptModal, setDeptModal] = useState(false)
  const [deptForm, setDeptForm] = useState({ name: '', description: '', keywords: '' })
  const [deptSaving, setDeptSaving] = useState(false)

  useEffect(() => {
    if (user?.companyId) {
      apiFetch('/companies/profile')
        .then((data) => {
          setCompany(data)
          setSettingsJson(JSON.stringify(data.settings || {}, null, 2))
        })
        .catch(() => addToast('Failed to load company settings', 'error'))
      apiFetch('/departments')
        .then((data) => setDepartments(Array.isArray(data) ? data : []))
        .catch(() => {})
        .finally(() => setLoading(false))
    }
  }, [user?.companyId, addToast])

  const saveSettings = async () => {
    setSaving(true)
    try {
      let parsed: Record<string, any> = {}
      try {
        parsed = JSON.parse(settingsJson)
      } catch {
        addToast('Invalid JSON in settings', 'error')
        setSaving(false)
        return
      }
      await apiFetch('/companies/settings', {
        method: 'PATCH',
        body: JSON.stringify({ settings: parsed }),
      })
      addToast('Settings saved successfully', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  const createDepartment = async () => {
    if (!deptForm.name.trim()) {
      addToast('Department name is required', 'error')
      return
    }
    setDeptSaving(true)
    try {
      const dept = await apiFetch('/departments', {
        method: 'POST',
        body: JSON.stringify({
          name: deptForm.name.trim(),
          description: deptForm.description.trim(),
          keywords: deptForm.keywords,
        }),
      })
      setDepartments((prev) => [...prev, dept])
      setDeptModal(false)
      setDeptForm({ name: '', description: '', keywords: '' })
      addToast('Department added', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to add department', 'error')
    } finally {
      setDeptSaving(false)
    }
  }

  const deleteDepartment = async (id: string) => {
    if (!confirm('Delete this department?')) return
    try {
      await apiFetch(`/departments/${id}`, { method: 'DELETE' })
      setDepartments((prev) => prev.filter((d) => d.id !== id))
      addToast('Department deleted', 'success')
    } catch {
      addToast('Failed to delete department', 'error')
    }
  }

  const embedCode = user?.companyId
    ? `<script src="${process.env.NEXT_PUBLIC_WIDGET_URL || 'https://ai-receptionist-backend-h14q.onrender.com'}/widget.js" data-api-url="${process.env.NEXT_PUBLIC_API_URL || 'https://ai-receptionist-backend-h14q.onrender.com'}" data-ws-url="${process.env.NEXT_PUBLIC_WS_URL || 'https://ai-receptionist-backend-h14q.onrender.com'}" data-company-id="${user.companyId}"></script>`
    : ''

  const copyEmbed = () => {
    navigator.clipboard.writeText(embedCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    addToast('Embed code copied to clipboard', 'success')
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Settings</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Manage your company, departments and the widget embed code.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Company</h2>
            <p className="text-sm text-muted-foreground">{company?.name || 'Your Company'}</p>
            <p className="text-xs text-muted-foreground mt-0.5">ID: {user?.companyId}</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Departments</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  The AI routes conversations to these departments based on intent.
                </p>
              </div>
              <button
                onClick={() => setDeptModal(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" /> Add
              </button>
            </div>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No departments yet</p>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div key={dept.id} className="flex items-center justify-between rounded-lg bg-secondary px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{dept.name}</p>
                      {dept.description && (
                        <p className="text-xs text-muted-foreground">{dept.description}</p>
                      )}
                      {dept.keywords.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {dept.keywords.map((k) => (
                            <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteDepartment(dept.id)}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">Company Settings</h2>
            <textarea
              value={settingsJson}
              onChange={(e) => setSettingsJson(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
            <button
              onClick={saveSettings}
              disabled={saving}
              className="mt-3 rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Save Settings'}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="text-sm font-semibold text-foreground mb-1">Widget Embed Code</h2>
            <p className="text-xs text-muted-foreground mb-3">
              Add this script to your website to enable the AI receptionist chat widget.
            </p>
            <div className="relative">
              <pre className="overflow-x-auto rounded-xl border border-border bg-secondary p-4 text-xs font-mono text-foreground">
                {embedCode || 'Loading...'}
              </pre>
              <button
                onClick={copyEmbed}
                disabled={!embedCode}
                className="absolute right-2 top-2 rounded-lg border border-border bg-card p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </>
      )}

      {deptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">New Department</h2>
              <button onClick={() => setDeptModal(false)} className="text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                placeholder="Name (e.g. Sales)"
                value={deptForm.name}
                onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                placeholder="Description (optional)"
                value={deptForm.description}
                onChange={(e) => setDeptForm({ ...deptForm, description: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <input
                placeholder="Keywords (comma separated, e.g. price, quote, cost)"
                value={deptForm.keywords}
                onChange={(e) => setDeptForm({ ...deptForm, keywords: e.target.value })}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={createDepartment}
                disabled={deptSaving}
                className="mt-2 w-full rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {deptSaving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Add Department'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
