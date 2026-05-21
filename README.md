# Apex

Personal optimisation dashboard — tracks recovery, training, nutrition, sleep, and supplements in one warm, mobile-first UI. Powered by Next.js, Supabase, WHOOP, and Claude AI.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database / Auth | Supabase (Postgres + Auth) |
| AI | Anthropic Claude (Sonnet + Haiku) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Charts | Recharts |
| Wearable | WHOOP API (OAuth2) |
| Food data | USDA FoodData Central |
| Hosting | Vercel |

---

## Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project with the schema applied
- An [Anthropic API key](https://console.anthropic.com/settings/keys)
- A [WHOOP developer app](https://developer.whoop.com) (optional — app works without it)
- A [USDA FoodData Central API key](https://fdc.nal.usda.gov/api-guide.html) (free, optional — falls back to DEMO_KEY)

---

## Local Development

### 1. Clone and install

```bash
git clone <repo-url>
cd apex
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all values. See `.env.example` for documentation on each variable.

### 3. Set up the database

Apply the Supabase schema through the Supabase Dashboard SQL editor or CLI.
The required tables are:
- `daily_logs`, `food_logs`, `training_sessions`, `exercises`
- `supplement_logs`, `user_supplements`
- `whoop_recovery`, `whoop_sleep`, `whoop_cycles`, `whoop_workouts`, `whoop_tokens`, `whoop_profile`, `whoop_body`
- `user_profile`, `user_goals`, `user_training`, `user_lifestyle`, `user_onboarding`
- `exercise_baselines`, `exercise_library`
- `workout_templates`, `template_sections`, `template_exercises`, `template_sets`
- `lab_reports`, `menstrual_cycles`, `chat_conversations`, `chat_messages`
- `ai_pex_plans`, `custom_foods`

All user-facing tables use Row Level Security (RLS). Ensure RLS is enabled and policies are set to `user_id = auth.uid()`.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Key Routes

| Path | Description |
|------|-------------|
| `/` | Today dashboard |
| `/chat` | AI coach (Claude Sonnet) |
| `/training` | Workout tracker + AI-PEX program generator |
| `/food` | Food logging + USDA search |
| `/sleep` | Sleep data from WHOOP |
| `/supplements` | Daily supplement tracking |
| `/lab` | Blood work upload + AI analysis |
| `/settings` | Profile, goals, WHOOP connection |

### API health check

```
GET /api/health
```

Returns `{ status: "ok", version, timestamp }`.

---

## Connecting WHOOP

1. Register a WHOOP developer app at https://developer.whoop.com
2. Set redirect URI to `https://your-domain.com/api/whoop/callback`
3. Add `WHOOP_CLIENT_ID`, `WHOOP_CLIENT_SECRET`, and `WHOOP_REDIRECT_URI` to env
4. In the app: Settings → Connect WHOOP

---

## Deploying to Vercel

```bash
npm i -g vercel
vercel
```

Set all env vars from `.env.example` in your Vercel project settings. Update `WHOOP_REDIRECT_URI` and `NEXT_PUBLIC_APP_URL` to your production domain.

---

## Android (TWA)

See [`MOBILE_READINESS.md`](./MOBILE_READINESS.md) for the full step-by-step guide to wrapping this app as an Android TWA for Google Play.

The short version:
1. Generate PWA icons (see MOBILE_READINESS.md Step 1)
2. Deploy to production with HTTPS
3. `npx bubblewrap init --manifest https://your-domain.com/manifest.json`
4. `bubblewrap build` → sign and upload to Play Store

---

## Linting & Type Checking

```bash
npm run lint       # ESLint
npx tsc --noEmit   # TypeScript
npm run build      # Full production build
```
