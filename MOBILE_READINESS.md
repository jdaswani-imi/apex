# APEX — Mobile Readiness Report
**Audit date:** 2026-05-21  
**Recommended Android path:** PWA → TWA (Trusted Web Activity)

---

## Recommended Android Path

**Do not rewrite in React Native.** The app is already a mobile-first SSR web app with a bottom nav, responsive layout, and touch-optimised components. A React Native rewrite would duplicate every screen, every API call, and every data type — months of work for zero feature gain.

**Use TWA (Trusted Web Activity)** — a thin Android APK shell that renders your verified PWA inside Chrome. It removes the browser UI (address bar, back button) and gives you:
- Full-screen native app experience
- Google Play Store listing
- Deep links / App Links
- Push notifications (via FCM + Web Push)
- Offline support (via service worker)

TWA requires the PWA to pass installability checks. The steps below get you there.

---

## Current State Assessment

| Check | Status | Notes |
|-------|--------|-------|
| Responsive layout (360px min) | ✅ Pass | Bottom nav + max-w-5xl container works at 360px |
| Mobile bottom nav | ✅ Pass | 5-tab bottom nav, 44px touch targets |
| Viewport meta | ✅ Pass | Set in layout.tsx |
| No horizontal scroll (basic) | ✅ Likely pass | Needs visual verification on 360px |
| `manifest.json` present | ✅ Yes | Colours now fixed |
| Icons in manifest | ❌ Fail | `icon-192.png` and `icon-512.png` missing from `public/` |
| Maskable icon | ⚠️ Listed | `icon-512.png` listed as maskable but file missing |
| `apple-touch-icon` | ❌ Missing | Not in `<head>` |
| Theme colour | ✅ Fixed | Now `#302b25` |
| Service worker | ❌ No-op | `sw.js` only installs/activates, no caching |
| Offline fallback page | ❌ Missing | |
| `display: standalone` | ✅ Pass | In manifest |
| HTTPS | ✅ Pass | Vercel enforces TLS |
| Safe area insets | ⚠️ Partial | `pb-20` on main handles notch; check `env(safe-area-inset-*)` |
| `prefers-reduced-motion` | ❌ Not checked | tw-animate-css animations run regardless |
| Push notification infra | ❌ Missing | No VAPID keys, no FCM setup |
| Deep linking / App Links | ❌ Missing | No `assetlinks.json` |

---

## Step-by-Step: What's Left After This Audit

### Step 1 — Generate PWA Icons (30 min)
**Required before any other step.** Without icons, the app cannot be installed.

1. Create a 1024×1024 PNG logo (Apex "A" on `#302b25` background).
2. Generate all sizes using [Maskable.app](https://maskable.app) or `pwa-asset-generator`:
   ```bash
   npx pwa-asset-generator ./icon-source.png ./public \
     --index src/app/layout.tsx \
     --maskable true \
     --background "#302b25"
   ```
3. This produces: `icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, and splash screens.
4. Add to `<head>` in `src/app/layout.tsx`:
   ```tsx
   <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
   ```

**Time estimate:** 30 minutes.

---

### Step 2 — Real Service Worker with Caching (2–4 hrs)
Replace the no-op `public/sw.js` with a proper Workbox-based strategy.

**Recommended caching strategy:**
- `cache-first` for static assets (`_next/static/**`, fonts, images)
- `network-first` with cache fallback for API data routes
- `stale-while-revalidate` for the daily brief and supplement data
- Offline fallback page (`/offline`) for navigation misses

**Easiest path:** Use `next-pwa` or hand-write Workbox in `public/sw.js`:
```js
import { precacheAndRoute } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies'

precacheAndRoute(self.__WB_MANIFEST)

// API data — network first
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkFirst())

// Static assets — cache first
registerRoute(
  ({ request }) => ['style', 'script', 'font'].includes(request.destination),
  new CacheFirst({ cacheName: 'static-assets' })
)
```

**Time estimate:** 2–4 hours.

---

### Step 3 — Offline Fallback Page (1 hr)
Create `src/app/offline/page.tsx` — a simple "You're offline" screen that the service worker serves when navigation fails with no cached version. Show a retry button and the last-synced time.

**Time estimate:** 1 hour.

---

### Step 4 — Safe Area Insets (1 hr)
Audit bottom nav and page headers for notch/home indicator safe areas on iOS and Android.

In `src/app/(app)/layout.tsx`, the bottom nav needs:
```tsx
// Add to the nav container:
className="... pb-[env(safe-area-inset-bottom)]"
```

And for pages with fixed headers, ensure `pt-[env(safe-area-inset-top)]` is applied.

**Time estimate:** 1 hour.

---

### Step 5 — `prefers-reduced-motion` (30 min)
Add to `globals.css`:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

**Time estimate:** 30 minutes.

---

### Step 6 — TWA Asset Links (1 hr)
Once the PWA passes installability and you have a Play Store developer account:

1. Generate a signing key for the Android APK.
2. Create `public/.well-known/assetlinks.json`:
   ```json
   [{
     "relation": ["delegate_permission/common.handle_all_urls"],
     "target": {
       "namespace": "android_app",
       "package_name": "com.yourcompany.apex",
       "sha256_cert_fingerprints": ["YOUR_SIGNING_KEY_SHA256"]
     }
   }]
   ```
3. Configure CORS to allow `/.well-known/assetlinks.json` to be fetched cross-origin.

**Time estimate:** 1 hour.

---

### Step 7 — Build the TWA APK (2–4 hrs)
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://your-domain.com/manifest.json
bubblewrap build
```

This produces a signed `.aab` ready for Google Play upload.

Alternatively, use [PWA Builder](https://www.pwabuilder.com) — paste your URL, download the Android package, sign it, upload.

**Time estimate:** 2–4 hours (first time; includes Play Console setup).

---

### Step 8 — Push Notifications (4–8 hrs)
Infrastructure is not yet in place. When ready:

1. Generate VAPID keys: `npx web-push generate-vapid-keys`
2. Store `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` in env.
3. Add a `push_subscriptions` table in Supabase (`user_id`, `endpoint`, `p256dh`, `auth`).
4. Create `POST /api/push/subscribe` to save subscriptions.
5. Create `POST /api/push/send` (server-side) using `web-push` to send notifications.
6. Add service worker `push` event listener.
7. Wire FCM for Android background delivery (required for TWA).

**Time estimate:** 4–8 hours.

---

## Total Remaining Work Estimate

| Task | Time |
|------|------|
| Step 1: PWA icons | 30 min |
| Step 2: Service worker | 2–4 hrs |
| Step 3: Offline page | 1 hr |
| Step 4: Safe area insets | 1 hr |
| Step 5: Reduced motion | 30 min |
| Step 6: Asset links | 1 hr |
| Step 7: TWA APK | 2–4 hrs |
| Step 8: Push notifications | 4–8 hrs |
| **Total** | **12–20 hrs** |

Everything in Steps 1–5 is pure frontend work, zero backend changes required. Steps 6–8 are the "native app" layer on top.

---

## What Does NOT Need Changing for Android

- Auth (Supabase magic link works in TWA/Chrome WebView)
- All API routes (unchanged)
- Data model (unchanged)
- UI components (already mobile-first)
- WHOOP OAuth (works in-browser; TWA opens Chrome for OAuth redirects)
