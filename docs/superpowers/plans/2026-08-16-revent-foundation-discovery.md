# Revent Phase 1 — Foundation & Public Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working, server-rendered, bilingual public event-discovery site for Georgia, browsing seeded data — no accounts yet.

**Architecture:** Next.js App Router with locale-prefixed routes (`/ka`, `/en`). All public pages are React Server Components querying Supabase Postgres with the anon key while row-level security is enabled. Filter state lives entirely in the URL query string, so every filtered view is shareable, indexable, and back-button correct. Discovery queries are isolated in one module (`src/modules/discovery`) that every page consumes, so the "no past events" invariant is enforced in exactly one place.

**Tech Stack:** Next.js (App Router, TypeScript), SCSS Modules, next-intl, Supabase (Postgres + CLI migrations), Zod, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-16-revent-event-discovery-design.md`

## Global Constraints

- **Node:** 20 LTS or newer.
- **Language:** TypeScript in `strict` mode. No `any` in committed code.
- **Styling:** SCSS Modules only. No Tailwind, no CSS-in-JS.
- **Locales:** exactly two — `ka` (default, unprefixed-default disabled: always `/ka/...`) and `en`.
- **Timestamps:** every date column is `timestamptz`. Never `timestamp`.
- **Fonts:** the body font must have Georgian Mkhedruli coverage (Noto Sans Georgian). A Latin-only font anywhere in the type stack is a bug.
- **Currency:** GEL only, integer lari (no minor units) in `entry_fee_gel`.
- **Invariant:** no public query may return an event with `starts_at < now()`, `is_published = false`, or `deleted_at IS NOT NULL`.
- **Migrations:** version-controlled SQL under `supabase/migrations/`, applied via Supabase CLI. Never edit schema in the dashboard.
- **Commits:** conventional commits (`feat:`, `test:`, `chore:`, `fix:`).

---

### Task 1: Project scaffold and test harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/lib/env.ts`
- Test: `src/lib/env.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `getEnv(): Env` from `src/lib/env.ts`, where `Env = { supabaseUrl: string; supabaseAnonKey: string }`. Every later task reads Supabase config through this function, never `process.env` directly.

- [ ] **Step 1: Scaffold the Next.js app**

```bash
npx create-next-app@latest . --typescript --app --src-dir --no-tailwind --eslint --import-alias "@/*" --use-npm
npm install @supabase/supabase-js@^2 @supabase/ssr@^0 next-intl@^4 zod@^4 sass
npm install -D vitest @vitejs/plugin-react vite-tsconfig-paths @testing-library/react @testing-library/dom jsdom @playwright/test
```

- [ ] **Step 2: Configure Vitest**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest",
"e2e": "playwright test"
```

- [ ] **Step 3: Write the failing test for env parsing**

Create `src/lib/env.test.ts`:

```ts
import { describe, it, expect, afterEach } from "vitest";
import { getEnv } from "./env";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

describe("getEnv", () => {
  it("returns parsed supabase config", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(getEnv()).toEqual({
      supabaseUrl: "http://localhost:54321",
      supabaseAnonKey: "anon-key",
    });
  });

  it("throws a named error when a variable is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(() => getEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });
});
```

- [ ] **Step 4: Run the test and verify it fails**

Run: `npm test -- src/lib/env.test.ts`
Expected: FAIL — cannot resolve `./env`.

- [ ] **Step 5: Implement env parsing**

Create `src/lib/env.ts`:

```ts
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

export function getEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables: ${missing}`);
  }
  return {
    supabaseUrl: parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: parsed.data.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
```

- [ ] **Step 6: Run the test and verify it passes**

Run: `npm test -- src/lib/env.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Create `.env.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-local-anon-key
```

Confirm `.env.local` is listed in `.gitignore`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with TypeScript, SCSS, and Vitest"
```

---

### Task 2: Database schema, RLS, and seed data

**Files:**
- Create: `supabase/config.toml` (generated), `supabase/migrations/0001_init.sql`, `supabase/migrations/0002_rls.sql`, `supabase/seed.sql`
- Create: `src/lib/supabase/server.ts`
- Test: `src/lib/supabase/rls.test.ts`

**Interfaces:**
- Consumes: `getEnv()` from Task 1.
- Produces: `createPublicClient(): SupabaseClient` from `src/lib/supabase/server.ts` — an anon-key client for server-side public reads. Produces the schema every later task queries: tables `profiles`, `cities`, `categories`, `venues`, `events`, `event_images`, `favorites`.

- [ ] **Step 1: Initialise and start local Supabase**

```bash
npx supabase init
npx supabase start
```

Copy the printed API URL and anon key into `.env.local`.

- [ ] **Step 2: Write the schema migration**

Create `supabase/migrations/0001_init.sql`:

```sql
create extension if not exists pg_trgm;

create type user_role as enum ('user', 'venue_owner', 'admin');

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null,
  role user_role not null default 'user',
  locale text not null default 'ka',
  created_at timestamptz not null default now()
);

create table cities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ka text not null,
  name_en text not null,
  lat double precision not null,
  lng double precision not null,
  is_active boolean not null default true
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ka text not null,
  name_en text not null,
  icon text not null,
  sort_order integer not null default 0
);

create table venues (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles on delete set null,
  slug text not null unique,
  city_id uuid not null references cities,
  name_ka text,
  name_en text,
  description_ka text,
  description_en text,
  address_ka text,
  address_en text,
  lat double precision,
  lng double precision,
  phone text,
  website text,
  instagram text,
  facebook text,
  cover_image_path text,
  is_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint venues_name_present check (name_ka is not null or name_en is not null)
);

create table events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references venues on delete cascade,
  category_id uuid not null references categories,
  city_id uuid not null references cities,
  slug text not null unique,
  title_ka text,
  title_en text,
  description_ka text,
  description_en text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  poster_image_path text not null,
  entry_fee_gel integer check (entry_fee_gel is null or entry_fee_gel >= 0),
  dress_code text,
  is_published boolean not null default false,
  view_count integer not null default 0,
  favorite_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint events_title_present check (title_ka is not null or title_en is not null),
  constraint events_ends_after_starts check (ends_at is null or ends_at > starts_at)
);

create index events_discovery_idx
  on events (city_id, starts_at)
  where is_published and deleted_at is null;

create index events_starts_at_idx on events (starts_at, id);
create index events_category_idx on events (category_id);

create table event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  image_path text not null,
  position integer not null default 0
);

create table favorites (
  user_id uuid not null references profiles on delete cascade,
  event_id uuid not null references events on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);
```

- [ ] **Step 3: Write the RLS migration**

Create `supabase/migrations/0002_rls.sql`:

```sql
alter table profiles enable row level security;
alter table cities enable row level security;
alter table categories enable row level security;
alter table venues enable row level security;
alter table events enable row level security;
alter table event_images enable row level security;
alter table favorites enable row level security;

create policy cities_public_read on cities
  for select using (is_active);

create policy categories_public_read on categories
  for select using (true);

create policy venues_public_read on venues
  for select using (deleted_at is null);

create policy events_public_read on events
  for select using (
    is_published
    and deleted_at is null
    and starts_at >= now()
  );

create policy event_images_public_read on event_images
  for select using (
    exists (
      select 1 from events e
      where e.id = event_images.event_id
        and e.is_published
        and e.deleted_at is null
        and e.starts_at >= now()
    )
  );

-- Public media bucket. Phase 2 adds the write policies for signed uploads;
-- Phase 1 only needs public reads so seeded posters resolve.
insert into storage.buckets (id, name, public)
values ('event-media', 'event-media', true)
on conflict (id) do nothing;

create policy event_media_public_read on storage.objects
  for select using (bucket_id = 'event-media');
```

Note: the public read policy on `events` enforces the core invariant at the database level. Application queries repeat the filter; neither layer is trusted alone.

- [ ] **Step 4: Write seed data**

Create `supabase/seed.sql` with at least 6 cities, all 9 categories, 5 venues, and 12 events. Include deliberately awkward rows the later tasks must handle:

```sql
insert into cities (slug, name_ka, name_en, lat, lng) values
  ('tbilisi', 'თბილისი', 'Tbilisi', 41.7151, 44.8271),
  ('batumi', 'ბათუმი', 'Batumi', 41.6168, 41.6367),
  ('kutaisi', 'ქუთაისი', 'Kutaisi', 42.2679, 42.6946),
  ('rustavi', 'რუსთავი', 'Rustavi', 41.5495, 44.9930),
  ('telavi', 'თელავი', 'Telavi', 41.9192, 45.4731),
  ('zugdidi', 'ზუგდიდი', 'Zugdidi', 42.5088, 41.8709);

insert into categories (slug, name_ka, name_en, icon, sort_order) values
  ('live-music', 'ცოცხალი მუსიკა', 'Live music', 'music', 1),
  ('dj', 'დიჯეი', 'DJ / club night', 'disc', 2),
  ('happy-hour', 'ჰეფი აური', 'Happy hour', 'glass', 3),
  ('trivia', 'ქვიზი', 'Trivia / quiz', 'brain', 4),
  ('karaoke', 'კარაოკე', 'Karaoke', 'mic', 5),
  ('standup', 'სტენდაპი', 'Stand-up', 'laugh', 6),
  ('themed', 'თემატური საღამო', 'Themed night', 'sparkles', 7),
  ('food', 'კულინარიული სპეციალი', 'Food special', 'utensils', 8),
  ('other', 'სხვა', 'Other', 'dot', 9);
```

Then insert venues and events referencing these by slug lookup. The event rows MUST include:
- at least one event with `title_en` NULL (Georgian-only content),
- at least one with `title_ka` NULL (English-only content),
- at least one with `starts_at` in the past (must never surface),
- at least one with `is_published = false` (must never surface),
- at least one with `entry_fee_gel` NULL (free entry),
- events spread across at least three cities and four categories,
- at least three events starting within the next 12 hours (so "Tonight" is non-empty),
- at least four events in Tbilisi with future dates (so cursor pagination has more than one page),
- at least two events in Batumi (the city-filter test asserts a non-empty result),
- at least one event whose title contains "Jazz" and one containing "ჯაზ" (the search tests in Task 11 assert both),
- at least one event in the `dj` category.

Seed dates must be relative, not hardcoded — write `now() + interval '6 hours'` rather than a literal
timestamp, or the seed rots and the "Tonight" section silently empties a week from now.

Poster paths must reference files that exist in the `event-media` bucket, or use a single shared
placeholder path (`posters/placeholder.jpg`) uploaded once via
`npx supabase storage cp ./seed-assets/placeholder.jpg ss:///event-media/posters/placeholder.jpg`.

- [ ] **Step 5: Apply migrations and seed**

```bash
npx supabase db reset
```

Expected: migrations apply cleanly, seed inserts without error.

- [ ] **Step 6: Write the failing RLS test**

Create `src/lib/supabase/rls.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createPublicClient } from "./server";

describe("public read policies", () => {
  it("returns only future published events to anonymous readers", async () => {
    const supabase = createPublicClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, starts_at, is_published, deleted_at");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    for (const row of data!) {
      expect(new Date(row.starts_at).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
      expect(row.is_published).toBe(true);
      expect(row.deleted_at).toBeNull();
    }
  });

  it("refuses anonymous writes to events", async () => {
    const supabase = createPublicClient();
    const { error } = await supabase.from("events").insert({
      venue_id: "00000000-0000-0000-0000-000000000000",
      category_id: "00000000-0000-0000-0000-000000000000",
      city_id: "00000000-0000-0000-0000-000000000000",
      slug: "hacked",
      title_en: "Hacked",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
      poster_image_path: "x.jpg",
    });
    expect(error).not.toBeNull();
  });

  it("hides profiles from anonymous readers", async () => {
    const supabase = createPublicClient();
    const { data } = await supabase.from("profiles").select("id");
    expect(data ?? []).toHaveLength(0);
  });
});
```

- [ ] **Step 7: Run the test and verify it fails**

Run: `npm test -- src/lib/supabase/rls.test.ts`
Expected: FAIL — cannot resolve `./server`.

- [ ] **Step 8: Implement the public Supabase client**

Create `src/lib/supabase/server.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

export function createPublicClient(): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getEnv();
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  });
}
```

- [ ] **Step 9: Run the test and verify it passes**

Run: `npm test -- src/lib/supabase/rls.test.ts`
Expected: PASS (3 tests). If the first test fails because no events are returned, the seed data lacks future published events — fix the seed, not the test.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add database schema, RLS policies, and seed data"
```

---

### Task 3: Slug generation with Georgian transliteration

**Files:**
- Create: `src/lib/slug.ts`
- Test: `src/lib/slug.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `transliterate(input: string): string` and `makeSlug(title: string, shortId: string): string` from `src/lib/slug.ts`. Phase 2's event-creation action calls `makeSlug`.

- [ ] **Step 1: Write the failing test**

Create `src/lib/slug.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { transliterate, makeSlug } from "./slug";

describe("transliterate", () => {
  it("converts Mkhedruli to Latin", () => {
    expect(transliterate("თბილისი")).toBe("tbilisi");
    expect(transliterate("ღამის წვეულება")).toBe("ghamis tsveuleba");
  });

  it("leaves Latin text untouched", () => {
    expect(transliterate("Jazz Night")).toBe("Jazz Night");
  });
});

describe("makeSlug", () => {
  it("builds a lowercase hyphenated slug with the id suffix", () => {
    expect(makeSlug("Jazz Night at Fabrika", "a1b2c3")).toBe("jazz-night-at-fabrika-a1b2c3");
  });

  it("transliterates Georgian titles", () => {
    expect(makeSlug("ჯაზის საღამო", "x9y8z7")).toBe("jazis-saghamo-x9y8z7");
  });

  it("strips punctuation and collapses whitespace", () => {
    expect(makeSlug("  DJ  Set: 90's  Party!! ", "zz11")).toBe("dj-set-90-s-party-zz11");
  });

  it("falls back to the id alone when the title has no slug-safe characters", () => {
    expect(makeSlug("!!!", "abc123")).toBe("abc123");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/lib/slug.test.ts`
Expected: FAIL — cannot resolve `./slug`.

- [ ] **Step 3: Implement**

Create `src/lib/slug.ts`:

```ts
const GEORGIAN_MAP: Record<string, string> = {
  ა: "a", ბ: "b", გ: "g", დ: "d", ე: "e", ვ: "v", ზ: "z", თ: "t",
  ი: "i", კ: "k", ლ: "l", მ: "m", ნ: "n", ო: "o", პ: "p", ჟ: "zh",
  რ: "r", ს: "s", ტ: "t", უ: "u", ფ: "p", ქ: "k", ღ: "gh", ყ: "q",
  შ: "sh", ჩ: "ch", ც: "ts", ძ: "dz", წ: "ts", ჭ: "ch", ხ: "kh",
  ჯ: "j", ჰ: "h",
};

export function transliterate(input: string): string {
  return [...input].map((ch) => GEORGIAN_MAP[ch] ?? ch).join("");
}

export function makeSlug(title: string, shortId: string): string {
  const base = transliterate(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base ? `${base}-${shortId}` : shortId;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/lib/slug.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.ts src/lib/slug.test.ts
git commit -m "feat: add slug generation with Georgian transliteration"
```

---

### Task 4: Locale routing and content-language fallback

**Files:**
- Create: `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/middleware.ts`
- Create: `messages/ka.json`, `messages/en.json`
- Create: `src/lib/content.ts`
- Modify: `next.config.ts`
- Move: `src/app/layout.tsx` → `src/app/[locale]/layout.tsx`; delete `src/app/page.tsx`
- Test: `src/lib/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Locale = "ka" | "en"` and `locales`, `defaultLocale` from `src/i18n/routing.ts`.
  - `pickContent<T extends Record<string, unknown>>(row: T, field: string, locale: Locale): string | null` from `src/lib/content.ts` — reads `${field}_${locale}`, falls back to the other locale, returns `null` if both are empty. Every page renders user content through this.

- [ ] **Step 1: Write the failing test for content fallback**

Create `src/lib/content.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickContent } from "./content";

const bilingual = { title_ka: "ჯაზი", title_en: "Jazz" };
const georgianOnly = { title_ka: "ჯაზი", title_en: null };
const englishOnly = { title_ka: null, title_en: "Jazz" };
const empty = { title_ka: null, title_en: null };

describe("pickContent", () => {
  it("returns the requested locale when present", () => {
    expect(pickContent(bilingual, "title", "en")).toBe("Jazz");
    expect(pickContent(bilingual, "title", "ka")).toBe("ჯაზი");
  });

  it("falls back to the other locale rather than rendering blank", () => {
    expect(pickContent(georgianOnly, "title", "en")).toBe("ჯაზი");
    expect(pickContent(englishOnly, "title", "ka")).toBe("Jazz");
  });

  it("treats an empty string as absent", () => {
    expect(pickContent({ title_ka: "   ", title_en: "Jazz" }, "title", "ka")).toBe("Jazz");
  });

  it("returns null when neither locale has content", () => {
    expect(pickContent(empty, "title", "ka")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/lib/content.test.ts`
Expected: FAIL — cannot resolve `./content`.

- [ ] **Step 3: Implement content fallback**

Create `src/lib/content.ts`:

```ts
import type { Locale } from "@/i18n/routing";

const OTHER: Record<Locale, Locale> = { ka: "en", en: "ka" };

function value(row: Record<string, unknown>, key: string): string | null {
  const raw = row[key];
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function pickContent(
  row: Record<string, unknown>,
  field: string,
  locale: Locale,
): string | null {
  return value(row, `${field}_${locale}`) ?? value(row, `${field}_${OTHER[locale]}`);
}
```

- [ ] **Step 4: Add routing config**

Create `src/i18n/routing.ts`:

```ts
import { defineRouting } from "next-intl/routing";

export const locales = ["ka", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "ka";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
```

Create `src/i18n/request.ts`:

```ts
import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = (routing.locales as readonly string[]).includes(requested ?? "")
    ? (requested as Locale)
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
```

Create `src/middleware.ts`:

```ts
import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";

export default createMiddleware(routing);

export const config = {
  matcher: ["/", "/(ka|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
```

Update `next.config.ts`:

```ts
import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {};

export default withNextIntl(nextConfig);
```

- [ ] **Step 5: Add message catalogues**

Create `messages/en.json`:

```json
{
  "nav": { "brand": "Revent", "browse": "Browse", "listVenue": "List your venue" },
  "home": { "tonight": "Tonight", "weekend": "This weekend", "trending": "Trending", "allEvents": "All events" },
  "filters": { "city": "City", "category": "Category", "when": "When", "free": "Free entry", "clear": "Clear filters", "search": "Search events" },
  "when": { "any": "Any date", "tonight": "Tonight", "tomorrow": "Tomorrow", "weekend": "This weekend", "week": "This week" },
  "event": { "free": "Free", "from": "From {amount} GEL", "dressCode": "Dress code", "at": "at" },
  "empty": { "title": "Nothing here yet", "body": "No events match these filters. Try a wider date range or another category." },
  "error": { "title": "Something went wrong", "retry": "Try again" },
  "notFound": { "title": "Page not found", "body": "This event may have ended or been removed.", "browse": "Browse events" }
}
```

Create `messages/ka.json` with the same keys and Georgian values.

- [ ] **Step 6: Move the root layout under `[locale]`**

Create `src/app/[locale]/layout.tsx`:

```tsx
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { Noto_Sans_Georgian } from "next/font/google";
import { routing } from "@/i18n/routing";
import "@/styles/globals.scss";

const font = Noto_Sans_Georgian({
  subsets: ["georgian", "latin"],
  variable: "--font-body",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale} className={font.variable}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
```

Delete `src/app/page.tsx` and the old `src/app/layout.tsx`. Create a placeholder `src/app/[locale]/page.tsx` returning `<main>Revent</main>` — Task 8 replaces it.

- [ ] **Step 7: Run the tests and the dev server**

Run: `npm test -- src/lib/content.test.ts`
Expected: PASS (4 tests).

Run: `npm run dev`, then visit `/` — expect a redirect to `/ka`. Visit `/en` — expect the page to render.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add locale routing and bilingual content fallback"
```

---

### Task 5: Design tokens and base styles

**Files:**
- Create: `src/styles/_tokens.scss`, `src/styles/globals.scss`
- Test: visual check only (no unit test — this task produces no logic)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties consumed by every component's SCSS module: `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-accent`, `--color-border`, `--radius-md`, `--space-1` … `--space-8`, `--font-body`.

- [ ] **Step 1: Write the token sheet**

Create `src/styles/_tokens.scss`:

```scss
:root {
  --color-bg: #0e0e11;
  --color-surface: #17171c;
  --color-surface-raised: #1f1f26;
  --color-text: #f4f4f5;
  --color-text-muted: #a1a1ab;
  --color-accent: #ff4d6d;
  --color-accent-text: #ffffff;
  --color-border: #2a2a33;

  --radius-sm: 6px;
  --radius-md: 12px;
  --radius-lg: 20px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;

  --max-width: 1200px;
}
```

Nightlife content reads better dark; this is a deliberate single-theme choice, not a missing light mode. A theme toggle is out of scope for Phase 1.

- [ ] **Step 2: Write global styles**

Create `src/styles/globals.scss`:

```scss
@use "./tokens";

*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body), system-ui, sans-serif;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

a {
  color: inherit;
  text-decoration: none;
}

img {
  max-width: 100%;
  display: block;
}

.container {
  width: 100%;
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 var(--space-4);
}
```

- [ ] **Step 3: Verify Georgian rendering**

Run `npm run dev`, visit `/ka`, and confirm Georgian text renders in Noto Sans Georgian with no tofu boxes.

- [ ] **Step 4: Commit**

```bash
git add src/styles
git commit -m "feat: add design tokens and base styles"
```

---

### Task 6: Discovery query module

**Files:**
- Create: `src/modules/discovery/types.ts`, `src/modules/discovery/filters.ts`, `src/modules/discovery/queries.ts`
- Test: `src/modules/discovery/filters.test.ts`, `src/modules/discovery/queries.test.ts`

**Interfaces:**
- Consumes: `createPublicClient()` (Task 2), `Locale` (Task 4).
- Produces:
  - `type WhenFilter = "any" | "tonight" | "tomorrow" | "weekend" | "week"`
  - `type EventFilters = { citySlug?: string; categorySlug?: string; when: WhenFilter; freeOnly: boolean; q?: string; cursor?: string }`
  - `parseFilters(params: Record<string, string | string[] | undefined>): EventFilters`
  - `toSearchParams(filters: EventFilters): URLSearchParams`
  - `resolveDateRange(when: WhenFilter, now: Date): { from: Date; to: Date | null }`
  - `type EventListItem` and `listEvents(filters: EventFilters, limit?: number): Promise<{ items: EventListItem[]; nextCursor: string | null }>`
  - `getEventBySlug(slug: string): Promise<EventDetail | null>`
  - `listCities(): Promise<City[]>`, `listCategories(): Promise<Category[]>`

  This is the ONLY module allowed to query events for public pages.

- [ ] **Step 1: Write the failing filter tests**

Create `src/modules/discovery/filters.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseFilters, toSearchParams, resolveDateRange } from "./filters";

describe("parseFilters", () => {
  it("defaults to any date and no filters", () => {
    expect(parseFilters({})).toEqual({ when: "any", freeOnly: false });
  });

  it("reads known values from the query string", () => {
    expect(parseFilters({ category: "dj", when: "weekend", free: "1", q: "jazz" })).toEqual({
      categorySlug: "dj",
      when: "weekend",
      freeOnly: true,
      q: "jazz",
    });
  });

  it("ignores an unknown when value instead of throwing", () => {
    expect(parseFilters({ when: "next-century" }).when).toBe("any");
  });

  it("takes the first value when a param repeats", () => {
    expect(parseFilters({ category: ["dj", "trivia"] }).categorySlug).toBe("dj");
  });
});

describe("toSearchParams", () => {
  it("omits defaults so canonical URLs stay clean", () => {
    expect(toSearchParams({ when: "any", freeOnly: false }).toString()).toBe("");
  });

  it("round-trips a populated filter set", () => {
    const filters = { categorySlug: "dj", when: "tonight" as const, freeOnly: true, q: "set" };
    expect(parseFilters(Object.fromEntries(toSearchParams(filters)))).toEqual(filters);
  });
});

describe("resolveDateRange", () => {
  const now = new Date("2026-08-19T18:00:00+04:00"); // a Wednesday

  it("returns now with no upper bound for 'any'", () => {
    const range = resolveDateRange("any", now);
    expect(range.from).toEqual(now);
    expect(range.to).toBeNull();
  });

  it("ends 'tonight' at 6am the next morning, not midnight", () => {
    const range = resolveDateRange("tonight", now);
    expect(range.to!.toISOString()).toBe(new Date("2026-08-20T06:00:00+04:00").toISOString());
  });

  it("spans Friday 18:00 to Monday 06:00 for 'weekend'", () => {
    const range = resolveDateRange("weekend", now);
    expect(range.from.toISOString()).toBe(new Date("2026-08-21T18:00:00+04:00").toISOString());
    expect(range.to!.toISOString()).toBe(new Date("2026-08-24T06:00:00+04:00").toISOString());
  });

  it("never starts a range in the past", () => {
    const friday = new Date("2026-08-21T23:00:00+04:00");
    expect(resolveDateRange("weekend", friday).from).toEqual(friday);
  });
});
```

Note the 6am boundary: a club night starting at 23:00 is "tonight" for someone browsing at 01:00, so calendar days are the wrong unit for nightlife.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm test -- src/modules/discovery/filters.test.ts`
Expected: FAIL — cannot resolve `./filters`.

- [ ] **Step 3: Implement filters**

Create `src/modules/discovery/filters.ts`:

```ts
export const WHEN_VALUES = ["any", "tonight", "tomorrow", "weekend", "week"] as const;
export type WhenFilter = (typeof WHEN_VALUES)[number];

export type EventFilters = {
  citySlug?: string;
  categorySlug?: string;
  when: WhenFilter;
  freeOnly: boolean;
  q?: string;
  cursor?: string;
};

const TZ_OFFSET_HOURS = 4; // Georgia, no DST
const NIGHT_ENDS_HOUR = 6;

function first(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseFilters(
  params: Record<string, string | string[] | undefined>,
): EventFilters {
  const when = first(params.when);
  const filters: EventFilters = {
    when: (WHEN_VALUES as readonly string[]).includes(when ?? "")
      ? (when as WhenFilter)
      : "any",
    freeOnly: first(params.free) === "1",
  };
  const city = first(params.city);
  const category = first(params.category);
  const q = first(params.q);
  const cursor = first(params.cursor);
  if (city) filters.citySlug = city;
  if (category) filters.categorySlug = category;
  if (q) filters.q = q;
  if (cursor) filters.cursor = cursor;
  return filters;
}

export function toSearchParams(filters: EventFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.citySlug) params.set("city", filters.citySlug);
  if (filters.categorySlug) params.set("category", filters.categorySlug);
  if (filters.when !== "any") params.set("when", filters.when);
  if (filters.freeOnly) params.set("free", "1");
  if (filters.q) params.set("q", filters.q);
  if (filters.cursor) params.set("cursor", filters.cursor);
  return params;
}

/** Local (UTC+4) wall-clock helpers, so "tonight" means tonight in Georgia. */
function localParts(date: Date) {
  const shifted = new Date(date.getTime() + TZ_OFFSET_HOURS * 3_600_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    weekday: shifted.getUTCDay(), // 0 = Sunday
  };
}

function localDate(year: number, month: number, day: number, hour: number): Date {
  return new Date(Date.UTC(year, month, day, hour - TZ_OFFSET_HOURS, 0, 0, 0));
}

function notBefore(candidate: Date, floor: Date): Date {
  return candidate.getTime() < floor.getTime() ? floor : candidate;
}

export function resolveDateRange(
  when: WhenFilter,
  now: Date,
): { from: Date; to: Date | null } {
  const p = localParts(now);
  const nextMorning = localDate(p.year, p.month, p.day + 1, NIGHT_ENDS_HOUR);

  switch (when) {
    case "any":
      return { from: now, to: null };
    case "tonight":
      return { from: now, to: nextMorning };
    case "tomorrow":
      return {
        from: notBefore(nextMorning, now),
        to: localDate(p.year, p.month, p.day + 2, NIGHT_ENDS_HOUR),
      };
    case "weekend": {
      const daysUntilFriday = (5 - p.weekday + 7) % 7;
      const fridayEvening = localDate(p.year, p.month, p.day + daysUntilFriday, 18);
      const mondayMorning = localDate(
        p.year,
        p.month,
        p.day + daysUntilFriday + 3,
        NIGHT_ENDS_HOUR,
      );
      return { from: notBefore(fridayEvening, now), to: mondayMorning };
    }
    case "week":
      return { from: now, to: localDate(p.year, p.month, p.day + 7, NIGHT_ENDS_HOUR) };
  }
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm test -- src/modules/discovery/filters.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Write the failing query tests**

Create `src/modules/discovery/queries.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { listEvents, getEventBySlug, listCities, listCategories } from "./queries";

describe("listEvents", () => {
  it("returns only future published events", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(new Date(item.starts_at).getTime()).toBeGreaterThanOrEqual(Date.now() - 1000);
    }
  });

  it("orders by start time ascending", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false });
    const times = items.map((i) => new Date(i.starts_at).getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it("filters by city", async () => {
    const { items } = await listEvents({ citySlug: "batumi", when: "any", freeOnly: false });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) expect(item.city.slug).toBe("batumi");
  });

  it("filters by category", async () => {
    const { items } = await listEvents({ categorySlug: "dj", when: "any", freeOnly: false });
    for (const item of items) expect(item.category.slug).toBe("dj");
  });

  it("returns only free events when freeOnly is set", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: true });
    for (const item of items) expect(item.entry_fee_gel).toBeNull();
  });

  it("paginates with a stable cursor and no duplicates", async () => {
    const page1 = await listEvents({ when: "any", freeOnly: false }, 2);
    expect(page1.items).toHaveLength(2);
    expect(page1.nextCursor).not.toBeNull();

    const page2 = await listEvents(
      { when: "any", freeOnly: false, cursor: page1.nextCursor! },
      2,
    );
    const ids = new Set([...page1.items, ...page2.items].map((i) => i.id));
    expect(ids.size).toBe(page1.items.length + page2.items.length);
  });

  it("returns an empty page rather than throwing for an unknown city", async () => {
    const { items } = await listEvents({ citySlug: "atlantis", when: "any", freeOnly: false });
    expect(items).toEqual([]);
  });
});

describe("getEventBySlug", () => {
  it("returns null for an unknown slug", async () => {
    expect(await getEventBySlug("no-such-event-zzz")).toBeNull();
  });

  it("returns the event with its venue and city for a known slug", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false }, 1);
    const detail = await getEventBySlug(items[0].slug);
    expect(detail).not.toBeNull();
    expect(detail!.venue.slug).toBeTruthy();
    expect(detail!.city.slug).toBeTruthy();
  });
});

describe("reference data", () => {
  it("lists active cities", async () => {
    const cities = await listCities();
    expect(cities.map((c) => c.slug)).toContain("tbilisi");
  });

  it("lists categories in sort order", async () => {
    const categories = await listCategories();
    const order = categories.map((c) => c.sort_order);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
```

- [ ] **Step 6: Run the tests and verify they fail**

Run: `npm test -- src/modules/discovery/queries.test.ts`
Expected: FAIL — cannot resolve `./queries`.

- [ ] **Step 7: Implement the types**

Create `src/modules/discovery/types.ts`:

```ts
export type City = {
  id: string;
  slug: string;
  name_ka: string;
  name_en: string;
};

export type Category = {
  id: string;
  slug: string;
  name_ka: string;
  name_en: string;
  icon: string;
  sort_order: number;
};

export type VenueRef = {
  id: string;
  slug: string;
  name_ka: string | null;
  name_en: string | null;
  is_verified: boolean;
};

export type EventListItem = {
  id: string;
  slug: string;
  title_ka: string | null;
  title_en: string | null;
  starts_at: string;
  poster_image_path: string;
  entry_fee_gel: number | null;
  favorite_count: number;
  venue: VenueRef;
  city: City;
  category: Category;
};

export type EventDetail = EventListItem & {
  description_ka: string | null;
  description_en: string | null;
  ends_at: string | null;
  dress_code: string | null;
  view_count: number;
  venue: VenueRef & {
    description_ka: string | null;
    description_en: string | null;
    address_ka: string | null;
    address_en: string | null;
    phone: string | null;
    website: string | null;
    instagram: string | null;
    facebook: string | null;
  };
  images: { id: string; image_path: string; position: number }[];
};
```

- [ ] **Step 8: Implement the queries**

Create `src/modules/discovery/queries.ts`:

```ts
import { createPublicClient } from "@/lib/supabase/server";
import { resolveDateRange, type EventFilters } from "./filters";
import type { Category, City, EventDetail, EventListItem } from "./types";

const LIST_SELECT = `
  id, slug, title_ka, title_en, starts_at, poster_image_path,
  entry_fee_gel, favorite_count,
  venue:venues!inner (id, slug, name_ka, name_en, is_verified),
  city:cities!inner (id, slug, name_ka, name_en),
  category:categories!inner (id, slug, name_ka, name_en, icon, sort_order)
`;

/** Cursor encodes the sort key so pagination is stable when rows are inserted mid-scroll. */
function encodeCursor(item: EventListItem): string {
  return Buffer.from(`${item.starts_at}|${item.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { startsAt: string; id: string } | null {
  try {
    const [startsAt, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    return startsAt && id ? { startsAt, id } : null;
  } catch {
    return null;
  }
}

export async function listEvents(
  filters: EventFilters,
  limit = 24,
): Promise<{ items: EventListItem[]; nextCursor: string | null }> {
  const supabase = createPublicClient();
  const range = resolveDateRange(filters.when, new Date());

  let query = supabase
    .from("events")
    .select(LIST_SELECT)
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", range.from.toISOString())
    .order("starts_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit + 1);

  if (range.to) query = query.lt("starts_at", range.to.toISOString());
  if (filters.citySlug) query = query.eq("cities.slug", filters.citySlug);
  if (filters.categorySlug) query = query.eq("categories.slug", filters.categorySlug);
  if (filters.freeOnly) query = query.is("entry_fee_gel", null);

  const decoded = filters.cursor ? decodeCursor(filters.cursor) : null;
  if (decoded) {
    query = query.or(
      `starts_at.gt.${decoded.startsAt},and(starts_at.eq.${decoded.startsAt},id.gt.${decoded.id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw new Error(`listEvents failed: ${error.message}`);

  const rows = (data ?? []) as unknown as EventListItem[];
  const items = rows.slice(0, limit);
  const nextCursor = rows.length > limit ? encodeCursor(items[items.length - 1]) : null;
  return { items, nextCursor };
}

export async function getEventBySlug(slug: string): Promise<EventDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("events")
    .select(`
      ${LIST_SELECT},
      description_ka, description_en, ends_at, dress_code, view_count,
      venue:venues!inner (
        id, slug, name_ka, name_en, is_verified,
        description_ka, description_en, address_ka, address_en,
        phone, website, instagram, facebook
      ),
      images:event_images (id, image_path, position)
    `)
    .eq("slug", slug)
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", new Date().toISOString())
    .maybeSingle();

  if (error) throw new Error(`getEventBySlug failed: ${error.message}`);
  return (data as unknown as EventDetail) ?? null;
}

export async function listCities(): Promise<City[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("cities")
    .select("id, slug, name_ka, name_en")
    .eq("is_active", true)
    .order("name_en");
  if (error) throw new Error(`listCities failed: ${error.message}`);
  return (data ?? []) as City[];
}

export async function listCategories(): Promise<Category[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, slug, name_ka, name_en, icon, sort_order")
    .order("sort_order");
  if (error) throw new Error(`listCategories failed: ${error.message}`);
  return (data ?? []) as Category[];
}
```

- [ ] **Step 9: Run the tests and verify they pass**

Run: `npm test -- src/modules/discovery/queries.test.ts`
Expected: PASS (11 tests). If pagination fails, confirm the seed has more than 2 future published events.

- [ ] **Step 10: Commit**

```bash
git add src/modules/discovery
git commit -m "feat: add discovery query module with URL filters and cursor pagination"
```

---

### Task 7: Event card and grid components

**Files:**
- Create: `src/components/EventCard.tsx`, `src/components/EventCard.module.scss`
- Create: `src/components/EventGrid.tsx`, `src/components/EventGrid.module.scss`
- Create: `src/lib/format.ts`
- Test: `src/lib/format.test.ts`, `src/components/EventCard.test.tsx`

**Interfaces:**
- Consumes: `EventListItem` (Task 6), `pickContent` (Task 4), tokens (Task 5).
- Produces: `<EventCard event={item} locale={locale} />`, `<EventGrid events={items} locale={locale} />`, and `formatEventDate(iso: string, locale: Locale): string`, `formatPrice(gel: number | null, locale: Locale): string`.

- [ ] **Step 1: Write the failing formatter test**

Create `src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatEventDate, formatPrice } from "./format";

describe("formatEventDate", () => {
  it("renders a Georgian-time weekday, day and time in English", () => {
    const out = formatEventDate("2026-08-21T19:00:00+04:00", "en");
    expect(out).toContain("21");
    expect(out).toContain("19:00");
  });

  it("renders Georgian locale output", () => {
    const out = formatEventDate("2026-08-21T19:00:00+04:00", "ka");
    expect(out).toContain("19:00");
  });

  it("uses Georgian local time regardless of the runtime timezone", () => {
    // 23:00 in Tbilisi is 19:00 UTC — must not render as 19:00 on a UTC server.
    expect(formatEventDate("2026-08-21T19:00:00Z", "en")).toContain("23:00");
  });
});

describe("formatPrice", () => {
  it("labels a null fee as free", () => {
    expect(formatPrice(null, "en")).toBe("Free");
    expect(formatPrice(null, "ka")).toBe("უფასო");
  });

  it("renders lari amounts", () => {
    expect(formatPrice(20, "en")).toBe("20 GEL");
    expect(formatPrice(20, "ka")).toBe("20 ₾");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/lib/format.test.ts`
Expected: FAIL — cannot resolve `./format`.

- [ ] **Step 3: Implement the formatters**

Create `src/lib/format.ts`:

```ts
import type { Locale } from "@/i18n/routing";

const TIME_ZONE = "Asia/Tbilisi";

export function formatEventDate(iso: string, locale: Locale): string {
  const date = new Date(iso);
  return new Intl.DateTimeFormat(locale === "ka" ? "ka-GE" : "en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(date);
}

export function formatPrice(gel: number | null, locale: Locale): string {
  if (gel === null) return locale === "ka" ? "უფასო" : "Free";
  return locale === "ka" ? `${gel} ₾` : `${gel} GEL`;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/lib/format.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing card test**

Create `src/components/EventCard.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EventCard } from "./EventCard";
import type { EventListItem } from "@/modules/discovery/types";

const base: EventListItem = {
  id: "1",
  slug: "jazz-night-abc123",
  title_ka: "ჯაზის საღამო",
  title_en: null,
  starts_at: "2026-08-21T19:00:00+04:00",
  poster_image_path: "posters/jazz.jpg",
  entry_fee_gel: null,
  favorite_count: 3,
  venue: { id: "v1", slug: "fabrika", name_ka: "ფაბრიკა", name_en: "Fabrika", is_verified: true },
  city: { id: "c1", slug: "tbilisi", name_ka: "თბილისი", name_en: "Tbilisi" },
  category: { id: "cat1", slug: "live-music", name_ka: "ცოცხალი მუსიკა", name_en: "Live music", icon: "music", sort_order: 1 },
};

describe("EventCard", () => {
  it("falls back to the Georgian title for an English viewer", () => {
    render(<EventCard event={base} locale="en" />);
    expect(screen.getByText("ჯაზის საღამო")).toBeDefined();
  });

  it("links to the locale-prefixed event page", () => {
    render(<EventCard event={base} locale="en" />);
    const link = screen.getByRole("link");
    expect(link.getAttribute("href")).toBe("/en/events/jazz-night-abc123");
  });

  it("marks free entry", () => {
    render(<EventCard event={base} locale="en" />);
    expect(screen.getByText("Free")).toBeDefined();
  });

  it("shows the verified badge only for verified venues", () => {
    const { rerender } = render(<EventCard event={base} locale="en" />);
    expect(screen.queryByLabelText("Verified venue")).not.toBeNull();

    rerender(
      <EventCard event={{ ...base, venue: { ...base.venue, is_verified: false } }} locale="en" />,
    );
    expect(screen.queryByLabelText("Verified venue")).toBeNull();
  });
});
```

- [ ] **Step 6: Run the test and verify it fails**

Run: `npm test -- src/components/EventCard.test.tsx`
Expected: FAIL — cannot resolve `./EventCard`.

- [ ] **Step 7: Implement the card**

Create `src/components/EventCard.module.scss`:

```scss
.card {
  display: flex;
  flex-direction: column;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: transform 120ms ease, border-color 120ms ease;

  &:hover {
    transform: translateY(-2px);
    border-color: var(--color-accent);
  }
}

.poster {
  aspect-ratio: 4 / 5;
  width: 100%;
  object-fit: cover;
  background: var(--color-surface-raised);
}

.body {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding: var(--space-4);
}

.date {
  color: var(--color-accent);
  font-size: 0.8125rem;
  font-weight: 600;
}

.title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  line-height: 1.3;
}

.venue {
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.meta {
  display: flex;
  gap: var(--space-2);
  align-items: center;
  margin-top: var(--space-2);
  font-size: 0.8125rem;
  color: var(--color-text-muted);
}

.badge {
  color: var(--color-accent);
}
```

Create `src/components/EventCard.tsx`:

```tsx
import Link from "next/link";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { formatEventDate, formatPrice } from "@/lib/format";
import { publicImageUrl } from "@/lib/images";
import type { EventListItem } from "@/modules/discovery/types";
import styles from "./EventCard.module.scss";

export function EventCard({ event, locale }: { event: EventListItem; locale: Locale }) {
  const title = pickContent(event, "title", locale) ?? "—";
  const venueName = pickContent(event.venue, "name", locale) ?? "";
  const cityName = pickContent(event.city, "name", locale) ?? "";
  const categoryName = pickContent(event.category, "name", locale) ?? "";

  return (
    <Link href={`/${locale}/events/${event.slug}`} className={styles.card}>
      <img
        className={styles.poster}
        src={publicImageUrl(event.poster_image_path)}
        alt=""
        loading="lazy"
      />
      <div className={styles.body}>
        <span className={styles.date}>{formatEventDate(event.starts_at, locale)}</span>
        <h3 className={styles.title}>{title}</h3>
        <span className={styles.venue}>
          {venueName}
          {event.venue.is_verified && (
            <span className={styles.badge} aria-label="Verified venue" role="img">
              {" ✓"}
            </span>
          )}
          {cityName && ` · ${cityName}`}
        </span>
        <div className={styles.meta}>
          <span>{categoryName}</span>
          <span>·</span>
          <span>{formatPrice(event.entry_fee_gel, locale)}</span>
        </div>
      </div>
    </Link>
  );
}
```

Create `src/lib/images.ts`:

```ts
import { getEnv } from "@/lib/env";

const BUCKET = "event-media";

export function publicImageUrl(path: string): string {
  const { supabaseUrl } = getEnv();
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;
}
```

- [ ] **Step 8: Run the test and verify it passes**

Run: `npm test -- src/components/EventCard.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 9: Implement the grid**

Create `src/components/EventGrid.module.scss`:

```scss
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: var(--space-4);
}

.empty {
  padding: var(--space-7) 0;
  text-align: center;
  color: var(--color-text-muted);
}
```

Create `src/components/EventGrid.tsx`:

```tsx
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { EventListItem } from "@/modules/discovery/types";
import { EventCard } from "./EventCard";
import styles from "./EventGrid.module.scss";

export function EventGrid({
  events,
  locale,
}: {
  events: EventListItem[];
  locale: Locale;
}) {
  const t = useTranslations("empty");

  if (events.length === 0) {
    return (
      <div className={styles.empty}>
        <p>{t("title")}</p>
        <p>{t("body")}</p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {events.map((event) => (
        <EventCard key={event.id} event={event} locale={locale} />
      ))}
    </div>
  );
}
```

- [ ] **Step 10: Commit**

```bash
git add src/components src/lib/format.ts src/lib/format.test.ts src/lib/images.ts
git commit -m "feat: add event card and grid components"
```

---

### Task 8: Homepage with city selection

**Files:**
- Create: `src/app/[locale]/page.tsx`, `src/app/[locale]/page.module.scss`
- Create: `src/components/CitySelect.tsx`, `src/components/CitySelect.module.scss`
- Create: `src/components/SiteHeader.tsx`, `src/components/SiteHeader.module.scss`
- Create: `src/lib/city-cookie.ts`
- Test: `src/lib/city-cookie.test.ts`

**Interfaces:**
- Consumes: `listEvents`, `listCities` (Task 6), `EventGrid` (Task 7).
- Produces: `CITY_COOKIE` constant and `resolveActiveCity(cookieValue: string | undefined, cities: City[]): City | null` from `src/lib/city-cookie.ts`; `<SiteHeader locale={locale} cities={cities} activeCity={city} />`.

- [ ] **Step 1: Write the failing city-resolution test**

Create `src/lib/city-cookie.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveActiveCity, CITY_COOKIE } from "./city-cookie";

const cities = [
  { id: "1", slug: "tbilisi", name_ka: "თბილისი", name_en: "Tbilisi" },
  { id: "2", slug: "batumi", name_ka: "ბათუმი", name_en: "Batumi" },
];

describe("resolveActiveCity", () => {
  it("uses the cookie value when it names a known city", () => {
    expect(resolveActiveCity("batumi", cities)!.slug).toBe("batumi");
  });

  it("defaults to Tbilisi when the cookie is absent", () => {
    expect(resolveActiveCity(undefined, cities)!.slug).toBe("tbilisi");
  });

  it("ignores an unknown cookie value rather than trusting it", () => {
    expect(resolveActiveCity("atlantis", cities)!.slug).toBe("tbilisi");
  });

  it("returns null when there are no cities at all", () => {
    expect(resolveActiveCity("tbilisi", [])).toBeNull();
  });

  it("exposes a stable cookie name", () => {
    expect(CITY_COOKIE).toBe("revent_city");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/lib/city-cookie.test.ts`
Expected: FAIL — cannot resolve `./city-cookie`.

- [ ] **Step 3: Implement**

Create `src/lib/city-cookie.ts`:

```ts
import type { City } from "@/modules/discovery/types";

export const CITY_COOKIE = "revent_city";
const DEFAULT_CITY_SLUG = "tbilisi";

export function resolveActiveCity(
  cookieValue: string | undefined,
  cities: City[],
): City | null {
  if (cities.length === 0) return null;
  return (
    cities.find((c) => c.slug === cookieValue) ??
    cities.find((c) => c.slug === DEFAULT_CITY_SLUG) ??
    cities[0]
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/lib/city-cookie.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Build the city selector**

Create `src/components/CitySelect.module.scss`:

```scss
.select {
  background: var(--color-surface-raised);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font: inherit;
  font-size: 0.875rem;
}
```

Create `src/components/CitySelect.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CITY_COOKIE } from "@/lib/city-cookie";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import type { City } from "@/modules/discovery/types";
import styles from "./CitySelect.module.scss";

export function CitySelect({
  cities,
  activeSlug,
  locale,
}: {
  cities: City[];
  activeSlug: string;
  locale: Locale;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onChange(slug: string) {
    document.cookie = `${CITY_COOKIE}=${slug}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <select
      className={styles.select}
      value={activeSlug}
      disabled={isPending}
      onChange={(e) => onChange(e.target.value)}
      aria-label="City"
    >
      {cities.map((city) => (
        <option key={city.id} value={city.slug}>
          {pickContent(city, "name", locale)}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 6: Build the header**

Create `src/components/SiteHeader.module.scss`:

```scss
.header {
  border-bottom: 1px solid var(--color-border);
  background: var(--color-surface);
}

.inner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  padding: var(--space-4);
  max-width: var(--max-width);
  margin: 0 auto;
}

.brand {
  font-weight: 700;
  font-size: 1.25rem;
  color: var(--color-accent);
  margin-right: auto;
}

.langs {
  display: flex;
  gap: var(--space-2);
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.active {
  color: var(--color-text);
  font-weight: 600;
}
```

Create `src/components/SiteHeader.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { City } from "@/modules/discovery/types";
import { CitySelect } from "./CitySelect";
import styles from "./SiteHeader.module.scss";

export function SiteHeader({
  locale,
  cities,
  activeCitySlug,
}: {
  locale: Locale;
  cities: City[];
  activeCitySlug: string;
}) {
  const t = useTranslations("nav");

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={`/${locale}`} className={styles.brand}>
          {t("brand")}
        </Link>
        <CitySelect cities={cities} activeSlug={activeCitySlug} locale={locale} />
        <div className={styles.langs}>
          <Link href="/ka" className={locale === "ka" ? styles.active : undefined}>
            ქარ
          </Link>
          <Link href="/en" className={locale === "en" ? styles.active : undefined}>
            EN
          </Link>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 7: Build the homepage**

Create `src/app/[locale]/page.module.scss`:

```scss
.section {
  margin: var(--space-7) 0;
}

.heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: var(--space-4);
}

.title {
  font-size: 1.375rem;
  margin: 0;
}

.more {
  color: var(--color-accent);
  font-size: 0.875rem;
}
```

Create `src/app/[locale]/page.tsx`:

```tsx
import { cookies } from "next/headers";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EventGrid } from "@/components/EventGrid";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { CITY_COOKIE, resolveActiveCity } from "@/lib/city-cookie";
import { listCities, listEvents } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("home");

  const cities = await listCities();
  const activeCity = resolveActiveCity((await cookies()).get(CITY_COOKIE)?.value, cities);
  const citySlug = activeCity?.slug;

  const [tonight, weekend, upcoming] = await Promise.all([
    listEvents({ citySlug, when: "tonight", freeOnly: false }, 8),
    listEvents({ citySlug, when: "weekend", freeOnly: false }, 8),
    listEvents({ citySlug, when: "any", freeOnly: false }, 12),
  ]);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={citySlug ?? ""} />
      <main className="container">
        {tonight.items.length > 0 && (
          <section className={styles.section}>
            <div className={styles.heading}>
              <h2 className={styles.title}>{t("tonight")}</h2>
              <Link className={styles.more} href={`/${locale}/${citySlug}?when=tonight`}>
                →
              </Link>
            </div>
            <EventGrid events={tonight.items} locale={locale} />
          </section>
        )}

        {weekend.items.length > 0 && (
          <section className={styles.section}>
            <div className={styles.heading}>
              <h2 className={styles.title}>{t("weekend")}</h2>
              <Link className={styles.more} href={`/${locale}/${citySlug}?when=weekend`}>
                →
              </Link>
            </div>
            <EventGrid events={weekend.items} locale={locale} />
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.heading}>
            <h2 className={styles.title}>{t("allEvents")}</h2>
            <Link className={styles.more} href={`/${locale}/${citySlug}`}>
              →
            </Link>
          </div>
          <EventGrid events={upcoming.items} locale={locale} />
        </section>
      </main>
    </>
  );
}
```

- [ ] **Step 8: Verify in the browser**

Run: `npm run dev`, visit `/ka` and `/en`.
Expected: header with city selector and language links; Tonight / This weekend / All events sections populated from seed data. Switch the city and confirm the lists change.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add homepage with city selection and event sections"
```

---

### Task 9: City browse page with URL-driven filters

**Files:**
- Create: `src/app/[locale]/[city]/page.tsx`, `src/app/[locale]/[city]/page.module.scss`
- Create: `src/components/FilterBar.tsx`, `src/components/FilterBar.module.scss`
- Create: `src/components/LoadMore.tsx`
- Test: `src/components/FilterBar.test.tsx`

**Interfaces:**
- Consumes: `parseFilters`, `toSearchParams`, `listEvents`, `listCategories` (Task 6); `EventGrid` (Task 7).
- Produces: `<FilterBar locale categories filters basePath />` — a client component that writes filter changes into the URL and never holds filter state locally.

- [ ] **Step 1: Write the failing filter-bar test**

Create `src/components/FilterBar.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "./FilterBar";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: replace }),
}));

const categories = [
  { id: "1", slug: "dj", name_ka: "დიჯეი", name_en: "DJ / club night", icon: "disc", sort_order: 1 },
  { id: "2", slug: "trivia", name_ka: "ქვიზი", name_en: "Trivia / quiz", icon: "brain", sort_order: 2 },
];

beforeEach(() => replace.mockClear());

describe("FilterBar", () => {
  it("writes the selected category into the URL", () => {
    render(
      <FilterBar
        locale="en"
        categories={categories}
        filters={{ when: "any", freeOnly: false }}
        basePath="/en/tbilisi"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "DJ / club night" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi?category=dj", { scroll: false });
  });

  it("toggles a selected category off rather than stacking filters", () => {
    render(
      <FilterBar
        locale="en"
        categories={categories}
        filters={{ categorySlug: "dj", when: "any", freeOnly: false }}
        basePath="/en/tbilisi"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "DJ / club night" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi", { scroll: false });
  });

  it("drops the pagination cursor when a filter changes", () => {
    render(
      <FilterBar
        locale="en"
        categories={categories}
        filters={{ when: "any", freeOnly: false, cursor: "abc" }}
        basePath="/en/tbilisi"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Free entry" }));
    expect(replace).toHaveBeenCalledWith("/en/tbilisi?free=1", { scroll: false });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/components/FilterBar.test.tsx`
Expected: FAIL — cannot resolve `./FilterBar`.

- [ ] **Step 3: Implement the filter bar**

Create `src/components/FilterBar.module.scss`:

```scss
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: var(--space-5) 0;
}

.chip {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
  border-radius: 999px;
  padding: var(--space-2) var(--space-4);
  font: inherit;
  font-size: 0.875rem;
  cursor: pointer;

  &:hover {
    color: var(--color-text);
  }
}

.chipActive {
  composes: chip;
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-accent-text);
}

.spacer {
  width: 100%;
}
```

Create `src/components/FilterBar.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { toSearchParams, WHEN_VALUES, type EventFilters } from "@/modules/discovery/filters";
import type { Category } from "@/modules/discovery/types";
import styles from "./FilterBar.module.scss";

export function FilterBar({
  locale,
  categories,
  filters,
  basePath,
}: {
  locale: Locale;
  categories: Category[];
  filters: EventFilters;
  basePath: string;
}) {
  const router = useRouter();
  const t = useTranslations();

  function apply(next: EventFilters) {
    // A filter change invalidates the cursor: page 2 of the old result set is meaningless.
    const { cursor: _dropped, ...withoutCursor } = next;
    const qs = toSearchParams(withoutCursor as EventFilters).toString();
    router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
  }

  return (
    <div className={styles.bar}>
      {WHEN_VALUES.map((when) => (
        <button
          key={when}
          type="button"
          className={filters.when === when ? styles.chipActive : styles.chip}
          onClick={() => apply({ ...filters, when })}
        >
          {t(`when.${when}`)}
        </button>
      ))}

      <span className={styles.spacer} />

      {categories.map((category) => {
        const active = filters.categorySlug === category.slug;
        return (
          <button
            key={category.id}
            type="button"
            className={active ? styles.chipActive : styles.chip}
            onClick={() =>
              apply({ ...filters, categorySlug: active ? undefined : category.slug })
            }
          >
            {pickContent(category, "name", locale)}
          </button>
        );
      })}

      <button
        type="button"
        className={filters.freeOnly ? styles.chipActive : styles.chip}
        onClick={() => apply({ ...filters, freeOnly: !filters.freeOnly })}
      >
        {t("filters.free")}
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/components/FilterBar.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement Load More**

Create `src/components/LoadMore.tsx`:

```tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function LoadMore({
  basePath,
  searchParams,
  cursor,
}: {
  basePath: string;
  searchParams: URLSearchParams;
  cursor: string;
}) {
  const t = await getTranslations("filters");
  const next = new URLSearchParams(searchParams);
  next.set("cursor", cursor);
  return (
    <p style={{ textAlign: "center", margin: "var(--space-6) 0" }}>
      <Link href={`${basePath}?${next.toString()}`}>{t("more")}</Link>
    </p>
  );
}
```

Add `"more": "Load more"` to `messages/en.json` under `filters`, and `"more": "მეტის ჩვენება"` to `messages/ka.json`.

- [ ] **Step 6: Build the city page**

Create `src/app/[locale]/[city]/page.module.scss`:

```scss
.title {
  margin: var(--space-6) 0 0;
  font-size: 1.75rem;
}
```

Create `src/app/[locale]/[city]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { EventGrid } from "@/components/EventGrid";
import { FilterBar } from "@/components/FilterBar";
import { LoadMore } from "@/components/LoadMore";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { parseFilters, toSearchParams } from "@/modules/discovery/filters";
import { listCategories, listCities, listEvents } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

type Props = {
  params: Promise<{ locale: Locale; city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props) {
  const { locale, city } = await params;
  const cities = await listCities();
  const match = cities.find((c) => c.slug === city);
  if (!match) return {};
  const name = pickContent(match, "name", locale);
  return {
    title: locale === "ka" ? `ღონისძიებები — ${name}` : `Events in ${name}`,
    alternates: {
      languages: { ka: `/ka/${city}`, en: `/en/${city}` },
    },
  };
}

export default async function CityPage({ params, searchParams }: Props) {
  const { locale, city } = await params;
  const cities = await listCities();
  const activeCity = cities.find((c) => c.slug === city);
  if (!activeCity) notFound();

  const filters = { ...parseFilters(await searchParams), citySlug: city };
  const [categories, page] = await Promise.all([listCategories(), listEvents(filters)]);
  const basePath = `/${locale}/${city}`;

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={city} />
      <main className="container">
        <h1 className={styles.title}>{pickContent(activeCity, "name", locale)}</h1>
        <FilterBar
          locale={locale}
          categories={categories}
          filters={filters}
          basePath={basePath}
        />
        <EventGrid events={page.items} locale={locale} />
        {page.nextCursor && (
          <LoadMore
            basePath={basePath}
            searchParams={toSearchParams({ ...filters, citySlug: undefined })}
            cursor={page.nextCursor}
          />
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 7: Verify in the browser**

Run `npm run dev`, visit `/en/tbilisi`.
Expected: filter chips update the URL; the back button restores the previous filter set; reloading a filtered URL renders the same list; an unknown city (`/en/atlantis`) returns 404.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add city browse page with URL-driven filters and pagination"
```

---

### Task 10: Event detail page

**Files:**
- Create: `src/app/[locale]/events/[slug]/page.tsx`, `src/app/[locale]/events/[slug]/page.module.scss`
- Create: `src/app/[locale]/not-found.tsx`, `src/app/[locale]/error.tsx`
- Test: covered by Task 12 E2E; `getEventBySlug` unit coverage exists in Task 6

**Interfaces:**
- Consumes: `getEventBySlug`, `listCities` (Task 6), `pickContent`, `formatEventDate`, `formatPrice`, `publicImageUrl`.
- Produces: the canonical event URL shape `/{locale}/events/{slug}` used by `EventCard`.

- [ ] **Step 1: Build the detail page**

Create `src/app/[locale]/events/[slug]/page.module.scss`:

```scss
.layout {
  display: grid;
  grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
  gap: var(--space-6);
  margin: var(--space-6) 0;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
}

.poster {
  width: 100%;
  border-radius: var(--radius-md);
  border: 1px solid var(--color-border);
}

.title {
  margin: 0 0 var(--space-2);
  font-size: 2rem;
  line-height: 1.2;
}

.when {
  color: var(--color-accent);
  font-weight: 600;
}

.facts {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: var(--space-2) var(--space-4);
  margin: var(--space-5) 0;
  font-size: 0.9375rem;
}

.label {
  color: var(--color-text-muted);
}

.description {
  white-space: pre-wrap;
  line-height: 1.7;
}

.gallery {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: var(--space-3);
  margin-top: var(--space-6);
}
```

Create `src/app/[locale]/events/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { formatEventDate, formatPrice } from "@/lib/format";
import { publicImageUrl } from "@/lib/images";
import { getEventBySlug, listCities } from "@/modules/discovery/queries";
import styles from "./page.module.scss";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const event = await getEventBySlug(slug);
  if (!event) return {};
  const title = pickContent(event, "title", locale) ?? "";
  const venue = pickContent(event.venue, "name", locale) ?? "";
  return {
    title: `${title} — ${venue}`,
    description: pickContent(event, "description", locale)?.slice(0, 160),
    openGraph: {
      title,
      images: [publicImageUrl(event.poster_image_path)],
    },
    alternates: {
      languages: { ka: `/ka/events/${slug}`, en: `/en/events/${slug}` },
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params;
  const [event, cities] = await Promise.all([getEventBySlug(slug), listCities()]);
  if (!event) notFound();

  const t = await getTranslations("event");
  const title = pickContent(event, "title", locale) ?? "";
  const description = pickContent(event, "description", locale);
  const venueName = pickContent(event.venue, "name", locale) ?? "";
  const address = pickContent(event.venue, "address", locale);
  const cityName = pickContent(event.city, "name", locale);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={event.city.slug} />
      <main className="container">
        <div className={styles.layout}>
          <div>
            <img
              className={styles.poster}
              src={publicImageUrl(event.poster_image_path)}
              alt={title}
            />
          </div>
          <div>
            <span className={styles.when}>{formatEventDate(event.starts_at, locale)}</span>
            <h1 className={styles.title}>{title}</h1>
            <Link href={`/${locale}/venues/${event.venue.slug}`}>
              {venueName}
              {event.venue.is_verified && " ✓"}
            </Link>

            <dl className={styles.facts}>
              <dt className={styles.label}>{t("at")}</dt>
              <dd>{[address, cityName].filter(Boolean).join(", ")}</dd>

              <dt className={styles.label}>{pickContent(event.category, "name", locale)}</dt>
              <dd>{formatPrice(event.entry_fee_gel, locale)}</dd>

              {event.dress_code && (
                <>
                  <dt className={styles.label}>{t("dressCode")}</dt>
                  <dd>{event.dress_code}</dd>
                </>
              )}
            </dl>

            {description && <p className={styles.description}>{description}</p>}
          </div>
        </div>

        {event.images.length > 0 && (
          <div className={styles.gallery}>
            {[...event.images]
              .sort((a, b) => a.position - b.position)
              .map((image) => (
                <img key={image.id} src={publicImageUrl(image.image_path)} alt="" />
              ))}
          </div>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 2: Add the not-found page**

Create `src/app/[locale]/not-found.tsx`:

```tsx
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

export default function NotFound() {
  const t = useTranslations("notFound");
  const locale = useLocale();
  return (
    <main className="container" style={{ padding: "var(--space-8) 0", textAlign: "center" }}>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <Link href={`/${locale}`}>{t("browse")}</Link>
    </main>
  );
}
```

- [ ] **Step 3: Add the error boundary**

Create `src/app/[locale]/error.tsx`:

```tsx
"use client";

import { useTranslations } from "next-intl";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("error");
  return (
    <main className="container" style={{ padding: "var(--space-8) 0", textAlign: "center" }}>
      <h1>{t("title")}</h1>
      <button type="button" onClick={reset}>
        {t("retry")}
      </button>
    </main>
  );
}
```

A read failure must never render a blank page — an empty discovery site looks closed.

- [ ] **Step 4: Verify in the browser**

Run `npm run dev`, click an event from `/en/tbilisi`.
Expected: full detail page; a Georgian-only event still shows its title under `/en`; `/en/events/does-not-exist` returns the 404 page with HTTP status 404 (check the Network tab, not just the visual).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add event detail page with metadata, 404, and error boundary"
```

---

### Task 11: Venue profile page and full-text search

**Files:**
- Create: `supabase/migrations/0003_search.sql`
- Create: `src/app/[locale]/venues/[slug]/page.tsx`
- Create: `src/components/SearchBox.tsx`, `src/components/SearchBox.module.scss`
- Modify: `src/modules/discovery/queries.ts` (add `getVenueBySlug`, apply `q` to `listEvents`)
- Test: `src/modules/discovery/search.test.ts`

**Interfaces:**
- Consumes: everything from Task 6.
- Produces: `getVenueBySlug(slug: string): Promise<VenueDetail | null>`; `listEvents` now honours `filters.q`; `<SearchBox basePath filters placeholder />`.

- [ ] **Step 1: Write the search migration**

Create `supabase/migrations/0003_search.sql`:

```sql
alter table events
  add column search_text text
  generated always as (
    coalesce(title_ka, '') || ' ' ||
    coalesce(title_en, '') || ' ' ||
    coalesce(description_ka, '') || ' ' ||
    coalesce(description_en, '')
  ) stored;

create index events_search_trgm_idx on events using gin (search_text gin_trgm_ops);
```

Postgres has no Georgian stemmer, so this uses trigram matching rather than `to_tsvector` with a language configuration — it gives substring and typo tolerance across both scripts, which is what short event titles need.

Apply it: `npx supabase db reset`

- [ ] **Step 2: Write the failing search test**

Create `src/modules/discovery/search.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { listEvents } from "./queries";

describe("search", () => {
  it("matches an English title substring", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "jazz" });
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const haystack = `${item.title_ka ?? ""} ${item.title_en ?? ""}`.toLowerCase();
      expect(haystack).toContain("jazz");
    }
  });

  it("matches a Georgian title substring", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "ჯაზ" });
    expect(items.length).toBeGreaterThan(0);
  });

  it("returns an empty list for nonsense rather than throwing", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "qqqzzzxxx" });
    expect(items).toEqual([]);
  });

  it("does not break when the query contains SQL metacharacters", async () => {
    const { items } = await listEvents({ when: "any", freeOnly: false, q: "'; drop table events;--" });
    expect(Array.isArray(items)).toBe(true);
  });
});
```

The seed must contain an event whose title includes "Jazz" and one containing "ჯაზ". Add them if missing.

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm test -- src/modules/discovery/search.test.ts`
Expected: FAIL — `q` is currently ignored, so the nonsense query returns all events.

- [ ] **Step 4: Apply `q` in `listEvents`**

In `src/modules/discovery/queries.ts`, after the `freeOnly` filter, add:

```ts
  if (filters.q) {
    // ilike on the generated column; the trigram index serves this.
    const escaped = filters.q.replace(/[%_]/g, (m) => `\\${m}`);
    query = query.ilike("search_text", `%${escaped}%`);
  }
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm test -- src/modules/discovery/search.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Build the search box**

Create `src/components/SearchBox.module.scss`:

```scss
.input {
  width: 100%;
  max-width: 420px;
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  padding: var(--space-3) var(--space-4);
  font: inherit;
}
```

Create `src/components/SearchBox.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toSearchParams, type EventFilters } from "@/modules/discovery/filters";
import styles from "./SearchBox.module.scss";

export function SearchBox({
  basePath,
  filters,
}: {
  basePath: string;
  filters: EventFilters;
}) {
  const router = useRouter();
  const t = useTranslations("filters");
  const [value, setValue] = useState(filters.q ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (value === (filters.q ?? "")) return;
      const next = toSearchParams({
        ...filters,
        q: value || undefined,
        cursor: undefined,
      });
      const qs = next.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [value, filters, basePath, router]);

  return (
    <input
      className={styles.input}
      type="search"
      value={value}
      placeholder={t("search")}
      onChange={(e) => setValue(e.target.value)}
      aria-label={t("search")}
    />
  );
}
```

Render `<SearchBox basePath={basePath} filters={filters} />` above `<FilterBar />` in `src/app/[locale]/[city]/page.tsx`.

- [ ] **Step 7: Add `getVenueBySlug`**

Append to `src/modules/discovery/queries.ts`:

```ts
export type VenueDetail = {
  id: string;
  slug: string;
  name_ka: string | null;
  name_en: string | null;
  description_ka: string | null;
  description_en: string | null;
  address_ka: string | null;
  address_en: string | null;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  cover_image_path: string | null;
  is_verified: boolean;
  city: City;
};

export async function getVenueBySlug(slug: string): Promise<VenueDetail | null> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("venues")
    .select(`
      id, slug, name_ka, name_en, description_ka, description_en,
      address_ka, address_en, phone, website, instagram, facebook,
      cover_image_path, is_verified,
      city:cities!inner (id, slug, name_ka, name_en)
    `)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(`getVenueBySlug failed: ${error.message}`);
  return (data as unknown as VenueDetail) ?? null;
}

export async function listVenueEvents(venueId: string): Promise<EventListItem[]> {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("events")
    .select(LIST_SELECT)
    .eq("venue_id", venueId)
    .eq("is_published", true)
    .is("deleted_at", null)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(48);

  if (error) throw new Error(`listVenueEvents failed: ${error.message}`);
  return (data ?? []) as unknown as EventListItem[];
}
```

- [ ] **Step 8: Build the venue page**

Create `src/app/[locale]/venues/[slug]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { EventGrid } from "@/components/EventGrid";
import { SiteHeader } from "@/components/SiteHeader";
import type { Locale } from "@/i18n/routing";
import { pickContent } from "@/lib/content";
import { getVenueBySlug, listCities, listVenueEvents } from "@/modules/discovery/queries";

type Props = { params: Promise<{ locale: Locale; slug: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale, slug } = await params;
  const venue = await getVenueBySlug(slug);
  if (!venue) return {};
  return {
    title: pickContent(venue, "name", locale) ?? "",
    description: pickContent(venue, "description", locale)?.slice(0, 160),
    alternates: { languages: { ka: `/ka/venues/${slug}`, en: `/en/venues/${slug}` } },
  };
}

export default async function VenuePage({ params }: Props) {
  const { locale, slug } = await params;
  const [venue, cities] = await Promise.all([getVenueBySlug(slug), listCities()]);
  if (!venue) notFound();

  const events = await listVenueEvents(venue.id);
  const description = pickContent(venue, "description", locale);
  const address = pickContent(venue, "address", locale);

  return (
    <>
      <SiteHeader locale={locale} cities={cities} activeCitySlug={venue.city.slug} />
      <main className="container">
        <h1>
          {pickContent(venue, "name", locale)}
          {venue.is_verified && " ✓"}
        </h1>
        <p style={{ color: "var(--color-text-muted)" }}>
          {[address, pickContent(venue.city, "name", locale)].filter(Boolean).join(", ")}
        </p>
        {description && <p>{description}</p>}
        <h2 style={{ marginTop: "var(--space-7)" }}>
          {locale === "ka" ? "მომავალი ღონისძიებები" : "Upcoming events"}
        </h2>
        <EventGrid events={events} locale={locale} />
      </main>
    </>
  );
}
```

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add venue profile page and bilingual trigram search"
```

---

### Task 12: End-to-end tests and the invariant guard

**Files:**
- Create: `playwright.config.ts`, `e2e/discovery.spec.ts`, `e2e/invariant.spec.ts`
- Create: `README.md`
- Modify: `package.json` (scripts)

**Interfaces:**
- Consumes: the running app and seeded database.
- Produces: `npm run e2e` as the pre-deploy gate.

- [ ] **Step 1: Configure Playwright**

```bash
npx playwright install --with-deps chromium
```

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000/ka",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
```

- [ ] **Step 2: Write the discovery journey test**

Create `e2e/discovery.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test("browse, filter, and open an event", async ({ page }) => {
  await page.goto("/en/tbilisi");
  await expect(page.getByRole("heading", { name: "Tbilisi" })).toBeVisible();

  await page.getByRole("button", { name: "DJ / club night" }).click();
  await expect(page).toHaveURL(/category=dj/);

  await page.goBack();
  await expect(page).not.toHaveURL(/category=dj/);

  const firstCard = page.locator("a[href*='/events/']").first();
  await firstCard.click();
  await expect(page).toHaveURL(/\/en\/events\//);
});

test("a filtered URL renders the same view after a reload", async ({ page }) => {
  await page.goto("/en/tbilisi?when=weekend&free=1");
  const countBefore = await page.locator("a[href*='/events/']").count();
  await page.reload();
  expect(await page.locator("a[href*='/events/']").count()).toBe(countBefore);
});

test("locale switching keeps the user on the site", async ({ page }) => {
  await page.goto("/en/tbilisi");
  await page.getByRole("link", { name: "ქარ" }).click();
  await expect(page).toHaveURL(/\/ka/);
});

test("an unknown event slug returns a 404 status", async ({ page }) => {
  const response = await page.goto("/en/events/definitely-not-real-zzz");
  expect(response?.status()).toBe(404);
});
```

- [ ] **Step 3: Write the invariant test**

Create `e2e/invariant.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

test("no past or unpublished event is reachable from any public surface", async ({ page }) => {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: hidden } = await supabase
    .from("events")
    .select("slug, starts_at, is_published")
    .or(`starts_at.lt.${new Date().toISOString()},is_published.eq.false`);

  expect(hidden!.length).toBeGreaterThan(0); // the seed must contain trap rows

  for (const row of hidden!) {
    const response = await page.goto(`/en/events/${row.slug}`);
    expect(response?.status(), `${row.slug} must not be publicly reachable`).toBe(404);
  }

  await page.goto("/en/tbilisi?when=any");
  const html = await page.content();
  for (const row of hidden!) {
    expect(html).not.toContain(row.slug);
  }
});
```

This test is the reason the seed contains a past event and an unpublished one. If someone later loosens a query or an RLS policy, this fails.

Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.example` (from `npx supabase status`) and confirm `.env.local` stays gitignored.

- [ ] **Step 4: Run the E2E suite**

Run: `npm run e2e`
Expected: 5 tests pass.

- [ ] **Step 5: Write the README**

Create `README.md` covering: what Revent is, prerequisites (Node 20+, Supabase CLI, Docker), setup (`npm install`, `npx supabase start`, copy keys to `.env.local`, `npx supabase db reset`, `npm run dev`), the test commands, and a short "architecture at a glance" section pointing at the spec and this plan.

- [ ] **Step 6: Run everything and commit**

```bash
npm test && npm run e2e
git add -A
git commit -m "test: add end-to-end discovery journey and public-visibility invariant tests"
```

---

## Phase 1 Definition of Done

- [ ] `npm test` and `npm run e2e` both pass from a clean `npx supabase db reset`.
- [ ] `/ka` and `/en` both render, with Georgian text in a Mkhedruli-capable font.
- [ ] A Georgian-only event is readable on the English site (fallback works).
- [ ] Every filter combination is expressible as a URL, survives reload, and works with the back button.
- [ ] No past, unpublished, or soft-deleted event appears anywhere public — verified by the invariant test, not by inspection.
- [ ] An unknown event, venue, or city slug returns HTTP 404.

## Deferred to Phase 2 and 3

Phase 2 (accounts and dashboard): Supabase Auth, profile creation, venue onboarding, event create/edit/duplicate/soft-delete, signed-URL image uploads, draft state.

Phase 3 (engagement and moderation): favorites with counter maintenance, view counting, trending score job, admin verification and unpublish surface, venue analytics.

Note: the spec places a Trending section on the homepage, but trending depends on view and favorite
counts that do not exist until Phase 3. Phase 1 ships Tonight / This weekend / All events, and the
`home.trending` message key stays defined but unused until then. This is a deliberate deferral, not
an omission.
