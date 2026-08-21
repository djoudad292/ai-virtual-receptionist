'use client'

import { useState, Suspense, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { MessageSquare, CheckCircle2 } from 'lucide-react'
import { useToast } from '@/components/toast'
import { Button, Input, Card } from '@supportai/ui/web'

function ResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { addToast } = useToast()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) {
      addToast('Password must be at least 8 characters', 'error')
      return
    }
    if (password !== confirm) {
      addToast('Passwords do not match', 'error')
      return
    }
    setLoading(true)
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, newPassword: password }),
      })
      setDone(true)
      addToast('Password updated. Sign in with your new password.', 'success')
      setTimeout(() => router.push('/login'), 1800)
    } catch (err: any) {
      addToast(err.message || 'Failed to reset password', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="h-12 w-12 text-success mb-3" />
        <h2 className="text-xl font-bold text-fg">Password updated</h2>
        <p className="mt-2 text-sm text-fg-muted">Redirecting you to sign in…</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input id="password" label="New Password" type="password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} />
      <Input id="confirm" label="Confirm Password" type="password" name="confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat your new password" required />
      <Button type="submit" loading={loading} fullWidth>Reset Password</Button>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <div id="main" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-bg p-4 outline-none">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <MessageSquare className="h-6 w-6 text-primary-fg" />
          </div>
          <h1 className="text-2xl font-bold text-fg">Choose a new password</h1>
          <p className="mt-2 text-sm text-fg-muted">Make it strong and unique</p>
        </div>

        <Card className="p-6">
          <Suspense fallback={<div className="py-8 text-center text-sm text-fg-muted">Loading…</div>}>
            <ResetForm />
          </Suspense>
          <p className="mt-4 text-center text-sm text-fg-muted">
            <Link href="/login" className="font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
