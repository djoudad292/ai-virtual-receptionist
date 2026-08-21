'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { MessageSquare, MailCheck } from 'lucide-react'
import { useToast } from '@/components/toast'
import { Button, Input, Card } from '@supportai/ui/web'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const { addToast } = useToast()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } catch (err: any) {
      addToast(err.message || 'Something went wrong', 'error')
    } finally {
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
          <h1 className="text-2xl font-bold text-fg">Forgot your password?</h1>
          <p className="mt-2 text-sm text-fg-muted">We&apos;ll email you a link to reset it</p>
        </div>

        <Card className="p-6">
          {sent ? (
            <div className="flex flex-col items-center text-center py-4">
              <MailCheck className="h-12 w-12 text-success mb-3" />
              <h2 className="text-lg font-semibold text-fg">Check your inbox</h2>
              <p className="mt-2 text-sm text-fg-muted">
                If an account exists for {email}, you will receive a reset link shortly.
              </p>
              <Link href="/login" className="mt-4 text-sm font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input id="email" label="Email" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
              <Button type="submit" loading={loading} fullWidth>Send Reset Link</Button>
              <p className="text-center text-sm text-fg-muted">
                Remembered it?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
