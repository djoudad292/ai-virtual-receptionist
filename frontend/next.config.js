/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@supportai/ui'],
  output: 'export',
  images: { unoptimized: true },
  reactStrictMode: true,
}
module.exports = nextConfig
