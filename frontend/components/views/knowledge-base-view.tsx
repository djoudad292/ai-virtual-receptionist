'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, paginate } from '@/lib/api'
import { useToast } from '@/components/toast'
import ConfirmDialog from '@/components/confirm-dialog'
import { Plus, Trash2, RefreshCw, Search, Loader2, X, Upload, ChevronLeft, ChevronRight } from 'lucide-react'

interface Document {
  id: string
  title: string
  content: string
  createdAt: string
}

const PAGE_SIZE = 20

export default function KnowledgeBaseView() {
  const { isAuthenticated } = useAuth()
  const { addToast } = useToast()
  const [docs, setDocs] = useState<Document[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Document[]>([])
  const [searching, setSearching] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Document | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch(`/knowledge-base?page=${page}&limit=${PAGE_SIZE}`)
        .then((data) => {
          const p = paginate<Document>(data)
          setDocs(p.items)
          setTotal(p.total)
        })
        .catch(() => addToast('Failed to load documents', 'error'))
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, page, addToast])

  const reloadFirstPage = () => {
    setPage(1)
    apiFetch(`/knowledge-base?page=1&limit=${PAGE_SIZE}`)
      .then((data) => {
        const p = paginate<Document>(data)
        setDocs(p.items)
        setTotal(p.total)
      })
      .catch(() => {})
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'txt' && ext !== 'md' && ext !== 'markdown') {
      addToast('Please choose a .txt or .md file', 'error')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      addToast('File must be under 2MB', 'error')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await apiFetch('/knowledge-base/upload', {
        method: 'POST',
        body: fd,
      })
      addToast(`Uploaded "${file.name}"`, 'success')
      reloadFirstPage()
    } catch (err: any) {
      addToast(err.message || 'Failed to upload file', 'error')
    } finally {
      setUploading(false)
    }
  }

  const addDocument = async () => {
    if (!newTitle.trim() || !newContent.trim()) return
    setSubmitting(true)
    try {
      await apiFetch('/knowledge-base', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      })
      setShowModal(false)
      setNewTitle('')
      setNewContent('')
      addToast('Document added successfully', 'success')
      reloadFirstPage()
    } catch (err: any) {
      addToast(err.message || 'Failed to add document', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const deleteDocument = async (id: string) => {
    setConfirmDelete(null)
    try {
      await apiFetch(`/knowledge-base/${id}`, { method: 'DELETE' })
      setDocs((prev) => prev.filter((d) => d.id !== id))
      setTotal((t) => Math.max(t - 1, 0))
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

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Your Knowledge Base</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            This is the AI&apos;s memory. Add documents about your products, prices, hours and policies so it can answer accurately.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 sm:flex-none"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload .txt/.md
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors sm:flex-none"
          >
            <Plus className="h-4 w-4" />
            Add Document
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Search Knowledge Base</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Search your knowledge base..."
            aria-label="Search your knowledge base"
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
          <h2 className="text-sm font-semibold text-foreground">Documents ({total})</h2>
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
                    aria-label={`Re-index ${doc.title}`}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(doc)}
                    className="rounded-lg border border-red-500/20 p-2 text-red-400 hover:bg-red-500/10 transition-colors"
                    aria-label={`Delete ${doc.title}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-5 py-3">
            <button
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {Math.max(Math.ceil(total / PAGE_SIZE), 1)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / PAGE_SIZE)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-doc-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="add-doc-title" className="text-lg font-semibold text-foreground">Add Document</h3>
              <button onClick={() => setShowModal(false)} aria-label="Close dialog" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="doc-title" className="block text-sm font-medium text-foreground mb-1">Title</label>
                <input
                  id="doc-title"
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Document title"
                  className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label htmlFor="doc-content" className="block text-sm font-medium text-foreground mb-1">Content</label>
                <textarea
                  id="doc-content"
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

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Delete document?"
        message={confirmDelete ? `"${confirmDelete.title}" will be permanently deleted. This cannot be undone.` : ''}
        onConfirm={() => confirmDelete && deleteDocument(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
