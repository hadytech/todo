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
