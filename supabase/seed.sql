-- Seed data for local development and tests.
--
-- All dates are RELATIVE, and anchored to Tbilisi's EVENING rather than to the
-- moment the seed happens to run. `now() + interval '5 hours'` looks fine until
-- you seed at 22:00 and every "tonight" event lands at 03:00 the next morning.
--
-- After running this file, run the reschedule block at the bottom, which pins
-- events to 21:00 local and spreads them across the coming week.
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

-- ---------------------------------------------------------------------------
-- Reschedule: pin events to Tbilisi evenings.
--
-- Two events are placed inside the next couple of hours so the "Tonight"
-- section is never empty in a fresh environment, and the rest spread across
-- the coming week. Re-run this block alone any time the seed data has aged.
-- ---------------------------------------------------------------------------
with anchor as (
  select (date_trunc('day', now() at time zone 'Asia/Tbilisi') + interval '21 hours')
           at time zone 'Asia/Tbilisi' as tonight_9pm
)
update events e set starts_at = v.new_start, ends_at = v.new_start + interval '5 hours'
from (
  select * from (values
    ('late-night-house-g7h8i9',            now() + interval '30 minutes'),
    ('techno-basement-d4e5f6',             now() + interval '90 minutes'),
    ('jazz-night-at-fabrika-a1b2c3',       (select tonight_9pm from anchor)),
    ('sunset-dj-set-y7z8a9',               (select tonight_9pm from anchor) + interval '22 hours'),
    ('happy-hour-vera-p7q8r9',             (select tonight_9pm from anchor) + interval '21 hours'),
    ('jaz-kvarteti-j1k2l3',                (select tonight_9pm from anchor) + interval '1 day'),
    ('trivia-tuesday-m4n5o6',              (select tonight_9pm from anchor) + interval '2 days'),
    ('karaoke-night-v4w5x6',               (select tonight_9pm from anchor) + interval '3 days'),
    ('beach-party-b1c2d3',                 (select tonight_9pm from anchor) + interval '4 days'),
    ('wine-tasting-e4f5g6',                (select tonight_9pm from anchor) + interval '5 days'),
    ('stand-up-in-english-s1t2u3',         (select tonight_9pm from anchor) + interval '6 days'),
    ('unpublished-event-must-not-appear-k1l2m3', (select tonight_9pm from anchor) + interval '3 days'),
    ('past-event-must-not-appear-h7i8j9',  now() - interval '2 days')
  ) as t(slug, new_start)
) v
where e.slug = v.slug;
