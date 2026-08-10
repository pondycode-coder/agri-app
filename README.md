# AgriApp — Cameroon Agribusiness Management

A multi-tenant farm management platform for Cameroonian agribusinesses.
Manage farms, plots, crops, inventory, workers, tasks, financials (XAF /
FCFA), contacts, and investments — in French and English, online or offline.

![XAF](https://img.shields.io/badge/currency-XAF%20%2F%20FCFA-emerald)

## Features

- **Multi-tenant by design.** Each farm is a tenant with full Row-Level
  Security isolation. One account can belong to several farms and switch
  between them from the sidebar.
- **Farm management.** Create farms, join farms by id, and switch tenants —
  all from the farm switcher in the sidebar.
- **Operations.** Plots & soil types, crop cycles (cocoa, coffee, maize…),
  inventory, workers with daily wages, task assignment with automatic wage
  expenses, harvests and revenue.
- **Financials.** Income/expense tracking in XAF, payment methods
  (Orange Money, MTN MoMo, cash…), plus an investments register.
- **Roles.** `admin`, `manager`, `worker` with a per-session role switcher.
- **Bilingual.** French / English UI (fr/en locale toggle).
- **Local-first.** Works without a backend via localStorage cache; mirrors to
  Supabase when configured.

## Tech stack

- **Frontend:** React 19, TypeScript, Vite 8, Tailwind CSS + shadcn/ui,
  React Router, TanStack Query, Recharts.
- **Backend:** Supabase (Postgres + RLS + Auth), accessed through
  `@supabase/supabase-js`.
- **Tests:** Vitest + Testing Library.
- **Deploy:** Vercel (SPA, static `dist`).

## Running locally

```bash
npm install
npm run dev       # http://localhost:8080
```

Without a Supabase config the app runs in **demo mode**: localStorage cache,
demo auth (any email + password works), seeded with a Cameroonian farm.

### Available scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start Vite dev server (port 8080) |
| `npm run build` | Production build to `dist/` |
| `npm run typecheck` | TypeScript type checking |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest suite |
| `npm run check` | typecheck + lint + test in one go |

## Multi-tenant setup (Supabase)

To go multi-tenant (shared backend, Farm = tenant):

1. Create a Supabase project (supabase.com).
2. Apply the schema + RLS policies with the CLI:
   ```bash
   npm i -g supabase
   supabase login
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   This runs every migration in `supabase/migrations/` in order. You need
   all four:
   - `20260809000000_init.sql` — tables, RLS policies, `current_farm_id()`.
   - `20260809000002_user_farms.sql` — multi-farm membership + trigger.
   - `20260809000003_create_join_farm.sql` — create/join farm RPCs.
   - `20260809000004_seed_demo.sql` — demo farm + full dataset; attaches new
     sign-ups to it.

   Alternatively, paste each migration into the Supabase SQL Editor and run
   them **in order** (never out of order — they build on each other).
3. Add your URL/anonymized key (never the `service_role` key):
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   in `.env.local` and in Vercel's Environment Variables.
4. Sign up at `/register` — a `profiles` row is created automatically (the
   `handle_new_user` trigger), and new sign-ups are attached to the seeded
   demo farm (`Plantation Agro-Ouest Bafoussam`), so the dashboard is
   populated immediately. The app hydrates the local cache from Supabase.

### How tenancy works

- **Farm = tenant.** Every resource row carries `farm_id`; `Profile.farm_id`
  ties each user to their farm.
- **RLS is the enforcement.** See `src/lib/supabaseBackend.ts` — the app also
  queries by `farm_id`, but even a tampered client cannot read/write another
  farm's rows because every table's policies filter on `current_farm_id()`.
- **Local-first fallback.** `src/services/store.ts` keeps the synchronous
  API pages already use; when Supabase is configured it mirrors writes and
  hydrates from live data, so demo/offline still works without a backend.

### Multi-farm support

One account can manage several farms. Membership lives in the `user_farms`
join table (see `supabase/migrations/20260809000002_user_farms.sql`). On
sign-in the app:
- adds the user to their default farm (`ensureMembership`),
- loads the full farm list via `listMyFarms`,
- hydrates the cache for the active farm.

A **farm switcher dropdown** in the sidebar (and the farm name in the top
bar) calls `switchFarm(farmId)`, which re-hydrates all data from the newly
selected farm. `Profiles.farm_id` stays the default farm; `switchRole` is
per-session only.

The same switcher includes **create** and **join** actions
(`supabase/migrations/20260809000003_create_join_farm.sql`):
- **Créer une ferme** — the `create_farm_and_join` security-definer RPC
  inserts the farm, adds the caller as its `admin` in `user_farms`, flips
  `Profiles.farm_id`, then the app re-hydrates and activates it.
- **Rejoindre une ferme** — `join_farm_by_id` adds the caller as a `worker`
  to an existing farm (given its id) and activates it.

These RPCs exist because the `farms_insert_own` policy requires
`id = current_farm_id()`, so a brand-new farm cannot be inserted directly;
the RPCs run as the table owner and create row + membership atomically.

## Project structure

```
src/
  components/   UI components, MainLayout, ErrorBoundary
  context/      AuthProvider (session, roles, farm switching), I18nProvider
  hooks/        use-toast, use-mobile
  i18n/         fr/en translations
  lib/          supabase client, SupabaseBackend (tenant data layer), remoteSync
  pages/        Dashboard, Farms, Plots, CropCycles, Inventory, Workers,
                Tasks, Financials, Contacts, Investments, Profile, auth pages
  services/     store.ts (local-first adaptive cache), mockData, tests
  types/        database.ts (domain models)
supabase/
  migrations/   SQL migrations in apply order
  config.toml   Supabase CLI configuration
```

## Testing

```bash
npm test              # run once
npm run test:watch    # watch mode
```

Tests cover the adaptive store and the wage-expense behaviour in Tasks.

## Deployment (Vercel)

The repo already includes `vercel.json` (SPA rewrites, cache headers,
pnpm install, output `dist/`).

1. Push to GitHub, import the repo into Vercel — the build is automatic.
2. Add environment variables (see step 3 above).
3. Attach a custom domain in Vercel → Settings → Domains.

Go-live checklist: apply migrations, set env vars, confirm email
registration is enabled in Supabase, and test tenant isolation between two
accounts.
