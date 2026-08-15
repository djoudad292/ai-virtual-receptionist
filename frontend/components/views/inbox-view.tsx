'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, getSocketUrl, paginate } from '@/lib/api'
import { useToast } from '@/components/toast'
import { Send, Loader2, UserCheck, CheckCircle, ArrowLeft, Sparkles, PhoneCall } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import InboxAiTalk from '@/components/views/inbox-ai-talk'

interface Conversation {
  id: string
  title: string
  status: string
  handledBy: string | null
  lastMessage?: string
  createdAt: string
  updatedAt: string
}

interface Source {
  chunkText: string
  similarity: number
  documentTitle?: string | null
}

interface Message {
  id: string
  content: string
  senderType: 'user' | 'ai' | 'agent' | 'system'
  senderId?: string
  createdAt: string
  metadata?: { sources?: Source[] }
}

function SourcesList({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false)
  const titles = sources
    .map((s) => s.documentTitle || s.chunkText.slice(0, 60))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 5)
  if (!titles.length) return null
  return (
    <div className="mt-1.5 border-t border-border/50 pt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? '▾' : '▸'} Sources ({titles.length})
      </button>
      {open && (
        <ul className="mt-1 space-y-0.5">
          {titles.map((t, i) => (
            <li key={i} className="text-[11px] text-muted-foreground/80">• {t}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function InboxView() {
  const { isAuthenticated, token, user } = useAuth()
  const { addToast } = useToast()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [aiTalkOpen, setAiTalkOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [, setSocket] = useState<Socket | null>(null)
  const [search, setSearch] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/conversations')
        .then((data) => setConversations(paginate<Conversation>(data).items))
        .catch(() => addToast('Failed to load conversations', 'error'))
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, addToast])

  useEffect(() => {
    if (!selectedConv) return
    setMessagesLoading(true)
    apiFetch(`/conversations/${selectedConv}/messages`)
      .then((data) => setMessages(Array.isArray(data) ? data : data.messages || []))
      .catch(() => addToast('Failed to load messages', 'error'))
      .finally(() => setMessagesLoading(false))
  }, [selectedConv, addToast])

  useEffect(() => {
    const s = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      timeout: 15000,
      auth: { token: token || '' },
    })
    s.on('connect', () => setSocket(s))
    s.on('newMessage', (msg: Message) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })
    s.on('aiResponse', (data: { message: Message }) => {
      if (data?.message) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    })
    s.on('takeover', () => {
      addToast('Agent has taken over', 'info')
    })
    return () => { s.disconnect() }
  }, [addToast, token])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || !selectedConv) return
    const content = input.trim()
    setInput('')
    try {
      await apiFetch(`/conversations/${selectedConv}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, senderType: 'agent' }),
      })
    } catch {
      addToast('Failed to send message', 'error')
    }
  }

  const handleSuggestReply = async () => {
    if (!selectedConv) return
    setSuggesting(true)
    try {
      const data = await apiFetch(`/conversations/${selectedConv}/suggest-reply`, { method: 'POST' })
      if (data?.reply) {
        setInput(data.reply)
        addToast('Draft generated — review and send', 'success')
      } else {
        addToast('No relevant published documents to draft a reply', 'info')
      }
    } catch {
      addToast('Failed to generate suggestion', 'error')
    } finally {
      setSuggesting(false)
    }
  }

  const handleTakeover = async () => {
    if (!selectedConv) return
    try {
      await apiFetch(`/conversations/${selectedConv}/assign`, { method: 'PATCH' })
      addToast('Conversation assigned to you', 'success')
    } catch {
      addToast('Failed to assign conversation', 'error')
    }
  }

  const handleResolve = async () => {
    if (!selectedConv) return
    try {
      await apiFetch(`/conversations/${selectedConv}/resolve`, { method: 'PATCH' })
      addToast('Conversation resolved', 'success')
    } catch {
      addToast('Failed to resolve conversation', 'error')
    }
  }

  const selectedConvData = conversations.find((c) => c.id === selectedConv)
  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.lastMessage || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
      {aiTalkOpen ? (
        <InboxAiTalk token={token || ''} companyId={user?.companyId || ''} onClose={() => setAiTalkOpen(false)} />
      ) : (
        <>
      <div className={`w-full border-r border-border md:block md:w-80 lg:w-96 ${selectedConv ? 'hidden' : 'block'}`}>
        <div className="p-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 130px)' }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              {search ? 'No conversations match your search' : 'No conversations'}
            </p>
          ) : (
            filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConv(conv.id)}
                className={`w-full border-b border-border px-4 py-3 text-left transition-colors hover:bg-secondary ${
                  selectedConv === conv.id ? 'bg-secondary' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground truncate">
                    {conv.title || 'Untitled Conversation'}
                  </p>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                    conv.status === 'active' ? 'bg-green-500/10 text-green-400' :
                    conv.status === 'resolved' ? 'bg-blue-500/10 text-blue-400' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {conv.status}
                  </span>
                </div>
                {conv.lastMessage && (
                  <p className="mt-1 truncate text-xs text-muted-foreground">{conv.lastMessage}</p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(conv.updatedAt || conv.createdAt).toLocaleDateString()}
                </p>
              </button>
            ))
          )}
        </div>
      </div>

      <div className={`flex flex-1 flex-col ${selectedConv ? 'fixed inset-0 z-40 bg-background md:static md:z-auto' : 'hidden md:flex'}`}>
        {!selectedConv ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <button
                type="button"
                onClick={() => setAiTalkOpen(true)}
                className="mx-auto flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <PhoneCall className="h-4 w-4" /> Talk to your AI
              </button>
              <p className="mt-3 text-sm text-muted-foreground">
                Select a conversation to view messages
              </p>
              <p className="mt-1 text-xs text-muted-foreground/60">
                When a visitor uses the widget on your site, their conversation appears here.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() => setSelectedConv(null)}
                  className="text-muted-foreground hover:text-foreground md:hidden"
                  aria-label="Back to conversations"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {selectedConvData?.title || 'Conversation'}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedConvData?.status} &middot; Handled by: {selectedConvData?.handledBy || 'AI'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={handleTakeover}
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors md:px-3"
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Takeover</span>
                </button>
                <button
                  onClick={handleResolve}
                  className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-2.5 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors md:px-3"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="hidden md:inline">Resolve</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 md:p-6" style={{ height: 'calc(100vh - 180px)' }} aria-live="polite">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No messages yet</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm ${
                        msg.senderType === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : msg.senderType === 'agent'
                            ? 'bg-green-500/10 text-foreground border border-green-500/20 rounded-bl-md'
                            : msg.senderType === 'system'
                              ? 'bg-muted text-muted-foreground italic text-xs'
                              : 'bg-secondary text-foreground rounded-bl-md'
                      }`}
                    >
                      <p className="text-xs font-medium mb-1 opacity-70">
                        {msg.senderType === 'agent' ? 'Agent' :
                         msg.senderType === 'ai' ? 'AI' :
                         msg.senderType === 'system' ? 'System' : 'User'}
                      </p>
                      <p>{msg.content}</p>
                      {msg.senderType === 'ai' && msg.metadata?.sources?.length ? (
                        <SourcesList sources={msg.metadata.sources} />
                      ) : null}
                      <p className="mt-1 text-xs opacity-50">
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSuggestReply}
                  disabled={suggesting}
                  title="Draft a reply grounded in your published documents"
                  aria-label="AI suggest reply"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                >
                  {suggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Type a reply..."
                  aria-label="Type a reply"
                  className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  aria-label="Send reply"
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
      </>
      )}
    </div>
  )
}
