'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'
import { warmUpBackend } from '@/lib/api'
import { MessageSquare } from 'lucide-react'
import { useToast } from '@/components/toast'
import { Button, Input } from '@supportai/ui/web'

export default function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [waking, setWaking] = useState(false)
  const { register } = useAuth()
  const { addToast } = useToast()
  const router = useRouter()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setWaking(true)
    try {
      await warmUpBackend()
      setWaking(false)
      await register(name, email, password, companyName)
      addToast('Account created successfully', 'success')
      router.push('/dashboard')
    } catch (err: any) {
      addToast(err.message || 'Failed to create account', 'error')
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
          <h1 className="text-2xl font-bold text-fg">Create your account</h1>
          <p className="mt-2 text-sm text-fg-muted">Start with your AI receptionist for free</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input id="name" label="Full Name" type="text" name="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" required />
          <Input id="email" label="Email" type="email" name="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required />
          <Input id="password" label="Password" type="password" name="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" required />
          <Input id="companyName" label="Company Name" type="text" name="companyName" autoComplete="organization" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Inc." required />
          <Button type="submit" loading={loading} fullWidth>
            {waking ? 'Waking up the assistant…' : 'Create Account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-fg-muted">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
