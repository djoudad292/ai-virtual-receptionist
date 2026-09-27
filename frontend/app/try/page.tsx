import type { Metadata } from 'next'
import Link from 'next/link'
import { Check } from 'lucide-react'
import { DemoChat } from '@/components/demo-chat'
import { DemoUpload } from '@/components/demo-upload'
import { SiteHeader } from '@/components/site-header'
import { WakeSplash } from '@/components/wake-splash'
import { DemoIntake } from '@/components/demo-intake'

export const metadata: Metadata = {
  title: 'Try the AI Receptionist — live demo',
  description:
    'Use the AI receptionist yourself: opening hours, prices, urgent symptoms and a full booking taken in chat. Answers come from the live knowledge base when it is reachable, with built-in demo rules as offline fallback. Toggle Talk to speak out loud and hear the answer with live subtitles.',
}

const PORTFOLIO_URL = 'https://djaouad.is-a.dev'

const WORTH_TRYING = [
  {
    ask: 'What are your opening hours?',
    does: 'Reads them back from the practice profile, including the Saturday and the closed days.',
  },
  {
    ask: 'I want to book an appointment',
    does: 'Takes the name, offers two free slots, asks for a number, then confirms the booking.',
  },
  {
    ask: 'Tap the mic and ask with your voice',
    does: 'Toggle Talk, speak your question, and hear the answer back with a live subtitle — voice stays on-device.',
  },
  {
    ask: 'My tooth is broken and it hurts',
    does: 'Checks the red flags first and gives you the phone number instead of offering a slot.',
  },
  {
    ask: 'Put me through to a person',
    does: 'Hands over rather than guessing, and says roughly how long the wait is.',
  },
  {
    ask: 'How much is a check-up?',
    does: 'Answers with the prices it was given, and offers to book if you want to go ahead.',
  },
]

export default function TryPage() {
  return (
    <div id="main" tabIndex={-1} className="min-h-screen bg-bg text-fg outline-none">
      <WakeSplash />
      <SiteHeader />

      <main>
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <DemoIntake />
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-12">
            <div className="min-w-0">
              <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Talk to it yourself
              </h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-secondary">
                This is the same conversation your visitors get, for a sample dental practice in Bristol. Use the
                buttons, type your own question, or toggle Talk and ask out loud — it answers by voice with live
                subtitles. Answers use the live knowledge base when the API is reachable, with built-in demo rules as
                the offline fallback.
              </p>

              <h2 className="mt-10 text-sm font-semibold tracking-tight">Worth trying</h2>
              <div className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2">
                {WORTH_TRYING.map((item) => (
                  <div key={item.ask} className="border-t border-border pt-3">
                    <p className="text-sm font-semibold text-fg-secondary">{item.ask}</p>
                    <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{item.does}</p>
                  </div>
                ))}
              </div>

              <ul className="mt-8 space-y-2 text-sm text-fg-muted">
                {['Finished the booking? Hit reset and run it again', 'Every answer comes from the practice notes, not a guess'].map(
                  (point) => (
                    <li key={point} className="flex items-center gap-2">
                      <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" />
                      {point}
                    </li>
                  ),
                )}
              </ul>
            </div>

            <div id="demo" className="min-w-0 scroll-mt-28">
              <DemoChat />
            </div>
          </div>
        </section>

        <section className="border-t border-border px-4 py-10">
          <div className="mx-auto max-w-5xl">
            <p className="text-[15px] leading-relaxed text-fg-secondary">
              This is the practice side of the product. Point your own version at your documents and it answers the same
              way, with the prices and hours you gave it.
            </p>
            <Link
              href="/"
              className="mt-4 inline-block border border-border px-4 py-2 text-sm text-fg-secondary transition-colors hover:border-border-strong hover:text-fg"
            >
              How it works
            </Link>
          </div>
        </section>

        <section className="border-t border-border px-4 py-10">
          <div className="mx-auto max-w-5xl">
            <DemoUpload />
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
