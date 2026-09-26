-- yalp.uz — the write side.
--
-- Everything a visitor creates lives here. Business records stay in
-- data/businesses/*.yaml, under review in git, because a directory's
-- facts should be auditable and revertable. Opinions are not facts, so
-- reviews go in Postgres.
--
-- Apply with:  psql "$DATABASE_URL" -f db/schema.sql
-- Safe to re-run.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- people

create table if not exists users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  -- Shown on reviews. Not the email: nobody's address should be
  -- discoverable by reading the site.
  name        text not null,
  created_at  timestamptz not null default now(),
  -- Set to hide every review this account has written at once, without
  -- deleting anything. Moderation should be reversible.
  blocked_at  timestamptz
);

-- ------------------------------------------------------------------ auth
--
-- Two short-lived token tables. Neither stores the token itself — only a
-- SHA-256 of it. A dump of this database must not let the reader log in
-- as anyone.

create table if not exists login_tokens (
  token_hash  text primary key,
  email       text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  -- A daily pseudonym for the requesting network, kept only to
  -- rate-limit. Never the address itself — see lib/privacy.ts.
  request_key text
);

create index if not exists login_tokens_email_idx on login_tokens (email, created_at desc);
-- The index on request_key is created further down, with the alter that
-- adds the column: `create table if not exists` skips an existing table,
-- so on an upgrade the column does not exist yet at this point.

create table if not exists sessions (
  token_hash  text primary key,
  user_id     uuid not null references users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);

create index if not exists sessions_user_idx on sessions (user_id);

-- --------------------------------------------------------------- reviews

create table if not exists reviews (
  id             uuid primary key default gen_random_uuid(),
  -- Deliberately not a foreign key. Businesses live in YAML, not in this
  -- database, and a slug that stops resolving is a broken listing to fix
  -- rather than a review to silently destroy.
  business_slug  text not null,
  user_id        uuid not null references users (id) on delete cascade,
  rating         smallint not null check (rating between 1 and 5),
  body           text not null check (length(btrim(body)) between 20 and 4000),
  created_at     timestamptz not null default now(),
  edited_at      timestamptz,
  hidden_at      timestamptz,
  -- One review per person per place. This is the whole anti-astroturfing
  -- story and it belongs in the database, where it cannot be forgotten
  -- by a later caller. Editing is an update, not a second row.
  unique (business_slug, user_id)
);

create index if not exists reviews_slug_idx on reviews (business_slug, created_at desc);

-- ----------------------------------------------------------------- votes
--
-- Upvote / downvote on a review, one per person per review. Changing your
-- mind is an update; taking it back is a delete.

-- The voter is one text column, not a user reference: 'u:<uuid>' for a
-- signed-in account, 'a:<author key>' for an anonymous cookie. A vote's
-- author is never joined to, cascaded from or displayed, so it does not
-- need to be two typed nullable columns — it needs to be one value that
-- is either equal to another or not. See the migration further down for
-- how a database created before this reaches the same shape.
create table if not exists votes (
  review_id   uuid not null references reviews (id) on delete cascade,
  voter       text not null,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (review_id, voter)
);

create index if not exists votes_review_idx on votes (review_id);

-- ------------------------------------------------------------ aggregates
--
-- One row per business that has any visible review. Read by the cards and
-- the listing pages, which must not run a per-business query.

create or replace view review_stats as
  select business_slug,
         count(*)::int                        as review_count,
         round(avg(rating)::numeric, 2)::float as rating_avg
    from reviews
   where hidden_at is null
group by business_slug;

-- ------------------------------------------------------- submissions
--
-- A place somebody suggested from the site itself.
--
-- Deliberately NOT the same table as the directory. Business records
-- live in data/businesses/*.yaml, under review in git, because a
-- directory's facts should be auditable and revertable by anyone. This
-- table is the inbox in front of that: anyone can post to it, a
-- maintainer turns the good ones into YAML drafts with
-- `npm run submissions`, and the repository stays the source of truth.
--
-- Nothing here is ever rendered on the site. A row is a suggestion, not
-- a listing.

create table if not exists submissions (
  id           uuid primary key default gen_random_uuid(),

  name         text not null check (length(btrim(name)) between 2 and 120),
  category     text not null,
  district     text,
  address      text,
  lat          double precision,
  lng          double precision,

  -- Contact details, all optional. A submission with only a name and a
  -- pin is still worth having: the rest can be looked up, the location
  -- cannot.
  phone        text,
  website      text,
  telegram     text,
  instagram    text,

  -- Free text on purpose. Asking someone who is doing you a favour to
  -- fill in a seven-day opening schedule is how a form gets abandoned
  -- halfway. A maintainer normalises this into the real `hours` shape.
  hours_note   text,
  comment      text,
  -- How to reach the submitter, if they want to be reachable. Never
  -- shown on the site.
  contact      text,

  -- Set when the submitter happened to be signed in. Not required:
  -- demanding an account before someone may suggest a shop is exactly
  -- the barrier this table exists to remove.
  user_id      uuid references users (id) on delete set null,
  -- A daily pseudonym for the submitting network, kept only to
  -- rate-limit. Never the address itself — see lib/privacy.ts.
  submitter_key text,

  status       text not null default 'pending'
                 check (status in ('pending', 'imported', 'rejected')),
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now()
);

create index if not exists submissions_status_idx on submissions (status, created_at);
-- submitter_key's index, likewise, is created with the alter that adds it.

-- ------------------------------------- submissions: photo and first rating
--
-- Adding a place and having an opinion about it are the same act, so the
-- form asks for both. These are additive, so an existing database takes
-- them without a migration step.

alter table submissions add column if not exists rating smallint
  check (rating is null or rating between 1 and 5);

/*
 * The photo, as a base64 data URL, compressed in the browser before it
 * is sent.
 *
 * Deliberately in the row rather than a blob store: a blob store is
 * another account, another key and another bill, and this is a queue
 * rather than a library — `npm run submissions import` writes the file
 * into photos-src/ and nulls this column, so a row only carries an
 * image for as long as nobody has looked at it yet. That keeps the
 * table small enough for a free Postgres tier, which holding every
 * photo forever would not.
 */
alter table submissions add column if not exists photo text;

alter table submissions add column if not exists photo_imported_at timestamptz;

-- ======================================================== anonymous writing
--
-- Rating a place and saying why is the whole point of the site, and until
-- now both required an email account. That is backwards: the person who
-- knows which barber is good is not the person who will make a login to
-- say so, and a review nobody writes is worth less than a review signed
-- "Mehmon".
--
-- So a review may be attributed to an account OR to an anonymous author
-- key — the SHA-256 of a random cookie the server minted on the writer's
-- first write. See server/utils/identity.ts for what that key is and is
-- not. Accounts still exist and still mean something: they carry a name
-- across devices and browsers, which a cookie cannot.
--
-- Additive: an existing database takes this without losing a row.

alter table reviews alter column user_id drop not null;
alter table reviews add column if not exists author_key  text;
alter table reviews add column if not exists author_name text;

-- Exactly one author, never both and never neither. Without this an
-- unattributed review is representable, and an unattributed review is
-- one the two uniqueness rules below cannot see.
do $$ begin
  alter table reviews add constraint reviews_one_author
    check ((user_id is null) <> (author_key is null));
exception when duplicate_object then null;
end $$;

-- One review per anonymous author per place, the same rule accounts have
-- had from the start. The existing unique (business_slug, user_id) keeps
-- covering accounts: Postgres treats NULLs as distinct, so anonymous rows
-- do not collide with each other through it.
create unique index if not exists reviews_anon_uniq
  on reviews (business_slug, author_key) where author_key is not null;

-- ------------------------------------------------------------ votes, again
--
-- The primary key was (review_id, user_id), and a nullable column cannot
-- be part of a primary key. Rather than two nullable columns and two
-- partial indexes, a vote's author becomes one text column: 'u:<uuid>'
-- for an account, 'a:<author key>' for a cookie. A vote's identity is
-- never joined to, cascaded from or displayed, so it does not need to be
-- two typed columns — it needs to be one value that is either equal or
-- not.

do $$ begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = current_schema() and table_name = 'votes' and column_name = 'user_id'
  ) then
    alter table votes add column if not exists voter text;
    update votes set voter = 'u:' || user_id where voter is null;
    alter table votes drop constraint if exists votes_pkey;
    alter table votes alter column voter set not null;
    alter table votes drop column user_id;
    alter table votes add primary key (review_id, voter);
  end if;
end $$;

-- ============================================================= pseudonyms
--
-- Addresses are no longer stored. Rate limiting needs to recognise a
-- repeat caller within a day; it does not need to know which network they
-- are on, and a column that knows is a log of who read what — the record
-- that gets demanded later, and the one a directory of opinions must not
-- be able to hand over.
--
-- What replaces it is HMAC(secret, day || ':' || address), rotated daily,
-- with the secret outside the database. A stolen dump is a column of
-- noise. See lib/privacy.ts.
--
-- The old columns are dropped rather than converted: there is no key that
-- can turn a stored address into the new form without first holding the
-- address, and keeping them "just in case" is how a privacy change
-- becomes a rename.

-- The new columns are declared in the table definitions above, so all
-- this has to do is take the old ones away from a database created
-- before them. They are dropped rather than converted: no key can turn a
-- stored address into the new form without first holding the address, and
-- keeping them "just in case" is how a privacy change becomes a rename.
alter table submissions  add  column if not exists submitter_key text;
alter table submissions  drop column if exists submitted_ip;
alter table login_tokens add  column if not exists request_key text;
alter table login_tokens drop column if exists request_ip;

drop index if exists submissions_ip_idx;
drop index if exists login_tokens_ip_idx;
create index if not exists submissions_key_idx  on submissions  (submitter_key, created_at desc);
create index if not exists login_tokens_key_idx on login_tokens (request_key, created_at desc);

-- Anonymous reviews are rate limited per author key and per day, which
-- needs the same index accounts already have.
-- The writer's daily pseudonym, kept only to throttle. Separate from
-- author_key, which is durable and identifies the author to themselves;
-- this one is unrecognisable tomorrow and identifies nothing.
alter table reviews add column if not exists writer_key text;

create index if not exists reviews_author_idx on reviews (author_key, created_at desc);
create index if not exists reviews_writer_idx on reviews (writer_key, created_at desc);
