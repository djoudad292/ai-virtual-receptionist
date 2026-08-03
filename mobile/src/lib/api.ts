import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL, WS_URL } from './theme'

const TOKEN_KEY = 'token'

export const getApiUrl = () => API_URL
export const getSocketUrl = () => WS_URL

export async function storageGet(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return (await AsyncStorage.getItem(key)) || null
    } catch {
      return null
    }
  }
  return SecureStore.getItemAsync(key)
}

export async function storageSet(key: string, value: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value)
  } else {
    await SecureStore.setItemAsync(key, value)
  }
}

export async function storageDelete(key: string) {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key)
  } else {
    await SecureStore.deleteItemAsync(key)
  }
}

export async function getToken(): Promise<string | null> {
  return storageGet(TOKEN_KEY)
}

export async function setToken(token: string | null) {
  if (token) await storageSet(TOKEN_KEY, token)
  else await storageDelete(TOKEN_KEY)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export async function warmUpBackend(
  maxAttempts = 30,
  delayMs = 2000,
  onStatus?: (attempt: number, max: number) => void,
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    onStatus?.(attempt, maxAttempts)
    try {
      const res = await fetchWithTimeout(`${API_URL}/api/health`, {}, 15000)
      if (res.ok) return true
    } catch {
      // still booting or unreachable — keep polling
    }
    await sleep(delayMs)
  }
  return false
}

export async function apiFetch<T = any>(path: string, options?: RequestInit, { retries = 2, retryDelayMs = 2500 } = {}): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await rawFetch<T>(path, options)
    } catch (err) {
      lastError = err
      const isAuth = err instanceof Error && (err.message.includes('401') || err.message.includes('Unauthorized'))
      if (isAuth) throw err
      if (attempt < retries) await sleep(retryDelayMs)
    }
  }
  throw lastError
}

async function rawFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken()
  const body = options?.body
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const res = await fetchWithTimeout(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  }, 45000)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: 'Request failed' }))
    const err = new Error(error.message || error.error || 'Request failed')
    ;(err as any).status = res.status
    throw err
  }
  return res.json() as Promise<T>
}

export function paginate<T = any>(data: any): { items: T[]; total: number; page: number; perPage: number } {
  if (Array.isArray(data)) return { items: data as T[], total: data.length, page: 1, perPage: data.length }
  if (data && Array.isArray(data.items)) {
    return { items: data.items as T[], total: data.total ?? data.items.length, page: data.page ?? 1, perPage: data.perPage ?? data.items.length }
  }
  return { items: [], total: 0, page: 1, perPage: 50 }
}

export function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString()
  } catch {
    return ''
  }
}

export function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return ''
  }
}

export function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch {
    return ''
  }
}
