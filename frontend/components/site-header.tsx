import Link from 'next/link'

const PORTFOLIO_URL = 'https://djaouad.is-a.dev'

/**
 * Public header shared by the marketing home page and the /try demo sandbox, so
 * a visitor who wanders from one to the other keeps the same nav. The anchored
 * section links only render on the home page, which is the only route that
 * actually has those sections.
 */
export function SiteHeader({ withSectionLinks = false }: { withSectionLinks?: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm font-semibold tracking-tight">Receptionist</span>
        <nav className="flex items-center gap-4 text-sm">
          {withSectionLinks && (
            <>
              <a href="#what-it-does" className="hidden text-fg-muted transition-colors hover:text-fg sm:inline">
                What it does
              </a>
              <a href="#how-it-works" className="hidden text-fg-muted transition-colors hover:text-fg sm:inline">
                How it works
              </a>
            </>
          )}
          <Link href="/login" className="text-fg-muted transition-colors hover:text-fg">
            Sign in
          </Link>
          <Link href="/register" className="hidden border border-border px-3 py-1.5 font-medium transition-colors hover:border-border-strong sm:inline-block">
            Create account
          </Link>
          <Link
            href="/try"
            className="bg-primary px-3 py-1.5 font-semibold text-primary-fg transition-colors hover:bg-primary-strong"
          >
            Try it
          </Link>
        </nav>
      </div>
      <p className="border-t border-border px-4 py-1.5 text-center text-xs text-fg-muted">
        Built by Djaouad Frih · Want this for your business?{' '}
        <a href={PORTFOLIO_URL} target="_blank" rel="noopener noreferrer" className="text-fg-secondary underline underline-offset-2 hover:text-fg">
          {PORTFOLIO_URL}
        </a>
      </p>
    </header>
  )
}
