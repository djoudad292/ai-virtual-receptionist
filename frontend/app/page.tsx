'use client'

import Link from 'next/link'
import { MessageSquare, Bot, Zap, Users, CalendarClock, BarChart3 } from 'lucide-react'
import ChatWidgetPreview from '@/components/chat-widget-preview'

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
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <MessageSquare className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold text-foreground">AI Receptionist</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden pt-32 pb-20">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
          <div className="mx-auto max-w-7xl px-6 text-center">
            <h1 className="animate-fade-in-up text-5xl font-bold tracking-tight text-foreground md:text-6xl">
              AI Virtual Receptionist
              <br />
              <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
                Answers, books, captures &amp; routes
              </span>
            </h1>
            <p className="animate-fade-in-up-delay-1 mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              An AI receptionist that answers customer questions from your knowledge base, captures leads,
              books appointments, and routes conversations to the right department &mdash; 24/7.
            </p>
            <p className="mt-3 text-sm text-muted-foreground">
              Powered by{' '}
              <span className="font-medium text-primary">OpenRouter</span>
              {' · '}
              <span className="font-medium text-primary">pgvector RAG</span>
              {' · '}
              <span className="font-medium text-primary">Postgres</span>
              <br />
              Built by{' '}
              <a href="https://djaouad.tech" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">djaouad frih</a>
            </p>
            <div className="animate-fade-in-up-delay-2 mt-10 flex items-center justify-center gap-4">
              <Link
                href="/register"
                className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Get Started
              </Link>
              <button
                onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
                className="rounded-xl border border-border px-8 py-3 text-sm font-semibold text-foreground hover:bg-secondary transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>
        </section>

        <section id="features" className="py-20">
          <div className="mx-auto max-w-7xl px-6">
            <h2 className="animate-fade-in-up text-center text-3xl font-bold text-foreground">
              Everything a receptionist does, automated
            </h2>
            <p className="animate-fade-in-up-delay-1 mx-auto mt-4 max-w-xl text-center text-muted-foreground">
              Answer questions, qualify visitors, book meetings and route them to the right team.
            </p>
            <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      </main>

      <footer className="border-t border-border py-8">
        <div className="mx-auto max-w-7xl px-6 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} AI Virtual Receptionist &mdash; Built by{' '}
          <a href="https://djaouad.tech" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary hover:underline">djaouad frih</a>
        </div>
      </footer>

      <ChatWidgetPreview />
    </div>
  )
}
