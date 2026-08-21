'use client'

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Sparkles, Loader2, RefreshCw, FileText, Check } from 'lucide-react'
import { apiFetch, paginate, formatDate } from '@/lib/api'
import { useToast } from '@/components/toast'

interface Document {
  id: string
  title: string
  status: string
  summary: string | null
  updatedAt?: string
}

export default function SummariesView() {
  const { addToast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [summary, setSummary] = useState<string>('')
  const [cached, setCached] = useState(false)
  const [busy, setBusy] = useState(false)

  const reload = async () => {
    try {
      const data = await apiFetch(`/knowledge-base?page=1&limit=100`)
      setDocuments(paginate<Document>(data).items)
    } catch {}
  }

  useEffect(() => {
    reload().finally(() => setLoading(false))
  }, [])

  const ready = documents.filter((d) => d.status === 'ready')

  const select = (id: string) => {
    setSelectedId(id)
    setSummary('')
    setCached(false)
    const doc = documents.find((d) => d.id === id)
    if (doc?.summary) {
      setSummary(doc.summary)
      setCached(true)
    }
  }

  const generate = async (force = false) => {
    if (!selectedId) return
    setBusy(true)
    try {
      const res = (await apiFetch(`/knowledge-base/${selectedId}/summarize`, {
        method: 'POST',
        body: JSON.stringify({ force }),
      })) as { summary: string; cached: boolean }
      setSummary(res.summary)
      setCached(res.cached)
      addToast(res.cached ? 'Loaded cached summary' : 'Summary generated', 'success')
      await reload()
    } catch (err: any) {
      addToast(err.message || 'Failed to summarize', 'error')
    } finally {
      setBusy(false)
    }
  }

  const selectedDoc = documents.find((d) => d.id === selectedId)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Summaries
            </h2>
          </div>
          <div className="p-5">
            <label className="block text-sm font-medium text-foreground mb-2">Document</label>
            {loading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <ul className="space-y-2">
                {ready.map((doc) => (
                  <li key={doc.id}>
                    <button
                      onClick={() => select(doc.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                        selectedId === doc.id
                          ? 'border-primary/50 bg-primary/10 text-foreground'
                          : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <FileText className="h-4 w-4 shrink-0 text-primary" />
                      <span className="min-w-0 flex-1 truncate">{doc.title}</span>
                      {doc.summary && <Check className="h-4 w-4 shrink-0 text-success" />}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!loading && ready.length === 0 && <p className="text-xs text-muted-foreground">No ready documents yet.</p>}
          </div>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h2 className="font-semibold text-foreground">{selectedDoc?.title || 'Select a document'}</h2>
            {selectedId && (
              <div className="flex gap-2">
                <button
                  onClick={() => generate(false)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate
                </button>
                <button
                  onClick={() => generate(true)}
                  disabled={busy}
                  className="flex items-center gap-1.5 rounded-xl border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary/60 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate
                </button>
              </div>
            )}
          </div>

          <div className="p-5">
            {!selectedId ? (
              <p className="text-center text-sm text-muted-foreground">Pick a ready document to generate its summary.</p>
            ) : busy ? (
              <div className="flex items-center justify-center gap-3 py-10">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Reading the document and writing a summary…</p>
              </div>
            ) : summary ? (
              <div>
                {cached && (
                  <p className="mb-3 inline-block rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs text-yellow-400">
                    Cached summary · {formatDate(selectedDoc?.updatedAt)}
                  </p>
                )}
                <div className="prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 text-sm leading-relaxed text-foreground">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                      h1: ({ children }) => <h1 className="mb-2 mt-4 text-lg font-bold text-foreground">{children}</h1>,
                      h2: ({ children }) => <h2 className="mb-2 mt-4 text-base font-bold text-foreground">{children}</h2>,
                      h3: ({ children }) => <h3 className="mb-2 mt-3 text-sm font-bold text-foreground">{children}</h3>,
                      ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>,
                      li: ({ children }) => <li className="text-sm leading-relaxed text-foreground">{children}</li>,
                      blockquote: ({ children }) => (
                        <blockquote className="mb-2 border-l-2 border-primary/40 pl-3 italic text-muted-foreground">{children}</blockquote>
                      ),
                      hr: () => <hr className="my-3 border-border" />,
                      code: ({ className, children }) =>
                        className ? (
                          <code className="my-2 block overflow-x-auto rounded-lg bg-secondary px-3 py-2 font-mono text-xs text-foreground">
                            {children}
                          </code>
                        ) : (
                          <code className="rounded bg-secondary px-1 py-0.5 font-mono text-xs text-primary">{children}</code>
                        ),
                    }}
                  >
                    {summary}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <p className="text-center text-sm text-muted-foreground">No summary yet — click Generate.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
