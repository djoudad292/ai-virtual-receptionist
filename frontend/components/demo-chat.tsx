'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageSquare, Mic, MicOff, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Public demo conversation. No account, no API call: the guest is answered by a
 * pre-seeded sample tenant so the page stays instant and always works. Swap the
 * handler for a POST to the public widget endpoint to run it against a live tenant.
 *
 * Voice "Talk" mode is fully client-side: SpeechRecognition -> send() (the same
 * state machine as typing) -> speechSynthesis with a karaoke subtitle. Nothing
 * is recorded or sent anywhere.
 */
const DEMO_TENANT = {
  name: 'Northside Dental',
  role: 'Reception',
  hours: 'Mon–Fri 08:00–18:00 · Sat 09:00–13:00',
  phone: '0117 496 0182',
  address: '18 Clifton Park Road, Bristol BS8 2AB',
}

const GREETING = `Hello — you are chatting with ${DEMO_TENANT.name}. Ask me about opening hours, treatments, prices, or book an appointment.`

const QUICK_REPLIES = [
  'What are your opening hours?',
  'How much is a check-up?',
  'I want to book an appointment',
  'Do you take my insurance?',
]

const FALLBACK =
  "I don't have that in my notes yet. I can help with opening hours, treatments and prices, booking an appointment, or passing you to a person. What would you like?"

type Step = 'none' | 'name' | 'slot' | 'phone'

interface Message {
  role: 'guest' | 'reception'
  text: string
  /** Suggested follow-ups rendered under the last receptionist message. */
  replies?: string[]
}

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

function normalise(q: string) {
  return q.toLowerCase().replace(/[^a-z0-9\s:]/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasAny(q: string, terms: string[]) {
  return terms.some((term) => q.includes(term))
}

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const w = window as any
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

type Reply = { text: string; replies?: string[]; step?: Step; name?: string; slot?: string }

/**
 * Routes one guest message to the demo receptionist. `step` carries the
 * multi-turn booking flow so a visitor can finish booking without typing prose.
 * Omitted flow fields are carried forward by the caller.
 */
function reply(guestText: string, step: Step, name: string, slot: string): Reply {
  const q = normalise(guestText)

  if (step === 'name') return { text: `Thanks ${guestText.trim()}. Which day works for you? I have Tuesday 10:30 and Thursday 15:00 free.`, replies: ['Tuesday 10:30', 'Thursday 15:00'], step: 'slot', name: guestText.trim(), slot: '' }
  if (step === 'slot')
    return { text: `Booked: ${name}, ${guestText.trim()}. You will get a confirmation by text, and we will remind you 24 hours before. Is there a mobile number I should use?`, replies: ['Yes, 07700 900123', 'No, email is fine'], step: 'phone', name, slot: guestText.trim() }
  if (step === 'phone')
    return { text: `Done — appointment confirmed for ${name} on ${slot}. Ask me anything else while you are here.`, replies: QUICK_REPLIES, step: 'none', name: '', slot: '' }

  if (hasAny(q, ['human', 'person', 'receptionist', 'complain', 'complaint'])) {
    return { text: 'Putting you through to the practice manager now. They usually pick up within about ten minutes during opening hours.', replies: QUICK_REPLIES }
  }

  // Urgency outranks a booking intent: "my tooth is broken, can I come in?" must not
  // be answered with a calendar before it is checked against the red-flag symptoms.
  if (hasAny(q, ['emergency', 'urgent', 'broken', 'knocked', 'chipped', 'cracked', 'hurts', 'hurting', 'swelling', 'swelled', 'bleeding', 'blood', 'pain', 'abscess', 'injur'])) {
    return {
      text: 'If you have facial swelling, bleeding that will not stop, or difficulty swallowing or breathing, call ' + DEMO_TENANT.phone + ' now rather than waiting for a message. For anything else I can book you in today.',
      replies: ['Book me in today', 'What are your opening hours?'],
    }
  }

  if (hasAny(q, ['book', 'appointment', 'see the dentist', 'available', 'availability', 'slot'])) {
    return { text: 'Happy to book you in. What name should I put the appointment under?', step: 'name' }
  }

  if (hasAny(q, ['hour', 'open', 'close', 'weekend', 'sunday', 'saturday', 'today', 'tomorrow'])) {
    return { text: `We are open ${DEMO_TENANT.hours}. Closed Sundays and bank holidays. Walk-ins are welcome if you can wait about 20 minutes.`, replies: ['Book an appointment', 'Where are you?'] }
  }

  if (hasAny(q, ['price', 'cost', 'how much', 'fee', 'charge', 'check up', 'checkup', 'cleaning'])) {
    return { text: 'Check-up and clean is £60, a filling from £120, teeth whitening £180. First consultations are free. Prices include the X-ray.', replies: ['I want to book an appointment', 'Do you take my insurance?'] }
  }

  if (hasAny(q, ['insurance', 'plan', 'payment', 'pay', 'card', 'finance', 'financing', 'instalment', 'installment', 'denplan'])) {
    return { text: 'We take Bupa, AXA and Vitality, and we are a Denplan practice. You can pay in monthly instalments over 12 months with no interest.', replies: ['How much is a check-up?', 'Book an appointment'] }
  }

  if (hasAny(q, ['whitening', 'braces', 'invisalign', 'implant', 'veneer', 'treatment', 'filling', 'extract', 'check up'])) {
    return { text: 'We do check-ups, hygienist visits, fillings, extractions, crowns, whitening, clear aligners and implants. Most start with a free consultation and X-ray.', replies: ['How much is a check-up?', 'I want to book an appointment'] }
  }

  if (hasAny(q, ['where', 'address', 'parking', 'bus', 'train', 'find'])) {
    return { text: `We are at ${DEMO_TENANT.address}. There is free parking at the back and the Clifton Down bus stop is a two minute walk.`, replies: ['What are your opening hours?', 'Book an appointment'] }
  }

  if (hasAny(q, ['phone', 'call', 'number', 'contact'])) {
    return { text: `Call us on ${DEMO_TENANT.phone} during opening hours, or leave me a message here and we will call you back.`, replies: ['Book an appointment', 'What are your opening hours?'] }
  }

  if (hasAny(q, ['hello', 'hi ', 'hey', 'good morning', 'good afternoon'])) {
    return { text: `Hello. ${DEMO_TENANT.hours} today. How can I help?`, replies: QUICK_REPLIES }
  }

  return { text: FALLBACK, replies: QUICK_REPLIES }
}

function initialMessages(): Message[] {
  return [{ role: 'reception', text: GREETING, replies: QUICK_REPLIES }]
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

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const speechRef = useRef<{ timers: number[]; spokenId?: string }>({ timers: [] })
  const flowRef = useRef(flow)
  const pendingRef = useRef(false)
  const talkActiveRef = useRef(false)

  useEffect(() => {
    setMicSupported(getSpeechRecognitionCtor() !== null)
    setSpeechSupported('speechSynthesis' in window)
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
    const words = text.split(' ')
    const spokenId = `${Date.now()}`
    speechRef.current.spokenId = spokenId
    let revealed = 0

    const render = () => {
      if (speechRef.current.spokenId !== spokenId) return
      setSubtitle(words.slice(0, revealed).join(' ') + (revealed < words.length ? ' ▎' : ''))
    }

    const finish = () => {
      if (speechRef.current.spokenId !== spokenId) return
      speechRef.current.spokenId = undefined
      clearSpeechTimers()
      setSpeaking(false)
      setSubtitle('')
    }

    setSpeaking(true)
    render()

    const iv = window.setInterval(() => {
      if (speechRef.current.spokenId !== spokenId) return
      if (revealed < words.length - 1) {
        revealed += 1
        render()
      }
    }, 260)
    speechRef.current.timers.push(iv)

    const cap = window.setTimeout(finish, Math.min(10000, 1600 + words.length * 220))
    speechRef.current.timers.push(cap)

    try {
      const u = new SpeechSynthesisUtterance(text)
      u.rate = 1
      u.pitch = 1
      u.onend = finish
      u.onerror = () => {}
      window.speechSynthesis.speak(u)
    } catch {
      finish()
    }
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
    setInput('')

    setMessages((prev) => [...prev, { role: 'guest', text: clean }, { role: 'reception', text: '' }])

    window.setTimeout(() => {
      const answer = reply(clean, flowRef.current.step, flowRef.current.name, flowRef.current.slot)
      setFlow((prev) => ({
        step: answer.step ?? prev.step,
        name: answer.name ?? prev.name,
        slot: answer.slot ?? prev.slot,
      }))
      pendingRef.current = false
      setPending(false)
      setMessages((prev) => {
        const next = [...prev]
        next[next.length - 1] = { role: 'reception', text: answer.text, replies: answer.replies }
        return next
      })
      // Speak only replies produced while Talk is enabled, and only as a result
      // of a user gesture (this send call). The greeting on load is never spoken.
      if (talkActiveRef.current && speechSupported) speak(answer.text)
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
    return () => {
      cancelSpeech()
      cancelListening()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lastReception = [...messages].reverse().find((m) => m.role === 'reception')

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
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <p className="bg-surface-alt px-3 py-2 text-sm text-fg-muted">Typing…</p>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {lastReception?.replies && !pending && (
        <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
          {lastReception.replies.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => send(r)}
              className="border border-border px-2.5 py-1 text-xs text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
            >
              {r}
            </button>
          ))}
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
        Sample practice, running in your browser. No account, nothing sent anywhere.
        {talkActive && ' Voice uses your mic through the browser — nothing is recorded or uploaded.'}
      </p>
    </div>
  )
}
