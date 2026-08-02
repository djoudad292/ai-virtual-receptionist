const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ai-receptionist-backend-h14q.onrender.com'

export async function apiFetch(path: string, options?: RequestInit) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    throw new Error(error.message || error.error || 'Request failed')
  }
  return res.json()
}

export function getApiUrl() {
  return API_URL
}

export function getSocketUrl() {
  return process.env.NEXT_PUBLIC_WS_URL || API_URL
}
