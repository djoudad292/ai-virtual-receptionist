/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs')

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
}

const sentryConfig = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.SENTRY_DSN,
}

module.exports = process.env.SENTRY_DSN ? withSentryConfig(nextConfig, sentryConfig) : nextConfig
