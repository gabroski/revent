# Revent

Event discovery for Georgia — restaurants, bars and clubs publish what's on, people find
something to do tonight. Bilingual (ქართული / English), server-rendered, mobile-first.

Phase 1 (this repo's current state) is the **public discovery site**: browsing, filtering,
search, event and venue pages, running on seeded data. Accounts and the venue dashboard are
Phase 2; favorites, trending and moderation are Phase 3.

- Design spec: [`docs/superpowers/specs/2026-08-16-revent-event-discovery-design.md`](docs/superpowers/specs/2026-08-16-revent-event-discovery-design.md)
- Phase 1 plan: [`docs/superpowers/plans/2026-08-16-revent-foundation-discovery.md`](docs/superpowers/plans/2026-08-16-revent-foundation-discovery.md)

## Prerequisites

- Node 20+
- Docker (required by the Supabase CLI for the local database)
- Supabase CLI (`npx supabase` works without a global install)

## Setup

```bash
npm install

# Start the local database, then copy the printed API URL and keys.
npx supabase start
cp .env.example .env.local   # paste the anon key and service role key

# Apply migrations and load seed data.
npx supabase db reset

npm run dev                  # http://localhost:3000 -> /ka
```

Without a running Supabase, the pure-logic and component tests still pass; the database-backed
suites skip themselves rather than failing. They are not optional before deploying.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm test` | Unit + integration tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Architecture at a glance

```
Browser
  ├─ public reads ──▶ React Server Components ──▶ Supabase (anon key, RLS on)
  └─ mutations ─────▶ server actions (Phase 2) ──▶ Supabase (RLS on)
```

Things worth knowing before changing code:

- **`src/modules/discovery` is the only module that queries events for public pages.** The rule
  that a past, unpublished, or soft-deleted event is never visible is enforced there *and* in
  RLS policies. Neither layer is trusted alone, and `e2e/invariant.spec.ts` proves it.
- **Filter state lives in the URL**, never in React state. That is what makes filtered views
  shareable, indexable, and correct with the back button.
- **Content is bilingual per row** (`title_ka` / `title_en`). Venues fill one language; render
  through `pickContent`, which falls back to the other rather than showing a blank card.
- **"Tonight" ends at 6am**, not midnight — a club night starting at 23:00 is still tonight to
  someone browsing at 01:00. All date logic is pinned to `Asia/Tbilisi`.
- **The seed contains deliberate trap rows** (a past event, an unpublished one). Don't remove
  them; tests depend on them.
