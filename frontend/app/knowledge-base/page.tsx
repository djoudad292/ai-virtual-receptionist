'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiFetch } from '@/lib/api'
import Sidebar from '@/components/sidebar'
import MobileSidebar from '@/components/mobile-sidebar'
import { useToast } from '@/components/toast'
import { Menu, Plus, Trash2, RefreshCw, Search, Loader2, X } from 'lucide-react'

interface Document {
  id: string
  title: string
  content: string
  createdAt: string
}

export default function KnowledgeBasePage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/knowledge-base')
        .then((data) => setDocs(Array.isArray(data) ? data : data.documents || []))
        .catch(() => addToast('Failed to load documents', 'error'))
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, addToast])

  const addDocument = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    setSubmitting(true)
    try {
      const doc = await apiFetch('/knowledge-base', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      })
      setDocs((prev) => [...prev, doc])
      setShowModal(false)
      setNewTitle('')
      setNewContent('')
      addToast('Document added successfully', 'success')
    } catch (err: any) {
      addToast(err.message || 'Failed to add document', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteDocument = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return
    try {
      await apiFetch(`/knowledge-base/${id}`, { method: 'DELETE' })
      setDocs((prev) => prev.filter((d) => d.id !== id))
      addToast('Document deleted', 'success')
    } catch {
      addToast('Failed to delete document', 'error')
    }
  }

  const reindexDocument = async (id: string) => {
    try {
      await apiFetch(`/knowledge-base/${id}/reindex`, { method: 'POST' })
      addToast('Document re-indexed', 'success')
    } catch {
      addToast('Failed to re-index document', 'error')
    }
  }

  const handleSearch = async () => {
    if (!searchQuery.trim()) return
    setSearching(true)
    try {
      const data = await apiFetch('/knowledge-base/search', {
        method: 'POST',
        body: JSON.stringify({ query: searchQuery.trim() }),
      })
      setSearchResults(Array.isArray(data) ? data : data.results || [])
    } catch {
      addToast('Search failed', 'error')
    } finally {
      setSearching(false)
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
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 text-center text-[10px] text-amber-400">
          Demo &middot; In-memory &middot; Built by{' '}
          <a href="https://djaouad.tech" target="_blank" rel="noopener noreferrer" className="font-semibold underline">djaouad frih</a>
        </div>
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileOpen(true)} className="text-muted-foreground md:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Knowledge Base</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Document
          </button>
        </header>

        <div className="p-6 space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Search Knowledge Base</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
                placeholder="Search your knowledge base..."
                className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleSearch}
                disabled={searching || !searchQuery.trim()}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((doc) => (
                  <div key={doc.id} className="rounded-lg bg-secondary p-3">
                    <p className="text-sm font-medium text-foreground">{doc.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{doc.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-sm font-semibold text-foreground">Documents ({docs.length})</h2>
            </div>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No documents yet. Add your first document.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between px-5 py-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Added {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-4">
                      <button
                        onClick={() => reindexDocument(doc.id)}
                        className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        title="Re-index"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => deleteDocument(doc.id)}
                        className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add Document</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Content</label>
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="Document content for the AI to reference..."
                  rows={6}
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addDocument}
                  disabled={submitting || !newTitle.trim() || !newContent.trim()}
                  className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Add Document'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
