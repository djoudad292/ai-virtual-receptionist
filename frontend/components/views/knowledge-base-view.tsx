'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, paginate, downloadFile, formatBytes } from '@/lib/api'
import { useToast } from '@/components/toast'
import ConfirmDialog from '@/components/confirm-dialog'
import { Plus, Trash2, RefreshCw, Search, Loader2, X, Upload, ChevronLeft, ChevronRight, Download, Globe } from 'lucide-react'
import { truncateText } from '@/lib/utils'

interface Document {
  id: string
  title: string
  content: string
  createdAt: string
  filename?: string | null
  sizeBytes?: number
  pageCount?: number
  status?: string
  published?: boolean
  summary?: string | null
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
    if (ext !== 'txt' && ext !== 'md' && ext !== 'markdown' && ext !== 'pdf') {
      addToast('Please choose a .txt, .md or .pdf file', 'error')
      return
    }
    const isPdf = ext === 'pdf'
    const maxSize = isPdf ? 10 * 1024 * 1024 : 2 * 1024 * 1024
    if (file.size > maxSize) {
      addToast(isPdf ? 'PDF must be under 10MB' : 'File must be under 2MB', 'error')
      return
    }
    setUploading(true)
    if (isPdf) addToast('Parsing PDF… this can take a few seconds', 'info')
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

  const togglePublished = async (doc: Document) => {
    const next = !doc.published
    setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, published: next } : d)))
    try {
      await apiFetch(`/knowledge-base/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ published: next }),
      })
      addToast(next ? 'Document published to the chat widget' : 'Document hidden from the chat widget', 'success')
    } catch {
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, published: !next } : d)))
      addToast('Failed to update document', 'error')
    }
  }

  const handleDownload = async (doc: Document) => {
    try {
      await downloadFile(`/knowledge-base/${doc.id}/download`, doc.filename || doc.title)
    } catch {
      addToast('No original file stored for this document', 'error')
    }
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Your Knowledge Base</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            This is the AI&apos;s memory. Add documents about your products, prices, hours and policies so it can answer accurately.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <input ref={fileInputRef} type="file" accept=".txt,.md,.markdown,.pdf,application/pdf" className="hidden" onChange={handleFileUpload} />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary transition-colors disabled:opacity-50 sm:flex-none"
          >
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload .pdf/.txt/.md
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
          <div className="space-y-3">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="group flex flex-col gap-2.5 p-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/50 bg-card/50 shadow-sm transition-all hover:shadow-md hover:border-primary/20"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground" title={doc.title}>{truncateText(doc.title, 15)}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        doc.status === 'ready'
                          ? 'bg-success/10 text-success'
                          : doc.status === 'error'
                            ? 'bg-danger/10 text-danger'
                            : 'bg-yellow-500/10 text-yellow-400'
                      }`}
                    >
                      {doc.status || 'ready'}
                    </span>
                    {doc.published !== false && (
                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Published
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    Added {new Date(doc.createdAt).toLocaleDateString()}
                    {doc.filename && <span className="ml-1 inline-block max-w-[180px] align-bottom truncate">· {doc.filename}</span>}
                    {doc.pageCount ? <span> · {doc.pageCount} pages</span> : null}
                    {doc.sizeBytes ? <span> · {formatBytes(doc.sizeBytes)}</span> : null}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 sm:shrink-0 sm:ml-4">
                  <button
                    onClick={() => togglePublished(doc)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    aria-label={doc.published !== false ? `Unpublish ${doc.title}` : `Publish ${doc.title}`}
                    title={doc.published !== false ? 'Visible in chat widget — click to hide' : 'Hidden from chat widget — click to publish'}
                  >
                    <Globe className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:block"
                    aria-label={`Download ${doc.title}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => reindexDocument(doc.id)}
                    className="rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors hidden sm:block"
                    aria-label={`Re-index ${doc.title}`}
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setConfirmDelete(doc)}
                    className="rounded-lg border border-red-500/20 p-2 text-danger hover:bg-danger/10 transition-colors"
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
