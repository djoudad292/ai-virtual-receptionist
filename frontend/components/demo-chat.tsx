'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { BookOpen, CalendarCheck, Mail, MessageSquare, Mic, MicOff, RotateCcw, UserPlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { pickMaleVoice } from '@/lib/demo-voice'
import { askDemo, getDemoAppointments, getDemoLeads, type DemoAppointment, type DemoAction, type DemoLead } from '@/lib/demo-api'

/**
 * Public demo conversation. No account, no API call: the guest is answered by a
 * pre-seeded sample tenant so the page stays instant and always works. Swap the
 * handler for a POST to the public widget endpoint to run it against a live tenant.
 *
 * Voice "Talk" mode is fully client-side: SpeechRecognition -> send() (the same
 * state machine as typing) -> speechSynthesis with a karaoke subtitle. Nothing
 * is recorded or sent anywhere.
 */
import {
  DEMO_TENANT,
  FALLBACK,
  GREETING,
  QUICK_REPLIES,
  initialMessages,
  reply,
} from '@/lib/demo-conversation'
import type { Message, Reply, Step } from '@/lib/demo-conversation'
import { getDemoSessionId } from '@/lib/demo-session'
import { getDemoIntake, onIntakeSaved } from '@/lib/demo-intake'

interface SpeechRecognitionInstance {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  onresult: ((e: any) => void) | null
  onerror: ((e: any) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance

const SPEECH_LANG = 'en-US'

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export function DemoChat({ className }: { className?: string }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const [flow, setFlow] = useState<{ step: Step; name: string; slot: string }>({ step: 'none', name: '', slot: '' })

  const [talkActive, setTalkActive] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [voiceError, setVoiceError] = useState('')
  const [micSupported, setMicSupported] = useState<boolean | null>(null)
  const [speechSupported, setSpeechSupported] = useState<boolean | null>(null)

  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sessionIdRef = useRef<string>(getDemoSessionId())

  const [appointments, setAppointments] = useState<DemoAppointment[]>([])
  const [docsNoteIndex, setDocsNoteIndex] = useState<number | null>(null)
  const [hasIntake, setHasIntake] = useState(false)
  const [actionCards, setActionCards] = useState<Record<number, DemoAction[]>>({})
  const [leads, setLeads] = useState<DemoLead[]>([])

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const speechRef = useRef<{ timers: number[]; spokenId?: string }>({ timers: [] })
  const flowRef = useRef(flow)
  const pendingRef = useRef(false)
  const talkActiveRef = useRef(false)

  useEffect(() => {
    setMicSupported(getSpeechRecognitionCtor() !== null)
    setSpeechSupported('speechSynthesis' in window)
    // Warm the synthesis voice list early so it is populated by the time the
    // user talks. Browsers load voices lazily; probing here avoids a first-
    // utterance delay. Guarded: some browsers throw on a cold call.
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices()
      } catch {}
    }
  }, [])

  useEffect(() => {
    flowRef.current = flow
  }, [flow])
  useEffect(() => {
    pendingRef.current = pending
  }, [pending])
  useEffect(() => {
    talkActiveRef.current = talkActive
  }, [talkActive])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, pending, listening])

  useEffect(() => {
    getDemoIntake(getDemoSessionId()).then((d) => {
      if (d) setHasIntake(true)
    })
    return onIntakeSaved(() => setHasIntake(true))
  }, [])

  const clearSpeechTimers = () => {
    speechRef.current.timers.forEach((t) => window.clearInterval(t))
    speechRef.current.timers = []
  }

  const cancelListening = () => {
    const r = recognitionRef.current
    recognitionRef.current = null
    try {
      r?.stop()
    } catch {}
    setListening(false)
    setInterim('')
    setVoiceError('')
  }

  const cancelSpeech = () => {
    try {
      window.speechSynthesis.cancel()
    } catch {}
    clearSpeechTimers()
    speechRef.current.spokenId = undefined
    setSpeaking(false)
    setSubtitle('')
  }

  // Speaks a reception reply with a karaoke subtitle. Driven by the same
  // reply computed in send(), never invoked on mount or without a user gesture.
  const speak = (text: string) => {
    if (!speechSupported) return
    // Safety: a speaking reply must never overlap with listening.
    cancelListening()
    // Word offsets drive the karaoke: the subtitle advances in lockstep with
    // the real audio (onboundary) instead of a blind timer.
    const words = Array.from(text.matchAll(/\S+/g)).map((m) => ({ w: m[0], start: m.index! }))
    const spokenId = `${Date.now()}`
    speechRef.current.spokenId = spokenId
    let revealed = 0
    let boundarySeen = false
    let degraded = false
    let retriedVoice = false

    const render = () => {
      if (speechRef.current.spokenId !== spokenId) return
      setSubtitle(words.slice(0, revealed).map((x) => x.w).join(' ') + (revealed < words.length ? ' ▎' : ''))
    }

    const finish = () => {
      if (speechRef.current.spokenId !== spokenId) return
      speechRef.current.spokenId = undefined
      clearSpeechTimers()
      setSpeaking(false)
      setSubtitle('')
    }

    const degradeToVisual = () => {
      if (degraded || speechRef.current.spokenId !== spokenId) return
      degraded = true
      // Swap the long cap for the old formula so the mic re-enables at the
      // estimator's natural end, exactly like before this feature existed.
      const oldCap = window.setTimeout(finish, Math.min(10000, 1600 + words.length * 220))
      speechRef.current.timers.push(oldCap)
      // Leave the estimator running (boundarySeen stays false) so the subtitle
      // keeps marching at 260ms/word — the guaranteed visible feedback.
    }

    setSpeaking(true)
    render()

    // Estimator fallback: reveal one word every 260ms. It runs only until the
    // first onboundary event arrives, after which boundary events are the
    // single source of truth (preserves old behavior on browsers without
    // boundary events, e.g. Safari).
    const iv = window.setInterval(() => {
      if (speechRef.current.spokenId !== spokenId || boundarySeen) return
      if (revealed < words.length - 1) {
        revealed += 1
        render()
      }
    }, 260)
    speechRef.current.timers.push(iv)

    // Generous upper bound that cannot cut real speech; finish is idempotent
    // via spokenId so onend/onerror/cap may all call it.
    const cap = window.setTimeout(finish, Math.min(60000, 4000 + words.length * 500))
    speechRef.current.timers.push(cap)

    // Chrome pauses long utterances mid-sentence unless synthesis is nudged
    // back. Resume periodically so a long reply does not silently stop.
    const poke = window.setInterval(() => {
      if (speechRef.current.spokenId !== spokenId) return
      try {
        window.speechSynthesis.resume()
      } catch {}
    }, 8000)
    speechRef.current.timers.push(poke)

    try {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1
      u.pitch = 1
      const male = pickMaleVoice(window.speechSynthesis.getVoices())
      if (male) u.voice = male
      u.onboundary = (e: any) => {
        if (degraded) return
        // 'word' events are the primary signal; some browsers fire undefined.
        if (e.name !== 'word' && e.name !== undefined) return
        if (speechRef.current.spokenId !== spokenId) return
        const idx = typeof e.charIndex === 'number' ? e.charIndex : -1
        if (idx < 0) return
        let upto = 0
        for (let i = 0; i < words.length; i++) {
          if (words[i].start <= idx) upto = i + 1
          else break
        }
        if (upto > revealed) {
          revealed = upto
          if (!boundarySeen) {
            boundarySeen = true
            window.clearInterval(iv)
          }
          render()
        }
      }
      u.onend = () => { if (!degraded) finish() }
      u.onerror = (e: any) => {
        const err = e && e.error
        if (err === 'canceled' || err === 'interrupted') { finish(); return }  // our own cancel
        if (male && !retriedVoice) {
          retriedVoice = true
          try { u.voice = null; window.speechSynthesis.speak(u); return } catch {}
        }
        degradeToVisual()
      }
      window.speechSynthesis.speak(u)
    } catch {
      finish()
    }
  }

  const refreshAppointments = useCallback(async () => {
    // Silent: a lost connection must not break the chat.
    try {
      const data = await getDemoAppointments(sessionIdRef.current)
      setAppointments(data.appointments ?? [])
    } catch {}
  }, [])

  const refreshLeads = useCallback(async () => {
    try {
      const data = await getDemoLeads(sessionIdRef.current)
      setLeads(data.leads ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    refreshAppointments()
    refreshLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshAppointments, refreshLeads])

  // Shared tail of a turn: clear the pending flag, paint the reception reply,
  // and speak it only when Talk is on (the greeting on load is never spoken).
  const finishMessage = (text: string, replies?: string[]) => {
    pendingRef.current = false
    setPending(false)
    setMessages((prev) => {
      const next = [...prev]
      next[next.length - 1] = { role: 'reception', text, replies }
      return next
    })
    if (talkActiveRef.current && speechSupported) speak(text)
  }

  // Shared entry point for typed, quick-reply and spoken input. The final voice
  // transcript is routed here, so the booking flow is identical for voice and text.
  const send = (text: string) => {
    const clean = text.trim()
    if (!clean || pendingRef.current) return
    // A new turn always interrupts in-flight voice first.
    cancelSpeech()
    cancelListening()
    pendingRef.current = true
    setDocsNoteIndex(null)
    setInput('')

    setMessages((prev) => [...prev, { role: 'guest', text: clean }, { role: 'reception', text: '' }])

    window.setTimeout(async () => {
      // The multi-turn booking flow is fully local and untouched by the backend.
      // It stays byte-for-byte identical to the original state machine.
      if (flowRef.current.step !== 'none') {
        const answer = reply(clean, flowRef.current.step, flowRef.current.name, flowRef.current.slot)
        setFlow((prev) => ({
          step: answer.step ?? prev.step,
          name: answer.name ?? prev.name,
          slot: answer.slot ?? prev.slot,
        }))
        finishMessage(answer.text, answer.replies)
        return
      }

      // RAG-first: ask the live knowledge base (practice profile + this
      // visitor's uploads). On any failure — network, timeout, empty response —
      // fall back to the local rules, which are the eval golden set.
      let answered = false
      try {
        const result = await askDemo(sessionIdRef.current, clean)
        const responseText = result?.response?.trim() ?? ''
        if (responseText) {
          answered = true
          // The new reception message sits at the end of the list we just
          // appended (guest + empty reception). `messages` is still the
          // pre-update render value, so its length + 1 is that index.
          if (result.sources?.length > 0) setDocsNoteIndex(messages.length + 1)
          if (result.actions?.length) setActionCards((prev) => ({ ...prev, [messages.length + 1]: result.actions! }))
          finishMessage(responseText, QUICK_REPLIES)
          refreshAppointments()
          refreshLeads()
        }
      } catch {
        // fall through to the local rules
      }

      if (!answered) {
        const answer = reply(clean, flowRef.current.step, flowRef.current.name, flowRef.current.slot)
        setFlow((prev) => ({
          step: answer.step ?? prev.step,
          name: answer.name ?? prev.name,
          slot: answer.slot ?? prev.slot,
        }))
        finishMessage(answer.text, answer.replies)
      }
    }, 450)
  }

  const startListening = () => {
    const SR = getSpeechRecognitionCtor()
    if (!SR || speaking || pendingRef.current) return
    // Enabling the mic cancels any speech in progress.
    cancelSpeech()
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
          if (finalText) send(finalText)
        }
      }
      rec.onerror = (e: any) => {
        setListening(false)
        setInterim('')
        setVoiceError(
          (e && (e.message === 'not-allowed' || e.error === 'not-allowed' || e.error === 'PermissionDenied'))
            ? 'Microphone access was denied — check your browser permissions and try again.'
            : 'Voice input stopped. Check your microphone and try again.',
        )
      }
      rec.onend = () => {
        setListening(false)
      }
      recognitionRef.current = rec
      setVoiceError('')
      setListening(true)
      rec.start()
    } catch {
      setListening(false)
      setInterim('')
    }
  }

  const toggleListening = () => {
    if (speaking || pendingRef.current) return
    if (listening) cancelListening()
    else startListening()
  }

  const toggleTalk = () => {
    cancelSpeech()
    cancelListening()
    setTalkActive((prev) => !prev)
  }

  const reset = () => {
    cancelSpeech()
    cancelListening()
    setMessages(initialMessages())
    setFlow({ step: 'none', name: '', slot: '' })
    pendingRef.current = false
    setPending(false)
    setInput('')
    inputRef.current?.focus()
  }

  useEffect(() => {
    const onAsk = (e: CustomEvent) => send(e.detail)
    window.addEventListener('demo:ask', onAsk as EventListener)
    return () => window.removeEventListener('demo:ask', onAsk as EventListener)
  }, [send])

  useEffect(() => {
    return () => {
      cancelSpeech()
      cancelListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const statusText = speaking
    ? 'AI is speaking…'
    : pending
      ? 'Thinking…'
      : listening
        ? 'Listening — speak now'
        : 'Tap the mic to talk'

  return (
    <div className={cn('flex flex-col border border-border bg-surface', className)}>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span aria-hidden className="flex h-8 w-8 shrink-0 items-center justify-center bg-primary-soft text-primary">
          <MessageSquare className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-fg">{DEMO_TENANT.name}</p>
          <p className="truncate text-xs text-fg-muted">{DEMO_TENANT.role} · {DEMO_TENANT.hours}</p>
        </div>

          {micSupported === null ? (
            <button
              type="button"
              disabled
              aria-pressed={false}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                'text-fg-muted cursor-not-allowed opacity-60',
              )}
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Talk</span>
            </button>
          ) : micSupported ? (
            <button
              type="button"
              onClick={toggleTalk}
              aria-pressed={talkActive}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                talkActive
                  ? 'bg-primary text-primary-fg hover:bg-primary-strong'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              <Mic className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Talk</span>
            </button>
          ) : (
            <span
              className="flex items-center gap-1 text-xs text-fg-muted"
              title="Voice works in Chrome or Edge"
            >
              <MicOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Voice in Chrome/Edge</span>
            </span>
          )}

        <button
          type="button"
          onClick={reset}
          className="flex shrink-0 items-center gap-1.5 px-2 py-1 text-xs text-fg-muted transition-colors hover:text-fg"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </button>
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Demo conversation"
        className="h-[22rem] space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.map((msg, i) => (
          <div key={i} className={cn('flex', msg.role === 'guest' ? 'justify-end' : 'justify-start')}>
            <p
              className={cn(
                'max-w-[85%] px-3 py-2 text-sm leading-relaxed',
                msg.role === 'guest' ? 'bg-primary text-primary-fg' : 'border border-border bg-surface-alt text-fg-secondary',
              )}
            >
              {msg.text || <span className="text-fg-muted">…</span>}
            </p>
            {msg.role === 'reception' && i === docsNoteIndex && (
              <p className="mt-1 max-w-[85%] px-1 text-[11px] text-fg-muted">answered from your documents</p>
            )}
            {msg.role === 'reception' && actionCards[i]?.length && (
              <div
                role="group"
                aria-label="Agent actions"
                className="mt-1 max-w-[85%] space-y-1"
              >
                {actionCards[i].map((action, j) => {
                  const Icon =
                    action.type === 'lead'
                      ? UserPlus
                      : action.type === 'appointment'
                        ? CalendarCheck
                        : Mail
                  let label: string
                  if (action.type === 'lead') {
                    label = `Lead saved — ${action.detail ?? ''}`
                  } else if (action.type === 'appointment') {
                    label = `Appointment booked — ${action.detail ?? ''}`
                  } else {
                    label = `Email ${action.ok ? 'sent' : 'simulated (demo has no SMTP)'} — ${action.detail ?? ''}`
                  }
                  return (
                    <div
                      key={j}
                      className="flex items-center gap-1.5 border border-border bg-surface-alt rounded-md px-2.5 py-1.5 text-[11px]"
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className={cn('truncate', action.ok ? 'text-success' : 'text-fg-muted')}>
                        {action.ok ? '✓ ' : ''}{label}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <p className="bg-surface-alt px-3 py-2 text-sm text-fg-muted">Typing…</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {(appointments.length > 0 || leads.length > 0) && (
        <div className="border-t border-border px-4 py-3">
          <p className="mb-2 text-xs font-semibold text-fg">This session</p>
          {appointments.length > 0 && (
            <>
              <p className="mb-1 text-[11px] font-medium text-fg-muted">Appointments</p>
              <ul className="space-y-1.5">
                {appointments.map((appt, i) => {
                  const name = typeof appt.customerName === 'string' ? appt.customerName : ''
                  const when = [appt.date, appt.time].filter(Boolean).join(' · ') || appt.title || ''
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm text-fg-secondary">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="truncate">
                        {name}
                        {when ? ` · ${when}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
          {leads.length > 0 && (
            <>
              <p className="mb-1 text-[11px] font-medium text-fg-muted">Details captured</p>
              <ul className="space-y-1.5">
                {leads.map((lead, i) => {
                  const handle = lead.email || lead.phone || ''
                  return (
                    <li key={i} className="flex items-center gap-2 text-sm text-fg-secondary">
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
                      <span className="truncate">
                        {lead.name}
                        {handle ? ` · ${handle}` : ''}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>
      )}

      {talkActive && (
        <div className="border-t border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleListening}
              disabled={speaking || pending}
              aria-label={listening ? 'Stop listening' : 'Start listening'}
              className={cn(
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition-colors',
                speaking || pending
                  ? 'cursor-not-allowed opacity-40'
                  : listening
                    ? 'bg-danger text-white hover:bg-danger/80'
                    : 'bg-primary text-primary-fg hover:bg-primary-strong',
              )}
            >
              {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-xs text-fg-muted">{statusText}</p>
              {listening && interim && (
                <p className="mt-0.5 break-words text-sm text-fg-secondary">{interim}</p>
              )}
              {speaking && subtitle && (
                <p className="mt-0.5 break-words text-sm leading-relaxed text-fg" aria-live="polite">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {speechSupported === false && micSupported && talkActive && (
            <p className="mt-2 text-xs text-fg-muted">
              Speech output is not available in this browser — replies still appear in chat.
            </p>
          )}
          {voiceError && (
            <p className="mt-2 text-xs text-fg-muted" role="alert">
              {voiceError}
            </p>
          )}
        </div>
      )}

      {hasIntake && (
        <div className="flex items-center gap-2 px-4 py-2">
          <BookOpen className="h-3.5 w-3.5 shrink-0 text-success" />
          <span className="text-[11px] text-fg-muted">
            Your saved details are included — answers are retrieved from the practice documents (RAG)
          </span>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
        className="flex gap-2 border-t border-border px-4 py-3"
      >
        <label htmlFor="demo-chat-input" className="sr-only">
          Message the demo receptionist
        </label>
        <input
          id="demo-chat-input"
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={talkActive ? 'Type a message or tap the mic…' : 'Type a message…'}
          maxLength={500}
          autoComplete="off"
          className="w-full min-w-0 flex-1 border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border-strong focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || pending}
          className="shrink-0 bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-strong disabled:opacity-40"
        >
          Send
        </button>
      </form>

      <p className="border-t border-border px-4 py-2 text-xs text-fg-muted">
        Sample practice. Answers use the live knowledge base (the practice profile and your uploads) when the
        API is reachable, with built-in demo rules as the offline fallback. Voice stays on-device — your mic is
        used only while you talk.
      </p>
    </div>
  )
}
