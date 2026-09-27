'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { API_URL } from '@/lib/api'

const POLL_MS = 2500
const REQUEST_TIMEOUT_MS = 9000
const MIN_SPLASH_MS = 700
const CONTINUE_AFTER_MS = 45000
const FADE_MS = 350
const RELOAD_AFTER_MS = 10000
const SPLASH_DISMISSED_KEY = 'receptionist-try-splash-dismissed'

function isSplashDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(SPLASH_DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

function markSplashDismissed(): void {
  try {
    window.sessionStorage.setItem(SPLASH_DISMISSED_KEY, '1')
  } catch {
    // storage unavailable (e.g. private mode) — best effort only
  }
}

type Overlay = 'shown' | 'fading' | 'gone'

/**
 * Full-screen wake splash for /try. The backend is a Render free instance
 * that sleeps between pings, so a first-time visitor can wait a while before
 * the chat answers. This keeps them on a branded screen until /health responds,
 * with a 10s reload loop and an escape hatch so nobody is trapped.
 */
export function WakeSplash() {
  const [overlay, setOverlay] = useState<Overlay>(
    isSplashDismissed() ? 'gone' : 'shown',
  )
  const [elapsedMs, setElapsedMs] = useState(0)

  const startedAtRef = useRef(0)
  const dismissedRef = useRef(false)
  const timeoutIdsRef = useRef<number[]>([])
  const reloadTimerRef = useRef<number | null>(null)

  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms)
    timeoutIdsRef.current.push(id)
  }, [])

  const clearReloadTimer = useCallback(() => {
    if (reloadTimerRef.current !== null) {
      window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = null
    }
  }, [])

  // Auto dismissal: probe success. No persistence — only explicit user
  // dismissals survive the 10s reload loop.
  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    clearReloadTimer()
    const wait = Math.max(0, MIN_SPLASH_MS - (Date.now() - startedAtRef.current))
    later(() => {
      setOverlay('fading')
      later(() => setOverlay('gone'), FADE_MS)
    }, wait)
  }, [later, clearReloadTimer])

  // User dismissal: Esc or "Enter anyway". Persists across the reload loop.
  const dismissUser = useCallback(() => {
    markSplashDismissed()
    dismiss()
  }, [dismiss])

  // Start the clock and poll the backend until it answers (CORS is open: *).
  useEffect(() => {
    startedAtRef.current = Date.now()
    let cancelled = false
    let retryId = 0
    let inflight: AbortController | null = null

    // If the visitor hasn't dismissed the splash, give the backend 10s to
    // respond before reloading — the fresh load restarts the cycle, stopping
    // only when /health answers or the user dismisses. The dismissedRef guard
    // also prevents rescheduling during the fade-out.
    if (overlay !== 'gone' && !dismissedRef.current) {
      reloadTimerRef.current = window.setTimeout(() => {
        window.location.reload()
      }, RELOAD_AFTER_MS)
    }

    const probe = async () => {
      inflight?.abort()
      const ctrl = new AbortController()
      inflight = ctrl
      const hardStop = window.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
      try {
        const res = await fetch(`${API_URL}/api/health`, {
          signal: ctrl.signal,
          cache: 'no-store',
        })
        if (res.ok) {
          window.clearTimeout(hardStop)
          clearReloadTimer()
          if (!cancelled) dismiss()
          return
        }
      } catch {
        // asleep or unreachable — poll again
      }
      window.clearTimeout(hardStop)
      if (!cancelled) retryId = window.setTimeout(probe, POLL_MS)
    }
    void probe()

    return () => {
      cancelled = true
      window.clearTimeout(retryId)
      clearReloadTimer()
      inflight?.abort()
    }
  }, [overlay, dismiss, clearReloadTimer])

  // Elapsed clock for the status copy; stops once the splash is gone.
  useEffect(() => {
    if (overlay === 'gone') return
    const iv = window.setInterval(
      () => setElapsedMs(Date.now() - startedAtRef.current),
      500,
    )
    return () => window.clearInterval(iv)
  }, [overlay])

  // Esc leaves the splash (user-initiated: persists across the reload loop).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismissUser()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissUser])

  // Clear pending fades if the page unloads mid-transition.
  useEffect(
    () => () => {
      timeoutIdsRef.current.forEach((id) => window.clearTimeout(id))
    },
    [],
  )

  // Body scroll lock while visible; restore the previous overflow on unmount.
  useEffect(() => {
    if (overlay === 'gone') return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [overlay])

  const sec = Math.floor(elapsedMs / 1000)
  const statusText =
    sec < 15
      ? 'Waking the live demo server…'
      : sec < 45
        ? 'Free servers sleep after quiet periods — the first wake usually takes under a minute.'
        : 'Still starting. Enter anyway and the chat appears the moment it connects.'
  const showContinue = sec >= CONTINUE_AFTER_MS / 1000 && overlay === 'shown'

  if (overlay === 'gone') return null

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center px-6 transition-opacity duration-300 ${
        overlay === 'fading' ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'var(--bg)' }}
      role="status"
      aria-live="polite"
    >
      <div className="w-full max-w-[20rem] text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-fg-muted">
          Receptionist
        </div>
        <div className="mt-2 text-[15px] font-medium text-fg">
          AI Receptionist · live demo
        </div>
        <div className="mt-8 flex justify-center">
          <span
            className="h-6 w-6 animate-spin rounded-full border-2 border-border-strong border-t-primary"
            aria-hidden="true"
          />
        </div>
        <p className="mt-6 text-[13px] leading-relaxed text-fg-secondary">
          {statusText}
        </p>
        <p
          className="mt-1.5 text-[11px] tabular-nums text-fg-muted"
          aria-hidden="true"
        >
          {sec}s
        </p>
        {showContinue && (
          <button
            type="button"
            onClick={dismissUser}
            className="mt-6 rounded-md border border-border-strong bg-surface px-4 py-2 text-[13px] font-medium text-fg transition-colors hover:border-primary hover:text-primary"
          >
            Enter anyway
          </button>
        )}
      </div>
    </div>
  )
}