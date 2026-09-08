'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageSquare, Send, X, Bot, User, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const PRESET_QA: Record<string, string> = {
  'what services do you offer': 'We offer web development, mobile apps, AI integration, and cloud deployment. Our team specializes in Next.js, React Native, and LLM-powered features.',
  'how much does it cost': 'Pricing depends on the project scope. Our AI Virtual Receptionist starts at $49/month. Custom projects are quoted after a free consultation.',
  'how can i book a meeting': 'You can book a meeting directly through this chat! Just tell me your preferred date and time, and I\'ll schedule it for you.',
  'do you offer support': 'Yes! We provide 24/7 AI-powered support plus human escalation for complex issues. Response time is under 1 second.',
  'what technologies do you use': 'We use Next.js, NestJS, TypeScript, PostgreSQL with pgvector, Gemini/OpenAI for AI, and React Native for mobile apps.',
}

const FALLBACK = 'Thanks for your question! In a live deployment, I\'d answer from the company\'s knowledge base. Try asking about services, pricing, or how to book a meeting.'

function matchAnswer(q: string): string {
  const lower = q.toLowerCase()
  for (const [key, answer] of Object.entries(PRESET_QA)) {
    if (lower.includes(key) || key.split(' ').every((w) => lower.includes(w))) return answer
  }
  return FALLBACK
}

interface Message {
  role: 'user' | 'assistant'
  text: string
}

export function DemoChat() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Hi! I\'m the AI Virtual Receptionist. Ask me about our services, pricing, or how to book a meeting.' },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', text }])
    setLoading(true)
    await new Promise((r) => setTimeout(r, 600 + Math.random() * 400))
    setMessages((prev) => [...prev, { role: 'assistant', text: matchAnswer(text) }])
    setLoading(false)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all hover:scale-105',
          open ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
        )}
      >
        {open ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border bg-primary px-4 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-foreground/20">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-semibold text-primary-foreground">AI Receptionist</p>
              <p className="text-xs text-primary-foreground/70">Usually replies instantly</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: 360 }}>
            {messages.map((msg, i) => (
              <div key={i} className={cn('flex gap-2', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                    <Bot className="h-3 w-3 text-primary" />
                  </div>
                )}
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-foreground'
                  )}
                >
                  {msg.text}
                </div>
                {msg.role === 'user' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted mt-0.5">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Loader2 className="h-3 w-3 animate-spin text-primary" />
                </div>
                <div className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  Thinking...
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <form
              onSubmit={(e) => { e.preventDefault(); send() }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about services, pricing..."
                className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
