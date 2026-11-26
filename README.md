# TechBridge Platform

TechBridge is a full-stack community, hackathon, mentorship, and certificate-verification platform built with React 18, TypeScript, Vite, Tailwind CSS, Drizzle ORM, and Supabase (PostgreSQL, Auth, Storage, Realtime, and Edge Functions).

## Prerequisites

- **Node.js** 20+ and **npm**
- **Supabase CLI** (`npm install -g supabase` or `npx supabase`)
- **Git** and a **GitHub** account

## 1. Local Setup & Running the App

```bash
cd "techbridge_source_2026-11-17/techbridge-source"

# 1. Install dependencies
npm install

# 2. Configure environment variables
cp .env.example .env
# Edit .env with your VITE_SUPABASE_PROJECT_ID, VITE_SUPABASE_URL, and VITE_SUPABASE_PUBLISHABLE_KEY

# 3. Start the local dev server (http://localhost:8080)
npm run dev
```

### Useful Scripts

- `npm run dev` — Start Vite development server on port `8080`
- `npm run build` — Generate sitemap and build production bundle into `dist/`
- `npm run preview` — Preview the production build locally
- `npm run test` — Run unit tests with Vitest
- `npm run lint` — Run ESLint

## 2. Applying Database Migrations & Edge Functions (Supabase)

All 77 database migrations are unified in `supabase/migrations/` (and mirrored in `drizzle/migrations/` with the canonical Drizzle schema in `drizzle/schema.ts`). See [`docs/DATABASE_ARCHITECTURE.md`](./docs/DATABASE_ARCHITECTURE.md) for full details.

```bash
# 1. Authenticate and link your Supabase project
npx supabase login
npx supabase link --project-ref <YOUR_SUPABASE_PROJECT_ID>

# 2. Push all SQL migrations (tables, RLS policies, triggers, storage buckets, RPCs)
npx supabase db push

# 3. Set Edge Function secrets (as needed)
npx supabase secrets set \
  ALLOWED_ORIGINS="https://your-production-domain.com" \
  SITE_URL="https://your-production-domain.com" \
  RESEND_API_KEY="re_..." \
  FROM_EMAIL="TechBridge <notifications@your-domain.com>" \
  BOOKING_REMINDERS_SECRET="your-random-cron-secret" \
  WEEKLY_DIGEST_SECRET="your-random-cron-secret"

# 4. Deploy Edge Functions
npx supabase functions deploy
```

## 3. Publishing to GitHub

```bash
cd "techbridge_source_2026-11-17/techbridge-source"

git init
git branch -M main
git add .
git commit -m "Initial commit: hardened TechBridge platform and reorganized database"

# Add your GitHub repository remote (replace with your GitHub URL)
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
*(Note: `.gitignore` is configured to exclude `.env` so your secrets are never committed.)*
