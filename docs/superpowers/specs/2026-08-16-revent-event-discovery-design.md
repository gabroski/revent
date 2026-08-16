# Revent — Event Discovery Platform: Design

**Date:** 2026-08-16
**Status:** Approved for planning

## 1. Purpose and Context

Revent is a public web platform where venues in Georgia — restaurants, bars, clubs — publish
their upcoming events, and people discover what is happening near them tonight, this weekend,
or later.

This is a real product intended for real venues and real users, not a portfolio exercise. That
decision drives everything below: content must be indexable by search engines, pages must load
on weak mobile connections, and there must be a way to react to abuse.

### Decisions already settled

| Decision | Choice | Why |
|---|---|---|
| Market | All cities in Georgia | City is a first-class entity, not a text field |
| Languages | Georgian (default) + English | Bilingual UI *and* bilingual content fields |
| Frontend | Next.js (React), SCSS Modules | Server rendering for SEO and slow connections |
| Backend | Supabase (Postgres, Auth, Storage) | Managed auth/storage/RLS; no separate service to run |
| Data boundary | Reads direct, writes via server actions | Validation layer without building a REST API |
| Venue onboarding | Self-serve, publishes immediately | Owner's decision; mitigated by admin unpublish |
| Trust model | Verified badge, no publishing gate | Owner's decision; see Risks |
| Recurring events | Not in v1; "duplicate event" instead | Recurrence infects every query; defer until demanded |

### Explicitly out of scope for v1

RSVP/interest counts, map view and Google Maps integration, reviews and ratings, comments,
email notifications, follower system, calendar heatmap, recommendations, machine translation,
ticketing or payments.

Favorites **are** in v1.

## 2. Architecture

```
Browser
  │
  ├─ Public reads ──▶ Next.js Server Components ──▶ Supabase (anon key, RLS on)
  │
  └─ Mutations ─────▶ Next.js Server Actions ─────▶ Supabase (RLS on)
                       Zod validation
                       ownership checks
```

**Reads.** Public pages (home, city, category, event detail, venue profile) render on the
server, querying Supabase with the anon key. Row-level security remains enabled, so an
unpublished or soft-deleted event is invisible even if a query forgets to filter it.

**Writes.** Every mutation goes through a Next.js server action that:
1. resolves the session,
2. validates input with Zod,
3. verifies ownership (this venue belongs to this user),
4. performs the write.

RLS policies duplicate rules 3 and 4 at the database level. This duplication is intentional:
neither layer alone is trusted.

**Rejected alternatives.** Supabase-direct-from-client (all rules live in SQL policies, one
bad policy is a data leak with no second line of defence) and a separate Node/NestJS service
(a second deploy target, duplicated types, and weeks of work buying structure not yet needed).

### Module boundaries

Each module owns its data access, and no module reaches into another's tables directly.

| Module | Responsibility |
|---|---|
| `auth` | Session, profile, role resolution |
| `venues` | Venue CRUD, ownership, verification state |
| `events` | Event CRUD, publishing, soft delete, duplication |
| `discovery` | Public querying: filtering, search, trending, pagination |
| `favorites` | User bookmarks |
| `media` | Signed upload URLs, image validation, storage paths |
| `admin` | Verification toggle, unpublish |
| `i18n` | Locale routing, translation files, content fallback |

## 3. Data Model

All timestamps are `timestamptz`. Georgia is UTC+4 with no DST, but the type is explicit
regardless.

### `profiles`
One row per authenticated user, `id` referencing `auth.users`.
- `id`, `display_name`, `role` (`user` | `venue_owner` | `admin`), `locale`, `created_at`

Everyone signs up as `user`. Listing a venue promotes the profile to `venue_owner`; the same
account can still browse and favorite events.

### `cities`
Seeded fixed list covering Georgian cities (Tbilisi, Batumi, Kutaisi, Rustavi, Gori, Zugdidi,
Telavi, Mestia, Sighnaghi, …).
- `id`, `slug`, `name_ka`, `name_en`, `lat`, `lng`, `is_active`

Fixed list rather than free text so filtering and `/ka/batumi` URLs work reliably.

### `venues`
- `id`, `owner_id` → `profiles`, `slug`, `city_id` → `cities`
- `name_ka`, `name_en`, `description_ka`, `description_en`, `address_ka`, `address_en`
- `lat`, `lng` (stored now, unused until the v2 map)
- `phone`, `website`, `instagram`, `facebook`
- `cover_image_path`, `is_verified`, `created_at`, `updated_at`, `deleted_at`

One owner may hold multiple venues.

### `categories`
Seeded: live music, DJ / club night, happy hour, trivia / quiz, karaoke, stand-up, themed
night, food special, other.
- `id`, `slug`, `name_ka`, `name_en`, `icon`, `sort_order`

### `events`
- `id`, `venue_id` → `venues`, `category_id` → `categories`, `city_id` → `cities`
- `slug`, `title_ka`, `title_en`, `description_ka`, `description_en`
- `starts_at`, `ends_at` (nullable)
- `poster_image_path` (required), `entry_fee_gel` (nullable = free), `dress_code` (nullable)
- `is_published`, `view_count`, `favorite_count`
- `created_at`, `updated_at`, `deleted_at`

`city_id` is denormalized from the venue so the hot discovery query never joins. It is kept in
sync by a trigger when a venue's city changes.

`view_count` and `favorite_count` are denormalized counters maintained server-side, so list
rendering and trending never aggregate at read time.

### `event_images`
- `id`, `event_id`, `image_path`, `position`

Gallery images beyond the required poster.

### `favorites`
- `user_id`, `event_id`, `created_at` — composite primary key

Insert/delete adjusts `events.favorite_count` in the same transaction.

### Slugs

Generated as `transliterated-title-shortid`. Georgian Mkhedruli is transliterated to Latin;
the short id suffix guarantees uniqueness without a retry loop.

## 4. Bilingual Content and Routing

Two distinct problems, deliberately handled differently.

**UI chrome** — `next-intl` with locale-prefixed routes: `/ka/...` and `/en/...`. Georgian is
the default. Both language versions of every public page are indexable, with `hreflang`
annotations.

**User-generated content** — one required primary language, one optional secondary. The event
and venue forms carry a language toggle; the owner fills whichever they are comfortable in.
At render time the app falls back to the other language rather than showing an empty field, so
an English-browsing user sees Georgian text instead of a blank card. No machine translation in
v1.

**Consequences accepted:** most content will be Georgian-only, English-language SEO will be
thin at launch, and every layout must survive Georgian text, which runs longer than English.
Typography must use a face with real Mkhedruli coverage (Noto Sans Georgian or equivalent) —
never a Latin-only display font with a fallback.

## 5. Discovery

**URL is the state.** Every filter — city, category, date range, free/paid, search query,
cursor — lives in the query string and the page renders on the server from it.
`/ka/tbilisi?category=dj&when=weekend` is shareable, indexable, and survives the back button.
Filter state held only in React would cost all three.

Filter chips update the URL through a client transition; results re-stream from the server
while the previous list remains visible in a dimmed state rather than collapsing to a spinner.

**Homepage** is city-first: geolocation suggests a city, the user can override, the choice
persists in a cookie, default Tbilisi. Sections: Tonight, This weekend, Trending, then a
browsable grid.

**Search** uses Postgres full-text search across event titles, descriptions, and venue names in
both languages. Postgres has no Georgian stemmer, so Georgian search uses the `simple`
configuration plus `pg_trgm` trigram matching for typo tolerance. Adequate for short event
titles; not linguistically clever.

**Trending** is a weighted score over favorites and views in the trailing 7 days, with a small
boost for verified venues, recomputed on a schedule rather than per request.

**Past events never appear.** Every public query filters `starts_at >= now()`. This is the one
rule that must never break — a discovery site showing last month's parties is dead on arrival.

**Pagination** is cursor-based on `(starts_at, id)`.

## 6. Venue Experience

**Onboarding.** "List your venue" from any account. Short form: name, city, address, contact
links, cover image. Publishes immediately as unverified.

**Event form.** Fields per the model, with a live preview of the resulting event card beside
the form — the poster is what users actually respond to, so the author should see it as
published. Save as draft or publish.

**Duplicate.** Copies an event with the date cleared. This is the v1 answer to recurring
events (trivia nights, happy hours): two clicks to next week's listing, instead of a recurrence
engine that would complicate every query, filter, favorite, and edit in the system. If venues
ask for real recurrence, that request is the evidence needed to design it properly in v2.

**Delete is soft** (`deleted_at`), so an accidental click does not destroy a listing users have
favorited.

**Analytics.** Two numbers per event row: detail-page views and favorites. Not a charts
dashboard. It is what venues ask for first and it is nearly free given the denormalized
counters.

## 7. Media Handling

1. Client requests an upload URL from a server action, passing filename, MIME type, and size.
2. The server action validates MIME type (JPEG, PNG, WebP) and size (max 8MB), then issues a
   signed Supabase Storage URL scoped to a path derived from the venue id.
3. The browser compresses the image before upload — posters are typically phone screenshots
   over 5MB, on connections that will not tolerate that.
4. The browser uploads directly to Storage.
5. Images are served through the Next.js image optimizer.

The client never holds credentials that allow an arbitrary write, and the size/type gate is
enforced before any URL is issued.

## 8. Admin

A single protected route, accessible to `role = admin`:
- list venues, filter by verification state, toggle `is_verified`
- search events, unpublish any event

This is the entire moderation surface. Given the no-gate publishing model, it is the mechanism
for responding to spam, and must exist at launch rather than after the first incident.

## 9. Error Handling

- **Server actions** return a typed discriminated result (`{ ok: true, data }` or
  `{ ok: false, error }`) rather than throwing across the boundary. Forms render field-level
  errors from Zod issues.
- **Validation is duplicated** on client (immediate feedback) and server (authority). The
  server is the only one trusted.
- **Read failures** on public pages render an error boundary with a retry, never a blank page —
  a discovery site that shows nothing looks closed.
- **Not-found** event, venue, or city slugs return a real 404 with suggestions, not a redirect
  to home. Search engines must see the 404.
- **Upload failures** preserve the rest of the form state; the user re-picks the image only.
- **Auth expiry** mid-form preserves the draft in local state and re-authenticates in place.

## 10. Testing

- **Unit (Vitest):** slug generation and transliteration, content-language fallback, trending
  score, filter/query-string parsing, Zod schemas.
- **Integration (Vitest against a local Supabase):** every server action, including the
  negative cases — editing another owner's event, publishing while unverified-but-allowed,
  uploading an oversized file, favoriting twice.
- **RLS policy tests:** direct queries as anonymous, as a non-owner, and as an owner, asserting
  what each can read and write. These are the tests that catch a data leak.
- **E2E (Playwright):** venue signup → create event → appears in city listing → user favorites
  it → appears in favorites; and locale switching preserving the current page.
- **The invariant test:** a past event never appears in any public list. Asserted directly
  against every discovery query.

## 11. Deployment

Vercel for the Next.js app, Supabase cloud for the database. Two environments: preview
(branch-deployed, against a staging Supabase project) and production. Database migrations are
version-controlled SQL applied through the Supabase CLI, never hand-edited in the dashboard.

## 12. Risks

**Cold start (highest risk, not a technical one).** The chosen launch order is self-serve venue
signup, which means the platform is empty until venues independently discover it and post. A
user arriving at an empty catalogue does not return. The mitigation available within this
design is that nothing prevents seeding the catalogue manually through the same venue accounts;
the recommendation is to do so before any public launch.

**Open publishing.** No approval gate means the first fake or spam listing is publicly visible
on a site with no established reputation. Mitigated only by the admin unpublish surface and the
speed of response.

**Thin English content.** Content-language fallback means English SEO will be weak initially.
Accepted.

**Georgian search quality.** No stemmer; trigram matching only. Acceptable for short titles,
will degrade for description search.
