'use client'

import type { Tab } from '@/lib/workspace'
import { Rocket, BookOpen, MessageSquare, Users, CalendarClock, BarChart3, Settings, Send, Smartphone, Download } from 'lucide-react'

const sections = [
  {
    id: 'start',
    icon: Rocket,
    title: 'Getting Started',
    color: 'text-success bg-success/10',
    steps: [
      'Create your account (or sign in). Sales, Support and Billing departments are created for you automatically.',
      'Add knowledge base documents so the AI has real facts about your business to answer from.',
      'Copy the widget embed code from Settings and paste it into your website.',
      'Click "Talk to your AI" for a hands-free voice conversation, or use the embedded widget on your site to test the AI with a text chat.',
    ],
  },
  {
    id: 'inbox',
    icon: MessageSquare,
    title: 'Inbox',
    color: 'text-primary bg-primary/10',
    steps: [
      'All conversations with your visitors appear here in real time.',
      'Click "Talk to your AI" for a hands-free voice conversation with your AI, just like ChatGPT or Gemini — tap the mic, speak, and follow along with live subtitles.',
      'Click a conversation to read the full history and reply live.',
      'Click "Take over" to pause the AI and chat with the visitor yourself.',
      'Use "Resolve" to mark a conversation as finished.',
    ],
  },
  {
    id: 'knowledge',
    icon: BookOpen,
    title: 'Knowledge Base',
    color: 'text-purple-400 bg-purple-500/10',
    steps: [
      'This is the AI\'s memory. Add documents about your products, prices, hours and policies.',
      'Each document is automatically split into chunks, embedded, and stored in a vector database.',
      'When a visitor asks a question, the AI retrieves the most relevant chunks and answers with citations.',
      'Use "Re-index" after editing a document so the AI picks up the changes.',
      'The search bar lets you test what the AI can find for a given question.',
    ],
  },
  {
    id: 'leads',
    icon: Users,
    title: 'Leads',
    color: 'text-orange-400 bg-orange-500/10',
    steps: [
      'When a visitor shares their name, email or phone in chat, the AI saves it as a lead.',
      'Review captured contacts, edit their details, and change their status.',
      'Export or follow up with leads however you like.',
    ],
  },
  {
    id: 'appointments',
    icon: CalendarClock,
    title: 'Appointments',
    color: 'text-yellow-400 bg-yellow-500/10',
    steps: [
      'Visitors can book meetings directly in chat, e.g. "book me tomorrow at 14:00".',
      'The AI parses relative dates and times and saves the appointment.',
      'Review all bookings here and update their status (scheduled / completed / cancelled).',
    ],
  },
  {
    id: 'analytics',
    icon: BarChart3,
    title: 'Analytics',
    color: 'text-cyan-400 bg-cyan-500/10',
    steps: [
      'See how your receptionist is performing: total conversations, active chats, unresolved threads.',
      'Track how many conversations were handled by the AI vs by a human.',
      'Monitor leads captured and appointments booked over time.',
    ],
  },
  {
    id: 'settings',
    icon: Settings,
    title: 'Settings',
    color: 'text-fg-muted bg-slate-500/10',
    steps: [
      'Departments: manage the teams the AI routes conversations to (Sales, Support, Billing...).',
      'Widget embed code: the one-line script to add the chat widget to your website.',
      'Company settings: advanced configuration stored as JSON for power users.',
    ],
  },
  {
    id: 'tips',
    icon: Send,
    title: 'Tips for better answers',
    color: 'text-danger bg-danger/10',
    steps: [
      'Write clear, complete knowledge base content. The AI can only answer what it knows.',
      'Include prices, hours, contact info and common questions in your documents.',
      'Keep documents focused on one topic each for better retrieval.',
      'Test questions yourself in the widget before launching it to visitors.',
      'Watch the Inbox and take over conversations whenever a human touch is needed.',
    ],
  },
]

export default function GuideView({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  return (
    <div className="p-4 md:p-6 max-w-4xl">
      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-xl font-bold text-foreground">How to use your AI Receptionist</h2>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          This platform puts an AI receptionist on your website. It answers visitor questions from your
          knowledge base, captures leads, books appointments and routes conversations to departments.
          Everything the AI does lands in this dashboard, where you can review it and take over any time.
        </p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon
          return (
            <div key={section.id} className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${section.color}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
              </div>
              <ol className="space-y-2">
                {section.steps.map((step, i) => (
                  <li key={i} className="flex gap-2.5 text-sm text-muted-foreground">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-6">
        <div>
          <p className="text-sm font-semibold text-foreground">Ready to set it up?</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Start by adding your knowledge base, then embed the widget.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onNavigate('knowledge')}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Add Documents
          </button>
          <button
            onClick={() => onNavigate('settings')}
            className="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            Get Embed Code
          </button>
        </div>
      </div>

      {/* Mobile App Download */}
      <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-foreground">Get the Mobile App</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Manage conversations, view leads, and talk to your AI receptionist from your Android device.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href="/app-release.apk"
                download
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download APK
              </a>
              <a
                href="https://github.com/djoudad292/ai-virtual-receptionist/tree/main/mobile"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                View Source
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
