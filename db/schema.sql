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
  -- Kept only to rate-limit. See server/utils/ratelimit.ts.
  request_ip  text
);

create index if not exists login_tokens_email_idx on login_tokens (email, created_at desc);
create index if not exists login_tokens_ip_idx    on login_tokens (request_ip, created_at desc);

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

create table if not exists votes (
  review_id   uuid not null references reviews (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  primary key (review_id, user_id)
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
  submitted_ip text,

  status       text not null default 'pending'
                 check (status in ('pending', 'imported', 'rejected')),
  reviewed_at  timestamptz,
  review_note  text,
  created_at   timestamptz not null default now()
);

create index if not exists submissions_status_idx on submissions (status, created_at);
create index if not exists submissions_ip_idx     on submissions (submitted_ip, created_at desc);

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
