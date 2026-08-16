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
