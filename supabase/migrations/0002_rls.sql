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
