import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import * as Sentry from '@sentry/nextjs'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import { ToastProvider } from '@/components/toast'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Support Platform - Demo by djaouad frih',
  description: 'Multi-tenant AI customer support platform with intelligent chatbots, real-time messaging, and smart knowledge base management. Built by djaouad frih.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
        >
          Skip to main content
        </a>
        <Sentry.ErrorBoundary fallback={<p>Something went wrong</p>}>
          <AuthProvider>
            <ToastProvider>
              {children}
            </ToastProvider>
          </AuthProvider>
        </Sentry.ErrorBoundary>
      </body>
    </html>
  )
}
