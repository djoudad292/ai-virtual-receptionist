import { API_URL } from '@/lib/api'

export interface DemoIntake {
  title: string
  fullName: string
  phone: string
  email: string
  preferredAt: string
  reason: string
}

export const INTAKE_SAVED_EVENT = 'receptionist-intake-saved'

const DRAFT_KEY = 'receptionist-intake-draft'

/** Restore the last in-progress draft from sessionStorage (tolerates corruption). */
export function loadDraft(): DemoIntake | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && typeof (parsed as Partial<DemoIntake>).fullName === 'string') {
      return parsed as DemoIntake
    }
    return null
  } catch {
    return null
  }
}

/** Persist the current draft so it survives the splash reload loop. */
export function saveDraft(d: DemoIntake): void {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d))
  } catch {
    // best-effort
  }
}

/** Drop the saved draft. Kept for completeness; the intake form intentionally
 * keeps the draft in sync with the server row rather than clearing it. */
export function clearDraft(): void {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY)
  } catch {
    // best-effort
  }
}

/** Mirrors askDemo/demoFetch from ./demo-api: AbortController timeout, throws an
 * Error carrying `status` on non-2xx, parses JSON. */
async function intakeFetch<T>(path: string, init: RequestInit = {}, timeoutMs = 15000): Promise<T> {
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
      ;(err as Error & { status: number }).status = res.status
      throw err
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

/** Persist a visitor's intake form to the practice database (RAG context). */
export async function saveDemoIntake(sessionId: string, data: DemoIntake): Promise<void> {
  await intakeFetch('/demo/intake', {
    method: 'POST',
    body: JSON.stringify({ sessionId, ...data }),
  })
}

/** Read a previously saved intake for this session. null on 404/missing/error. */
export async function getDemoIntake(sessionId: string): Promise<DemoIntake | null> {
  try {
    return await intakeFetch<DemoIntake>(
      `/demo/intake?sessionId=${encodeURIComponent(sessionId)}`,
      {},
      8000,
    )
  } catch {
    return null
  }
}

export function dispatchIntakeSaved(d: DemoIntake): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(INTAKE_SAVED_EVENT, { detail: d }))
}

export function onIntakeSaved(cb: (d: DemoIntake) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent<DemoIntake>).detail)
  window.addEventListener(INTAKE_SAVED_EVENT, handler as EventListener)
  return () => window.removeEventListener(INTAKE_SAVED_EVENT, handler as EventListener)
}
