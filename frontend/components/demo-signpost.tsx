import Link from 'next/link'

const PORTFOLIO_URL = 'https://djaouad.is-a.dev'

/**
 * Quiet signpost for the public auth pages. The demo itself never needs an
 * account, so a visitor who wandered into sign-in must be able to get back to
 * it — and to the portfolio — without signing in first.
 */
export function DemoSignpost() {
  return (
    <p className="mt-8 border-t border-border pt-4 text-center text-xs leading-relaxed text-fg-muted">
      <Link href="/" className="text-fg-secondary underline underline-offset-2 hover:text-fg">
        Back to the demo — no account needed
      </Link>
      <span className="mx-2" aria-hidden="true">
        ·
      </span>
      Built by Djaouad Frih ·{' '}
      <a
        href={PORTFOLIO_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-fg-secondary underline underline-offset-2 hover:text-fg"
      >
        {PORTFOLIO_URL}
      </a>
    </p>
  )
}
