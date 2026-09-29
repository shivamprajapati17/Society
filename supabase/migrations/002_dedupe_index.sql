-- Re-import dedupe fix.
--
-- 001 created `complaints_source_hash_uq` as a *partial* unique index
-- (… where source_hash is not null). PostgREST turns
-- `upsert(..., { onConflict: "society_id,source_hash" })` into
-- `ON CONFLICT (society_id, source_hash) DO NOTHING`, and Postgres refuses to
-- infer a partial index unless the statement repeats its predicate. The insert
-- therefore failed with 42P10 ("no unique or exclusion constraint matching the
-- ON CONFLICT specification") and every chat import returned 500.
--
-- Dropping the predicate is safe: Postgres treats NULLs as distinct in a unique
-- index, so the many complaints that have no source_hash still never collide.
-- Any rows without a hash are unaffected.

drop index if exists complaints_source_hash_uq;

create unique index complaints_source_hash_uq
  on complaints(society_id, source_hash);
