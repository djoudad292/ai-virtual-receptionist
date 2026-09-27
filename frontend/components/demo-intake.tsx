'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Contact,
  Mail,
  NotebookPen,
  Phone,
  Save,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getDemoSessionId } from '@/lib/demo-session'
import {
  type DemoIntake,
  dispatchIntakeSaved,
  getDemoIntake,
  loadDraft,
  saveDraft,
  saveDemoIntake,
} from '@/lib/demo-intake'

const TITLES = ['', 'Mr', 'Mrs', 'Ms', 'Dr', 'Prof']

const emptyForm: DemoIntake = {
  title: '',
  fullName: '',
  phone: '',
  email: '',
  preferredAt: '',
  reason: '',
}

type SaveState = 'idle' | 'saving' | 'saved' | 'local'

const SAVE_LABEL: Record<SaveState, string> = {
  idle: 'Save details',
  saving: 'Saving…',
  saved: 'Details saved — the receptionist will use them',
  local: 'Saved locally — syncing when the server wakes',
}

function toDateTimeLocal(value: string): string {
  if (!value) return ''
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(value)
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : ''
}

function validate(form: DemoIntake): Record<string, string> {
  const e: Record<string, string> = {}
  if (!form.fullName || form.fullName.length < 1 || form.fullName.length > 100) {
    e.fullName = 'Full name is required (up to 100 characters)'
  }
  if (!TITLES.includes(form.title)) e.title = 'Select a title'
  if (form.phone && form.phone.length > 32) e.phone = 'Phone must be 32 characters or fewer'
  if (form.email) {
    if (form.email.length > 120) e.email = 'Email is too long'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address'
  }
  if (form.preferredAt) {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(form.preferredAt) || Number.isNaN(new Date(form.preferredAt).getTime())) {
      e.preferredAt = 'Enter a valid date and time'
    }
  }
  if (form.reason.length > 500) e.reason = 'Reason must be 500 characters or fewer'
  return e
}

const inputCls =
  'mt-1 block w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-border-strong focus:outline-none'

export function DemoIntake() {
  const [form, setForm] = useState<DemoIntake>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const formRef = useRef(form)
  const retryRef = useRef<number | null>(null)

  useEffect(() => {
    formRef.current = form
  }, [form])

  // Restore the draft and reconcile a saved server row on mount. All window
  // access happens here (client-only) so the static-export first paint stays
  // hydration-clean.
  useEffect(() => {
    const draft = loadDraft()
    if (draft) setForm(draft)

    const sid = getDemoSessionId()
    getDemoIntake(sid).then((server) => {
      if (!server) return
      const normalized: DemoIntake = { ...server, preferredAt: toDateTimeLocal(server.preferredAt) }
      setForm(normalized)
      saveDraft(normalized)
      setSaveState('saved')
      dispatchIntakeSaved(normalized)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const clearRetry = () => {
    if (retryRef.current !== null) {
      clearInterval(retryRef.current)
      retryRef.current = null
    }
  }

  const startRetry = () => {
    clearRetry()
    const id = window.setInterval(async () => {
      try {
        const sid = getDemoSessionId()
        await saveDemoIntake(sid, formRef.current)
        saveDraft(formRef.current)
        dispatchIntakeSaved(formRef.current)
        setSaveState('saved')
        clearRetry()
      } catch {
        // still asleep — keep syncing on the next tick
      }
    }, 5000)
    retryRef.current = id
  }

  const onSave = async () => {
    const errs = validate(form)
    setErrors(errs)
    if (Object.keys(errs).length > 0) return
    setSaveState('saving')
    try {
      const sid = getDemoSessionId()
      await saveDemoIntake(sid, form)
      saveDraft(form)
      dispatchIntakeSaved(form)
      setSaveState('saved')
    } catch {
      // Backend is likely asleep (Render free tier). Keep the data locally and
      // retry until the server wakes — the draft survives the splash reload.
      setSaveState('local')
      startRetry()
    }
  }

  const updateField = (field: keyof DemoIntake, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    const nextErrs = { ...errors }
    delete nextErrs[field]
    setErrors(nextErrs)
    setSaveState('idle')
    clearRetry()
  }

  useEffect(() => clearRetry, [])

  const submitting = saveState === 'saving' || saveState === 'local'

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <header className="mb-5 flex items-start gap-3">
        <NotebookPen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <h2 className="text-base font-semibold text-fg">Visitor intake</h2>
          <p className="mt-1 text-sm text-fg-secondary">
            Saved to the practice database — the receptionist answers with these details
          </p>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          onSave()
        }}
        className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2"
      >
        <div>
          <label htmlFor="intake-title" className="flex items-center gap-2 text-sm font-medium text-fg">
            <User className="h-4 w-4 text-fg-muted" />
            Title
          </label>
          <select
            id="intake-title"
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            aria-describedby={errors.title ? 'intake-title-error' : undefined}
            aria-invalid={!!errors.title}
            className={inputCls}
          >
            {TITLES.map((t) => (
              <option key={t || '__placeholder'} value={t}>
                {t || '—'}
              </option>
            ))}
          </select>
          {errors.title && (
            <p id="intake-title-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.title}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="intake-fullName" className="flex items-center gap-2 text-sm font-medium text-fg">
            <Contact className="h-4 w-4 text-fg-muted" />
            Full name <span aria-hidden className="text-primary">*</span>
          </label>
          <input
            id="intake-fullName"
            type="text"
            maxLength={100}
            value={form.fullName}
            onChange={(e) => updateField('fullName', e.target.value)}
            placeholder="Jane Nichols"
            aria-describedby={errors.fullName ? 'intake-fullName-error' : undefined}
            aria-invalid={!!errors.fullName}
            className={inputCls}
          />
          {errors.fullName && (
            <p id="intake-fullName-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.fullName}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="intake-reason" className="flex items-center gap-2 text-sm font-medium text-fg">
            <ClipboardList className="h-4 w-4 text-fg-muted" />
            Reason for visit
          </label>
          <textarea
            id="intake-reason"
            rows={3}
            maxLength={500}
            value={form.reason}
            onChange={(e) => updateField('reason', e.target.value)}
            placeholder="A check-up, a toothache, a cleaning…"
            aria-describedby={errors.reason ? 'intake-reason-error' : undefined}
            aria-invalid={!!errors.reason}
            className={cn(inputCls, 'resize-y')}
          />
          {errors.reason && (
            <p id="intake-reason-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.reason}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="intake-phone" className="flex items-center gap-2 text-sm font-medium text-fg">
            <Phone className="h-4 w-4 text-fg-muted" />
            Phone
          </label>
          <input
            id="intake-phone"
            type="tel"
            maxLength={32}
            value={form.phone}
            onChange={(e) => updateField('phone', e.target.value)}
            placeholder="07700 900123"
            aria-describedby={errors.phone ? 'intake-phone-error' : undefined}
            aria-invalid={!!errors.phone}
            className={inputCls}
          />
          {errors.phone && (
            <p id="intake-phone-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.phone}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="intake-preferredAt" className="flex items-center gap-2 text-sm font-medium text-fg">
            <CalendarClock className="h-4 w-4 text-fg-muted" />
            Preferred appointment
          </label>
          <input
            id="intake-preferredAt"
            type="datetime-local"
            value={form.preferredAt}
            onChange={(e) => updateField('preferredAt', e.target.value)}
            aria-describedby={errors.preferredAt ? 'intake-preferredAt-error' : undefined}
            aria-invalid={!!errors.preferredAt}
            className={inputCls}
          />
          {errors.preferredAt && (
            <p id="intake-preferredAt-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.preferredAt}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="intake-email" className="flex items-center gap-2 text-sm font-medium text-fg">
            <Mail className="h-4 w-4 text-fg-muted" />
            Email
          </label>
          <input
            id="intake-email"
            type="email"
            maxLength={120}
            value={form.email}
            onChange={(e) => updateField('email', e.target.value)}
            placeholder="jane@example.com"
            aria-describedby={errors.email ? 'intake-email-error' : undefined}
            aria-invalid={!!errors.email}
            className={inputCls}
          />
          {errors.email && (
            <p id="intake-email-error" role="alert" className="mt-1 text-xs text-danger">
              {errors.email}
            </p>
          )}
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={submitting}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors',
              submitting
                ? 'cursor-wait border border-border bg-surface text-fg-secondary opacity-80'
                : 'bg-primary text-primary-fg hover:bg-primary-strong disabled:opacity-40',
            )}
          >
            {saveState === 'saved' ? (
              <CheckCircle2 className="h-4 w-4 text-success" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {SAVE_LABEL[saveState]}
          </button>
        </div>
      </form>
    </section>
  )
}
