'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { getSocketUrl, apiFetch } from '@/lib/api'
import { useToast } from '@/components/toast'
import { Mic, MicOff, Plus, X, Loader2 } from 'lucide-react'

interface TalkMessage {
  id: string
  content: string
  senderType: 'user' | 'ai' | 'agent' | 'system'
  conversationId?: string
  createdAt: string
}

interface InboxAiTalkProps {
  token: string
  companyId: string
  onClose: () => void
}

const SPEECH_LANG = 'en-US'

export default function InboxAiTalk({ token, companyId, onClose }: InboxAiTalkProps) {
  const { addToast } = useToast()
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<TalkMessage[]>([])
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [subtitle, setSubtitle] = useState('')
  const [connecting, setConnecting] = useState(true)
  const [interim, setInterim] = useState('')
  const [newTalk, setNewTalk] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const recognitionRef = useRef<any>(null)
  const conversationIdRef = useRef<string | null>(null)
  const subtitleRef = useRef<{ timers: number[]; spokenId?: string }>({ timers: [] })
  const clearTimers = () => {
    subtitleRef.current.timers.forEach((t) => window.clearInterval(t))
    subtitleRef.current.timers = []
  }
  const scrollRef = useRef<HTMLDivElement>(null)

  const micSupported =
    typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
  const speechSupported =
    typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined'

  const appendMessage = useCallback((msg: TalkMessage) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev
      return [...prev, msg]
    })
  }, [])

  const clearSubtitle = useCallback(() => {
    clearTimers()
    subtitleRef.current.spokenId = undefined
    setSubtitle('')
    setSpeaking(false)
  }, [])

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop() } catch {}
    recognitionRef.current = null
    setListening(false)
    setInterim('')
  }, [])

  const speak = useCallback((text: string) => {
    const words = text.split(' ')
    const spokenId = `${Date.now()}`
    subtitleRef.current.spokenId = spokenId
    let revealed = 0

    const render = () => {
      if (subtitleRef.current.spokenId !== spokenId) return
      setSubtitle(words.slice(0, revealed).join(' ') + (revealed < words.length ? ' ▎' : ''))
    }

    const finish = () => {
      if (subtitleRef.current.spokenId !== spokenId) return
      subtitleRef.current.spokenId = undefined
      clearTimers()
      setSpeaking(false)
      setSubtitle('')
    }

    setSpeaking(true)
    render()
    const iv = window.setInterval(() => {
      if (subtitleRef.current.spokenId !== spokenId) return
      if (revealed < words.length) {
        revealed += 1
        render()
      }
    }, 260)
    subtitleRef.current.timers.push(iv)

    const cap = window.setTimeout(finish, Math.min(10000, 1600 + words.length * 220))
    subtitleRef.current.timers.push(cap)

    if (!speechSupported) return
    try { window.speechSynthesis.cancel() } catch {}
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1
      u.pitch = 1
      u.onboundary = (e: any) => {
        if (subtitleRef.current.spokenId !== spokenId) return
        if (e.name === 'word') {
          revealed = Math.max(revealed, e.charIndex > 0 ? text.slice(0, e.charIndex).split(' ').length - 1 : 0)
          render()
        }
      }
      u.onend = finish
      u.onerror = () => {}
      window.speechSynthesis.speak(u)
    } catch {
      // interval + cap still drive the subtitle and indicator
    }
  }, [speechSupported])

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR || speaking || aiThinking) return
    try {
      const rec = new SR()
      rec.lang = SPEECH_LANG
      rec.interimResults = true
      rec.continuous = false
      rec.onresult = (e: any) => {
        let transcript = ''
        for (let i = e.resultIndex; i < e.results.length; i++) {
          transcript += e.results[i][0].transcript
        }
        setInterim(transcript)
        if (e.results[e.results.length - 1].isFinal) {
          const finalText = transcript.trim()
          setInterim('')
          setListening(false)
          if (finalText) sendTalk(finalText)
        }
      }
      rec.onerror = () => { setListening(false); setInterim('') }
      rec.onend = () => { setListening(false) }
      recognitionRef.current = rec
      setListening(true)
      rec.start()
    } catch {
      setListening(false)
      setInterim('')
    }
  }, [speaking, aiThinking])

  const sendTalk = useCallback((content: string) => {
    const s = socketRef.current
    const id = conversationIdRef.current
    if (!s || !id) return
    s.emit('aiTalk', { conversationId: id, content })
  }, [])

  const toggleMic = () => {
    if (speaking) return
    if (listening) {
      stopListening()
      return
    }
    if (!micSupported) {
      addToast('Voice input is not supported in this browser', 'info')
      return
    }
    startListening()
  }

  const startNewTalk = () => {
    clearSubtitle()
    window.speechSynthesis.cancel()
    stopListening()
    setMessages([])
    setConversationId(null)
    setAiThinking(false)
    setNewTalk(true)
    createConversation()
  }

  const createConversation = useCallback(async () => {
    try {
      const data = (await apiFetch('/conversations', {
        method: 'POST',
        body: JSON.stringify({ companyId, title: 'AI talk' }),
      })) as any
      const id = data.id || data.conversationId
      if (!id) {
        addToast('Failed to start a new talk', 'error')
        setConnecting(false)
        return
      }
      setConversationId(id)
      socketRef.current?.emit('joinConversation', { conversationId: id })
      setConnecting(false)
      setNewTalk(false)
    } catch {
      addToast('Failed to start a new talk', 'error')
      setConnecting(false)
    }
  }, [companyId, addToast])

  useEffect(() => {
    const s = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      timeout: 15000,
      auth: { token: token || '' },
    })
    socketRef.current = s

    s.on('connect', () => {
      setConnecting(true)
      createConversation()
    })
    s.on('newMessage', (msg: TalkMessage) => {
      if (msg.conversationId && msg.conversationId !== conversationIdRef.current) return
      appendMessage(msg)
    })
    s.on('aiResponse', (data: any) => {
      if (data?.message && data.message.conversationId && data.message.conversationId !== conversationIdRef.current) return
      const msg = data?.message
      if (msg?.senderType === 'ai') {
        appendMessage(msg)
        speak(msg.content)
      } else if (msg) {
        appendMessage(msg)
      }
    })
    s.on('aiThinking', (data: any) => setAiThinking(!!data?.isThinking))
    s.on('error', (data: any) => {
      addToast(data?.message || 'Connection error', 'error')
    })

    return () => {
      try { window.speechSynthesis.cancel() } catch {}
      clearSubtitle()
      stopListening()
      s.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, addToast])

  conversationIdRef.current = conversationId

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, subtitle, interim])

  const statusText = connecting
    ? 'Connecting…'
    : aiThinking
      ? 'Thinking…'
      : speaking
        ? 'AI is speaking…'
        : listening
          ? 'Listening — speak now'
          : interim
            ? 'Listening…'
            : 'Tap the mic and talk to your AI'

  return (
    <div className="flex flex-1 flex-col overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
      <div className="flex items-center justify-between border-b border-border px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">Talk to your AI</p>
            <p className="truncate text-xs text-muted-foreground">
              Hands-free conversation like ChatGPT or Gemini — subtitles included
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={startNewTalk}
            disabled={connecting || newTalk}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/10 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> New talk
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close talk to AI"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-center px-4 pt-4">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card px-5 py-6 text-center">
            {(speaking || listening) && (
              <div className="mb-3 flex items-center justify-center gap-2">
                {speaking ? (
                  <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <span className="flex h-3 items-end gap-0.5">
                      <span className="w-0.5 animate-pulse rounded-full bg-primary" style={{ height: '100%' }} />
                      <span className="w-0.5 animate-pulse rounded-full bg-primary" style={{ height: '60%', animationDelay: '120ms' }} />
                      <span className="w-0.5 animate-pulse rounded-full bg-primary" style={{ height: '80%', animationDelay: '240ms' }} />
                    </span>
                    AI is speaking
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 rounded-full bg-danger/10 px-3 py-1 text-xs font-semibold text-danger">
                    <span className="h-2 w-2 animate-ping rounded-full bg-danger" />
                    Listening — speak now
                  </span>
                )}
              </div>
            )}
            <p
              className="min-h-[3rem] text-xl font-semibold leading-relaxed text-foreground"
              aria-live="polite"
            >
              {speaking
                ? subtitle
                : listening
                  ? (interim || '…')
                  : aiThinking
                    ? '…'
                    : conversationId
                      ? 'Tap the mic and ask anything.'
                      : 'Starting your talk…'}
            </p>
            {!speaking && !listening && (
              <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{statusText}</p>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto w-full max-w-2xl space-y-3">
            {messages.length === 0 && !aiThinking && (
              <p className="pt-4 text-center text-xs text-muted-foreground">
                Your conversation transcript will appear here.
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.senderType === 'user'
                    ? 'ml-auto rounded-br-sm bg-primary text-primary-foreground'
                    : m.senderType === 'system'
                      ? 'mx-auto bg-muted text-center text-xs text-muted-foreground'
                      : 'mr-auto rounded-bl-sm border border-border bg-secondary text-foreground'
                }`}
              >
                {m.content}
              </div>
            ))}
            {aiThinking && (
              <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-secondary px-4 py-2.5 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
              </div>
            )}
            {listening && interim && (
              <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-sm border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm text-foreground/80">
                {interim} <span className="text-primary">▎</span>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>

        <div className="border-t border-border px-4 py-4">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-2">
            <div className="relative">
              {listening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />
              )}
              <button
                type="button"
                onClick={toggleMic}
                disabled={!micSupported || connecting || !conversationId || speaking || aiThinking}
                aria-label={listening ? 'Stop listening' : 'Start speaking'}
                className={`relative flex h-16 w-16 items-center justify-center rounded-full transition-all disabled:opacity-40 ${
                  listening
                    ? 'bg-danger text-white'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90'
                }`}
              >
                {listening ? <MicOff className="h-7 w-7" /> : <Mic className="h-7 w-7" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {listening ? 'Listening — speak now' : speaking ? 'The AI is talking…' : 'Tap the mic to talk'}
            </p>
            {!micSupported && (
              <p className="text-xs text-muted-foreground/70">
                Voice input isn't supported in this browser — use Chrome or Edge for the best experience.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
