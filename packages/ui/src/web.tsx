'use client'

/**
 * @supportai/ui — Web component library (React DOM + Tailwind, token-driven).
 * Import from '@supportai/ui/web'.
 */
import React, { useEffect, useId, useRef } from 'react'

/* ---------------------------------- Button --------------------------------- */

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

const buttonBase =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-200 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] ' +
  'disabled:opacity-50 disabled:pointer-events-none select-none whitespace-nowrap'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'text-white bg-[image:var(--gradient-primary)] hover:brightness-110 active:brightness-95 shadow-[0_8px_24px_-8px_rgba(99,102,241,0.55)]',
  secondary:
    'bg-[var(--primary-soft)] text-[var(--primary)] border border-[color-mix(in_srgb,var(--primary)_28%,transparent)] hover:bg-[color-mix(in_srgb,var(--primary)_22%,transparent)]',
  outline:
    'border border-[var(--border-strong)] text-[var(--fg)] bg-transparent hover:bg-[var(--surface-hover)]',
  ghost: 'text-[var(--fg-secondary)] hover:text-[var(--fg)] hover:bg-[var(--surface-hover)]',
  danger:
    'bg-[var(--danger-soft)] text-[var(--danger)] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--danger)_20%,transparent)]',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-sm min-h-[36px]',
  md: 'h-11 px-5 text-[15px] min-h-[44px]',
  lg: 'h-12 px-6 text-base min-h-[48px]',
}

export interface ButtonProps {
  children?: React.ReactNode
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && <Spinner size={16} />}
      {children}
    </button>
  )
}

/* ------------------------------ Form controls ------------------------------ */

export function Label({
  htmlFor,
  children,
  className = '',
}: {
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={`block text-sm font-semibold text-[var(--fg)] mb-1.5 ${className}`}
    >
      {children}
    </label>
  )
}

const fieldBase =
  'w-full rounded-xl bg-[var(--surface-alt)] border text-[15px] text-[var(--fg)] placeholder:text-[var(--fg-muted)] ' +
  'transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:border-transparent'

export interface InputProps {
  label?: string
  error?: string
  id?: string
  type?: string
  value?: string | number
  placeholder?: string
  required?: boolean
  disabled?: boolean
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void
  className?: string
  autoFocus?: boolean
  min?: string | number
  max?: string | number
  step?: string | number
  name?: string
  autoComplete?: string
  minLength?: number
  maxLength?: number
}

export function Input({ label, error, className = '', id, ...rest }: InputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="mb-4">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${fieldBase} h-11 px-3.5 ${
          error
            ? 'border-[var(--danger)]'
            : 'border-[var(--border)] focus:border-transparent'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  )
}

export interface TextareaProps {
  label?: string
  error?: string
  id?: string
  rows?: number
  value?: string | number
  placeholder?: string
  required?: boolean
  disabled?: boolean
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLTextAreaElement>) => void
  className?: string
  name?: string
}

export function Textarea({ label, error, className = '', id, rows = 4, ...rest }: TextareaProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  return (
    <div className="mb-4">
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <textarea
        id={inputId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`${fieldBase} px-3.5 py-2.5 ${
          error ? 'border-[var(--danger)]' : 'border-[var(--border)] focus:border-transparent'
        } ${className}`}
        {...rest}
      />
      {error && (
        <p id={errorId} role="alert" className="mt-1.5 text-sm text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  )
}

/* ----------------------------------- Card ---------------------------------- */

export function Card({
  children,
  className = '',
  interactive = false,
}: {
  children: React.ReactNode
  className?: string
  interactive?: boolean
}) {
  return (
    <div
      className={`rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_3px_0_rgb(2_6_16/0.32)] ${
        interactive
          ? 'hover:border-[var(--border-strong)] hover:bg-[var(--surface-alt)] transition-colors duration-200'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex items-center justify-between gap-3 px-5 pt-5 pb-3 ${className}`}>{children}</div>
}

export function CardTitle({
  children,
  as: Tag = 'h3',
  className = '',
}: {
  children: React.ReactNode
  as?: 'h1' | 'h2' | 'h3' | 'h4'
  className?: string
}) {
  return <Tag className={`text-lg font-bold tracking-tight text-[var(--fg)] ${className}`}>{children}</Tag>
}

export function CardContent({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 pb-5 ${className}`}>{children}</div>
}

/* ---------------------------------- Badge ---------------------------------- */

export type BadgeTone = 'primary' | 'success' | 'warning' | 'danger' | 'violet' | 'accent' | 'neutral'

const badgeTones: Record<BadgeTone, string> = {
  primary: 'bg-[var(--primary-soft)] text-[var(--primary)]',
  success: 'bg-[var(--success-soft)] text-[var(--success)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger)]',
  violet: 'bg-[var(--violet-soft)] text-[var(--violet)]',
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  neutral: 'bg-[var(--surface-hover)] text-[var(--fg-secondary)]',
}

export function Badge({
  children,
  tone = 'neutral',
  className = '',
}: {
  children: React.ReactNode
  tone?: BadgeTone
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${badgeTones[tone]} ${className}`}
    >
      {children}
    </span>
  )
}

/* ---------------------------------- Modal ---------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  closeLabel = 'Close dialog',
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  closeLabel?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-[var(--overlay)] backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="relative w-full max-w-lg rounded-2xl border border-[var(--border-strong)] bg-[var(--surface)] shadow-[0_12px_28px_-6px_rgb(2_6_16/0.45)] outline-none max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-[var(--fg)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-[var(--border)] px-5 py-4">{footer}</div>
        )}
      </div>
    </div>
  )
}

/* --------------------------------- Feedback -------------------------------- */

export function Spinner({ size = 20, label }: { size?: number; label?: string }) {
  return (
    <span role="status" aria-label={label ?? 'Loading'} className="inline-flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon?: React.ReactNode
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
          {icon}
        </div>
      )}
      <p className="text-base font-semibold text-[var(--fg)]">{title}</p>
      {subtitle && <p className="mt-1.5 max-w-sm text-sm text-[var(--fg-muted)]">{subtitle}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <div
      role="alert"
      className="mb-4 rounded-xl border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[var(--danger)]"
    >
      {message}
    </div>
  )
}

/* ------------------------------- Navigation -------------------------------- */

export interface SidebarLinkProps {
  href: string
  active: boolean
  icon?: React.ReactNode
  children: React.ReactNode
  onClick?: (e: React.MouseEvent) => void
}

export function SidebarLink({ href, active, icon, children, onClick }: SidebarLinkProps) {
  return (
    <a
      href={href}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
        active
          ? 'bg-[var(--primary-soft)] text-[var(--primary)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--primary)_25%,transparent)]'
          : 'text-[var(--fg-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]'
      }`}
    >
      {icon && <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{icon}</span>}
      {children}
    </a>
  )
}

/** Brand mark used in sidebar + mobile topbar. */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex items-center justify-center rounded-xl bg-[image:var(--gradient-primary)] text-white shadow-[0_8px_24px_-8px_rgba(99,102,241,0.55)]"
      style={{ height: size, width: size }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none">
        <path
          d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
