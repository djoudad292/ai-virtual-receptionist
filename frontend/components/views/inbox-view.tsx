'use client'

import { useEffect, useState, useRef } from 'react'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, getSocketUrl, paginate } from '@/lib/api'
import { useToast } from '@/components/toast'
import { Send, Loader2, UserCheck, CheckCircle, ArrowLeft, Sparkles, PhoneCall, Plus } from 'lucide-react'
import { io, Socket } from 'socket.io-client'
import InboxAiTalk from '@/components/views/inbox-ai-talk'

interface Conversation {
  id: string
  title: string
  status: string
  handledBy: string | null
  assignedAgentId?: string | null
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
  conversationId?: string
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
  const [reloadKey, setReloadKey] = useState(0)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [, setSocket] = useState<Socket | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const selectedConvRef = useRef<string | null>(null)
  selectedConvRef.current = selectedConv
  const [search, setSearch] = useState('')
  const [suggesting, setSuggesting] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/conversations')
        .then((data) => setConversations(paginate<Conversation>(data).items))
        .catch(() => addToast('Failed to load conversations', 'error'))
        .finally(() => setLoading(false))
    }
  }, [isAuthenticated, reloadKey, addToast])

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
    s.on('connect', () => { setSocket(s); socketRef.current = s })
    s.on('newMessage', (msg: Message) => {
      if (msg.conversationId && msg.conversationId !== selectedConvRef.current) return
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    })
    s.on('aiResponse', (data: { message: Message }) => {
      if (data?.message) {
        if (data.message.conversationId && data.message.conversationId !== selectedConvRef.current) return
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev
          return [...prev, data.message]
        })
      }
    })
    s.on('takeover', () => {
      addToast('Agent has taken over', 'info')
    })
    s.on('aiThinking', (data: { isThinking?: boolean }) => {
      if (data && typeof data.isThinking === 'boolean') {
        setIsThinking(data.isThinking)
      }
    })
    return () => { s.disconnect() }
  }, [addToast, token])

  useEffect(() => {
    const s = socketRef.current
    if (!s || !selectedConv) return
    s.emit('joinConversation', { conversationId: selectedConv })
  }, [selectedConv])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || !selectedConv) return
    const content = input.trim()
    setInput('')
    const conv = conversations.find((c) => c.id === selectedConv)
    const senderType = conv?.assignedAgentId ? 'agent' : 'user'
    const s = socketRef.current
    if (!s) {
      setInput(content)
      addToast('Chat not connected', 'error')
      return
    }
    s.emit('sendMessage', { conversationId: selectedConv, content, senderType })
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

  const handleNewConversation = async () => {
    try {
      const data = await apiFetch('/conversations', {
        method: 'POST',
        body: JSON.stringify({ companyId: user?.companyId, title: 'New Conversation' }),
      })
      if (data?.id) {
        setReloadKey((k) => k + 1)
        setSelectedConv(data.id)
        addToast('New conversation started', 'success')
      }
    } catch {
      addToast('Failed to start new conversation', 'error')
    }
  }

  const selectedConvData = conversations.find((c) => c.id === selectedConv)
  const filteredConversations = conversations.filter((c) =>
    (c.title || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.lastMessage || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
      {aiTalkOpen ? (
        <InboxAiTalk token={token || ''} companyId={user?.companyId || ''} onClose={() => { setAiTalkOpen(false); setReloadKey((k) => k + 1) }} />
      ) : (
    
      <>
      <div className={`w-full min-w-0 border-r border-border lg:block lg:w-80 xl:w-96 ${selectedConv ? 'hidden' : 'block'}`}>
        <div className="p-4">
          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() => { setAiTalkOpen(true); setReloadKey((k) => k + 1) }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <PhoneCall className="h-4 w-4" /> Talk to AI
            </button>
            <button
              type="button"
              onClick={handleNewConversation}
              className="flex items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <Plus className="h-4 w-4" /> New
            </button>
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            aria-label="Search conversations"
            className="w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary transition-shadow hover:border-primary/30"
          />
        </div>
        <div className="overflow-y-auto" style={{ height: 'calc(100vh - 130px)' }}>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              <p>{search ? 'No conversations match your search' : 'No conversations yet'}</p>
              {!search && (
                <p className="mt-2 text-xs text-muted-foreground/60">
                  Tap &ldquo;Talk to your AI&rdquo; above, or embed the widget on your site to get started.
                </p>
              )}
            </div>
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

      <div className={`flex min-w-0 flex-1 flex-col ${selectedConv ? 'fixed inset-0 z-40 bg-background lg:static lg:z-auto' : 'hidden lg:flex'}`}>
        {!selectedConv ? (
          <div className="flex flex-1 items-center justify-center">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Start a conversation</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-sm mx-auto">
                    Select a conversation from the list to view messages, or use the "Talk to your AI" button to start a voice conversation immediately.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setAiTalkOpen(true); setReloadKey((k) => k + 1) }}
                    className="mt-6 mx-auto flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <PhoneCall className="h-4 w-4" /> Talk to your AI
                  </button>
                </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  onClick={() => setSelectedConv(null)}
                  className="text-muted-foreground hover:text-foreground lg:hidden"
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
                    className={`flex gap-2 ${msg.senderType === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.senderType !== 'user' && msg.senderType !== 'system' && (
                      <div className="flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground uppercase border border-border">
                        {msg.senderType === 'agent' ? 'Ag' : 'AI'}
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                        msg.senderType === 'user'
                          ? 'bg-primary text-primary-foreground rounded-br-none'
                          : msg.senderType === 'agent'
                            ? 'bg-green-600 text-white rounded-bl-none'
                            : msg.senderType === 'system'
                              ? 'bg-muted text-muted-foreground italic text-xs mx-auto text-center !max-w-[90%] rounded-lg px-2 py-1'
                              : 'bg-secondary text-foreground rounded-bl-none'
                      }`}
                    >
                      {msg.senderType !== 'system' && (
                        <p className="text-[10px] font-semibold mb-1 opacity-60 uppercase tracking-wider">
                          {msg.senderType === 'agent' ? 'Agent' :
                           msg.senderType === 'ai' ? 'AI Virtual Receptionist' : 'User (Test)'}
                        </p>
                      )}
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
              {isThinking && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-2 rounded-2xl bg-secondary px-4 py-3 rounded-bl-none">
                    <span className="text-xs font-medium text-muted-foreground">AI is thinking</span>
                    <span className="flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '0ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '150ms' }} />
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                </div>
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
