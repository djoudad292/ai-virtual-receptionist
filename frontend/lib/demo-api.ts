/**
 * Public demo API helpers. Thin typed wrappers around the `/demo/*` endpoints
 * used by the Try page: ask a question (RAG-first), upload a document, list the
 * visitor's active uploads, and list this session's appointments.
 *
 * Every call is bounded by an AbortController timeout and throws a plain Error
 * carrying the server's `message` on failure — the caller decides what to do
 * (fall back to the local rules, or surface the message to the user).
 */

import { API_URL } from '@/lib/api'

export interface DemoAskSource {
  chunkText: string
  similarity: number
  [key: string]: unknown
}

export interface DemoAskRequest {
  sessionId: string
  question: string
}

export interface DemoAskResult {
  response: string
  source: 'ai' | 'escalate'
  confidence: number
  intent: string
  department?: string | null
  lead?: Record<string, unknown> | null
  appointment?: {
    date?: string | null
    time?: string | null
    title?: string | null
    [key: string]: unknown
  } | null
  sources: DemoAskSource[]
}

export interface DemoDocument {
  id: string
  title: string
  expiresAt: string
  createdAt: string
}

export interface DemoAppointment {
  customerName?: string
  date?: string
  time?: string
  title?: string
  [key: string]: unknown
}

async function demoFetch<T>(path: string, init: RequestInit = {}, timeoutMs: number): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string> | undefined),
      },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const message = (body && (body.message || body.error)) || res.statusText || 'Request failed'
      const err = new Error(message)
      ;(err as any).status = res.status
      throw err
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Ask the receptionist a question. RAG-first: the server answers from the live
 * knowledge base (practice profile + this visitor's uploads) when reachable.
 * 15s timeout; the caller falls back to the local rules on any failure. */
export async function askDemo(sessionId: string, question: string): Promise<DemoAskResult> {
  return demoFetch<DemoAskResult>(
    '/demo/ask',
    {
      method: 'POST',
      body: JSON.stringify({ sessionId, question } satisfies DemoAskRequest),
    },
    15000,
  )
}

/** Upload a document for indexing. Field name must be `file`. 45s timeout. */
export async function uploadDemoFile(file: File): Promise<{ id: string; title: string; expiresAt: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await fetch(`${API_URL}/demo/upload`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      const message = (body && (body.message || body.error)) || res.statusText || 'Upload failed'
      const err = new Error(message)
      ;(err as any).status = res.status
      throw err
    }
    return (await res.json()) as { id: string; title: string; expiresAt: string }
  } finally {
    clearTimeout(timer)
  }
}

/** List this visitor's active (non-expired) uploads. 8s timeout. */
export async function getDemoDocuments(): Promise<{ documents: DemoDocument[] }> {
  return demoFetch<{ documents: DemoDocument[] }>('/demo/documents', {}, 8000)
}

/** List appointments booked in this browser session. 8s timeout. */
export async function getDemoAppointments(sessionId: string): Promise<{ appointments: DemoAppointment[] }> {
  return demoFetch<{ appointments: DemoAppointment[] }>(
    `/demo/appointments?sessionId=${encodeURIComponent(sessionId)}`,
    {},
    8000,
  )
}

/** Stable per-mount session id, rendered into state only (never into HTML). */
export function createDemoSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}