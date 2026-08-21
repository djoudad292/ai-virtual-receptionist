'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { warmUpBackend } from '@/lib/api'
import { MessageSquare } from 'lucide-react'
import { useToast } from '@/components/toast'
import { Button, Input, Logo } from '@supportai/ui/web'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [waking, setWaking] = useState(false)
  const { login } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setWaking(true)
    try {
      await warmUpBackend()
      setWaking(false)
      await login(email, password)
      addToast('Signed in successfully', 'success')
      router.push('/dashboard')
    } catch (err: any) {
      addToast(err.message || 'Failed to sign in', 'error')
    } finally {
      setWaking(false)
      setLoading(false)
    }
  }

  return (
    <div id="main" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-bg p-4 outline-none">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <MessageSquare className="h-6 w-6 text-primary-fg" />
          </div>
          <h1 className="text-2xl font-bold text-fg">Welcome back</h1>
          <p className="mt-2 text-sm text-fg-muted">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            id="email"
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
          />
          <Input
            id="password"
            label="Password"
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
          <Button type="submit" loading={loading} fullWidth>
            {waking ? 'Waking up the assistant…' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm text-primary hover:underline">
            Forgot your password?
          </Link>
        </div>

        <p className="mt-6 text-center text-sm text-fg-muted">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
