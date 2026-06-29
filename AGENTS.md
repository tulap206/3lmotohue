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
