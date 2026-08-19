'use client'

import Link from 'next/link'
import { MessageSquare, Bot, Zap, Users, CalendarClock, BarChart3, FileText, Code2, MessageCircle, Smartphone, Download } from 'lucide-react'
import { DemoChat } from '@/components/demo-chat'

const features = [
  {
    icon: Bot,
    title: 'AI Answers 24/7',
    description: 'Answers customer questions instantly around the clock using a RAG knowledge base built on pgvector.',
  },
  {
    icon: Users,
    title: 'Lead Capture',
    description: 'Automatically captures visitor contact details and saves them as leads in your pipeline.',
  },
  {
    icon: CalendarClock,
    title: 'Appointments',
    description: 'Books meetings and appointments directly in chat, with dates parsed and saved automatically.',
  },
  {
    icon: MessageSquare,
    title: 'Department Routing',
    description: 'Classifies each conversation and routes it to the right department: sales, support, billing and more.',
  },
  {
    icon: Zap,
    title: 'Real-Time Chat',
    description: 'WebSocket-powered real-time messaging with typing indicators and seamless human handoff.',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    description: 'Track conversations, AI vs human handling, leads captured and appointments booked.',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="fixed top-0 z-30 w-full border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="truncate text-base font-semibold text-foreground md:text-lg">AI Receptionist</span>
          </div>
          <div className="flex shrink-0 items-center gap-3 md:gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors md:px-4"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main id="main" tabIndex={-1} className="outline-none">
        <section className="relative overflow-hidden pt-24 pb-16 md:pt-32 md:pb-20">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="mx-auto max-w-7xl px-4 text-center md:px-6">
            <h1 className="animate-fade-in-up text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl">
              AI Virtual Receptionist
              <br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Answers, books, captures &amp; routes
              </span>
            </h1>
            <p className="animate-fade-in-up-delay-1 mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:mt-6 md:text-lg">
              An AI receptionist that answers customer questions from your knowledge base, captures leads,
              books appointments, and routes conversations to the right department &mdash; 24/7.
            </p>
            <p className="mt-3 text-xs text-muted-foreground md:text-sm">
              Powered by{' '}
              <span className="font-medium text-primary">OpenRouter</span>
              {' · '}
              <span className="font-medium text-primary">pgvector RAG</span>
              {' · '}
              <span className="font-medium text-primary">Postgres</span>
            </p>
            <div className="mt-2 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <span>Built by</span>
              <a href="https://djaouad.tech" target="_blank" rel="noopener noreferrer" className="font-bold text-primary hover:underline">
                djaouad frih
              </a>
            </div>
            <div className="animate-fade-in-up-delay-2 mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4 md:mt-10">
              <Link
                href="/register"
                className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors sm:w-auto md:px-8"
              >
                Get Started
              </Link>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="w-full rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors sm:w-auto md:px-8"
              >
                Learn More
              </button>
            </div>
          </div>
        </section>

        <section id="features" className="py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="animate-fade-in-up text-center text-2xl font-bold text-foreground md:text-3xl">
              Everything a receptionist does, automated
            </h2>
            <p className="animate-fade-in-up-delay-1 mx-auto mt-4 max-w-xl text-center text-muted-foreground">
              Answer questions, qualify visitors, book meetings and route them to the right team.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 md:mt-16">
              {features.map((feature, i) => {
                const Icon = feature.icon
                return (
                  <div
                    key={feature.title}
                    className={`animate-fade-in-up-delay-${Math.min(i + 1, 3)} group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5`}
                  >
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-foreground">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-16 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-6">
            <h2 className="text-center text-2xl font-bold text-foreground md:text-3xl">How it works</h2>
            <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
              From sign-up to first conversation in three steps.
            </p>
            <div className="mt-14 grid gap-6 md:grid-cols-3">
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">1. Add your knowledge</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your FAQ, prices, policies or product docs. The AI studies them so it can answer accurately.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Code2 className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">2. Embed the widget</h3>
                <p className="text-sm text-muted-foreground">
                  Copy one line of code from Settings and paste it into your website. A chat bubble appears instantly.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-lg font-semibold text-foreground">3. Let the AI work</h3>
                <p className="text-sm text-muted-foreground">
                  It answers questions, captures leads, books appointments and routes conversations. You just check the inbox.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-16 md:pb-20">
          <div className="mx-auto max-w-4xl px-4 md:px-6">
            <div className="rounded-2xl border border-border bg-card p-6 text-center md:p-8">
              <h2 className="text-xl font-bold text-foreground md:text-2xl">Ready to try it?</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                Create a free account, add your knowledge base, and test the live widget in minutes. No credit card needed.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
                <Link
                  href="/register"
                  className="w-full rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors sm:w-auto md:px-8"
                >
                  Get Started Free
                </Link>
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="w-full rounded-xl border border-border px-6 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors sm:w-auto md:px-8"
                >
                  See How It Works
                </button>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-muted-foreground md:px-6">
          &copy; {new Date().getFullYear()} AI Virtual Receptionist &mdash; Built by{' '}
          <a href="https://djaouad.tech" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">djaouad frih</a>
        </div>
      </footer>

      {/* Mobile App Download Section */}
      <section className="py-16 md:py-20">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8 text-center">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
                <Smartphone className="h-8 w-8 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-bold text-foreground">Get the Mobile App</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Manage conversations, view leads, and talk to your AI receptionist from your Android device.
                </p>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href="/app-release.apk"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download APK
              </a>
              <a
                href="https://github.com/djoudad292/ai-virtual-receptionist/tree/main/mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Code2 className="h-4 w-4" />
                View Source
              </a>
            </div>
          </div>
        </div>
      </section>

      <DemoChat />
    </div>
  )
}
