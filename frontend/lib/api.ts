const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai-receptionist-backend-h14q.onrender.com'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Wakes a sleeping free-tier backend before real requests are made.
// The first /api/health call boots the instance; we poll until it answers.
export async function warmUpBackend(maxAttempts = 40, delayMs = 2000) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30000)
      const res = await fetch(`${API_URL}/api/health`, { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) return true
    } catch {
      // still booting (connection refused / timeout) — keep waiting
    }
    await sleep(delayMs)
  }
  return false
}

export async function apiFetch(path: string, options?: RequestInit, { retries = 2, retryDelayMs = 2500 } = {}) {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await rawFetch(path, options)
    } catch (err) {
      lastError = err
      const isAuth = err instanceof Error && (err.message.includes('401') || err.message.includes('Unauthorized'))
      if (isAuth) throw err // don't retry auth failures
      if (attempt < retries) await sleep(retryDelayMs)
    }
  }
  throw lastError
}

async function rawFetch(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const isFormData = typeof FormData !== 'undefined' && options?.body instanceof FormData
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    const err = new Error(error.message || error.error || 'Request failed')
    ;(err as any).status = res.status
    throw err
  }
  return res.json()
}

export function getApiUrl() {
  return API_URL
}

export function getSocketUrl() {
  return process.env.NEXT_PUBLIC_WS_URL || API_URL
}

// Normalizes paginated responses ({items, total, page, perPage}) and plain arrays
// into {items, total, page, perPage} for consistent consumption in views.
export function paginate<T = any>(data: any): { items: T[]; total: number; page: number; perPage: number } {
  if (Array.isArray(data)) return { items: data as T[], total: data.length, page: 1, perPage: data.length }
  if (data && Array.isArray(data.items)) {
    return { items: data.items as T[], total: data.total ?? data.items.length, page: data.page ?? 1, perPage: data.perPage ?? data.items.length }
  }
  return { items: [], total: 0, page: 1, perPage: 50 }
}
