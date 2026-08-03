'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import { useToast } from '@/components/toast'
import { Loader2, UserPlus, Trash2, Copy, Check, Mail } from 'lucide-react'

interface TeamAgent {
  id: string
  userId: string
  isOnline: boolean
  user?: {
    id: string
    email: string
    name: string
    role: string
    createdAt: string
  } | null
}

export default function TeamView() {
  const { user, isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [agents, setAgents] = useState<TeamAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [generated, setGenerated] = useState<{ email: string; name: string; tempPassword: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const isAdmin = user?.role === 'COMPANY_ADMIN'

  const loadAgents = () => {
    if (!isAuthenticated) return
    apiFetch('/agents')
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => addToast('Failed to load team', 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadAgents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  const inviteAgent = async () => {
    if (!email.trim()) {
      addToast('Email is required', 'error')
      return
    }
    setInviting(true)
    try {
      const result = await apiFetch('/agents/invite', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), name: name.trim() }),
      })
      setGenerated({ email: result.email, name: result.name, tempPassword: result.tempPassword })
      setShowModal(false)
      setEmail('')
      setName('')
      loadAgents()
      addToast('Agent invited', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to invite agent', 'error')
    } finally {
      setInviting(false)
    }
  }

  const removeAgent = async (id: string) => {
    if (!confirm('Remove this agent from your team? They will lose access immediately.')) return
    try {
      await apiFetch(`/agents/${id}`, { method: 'DELETE' })
      setAgents((prev) => prev.filter((a) => a.id !== id))
      addToast('Agent removed', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to remove agent', 'error')
    }
  }

  const copyCredentials = () => {
    if (!generated) return
    navigator.clipboard.writeText(
      `Email: ${generated.email}\nName: ${generated.name}\nTemporary password: ${generated.tempPassword}`
    )
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    addToast('Credentials copied to clipboard', 'success')
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Team</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Invite agents to handle conversations and take over from the AI.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-foreground">Agents ({agents.length})</h2>
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <UserPlus className="h-4 w-4" />
              Invite Agent
            </button>
          )}
        </div>
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'No agents yet. Invite your first team member.' : 'No agents on this team yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-medium text-primary">
                    {agent.user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    <span
                      className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${agent.isOnline ? 'bg-green-500' : 'bg-gray-400'}`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.user?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground truncate">{agent.user?.email || ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-4">
                  <span
                    className={`hidden sm:inline rounded-full px-2.5 py-1 text-[10px] font-medium ${
                      agent.isOnline ? 'bg-green-500/10 text-green-400' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    {agent.isOnline ? 'Online' : 'Offline'}
                  </span>
                  {isAdmin && (
                    <button
                      onClick={() => removeAgent(agent.id)}
                      className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove agent"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {generated && (
        <div className="rounded-xl border border-primary/40 bg-primary/5 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Agent invited — share credentials</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                An email was sent. Share these credentials with {generated.name} so they can sign in and change their password.
              </p>
            </div>
            <button
              onClick={copyCredentials}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              Copy
            </button>
          </div>
          <div className="space-y-1 rounded-lg bg-card p-4 font-mono text-xs text-foreground">
            <p>Email: {generated.email}</p>
            <p>Name: {generated.name}</p>
            <p>Temporary password: <span className="text-primary font-semibold">{generated.tempPassword}</span></p>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Invite Agent</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <UserPlus className="h-4 w-4 rotate-45" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="agent@company.com"
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">Full name (optional)</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <p className="flex items-start gap-2 rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                They'll get an invite email with a temporary password and can sign in at the login page.
              </p>
              <button
                onClick={inviteAgent}
                disabled={inviting || !email.trim()}
                className="mt-2 w-full rounded-xl bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
