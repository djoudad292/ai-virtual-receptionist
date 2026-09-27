import { createDemoSessionId } from '@/lib/demo-api'

const STORAGE_KEY = 'receptionist-demo-session'
const SESSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/

/**
 * Stable per-browser-session demo session id.
 *
 * The id is persisted to sessionStorage so the wake-splash 10s reload loop (and
 * any other hard refresh) keeps the same id — keeping visitor intake, uploads
 * and appointments linked across mounts. A stale or malformed value is ignored
 * and regenerated. On the server (no window) an ephemeral id is returned; the
 * client re-evaluates it on first paint and persists it for subsequent loads.
 */
export function getDemoSessionId(): string {
  if (typeof window === 'undefined') return createDemoSessionId()
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    if (stored && SESSION_ID_RE.test(stored)) return stored
  } catch {
    // sessionStorage blocked (e.g. private mode) — fall through to a fresh id
  }
  const id = createDemoSessionId()
  try {
    window.sessionStorage.setItem(STORAGE_KEY, id)
  } catch {
    // best-effort persistence
  }
  return id
}
