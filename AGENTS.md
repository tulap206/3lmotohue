# AGENTS.md

## Cursor Cloud specific instructions

### What this is
`3lmotohue` ("3L Moto") is a Vietnamese motorbike-rental management app built with **Next.js 16 (App Router) + React 19 + Supabase**. A public landing page (`/`) plus a protected `/dashboard` reached via `/login`.

### Run / build / lint
- Dev server: `npm run dev` (Next.js, defaults to port 3000; set `PORT` to run alongside the sibling apps). Dependency install is handled by the startup update script (`npm install`).
- Build: `npm run build`; start prod: `npm start`.
- Lint: `npm run lint` is defined as `eslint .` but **eslint is not in `devDependencies`**, so it fails with `eslint: not found`. Lint is effectively not configured in this repo — don't treat that failure as your regression.

### Required env (non-obvious gotcha)
- `lib/supabase.ts` reads `process.env.NEXT_PUBLIC_SUPABASE_URL!` / `NEXT_PUBLIC_SUPABASE_ANON_KEY!` with non-null assertions and calls `createClient(url, key)` at module load. If these are empty, `createClient` **throws and every page that imports it errors out**. So you must create a gitignored `.env.local` (see `.env.example`) before the dev server is usable.
- For UI-only work without a real backend, placeholder values are enough to boot, e.g.:
  - `NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY=<any non-empty string>`
- For real data, add genuine Supabase credentials (see `SUPABASE_SETUP.md`).

### Login without a database
`contexts/auth-context.tsx` tries Supabase first, then **falls back to hardcoded demo users** when Supabase is unreachable. With placeholder env you can still log in: username `admin`, password `admin`. Data-write features (vehicles/customers/rentals) need a real Supabase project to persist.

### Real Supabase credentials (Cursor Cloud secrets) — important gotcha
This repo's schema (`vehicles`, `customers`, `rentals`, `transactions`, `auth_users`) matches the Supabase project provided via Cursor Cloud secrets, and login + CRUD work end-to-end against it.
- **The `NEXT_PUBLIC_SUPABASE_URL` secret is currently set to a publishable key (`sb_publishable_...`), not a project URL.** Next.js treats real env vars as higher precedence than `.env.local`, so if you start the dev server with that injected value, `createClient` throws `Invalid URL` and every page breaks.
- Fix: the URL must be `https://<project-ref>.supabase.co`. The project ref can be recovered from the anon key by base64url-decoding the JWT payload and reading its `ref` field. Either correct the secret value, or override it for the dev process, e.g. `export NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co` before `npm run dev` (and put the same in `.env.local`).
- The provided `NEXT_PUBLIC_SUPABASE_ANON_KEY` (JWT) and `SUPABASE_SERVICE_ROLE_KEY` are valid; the anon key permits the client-side inserts the app uses.
