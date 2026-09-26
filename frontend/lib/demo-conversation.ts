/**
 * Public demo conversation. No account, no API call: the guest is answered by a
 * pre-seeded sample tenant so the page stays instant and always works. Swap the
 * handler for a POST to the public widget endpoint to run it against a live tenant.
 *
 * Voice "Talk" mode is fully client-side: SpeechRecognition -> send() (the same
 * state machine as typing) -> speechSynthesis with a karaoke subtitle. Nothing
 * is recorded or sent anywhere.
 */
export const DEMO_TENANT = {
  name: 'Northside Dental',
  role: 'Reception',
  hours: 'Mon–Fri 08:00–18:00 · Sat 09:00–13:00',
  phone: '0117 496 0182',
  address: '18 Clifton Park Road, Bristol BS8 2AB',
}

export const GREETING = `Hello — you are chatting with ${DEMO_TENANT.name}. Ask me about opening hours, treatments, prices, or book an appointment.`

export const QUICK_REPLIES = [
  'What are your opening hours?',
  'How much is a check-up?',
  'I want to book an appointment',
  'Do you take my insurance?',
]

export const FALLBACK =
  "I don't have that in my notes yet. I can help with opening hours, treatments and prices, booking an appointment, or passing you to a person. What would you like?"

export type Step = 'none' | 'name' | 'slot' | 'phone'

export interface Message {
  role: 'guest' | 'reception'
  text: string
  /** Suggested follow-ups rendered under the last receptionist message. */
  replies?: string[]
}

const IDENTITY_TEXT = 'I am the virtual receptionist for Northside Dental — I answer questions and book appointments here, and a person can join any time.'
const DECLINE_TEXT = 'I can only book dental appointments here. Tell me a day and time at the practice and I will hold a slot.'
const THANK_YOU_TEXT = 'You are welcome. Anything else — opening hours, prices, or shall I book you in?'
const GOODBYE_TEXT = 'Goodbye — if anything urgent comes up, call 0117 496 0182. Otherwise I will be right here.'
const NAME_REASK = 'Sorry — I need a name for the appointment. Just a first name is fine.'
const SLOT_REOFFER = 'I only have Tuesday 10:30 or Thursday 15:00 free this week. Which one suits you?'

function normalise(q: string) {
  return q.toLowerCase().replace(/[^a-z0-9\s:]/g, ' ').replace(/\s+/g, ' ').trim()
}

function hasAny(q: string, terms: string[]) {
  return terms.some((term) => q.includes(term))
}

export type Reply = { text: string; replies?: string[]; step?: Step; name?: string; slot?: string }

function looksLikeInfoRequest(q: string, guestText: string) {
  return (
    guestText.includes('?') ||
    hasAny(q, [
      'price',
      'cost',
      'how much',
      'hour',
      'open',
      'where',
      'address',
      'insurance',
      'thank',
      'goodbye',
      'who are you',
      'parking',
      'phone',
      'help',
      'how late',
    ])
  )
}

function validName(raw: string) {
  return raw.length >= 2 && raw.length <= 40 && new RegExp("^[\\p{L}][\\p{L}\\s'.-]*$", 'u').test(raw)
}

function validSlot(q: string) {
  return /(mon|tue|wed|thu|fri|sat|sun)/.test(q) && /\d/.test(q)
}

/**
 * Routes one guest message to the demo receptionist. `step` carries the
 * multi-turn booking flow so a visitor can finish booking without typing prose.
 * Omitted flow fields are carried forward by the caller.
 */
export function reply(guestText: string, step: Step, name: string, slot: string): Reply {
  const q = normalise(guestText)
  const raw = guestText.trim()

  // --- Flow-step guards (top of reply) ---
  if (step === 'name') {
    const wantInfo = looksLikeInfoRequest(q, guestText)
    if (!wantInfo) {
      if (validName(raw)) {
        return {
          text: `Thanks ${raw}. Which day works for you? I have Tuesday 10:30 and Thursday 15:00 free.`,
          replies: ['Tuesday 10:30', 'Thursday 15:00'],
          step: 'slot',
          name: raw,
          slot: '',
        }
      }
      return { text: NAME_REASK, step: 'name' }
    }
  }

  if (step === 'slot') {
    const wantInfo = looksLikeInfoRequest(q, guestText)
    if (!wantInfo) {
      if (validSlot(q)) {
        return {
          text: `Booked: ${name}, ${raw}. You will get a confirmation by text, and we will remind you 24 hours before. Is there a mobile number I should use?`,
          replies: ['Yes, 07700 900123', 'No, email is fine'],
          step: 'phone',
          name,
          slot: raw,
        }
      }
      return { text: SLOT_REOFFER, replies: ['Tuesday 10:30', 'Thursday 15:00'], step: 'slot' }
    }
  }

  if (step === 'phone')
    return {
      text: `Done — appointment confirmed for ${name} on ${slot}. Ask me anything else while you are here.`,
      replies: QUICK_REPLIES,
      step: 'none',
      name: '',
      slot: '',
    }

  // --- Non-flow routing (exact order required by the golden set) ---

  // Tag guard: never echo markup. Skipped while a flow step is active because
  // the name/slot guards above consume it first (e.g. f3).
  if (/[<>]/.test(guestText)) return { text: FALLBACK, replies: QUICK_REPLIES }

  // Identity (before human, so "robot or human?" is answered as the bot).
  if (
    hasAny(q, [
      'who are you',
      'what is your name',
      'your name',
      'are you a robot',
      'are you a human',
      'are you human',
      'is this a robot',
      'human or',
    ])
  ) {
    return { text: IDENTITY_TEXT, replies: QUICK_REPLIES }
  }

  // Handover to a person (extended phrasing).
  if (
    hasAny(q, [
      'human',
      'person',
      'receptionist',
      'complain',
      'complaint',
      'put me through',
      'someone',
      'manager',
      'speak to',
      'talk to',
    ])
  ) {
    return {
      text: 'Putting you through to the practice manager now. They usually pick up within about ten minutes during opening hours.',
      replies: QUICK_REPLIES,
    }
  }

  // Urgency outranks a booking intent: "my tooth is broken, can I come in?" must not
  // be answered with a calendar before it is checked against the red-flag symptoms.
  if (
    hasAny(q, [
      'emergency',
      'urgent',
      'broken',
      'knocked',
      'chipped',
      'cracked',
      'hurts',
      'hurting',
      'swelling',
      'swelled',
      'bleeding',
      'blood',
      'pain',
      'abscess',
      'injur',
    ])
  ) {
    return {
      text:
        'If you have facial swelling, bleeding that will not stop, or difficulty swallowing or breathing, call ' +
        DEMO_TENANT.phone +
        ' now rather than waiting for a message. For anything else I can book you in today.',
      replies: ['Book me in today', 'What are your opening hours?'],
    }
  }

  // Capability guard (before booking): "Do you do ...?" with a treatment term.
  if (
    hasAny(q, ['do you do', 'do you offer', 'do you have', 'do you provide', 'can you do']) &&
    hasAny(q, [
      'treatment',
      'filling',
      'extract',
      'check up',
      'whitening',
      'whiten',
      'braces',
      'invisalign',
      'implant',
      'veneer',
      'crown',
      'hygienist',
      'aligner',
      'root canal',
      'denture',
      'bridge',
    ])
  ) {
    return {
      text:
        'We do check-ups, hygienist visits, fillings, extractions, crowns, whitening, clear aligners and implants. Most start with a free consultation and X-ray.',
      replies: ['How much is a check-up?', 'I want to book an appointment'],
    }
  }

  // Non-dental booking decline (before the booking branch).
  if (hasAny(q, ['restaurant', 'table', 'hotel', 'flight', 'reservation'])) {
    return {
      text: DECLINE_TEXT,
      replies: ['I want to book an appointment', 'What are your opening hours?'],
    }
  }

  if (hasAny(q, ['book', 'appointment', 'see the dentist', 'available', 'availability', 'slot'])) {
    return { text: 'Happy to book you in. What name should I put the appointment under?', step: 'name' }
  }

  if (hasAny(q, ['hour', 'open', 'close', 'weekend', 'sunday', 'saturday', 'today', 'tomorrow'])) {
    return {
      text: `We are open ${DEMO_TENANT.hours}. Closed Sundays and bank holidays. Walk-ins are welcome if you can wait about 20 minutes.`,
      replies: ['Book an appointment', 'Where are you?'],
    }
  }

  if (
    hasAny(q, [
      'price',
      'cost',
      'how much',
      'fee',
      'charge',
      'check up',
      'checkup',
      'cleaning',
      'free',
      'first visit',
      'consultation',
    ])
  ) {
    return {
      text:
        'Check-up and clean is £60, a filling from £120, teeth whitening £180. First consultations are free. Prices include the X-ray.',
      replies: ['I want to book an appointment', 'Do you take my insurance?'],
    }
  }

  if (
    hasAny(q, [
      'insurance',
      'payment',
      'pay',
      'card',
      'finance',
      'financing',
      'instalment',
      'installment',
      'denplan',
    ])
  ) {
    return {
      text:
        'We take Bupa, AXA and Vitality, and we are a Denplan practice. You can pay in monthly instalments over 12 months with no interest.',
      replies: ['How much is a check-up?', 'Book an appointment'],
    }
  }

  if (
    hasAny(q, [
      'whitening',
      'braces',
      'invisalign',
      'implant',
      'veneer',
      'treatment',
      'filling',
      'extract',
      'check up',
      'crown',
      'hygienist',
      'aligner',
      'whiten',
      'root canal',
      'denture',
      'bridge',
    ])
  ) {
    return {
      text:
        'We do check-ups, hygienist visits, fillings, extractions, crowns, whitening, clear aligners and implants. Most start with a free consultation and X-ray.',
      replies: ['How much is a check-up?', 'I want to book an appointment'],
    }
  }

  if (hasAny(q, ['where', 'address', 'parking', 'bus', 'train', 'find']) && !hasAny(q, ['email'])) {
    return {
      text: `We are at ${DEMO_TENANT.address}. There is free parking at the back and the Clifton Down bus stop is a two minute walk.`,
      replies: ['What are your opening hours?', 'Book an appointment'],
    }
  }

  if (hasAny(q, ['phone', 'call', 'number', 'contact', 'email'])) {
    return {
      text: `Call us on ${DEMO_TENANT.phone} during opening hours, or leave me a message here and we will call you back.`,
      replies: ['Book an appointment', 'What are your opening hours?'],
    }
  }

  if (
    hasAny(q, ['hello', 'hey', 'good morning', 'good afternoon']) ||
    /(^| )hi( |$)/.test(q)
  ) {
    return { text: `Hello. ${DEMO_TENANT.hours} today. How can I help?`, replies: QUICK_REPLIES }
  }

  if (hasAny(q, ['thank', 'cheers', 'appreciated'])) {
    return { text: THANK_YOU_TEXT, replies: QUICK_REPLIES }
  }

  if (hasAny(q, ['goodbye', 'good bye']) || /(^| )bye( |$)/.test(q)) {
    return { text: GOODBYE_TEXT }
  }

  return { text: FALLBACK, replies: QUICK_REPLIES }
}

export function initialMessages(): Message[] {
  return [{ role: 'reception', text: GREETING, replies: QUICK_REPLIES }]
}