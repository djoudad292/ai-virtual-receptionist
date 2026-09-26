import Link from 'next/link'
import { Check } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'

const PORTFOLIO_URL = 'https://djaouad.is-a.dev'
const APK_URL = 'https://github.com/djoudad292/ai-virtual-receptionist/releases/download/latest-apk-receptionist/ai-receptionist.apk'

const capabilities = [
  {
    title: 'Answers from your documents',
    body: 'Upload your FAQ, price list or policies. It replies using that material and shows which document the answer came from.',
  },
  {
    title: 'Books appointments in chat',
    body: 'Collects the name, the slot and a contact number, then writes the appointment to the calendar your team already uses.',
  },
  {
    title: 'Captures leads you would otherwise lose',
    body: 'Asks for a name and number at the right moment and files the enquiry against the conversation it came from.',
  },
  {
    title: 'Routes to the right desk',
    body: 'Sales, support and billing are separated by intent, so nothing lands in one person’s inbox by accident.',
  },
  {
    title: 'Hands over to a person',
    body: 'When a question needs judgement, the conversation is flagged and assigned to an agent who can reply in the same thread.',
  },
  {
    title: 'Works on your site and your phone',
    body: 'One line of script for the website widget, plus an Android app so you can check conversations away from the desk.',
  },
]

const steps = [
  { title: 'Create an account', body: 'One workspace for your business. You can invite your team later.' },
  { title: 'Upload what you already know', body: 'A price list or an FAQ is enough to start. Documents can be marked private or published.' },
  { title: 'Paste one line of script', body: 'Settings gives you the snippet. Visitors get the chat widget on your site straight away.' },
]

export default function LandingPage() {
  return (
    <div id="main" tabIndex={-1} className="min-h-screen bg-bg text-fg outline-none">
      <SiteHeader withSectionLinks />

      <main>
        <section className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="max-w-2xl">
            <h1 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              A receptionist on your website, answering at 2am
            </h1>
            <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-secondary">
              It answers from your own documents, books appointments, captures enquiries and passes anything
              complicated to your team. The demo is the same conversation your visitors get, and it runs without an
              account.
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
              {['No card, no sales call', 'Your documents stay in your workspace', 'Cancel whenever you like'].map(
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
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">What it actually does</h2>
            <p className="mt-2 max-w-lg text-[15px] text-fg-muted">
              The parts of a front desk that eat an evening: answering the same question, writing down who called,
              finding a slot, and knowing who should pick it up.
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
