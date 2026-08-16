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
