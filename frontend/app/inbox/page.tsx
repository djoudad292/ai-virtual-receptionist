'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { apiFetch, getSocketUrl } from '@/lib/api'
import Sidebar from '@/components/sidebar'
import MobileSidebar from '@/components/mobile-sidebar'
import { useToast } from '@/components/toast'
import { Menu, Send, Loader2, UserCheck, CheckCircle } from 'lucide-react'
import { io, Socket } from 'socket.io-client'

interface Conversation {
  id: string
  title: string
  status: string
  handledBy: string | null
  lastMessage?: string
  createdAt: string
  updatedAt: string
}

interface Message {
  id: string
  content: string
  senderType: 'user' | 'ai' | 'agent' | 'system'
  senderId?: string
  createdAt: string
}

export default function InboxPage() {
  const { isAuthenticated, isLoading: authLoading, user, token } = useAuth()
  const router = useRouter()
  const { addToast } = useToast()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login')
  }, [authLoading, isAuthenticated, router])

  useEffect(() => {
    if (isAuthenticated) {
      apiFetch('/conversations')
        .then((data) => setConversations(Array.isArray(data) ? data : data.conversations || []))
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
    s.on('connected', () => {
      addToast('Connected', 'success')
    })
    return () => { s.disconnect() }
  }, [])

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
      <div className="flex flex-1 flex-col md:ml-64">
        <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-1.5 text-center text-[10px] text-amber-400">
          Demo &middot; In-memory &middot; Built by{' '}
          <a href="https://djaouad.tech" target="_blank" rel="noopener noreferrer" className="font-semibold underline">djaouad frih</a>
        </div>
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4">
          <button onClick={() => setMobileOpen(true)} className="text-muted-foreground md:hidden">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
        </header>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-full border-r border-border md:w-80 lg:w-96">
            <div className="p-4">
              <input
                type="text"
                placeholder="Search conversations..."
                className="w-full rounded-xl border border-border bg-secondary px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="overflow-y-auto" style={{ height: 'calc(100vh - 120px)' }}>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No conversations</p>
              ) : (
                conversations.map((conv) => (
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

          <div className="flex flex-1 flex-col">
            {!selectedConv ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">Select a conversation to view messages</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-border px-6 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedConvData?.title || 'Conversation'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedConvData?.status} &middot; Handled by: {selectedConvData?.handledBy || 'AI'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTakeover}
                      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      Takeover
                    </button>
                    <button
                      onClick={handleResolve}
                      className="flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-500/20 transition-colors"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Resolve
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4" style={{ height: 'calc(100vh - 180px)' }}>
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
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                      placeholder="Type a reply..."
                      className="flex-1 rounded-xl border border-border bg-secondary px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <button
                      onClick={sendMessage}
                      disabled={!input.trim()}
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
