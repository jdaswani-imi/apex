# APEX — Discovery Report
**Audit date:** 2026-05-21  
**Auditor:** Claude Code (senior staff engineer pass)  
**Branch:** `audit/full-hardening-pass`

---

## Stack Inventory

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.6 |
| Language | TypeScript | ^5 (strict: true) |
| Runtime | Node.js | Not pinned (Vercel default Node 24) |
| Package manager | npm (package-lock.json present) | — |
| Database / BaaS | Supabase (Postgres + Auth + Storage) | @supabase/ssr ^0.10.3 |
| Auth | Supabase Auth (email magic link / OAuth) | — |
| AI | Anthropic SDK | ^0.95.2 (claude-sonnet-4-6, claude-haiku-4-5) |
| CSS | Tailwind CSS v4 + tw-animate-css | ^4 |
| Component library | shadcn/ui + @base-ui/react | — |
| Charts | Recharts | ^3.8.1 |
| Toast | Sonner | ^2.0.7 |
| Date utils | date-fns | ^4.1.0 |
| Icons | lucide-react | ^1.14.0 |
| Fonts | Barlow + Barlow Condensed (Google Fonts via next/font) | — |
| Hosting | Vercel (`.vercel/` present) | — |
| CI/CD | **None** | — |
| Analytics | **None** | — |
| Error tracking | **None** | — |
| Tests | **None** | — |

### External Integrations
- **WHOOP API** — OAuth2, recovery/sleep/cycle/workout sync
- **USDA FoodData Central** — food search (currently using DEMO_KEY)
- **Anthropic Claude** — AI coach (chat), daily brief, lab analysis, meal plan, sleep routine, macro calculation, AI-PEX workout generation

---

## Architecture Map

### Entry Points
- `/` — Today dashboard (SSR, App Router page)
- `/login` — Supabase magic link / OAuth (public)
- `/onboarding` — Multi-step onboarding (public, redirects after complete)
- `/chat` — AI coach (client component, streams to `/api/chat`)
- `/training`, `/food`, `/sleep`, `/supplements`, `/lab`, `/progress`, `/week`, `/more`, `/settings`, `/hair`, `/skincare` — feature pages

### Routing & Auth
- **Middleware:** `src/proxy.ts` — **BROKEN** (exports `proxy`, not `middleware`; filename is not `middleware.ts`). Next.js never invokes this file. All page routes are unprotected at the middleware layer. Auth is enforced per-route only in API handlers via `supabase.auth.getUser()`.
- **Auth callback:** `/api/auth/callback` — Supabase PKCE code exchange
- **WHOOP callback:** `/api/whoop/callback` — OAuth code exchange + initial sync

### Data Flow
```
Browser
  ↕  (HTTPS)
Next.js App Router (Vercel)
  ├── Server Components / Server Actions → Supabase (Postgres RLS + Anon key)
  ├── API Routes (/api/**) → Supabase (Anon key, user-scoped queries)
  ├── API Routes (AI) → Anthropic Claude API
  └── API Routes (WHOOP) → WHOOP API (OAuth2 tokens in whoop_tokens table)

Supabase (remote)
  ├── Auth (sessions stored in cookies via @supabase/ssr)
  ├── Postgres (user data, logs, WHOOP data, lab reports)
  └── (no Storage integration in code — file upload handled in-memory)
```

### Server vs Client Boundary
- All data fetching on pages uses server components (via `lib/db.ts` + server supabase client)
- Chat page is client component (`chat-client.tsx`) — fetches via `/api/chat`
- Lab page is client component (`lab-client.tsx`) — file upload + fetch
- Auth check uses `React.cache` in `getAuthUser()` to dedupe per request

### Background Jobs
- None (no cron, no queues). WHOOP sync is triggered manually or on OAuth callback.

---

## Mobile-Readiness Assessment

**Current state:** SSR web app (Next.js App Router) with a PWA manifest and no-op service worker. The app has a mobile bottom nav and responsive layout, giving it a native-app feel in a browser.

**PWA status:**
- `manifest.json` present — but references icons (`icon-192.png`, `icon-512.png`) that do **not exist** in `public/`. Installability will fail.
- `sw.js` is a no-op (install + activate only, no caching strategy).
- `themeColor` in both manifest and `layout.tsx` is `#000000` (wrong — should be the warm palette `#302b25`).
- No `apple-touch-icon` in `<head>`.
- No maskable icon variant.

**Recommended Android path:** **Progressive Web App (PWA) → TWA (Trusted Web Activity)**

Reasoning:
- 100% of the app logic is in Next.js/Supabase. A React Native rewrite would duplicate all UI and API work.
- TWA wraps the PWA in an Android APK with near-zero code delta; the Google Play Store accepts it.
- The bottom nav, mobile viewport, and touch targets are already mobile-optimised.
- PWA improvements needed (icons, working service worker, offline page) are a few hours of work.
- TWA can be generated with `bubblewrap` CLI or Android Studio's TWA template.

---

## Dead Code & Unused Items

| Category | Item | Notes |
|----------|------|-------|
| File | `src/proxy.ts` | Should be `middleware.ts` |
| Dep | `shadcn` (listed as runtime dep) | Build tool only, should be devDependency |
| Dep | `@base-ui/react` | Only used for dropdown/tooltip primitives that shadcn also covers — verify usage |
| Env var | `USDA_API_KEY=DEMO_KEY` | Demo key, rate-limited to 30 req/hr/IP |
| Page images | `audit-*.png`, `verify-*.png` (root) | 13 screenshot files totalling ~2MB checked into repo |
| Env | `WHOOP_REDIRECT_URI=http://localhost:3000/...` | Hardcoded localhost; needs production value |
| Route | `/api/whoop/debug` | Debug endpoint — should not exist in production |
| Config | `daily_summary/` directory (24 files) | Appears to be generated data files; not imported anywhere in src |

---

## Risk Register — Top 20 Issues

| # | Severity | Category | Issue | File | Line(s) |
|---|----------|----------|-------|------|---------|
| 1 | 🔴 CRITICAL | Auth / Security | **Middleware completely broken** — `src/proxy.ts` is not named `middleware.ts` and exports `proxy` not `middleware`. Next.js never runs it. All page routes have zero server-side auth protection. | `src/proxy.ts` | 1-12 |
| 2 | 🔴 CRITICAL | Auth / Security | **`/api/cycle` has zero auth checks** — GET, POST, DELETE all run unauthenticated. Any caller can read or destroy any user's menstrual cycle data by guessing/knowing a UUID. | `src/app/api/cycle/route.ts` | 1-32 |
| 3 | 🔴 CRITICAL | Security | **`deleteMenstrualCycle` in db.ts has no user_id check** — deletes by `id` only; paired with the above, allows arbitrary deletion across all users. | `src/lib/db.ts` | 643 |
| 4 | 🟠 HIGH | Security | **`deleteUserSupplement` has no user_id check** — deletes by `id` only. Any authenticated user who knows a supplement UUID can delete another user's supplement. | `src/lib/db.ts` | 536 |
| 5 | 🟠 HIGH | Security | **`updateExerciseBaseline` has no user_id check** — updates by `id` only. Authenticated user can update any baseline. | `src/lib/db.ts` | 540-548 |
| 6 | 🟠 HIGH | Security | **Exercise route doesn't verify session ownership** — `POST /api/training/exercise` inserts an exercise with caller-supplied `session_id` without verifying the session belongs to the current user. | `src/app/api/training/exercise/route.ts` | 10-46 |
| 7 | 🟠 HIGH | Security | **Training session DELETE deletes exercises before checking session ownership** — `exercises.delete().eq('session_id', id)` runs with no user filter before the session's `user_id` check. Authenticated user can wipe exercises from any session they know the ID of. | `src/app/api/training/session/[id]/route.ts` | 20-27 |
| 8 | 🟠 HIGH | Security | **`/api/settings` GET returns user data without explicit 401** — Returns `getFullUserContext()` result (nulls) without checking auth at route level. Leaks table shape. | `src/app/api/settings/route.ts` | 5-8 |
| 9 | 🟡 MEDIUM | Security | **Silent `catch {}` in `supabase/server.ts`** — Cookie-set errors are swallowed with no log. Hides auth state corruption. | `src/lib/supabase/server.ts` | 21 |
| 10 | 🟡 MEDIUM | Security | **No security headers** — `next.config.ts` sets no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy. | `next.config.ts` | 1-7 |
| 11 | 🟡 MEDIUM | Security | **No rate limiting on AI endpoints** — `/api/chat`, `/api/ai-brief`, `/api/lab` (20MB upload + Claude call), `/api/training/ai-pex/generate` are all unthrottled. Cost exposure. | Multiple | — |
| 12 | 🟡 MEDIUM | Security | **`/api/whoop/debug` endpoint exists in production** — exposes WHOOP token status. | `src/app/api/whoop/debug/route.ts` | — |
| 13 | 🟡 MEDIUM | PWA | **PWA icons missing** — `manifest.json` references `icon-192.png` and `icon-512.png` that don't exist in `public/`. App is not installable. | `public/manifest.json` | 7-20 |
| 14 | 🟡 MEDIUM | PWA | **No-op service worker** — `sw.js` does nothing. No caching, no offline support. | `public/sw.js` | 1-3 |
| 15 | 🟡 MEDIUM | Config | **Theme colour mismatch** — `themeColor` in layout.tsx and manifest.json is `#000000`; design system background is `#302b25`. | `src/app/layout.tsx:34`, `public/manifest.json:8` | — |
| 16 | 🟡 MEDIUM | Config | **Root layout `body` uses `bg-black`** — hardcoded Tailwind value bypasses the warm token system. | `src/app/layout.tsx` | 41 |
| 17 | 🟡 MEDIUM | Config | **`USDA_API_KEY=DEMO_KEY`** — food search capped at 30 req/hr/IP; will fail in production under any real usage. | `.env.local` | 16 |
| 18 | 🟡 MEDIUM | Ops | **No error tracking** — No Sentry or equivalent. Errors are invisible in production. | — | — |
| 19 | 🟡 MEDIUM | Ops | **No CI/CD** — No lint, typecheck, or build gate before merge. | — | — |
| 20 | 🟢 LOW | DX | **No `.env.example`** — New developers have no reference for required env vars. | — | — |
