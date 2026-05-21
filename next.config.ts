import type { NextConfig } from "next";

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // Next.js inline scripts + React hydration
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Supabase API + WHOOP + Anthropic (server-side only, but listed for completeness)
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.prod.whoop.com https://api.anthropic.com https://fdc.nal.usda.gov",
      // Google Fonts (Barlow loaded via next/font — inlined; keeping CDN fallback)
      "font-src 'self' https://fonts.gstatic.com data:",
      // Inline styles from Tailwind + next/font CSS variables
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      // Exercise GIFs and images from Supabase Storage
      "img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  headers: async () => [
    {
      source: '/(.*)',
      headers: securityHeaders,
    },
  ],
}

export default nextConfig;
