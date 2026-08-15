'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Send, FileText, Search, BookOpen, Loader2, Mic, MicOff, Volume2 } from 'lucide-react'
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
  const [listening, setListening] = useState(false)
  const [speakingId, setSpeakingId] = useState<string | null>(null)
  const revealRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recognitionRef = useRef<any>(null)
  const micSupported =
    typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  const speechSupported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'

  useEffect(() => {
    apiFetch(`/knowledge-base?page=1&limit=100`)
      .then((data) => setDocuments(paginate<Document>(data).items))
      .catch(() => addToast('Failed to load documents', 'error'))
      .finally(() => setLoading(false))
    return () => {
      if (revealRef.current) clearInterval(revealRef.current)
      try { window.speechSynthesis?.cancel() } catch {}
      try { recognitionRef.current?.stop() } catch {}
    }
  }, [addToast])

  const ready = documents.filter((d) => d.status === 'ready')

  const ask = async (override?: string) => {
    if (!selectedId) {
      addToast('Select a document first', 'info')
      return
    }
    const q = (override !== undefined ? override : question).trim()
    if (!q) return
    if (revealRef.current) clearInterval(revealRef.current)
    setTyping(true)
    try {
      const result = (await apiFetch(`/knowledge-base/${selectedId}/ask`, {
        method: 'POST',
        body: JSON.stringify({ question: q }),
      })) as AskResult
      const item: HistoryItem = { question: q, result, revealed: 0 }
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

  const stopRecognition = () => {
    try { recognitionRef.current?.stop() } catch {}
    setListening(false)
  }

  const speakQuestion = () => {
    if (!micSupported) {
      addToast('Voice input is not supported in this browser', 'info')
      return
    }
    if (listening) {
      stopRecognition()
      return
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.onresult = (e: any) => {
      const text = e.results[0][0].transcript as string
      setQuestion(text)
      setListening(false)
      window.setTimeout(() => ask(text), 150)
    }
    rec.onerror = () => setListening(false)
    rec.onend = () => setListening(false)
    recognitionRef.current = rec
    setListening(true)
    try { rec.start() } catch { setListening(false) }
  }

  const speakAnswer = (text: string, id: string) => {
    if (!speechSupported) return
    if (speakingId === id) {
      window.speechSynthesis.cancel()
      setSpeakingId(null)
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1
    u.pitch = 1
    u.onend = () => setSpeakingId(null)
    u.onerror = () => setSpeakingId(null)
    setSpeakingId(id)
    window.speechSynthesis.speak(u)
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
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="ask-question" className="block text-sm font-medium text-foreground">
                  Question
                </label>
                {micSupported && (
                  <button
                    type="button"
                    onClick={speakQuestion}
                    disabled={typing}
                    aria-label={listening ? 'Stop listening' : 'Ask by voice'}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                      listening
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-secondary text-foreground hover:bg-primary/10'
                    }`}
                  >
                    {listening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                    {listening ? 'Listening…' : 'Speak'}
                  </button>
                )}
              </div>
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
              onClick={() => ask()}
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
                  {done && speechSupported && (
                    <button
                      type="button"
                      onClick={() => speakAnswer(item.result.answer, `${i}-${item.question}`)}
                      aria-label={speakingId === `${i}-${item.question}` ? 'Stop reading' : 'Read answer aloud'}
                      className={`mt-3 inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                        speakingId === `${i}-${item.question}`
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-secondary text-foreground hover:bg-primary/10'
                      }`}
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                      {speakingId === `${i}-${item.question}` ? 'Reading…' : 'Read aloud'}
                    </button>
                  )}
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
