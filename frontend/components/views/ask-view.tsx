'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, FileText, Search, BookOpen, Loader2 } from 'lucide-react'
import { apiFetch, paginate } from '@/lib/api'
import { useToast } from '@/components/toast'

interface Document {
  id: string
  title: string
  status: string
}

interface Source {
  chunkText: string
  similarity: number
  documentTitle?: string | null
}

interface AskResult {
  answer: string
  sources: Source[]
}

interface HistoryItem {
  question: string
  result: AskResult
  revealed: number
}

export default function AskView() {
  const { addToast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [typing, setTyping] = useState(false)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiFetch(`/knowledge-base?page=1&limit=100`)
      .then((data) => setDocuments(paginate<Document>(data).items))
      .catch(() => addToast('Failed to load documents', 'error'))
      .finally(() => setLoading(false))
    return () => {
      if (revealRef.current) clearInterval(revealRef.current)
    }
  }, [addToast])

  const ready = documents.filter((d) => d.status === 'ready')

  const ask = async () => {
    if (!selectedId) {
      addToast('Select a document first', 'info')
      return
    }
    if (!question.trim()) return
    if (revealRef.current) clearInterval(revealRef.current)
    setTyping(true)
    try {
      const result = (await apiFetch(`/knowledge-base/${selectedId}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question: question.trim() }),
      })) as AskResult
      const item: HistoryItem = { question: question.trim(), result, revealed: 0 }
      setHistory((prev) => [item, ...prev])
      setQuestion('')
      const words = result.answer.split(' ')
      const reduced =
        typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
      let revealed = 0
      if (reduced) {
        setHistory((prev) => prev.map((it, idx) => (idx === 0 ? { ...it, revealed: words.length } : it)))
        return
      }
      revealRef.current = setInterval(() => {
        revealed += 2
        if (revealed >= words.length) {
          revealed = words.length
          if (revealRef.current) clearInterval(revealRef.current)
        }
        setHistory((prev) => prev.map((it, idx) => (idx === 0 ? { ...it, revealed } : it)))
      }, 30)
    } catch (err: any) {
      addToast(err.message || 'Failed to get an answer', 'error')
    } finally {
      setTyping(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Search className="h-4 w-4 text-primary" /> Ask a document
            </h2>
          </div>

          <div className="space-y-5 p-5">
            <div>
              <label htmlFor="ask-document" className="block text-sm font-medium text-foreground mb-2">
                Document
              </label>
              <select
                id="ask-document"
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select a ready document…</option>
                {ready.map((doc) => (
                  <option key={doc.id} value={doc.id}>
                    {doc.title}
                  </option>
                ))}
              </select>
              {loading && <p className="mt-2 text-xs text-muted-foreground">Loading documents…</p>}
              {!loading && ready.length === 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  No ready documents. Upload a file first and wait for it to finish processing.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="ask-question" className="block text-sm font-medium text-foreground mb-2">
                Question
              </label>
              <textarea
                id="ask-question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    ask()
                  }
                }}
                rows={3}
                placeholder="e.g. What are the refund policies described in this document?"
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <button
              onClick={ask}
              disabled={typing || !question.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              Ask
            </button>
          </div>
        </div>

        <div className="mt-6 space-y-4" aria-live="polite">
          {history.length === 0 && !typing && (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Ask a question and the answer, with sources, will appear here.
            </p>
          )}

          {typing && (
            <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-5">
              <div className="flex items-center gap-1.5" aria-hidden="true">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
              <p className="text-sm text-muted-foreground">Searching the document and generating an answer…</p>
            </div>
          )}

          {history.map((item, i) => {
            const words = item.result.answer.split(' ')
            const visible = words.slice(0, item.revealed).join(' ')
            const done = item.revealed >= words.length
            return (
              <div key={`${i}-${item.question}`} className="rounded-2xl border border-border bg-card">
                <div className="border-b border-border px-5 py-3 text-sm font-medium text-foreground">Q: {item.question}</div>
                <div className="p-5">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {visible}
                    {!done && <span className="ml-0.5 inline-block h-4 w-2 bg-primary/70 align-middle" />}
                  </p>
                  {done && item.result.sources.length > 0 && (
                    <div className="mt-4">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <BookOpen className="h-3.5 w-3.5" /> Sources
                      </p>
                      <ul className="space-y-2">
                        {item.result.sources.map((s, j) => (
                          <li key={j} className="rounded-lg border border-border bg-secondary p-3">
                            <p className="mb-1 text-[10px] text-muted-foreground">Match {(s.similarity * 100).toFixed(0)}%</p>
                            <p className="line-clamp-2 text-xs text-foreground/80">{s.chunkText}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="hidden lg:block">
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <MessageSquare className="h-5 w-5 text-primary" />
          </div>
          <h3 className="font-semibold text-foreground">How it works</h3>
          <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Your document is chunked and embedded when uploaded.</li>
            <li className="flex gap-2"><Search className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> Your question is embedded and matched to the most relevant passages.</li>
            <li className="flex gap-2"><BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> The LLM answers strictly from those passages, with sources shown.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
