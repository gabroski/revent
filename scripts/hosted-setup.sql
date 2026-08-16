-- Revent: full database setup for a hosted Supabase project.
-- Paste this whole file into the Supabase SQL Editor and run it once.
-- Generated from supabase/migrations/*.sql + supabase/seed.sql — keep those as the source of truth.

-- ============================================================
-- supabase/migrations/0001_init.sql
-- ============================================================
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

-- events.city_id is denormalized from the venue so the hot discovery query never joins.
-- This trigger is what keeps the denormalization honest.
create or replace function sync_event_city() returns trigger
language plpgsql
as $$
begin
  select city_id into new.city_id from venues where id = new.venue_id;
  return new;
end;
$$;

create trigger events_sync_city
  before insert or update of venue_id on events
  for each row execute function sync_event_city();

create or replace function sync_events_city_on_venue_move() returns trigger
language plpgsql
as $$
begin
  if new.city_id is distinct from old.city_id then
    update events set city_id = new.city_id where venue_id = new.id;
  end if;
  return new;
end;
$$;

create trigger venues_sync_events_city
  after update of city_id on venues
  for each row execute function sync_events_city_on_venue_move();

-- ============================================================
-- supabase/migrations/0002_rls.sql
-- ============================================================
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

-- The core invariant, enforced at the database level. Application queries repeat
-- these filters; neither layer is trusted on its own.
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

-- ============================================================
-- supabase/migrations/0003_search.sql
-- ============================================================
-- Postgres has no Georgian stemmer, so search uses trigram matching over a generated
-- column rather than to_tsvector with a language configuration. That gives substring
-- and typo tolerance across both scripts, which is what short event titles need.
alter table events
  add column search_text text
  generated always as (
    coalesce(title_ka, '') || ' ' ||
    coalesce(title_en, '') || ' ' ||
    coalesce(description_ka, '') || ' ' ||
    coalesce(description_en, '')
  ) stored;

create index events_search_trgm_idx on events using gin (search_text gin_trgm_ops);

-- ============================================================
-- supabase/seed.sql
-- ============================================================
-- Seed data for local development and tests.
--
-- All dates are RELATIVE (now() + interval ...). Never hardcode timestamps here:
-- a literal date rots, and the "Tonight" section silently empties a week later.
--
-- The test suite depends on specific rows existing. Before removing anything, check:
--   * an event titled with "Jazz" and one containing "ჯაზ"  -> search tests
--   * a Georgian-only and an English-only event             -> content fallback tests
--   * a past event and an unpublished event                 -> public-visibility invariant
--   * at least 2 Batumi events, 4+ future Tbilisi events    -> filter and pagination tests

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

insert into venues (slug, city_id, name_ka, name_en, description_ka, description_en, address_ka, address_en, instagram, is_verified)
values
  ('fabrika', (select id from cities where slug = 'tbilisi'),
   'ფაბრიკა', 'Fabrika',
   'მრავალფუნქციური სივრცე ყოფილ საკერავ ფაბრიკაში.',
   'A multifunctional space in a former sewing factory.',
   'ეგნატე ნინოშვილის 8', '8 Egnate Ninoshvili St', 'fabrikatbilisi', true),

  ('bassiani', (select id from cities where slug = 'tbilisi'),
   'ბასიანი', 'Bassiani',
   'მიწისქვეშა კლუბი დინამო არენის ქვეშ.',
   'Underground club beneath the Dinamo Arena.',
   'აკაკი წერეთლის 2', '2 Akaki Tsereteli Ave', 'bassiani', true),

  ('dive-bar-tbilisi', (select id from cities where slug = 'tbilisi'),
   'დაივ ბარი', 'Dive Bar',
   'პატარა ბარი ვერაზე.', 'A small neighbourhood bar in Vera.',
   'ყიფშიძის 12', '12 Kipshidze St', 'divebartbilisi', false),

  ('sector-26', (select id from cities where slug = 'batumi'),
   'სექტორი 26', 'Sector 26',
   'ზღვისპირა კლუბი.', 'A seafront club.',
   'ბათუმის ბულვარი', 'Batumi Boulevard', 'sector26', false),

  ('toma-s-wine-cellar', (select id from cities where slug = 'kutaisi'),
   'თომას მარანი', concat('Toma', chr(39), 's Wine Cellar'),
   'ოჯახური მარანი ქუთაისში.', 'A family wine cellar in Kutaisi.',
   'ნიკეას 4', '4 Nikea St', 'tomaswine', false);

insert into events (
  venue_id, category_id, city_id, slug,
  title_ka, title_en, description_ka, description_en,
  starts_at, ends_at, poster_image_path, entry_fee_gel, dress_code, is_published
)
values
  -- Tonight (within 12 hours) --------------------------------------------------
  ((select id from venues where slug = 'fabrika'),
   (select id from categories where slug = 'live-music'),
   (select id from cities where slug = 'tbilisi'),
   'jazz-night-at-fabrika-a1b2c3',
   'ჯაზის საღამო ფაბრიკაში', 'Jazz Night at Fabrika',
   'ცოცხალი ჯაზი ეზოში, ღია ცის ქვეშ.',
   'Live jazz in the courtyard, under an open sky.',
   now() + interval '5 hours', now() + interval '9 hours',
   'posters/placeholder.jpg', null, null, true),

  ((select id from venues where slug = 'bassiani'),
   (select id from categories where slug = 'dj'),
   (select id from cities where slug = 'tbilisi'),
   'techno-basement-d4e5f6',
   null, 'Techno Basement',
   null,
   'Resident DJs until sunrise. No phones on the dancefloor.',
   now() + interval '6 hours', now() + interval '14 hours',
   'posters/placeholder.jpg', 30, 'No dress code, no photos', true),

  ((select id from venues where slug = 'dive-bar-tbilisi'),
   (select id from categories where slug = 'dj'),
   (select id from cities where slug = 'tbilisi'),
   'late-night-house-g7h8i9',
   'გვიანი ღამის ჰაუსი', 'Late Night House',
   'ჰაუსი დილის ხუთ საათამდე.', 'House music until five in the morning.',
   now() + interval '9 hours', now() + interval '16 hours',
   'posters/placeholder.jpg', 15, null, true),

  -- Georgian-only content (English viewers must fall back to this) --------------
  ((select id from venues where slug = 'fabrika'),
   (select id from categories where slug = 'live-music'),
   (select id from cities where slug = 'tbilisi'),
   'jaz-kvarteti-j1k2l3',
   'ჯაზ კვარტეტი', null,
   'ქართული ჯაზ კვარტეტი უკრავს სტანდარტებს.', null,
   now() + interval '2 days', null,
   'posters/placeholder.jpg', 20, null, true),

  -- Rest of the upcoming catalogue ---------------------------------------------
  ((select id from venues where slug = 'dive-bar-tbilisi'),
   (select id from categories where slug = 'trivia'),
   (select id from cities where slug = 'tbilisi'),
   'trivia-tuesday-m4n5o6',
   'სამშაბათის ქვიზი', 'Trivia Tuesday',
   'გუნდები ოთხ კაცამდე. პრიზი — ლუდის კოშკი.',
   'Teams of up to four. Prize is a tower of beer.',
   now() + interval '3 days', null,
   'posters/placeholder.jpg', null, null, true),

  ((select id from venues where slug = 'dive-bar-tbilisi'),
   (select id from categories where slug = 'happy-hour'),
   (select id from cities where slug = 'tbilisi'),
   'happy-hour-vera-p7q8r9',
   'ჰეფი აური ვერაზე', 'Happy Hour in Vera',
   'ორი კოქტეილი ერთის ფასად, 18:00-20:00.',
   'Two cocktails for the price of one, 18:00 to 20:00.',
   now() + interval '2 days' + interval '18 hours', null,
   'posters/placeholder.jpg', null, null, true),

  ((select id from venues where slug = 'fabrika'),
   (select id from categories where slug = 'standup'),
   (select id from cities where slug = 'tbilisi'),
   'stand-up-in-english-s1t2u3',
   'სტენდაპი ინგლისურად', 'Stand-up in English',
   'ადგილობრივი და ჩამოსული კომიკოსები.',
   'Local and visiting comedians.',
   now() + interval '7 days', null,
   'posters/placeholder.jpg', 20, null, true),

  ((select id from venues where slug = 'bassiani'),
   (select id from categories where slug = 'karaoke'),
   (select id from cities where slug = 'tbilisi'),
   'karaoke-night-v4w5x6',
   'კარაოკეს ღამე', 'Karaoke Night',
   'მიკროფონი ღიაა ყველასთვის.', 'The microphone is open to everyone.',
   now() + interval '4 days', null,
   'posters/placeholder.jpg', 15, null, true),

  -- Batumi ----------------------------------------------------------------------
  ((select id from venues where slug = 'sector-26'),
   (select id from categories where slug = 'dj'),
   (select id from cities where slug = 'batumi'),
   'sunset-dj-set-y7z8a9',
   'მზის ჩასვლის დიჯეი სეტი', 'Sunset DJ Set',
   'დიჯეი სეტი ზღვის პირას, მზის ჩასვლისას.',
   'A DJ set by the sea, starting at sunset.',
   now() + interval '1 day' + interval '19 hours', null,
   'posters/placeholder.jpg', 25, null, true),

  ((select id from venues where slug = 'sector-26'),
   (select id from categories where slug = 'themed'),
   (select id from cities where slug = 'batumi'),
   'beach-party-b1c2d3',
   'პლაჟის წვეულება', 'Beach Party',
   'თემატური წვეულება პლაჟზე.', 'A themed party on the beach.',
   now() + interval '5 days', null,
   'posters/placeholder.jpg', null, 'Beachwear', true),

  -- Kutaisi ---------------------------------------------------------------------
  ((select id from venues where slug = 'toma-s-wine-cellar'),
   (select id from categories where slug = 'food'),
   (select id from cities where slug = 'kutaisi'),
   'wine-tasting-e4f5g6',
   'ღვინის დეგუსტაცია', 'Wine Tasting',
   'რვა ქვევრის ღვინო, ადგილობრივი ყველით.',
   'Eight qvevri wines, served with local cheese.',
   now() + interval '6 days', null,
   'posters/placeholder.jpg', 40, null, true),

  -- TRAP ROWS: these must never appear on any public surface. -------------------
  -- e2e/invariant.spec.ts asserts both are unreachable and absent from listings.
  ((select id from venues where slug = 'bassiani'),
   (select id from categories where slug = 'dj'),
   (select id from cities where slug = 'tbilisi'),
   'past-event-must-not-appear-h7i8j9',
   'გასული ღონისძიება', 'Past Event Must Not Appear',
   'ეს ღონისძიება უკვე გასულია.', 'This event already happened.',
   now() - interval '2 days', null,
   'posters/placeholder.jpg', 10, null, true),

  ((select id from venues where slug = 'bassiani'),
   (select id from categories where slug = 'dj'),
   (select id from cities where slug = 'tbilisi'),
   'unpublished-event-must-not-appear-k1l2m3',
   'გამოუქვეყნებელი ღონისძიება', 'Unpublished Event Must Not Appear',
   'ეს ღონისძიება ჯერ დრაფტია.', 'This event is still a draft.',
   now() + interval '3 days', null,
   'posters/placeholder.jpg', 10, null, false);

insert into event_images (event_id, image_path, position)
select id, 'posters/placeholder.jpg', 0 from events where slug = 'jazz-night-at-fabrika-a1b2c3'
union all
select id, 'posters/placeholder.jpg', 1 from events where slug = 'jazz-night-at-fabrika-a1b2c3';

