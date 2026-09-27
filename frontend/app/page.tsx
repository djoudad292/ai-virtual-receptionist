import Link from 'next/link'
import { Check, Mic } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

const PORTFOLIO_URL = 'https://djaouad.is-a.dev'
const APK_URL = 'https://github.com/djoudad292/ai-virtual-receptionist/releases/download/latest-apk-receptionist/ai-receptionist.apk'

const capabilities = [
  {
    title: 'Opening hours and directions',
    body: 'Answers when you are open, which days you close, and how to find you — straight from the hours you publish, never improvised.',
  },
  {
    title: 'Prices and treatments',
    body: 'Reads your price list back, treatment by treatment, so nothing is guessed and nothing drifts online.',
  },
  {
    title: 'Books appointments in chat',
    body: 'Takes a name, offers two free slots, asks for a number, then confirms the booking — step by step, with nothing to drop.',
  },
  {
    title: 'Checks urgent symptoms first',
    body: 'Red-flag symptoms get the emergency number before a slot is even offered, so nobody is left waiting.',
  },
  {
    title: 'Hands to the right person',
    body: 'Sales, support and billing are separated by intent, so nothing lands in one person’s inbox — anything needing judgement goes to your team.',
  },
  {
    title: 'On site, on phone, in the dashboard',
    body: 'One snippet on every page drops the chat where visitors already are. The Android app lets you answer away from the desk, and the inbox keeps your team in the loop.',
  },
]

const steps = [
  { title: 'Set up your front desk', body: 'Add your hours, prices, treatments, the emergency number and who handles what.' },
  { title: 'One snippet, and it is live', body: 'Drop the widget on your pages and the front desk is open instantly.' },
  { title: 'Start taking bookings', body: 'Visitors chat, urgent cases go straight to you, bookings land in your calendar.' },
]

export default function LandingPage() {
  return (
    <div id="main" tabIndex={-1} className="min-h-screen bg-bg text-fg outline-none">
      <SiteHeader withSectionLinks />

      <main>
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              A receptionist that answers your website, day and night
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-secondary">
              It knows your hours, reads your prices, books appointments, triages urgent symptoms and puts anything tricky on to a real person. The demo is the real conversation your visitors get — no account needed.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/try"
                className="bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-strong"
              >
                Try it now — no signup
              </Link>
              <Link
                href="/register"
                className="border border-border px-4 py-2.5 text-sm font-semibold text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
              >
                Create a free account
              </Link>
            </div>

            <ul className="mt-8 space-y-2 text-sm text-fg-muted">
              {['No card, no sales call', 'Your notes stay in your workspace', 'Cancel whenever you like'].map(
                (point) => (
                  <li key={point} className="flex items-center gap-2">
                    <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                    {point}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>

        <section id="what-it-does" className="border-t border-border px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">What the front desk handles</h2>
            <p className="mt-2 max-w-lg text-[15px] text-fg-muted">
              A night shift that never blinks: answering the same question, writing down who called, finding a slot, and knowing who should pick it up.
            </p>
            <div className="mt-8 grid gap-x-10 gap-y-6 sm:grid-cols-2">
              {capabilities.map((c) => (
                <div key={c.title} className="border-t border-border pt-4">
                  <h3 className="text-sm font-semibold">{c.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Three steps, about an hour</h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {steps.map((s, i) => (
                <li key={s.title} className="border-t border-border pt-4">
                  <span className="text-xs font-medium text-fg-muted">Step {i + 1}</span>
                  <h3 className="mt-1.5 text-sm font-semibold">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="hear-it-answer" className="border-t border-border bg-surface px-4 py-14">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Hear it answer</h2>
            <p className="mt-2 max-w-lg text-[15px] text-fg-muted">
              It does not just chat — it talks back, with live subtitles, in your browser. Toggle Talk in the demo and ask out loud.
            </p>

            <div className="mt-8 max-w-2xl rounded-xl border border-border bg-bg p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
                  <Mic className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-xs text-fg-muted">
                    <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                    AI is speaking
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg">
                    We’re open Monday to Friday 8am to 6pm, Saturday 9 to 1… <span className="text-fg-muted">▎</span>
                  </p>
                  <p className="mt-2 text-xs text-fg-muted">
                    Answers use the live knowledge base when the API is reachable, with built-in demo rules as
                    offline fallback. Voice stays on-device.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Link
                  href="/try"
                  className="bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-strong"
                >
                  Try the voice demo
                </Link>
                <span className="text-xs text-fg-muted">Needs Chrome or Edge</span>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border px-4 py-10">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold">Check it on the move</h2>
              <p className="mt-1 text-sm text-fg-muted">
                The same inbox, leads and appointments in an Android app, so you are not tied to the desk.
              </p>
            </div>
            <a
              href={APK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 border border-border px-4 py-2 text-center text-sm text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
            >
              Download the Android app
            </a>
          </div>
        </section>

        <section className="border-t border-border px-4 py-14">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">Try it, then decide</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-fg-secondary">
              The demo is the same conversation your visitors get: hours, prices, an urgent symptom handled sensibly, and
              an appointment booked end to end. It needs no account, so you can judge it before handing over anything.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link
                href="/try"
                className="bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-strong"
              >
                Try it now — no signup
              </Link>
              <Link
                href="/register"
                className="border border-border px-4 py-2.5 text-sm font-semibold text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
              >
                Create a free account
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-4 py-6 text-xs text-fg-muted">
        <div className="mx-auto flex max-w-5xl flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <span>Receptionist · {new Date().getFullYear()}</span>
          <span>
            Built by Djaouad Frih · Want this for your business?{' '}
            <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="text-fg-secondary underline underline-offset-2 hover:text-fg">
              {PORTFOLIO_URL}
            </a>
          </span>
        </div>
      </footer>
    </div>
  )
}
