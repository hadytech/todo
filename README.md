# yalp.uz

Toşkent joylari maʼlumotnomasi — ochiq kodli, ochiq maʼlumotli.
An open-source, open-data local business directory for Tashkent.

Business records are YAML files in this repository, validated in CI and
rendered to static pages. Reviews are not: opinions belong in a database,
facts belong under review in git. The site runs with or without that
database — see *Deployment*.

---

## The alphabet rule

Data is authored in the **new Uzbek Latin alphabet** (`ö ğ ç ş`). Every
other form is derived at build time by [`lib/alphabet.ts`](lib/alphabet.ts),
never stored — so they cannot drift.

| Form | Example | Where it is used |
|---|---|---|
| New Latin (canonical) | `Çorsu Restorani` | everything the visitor reads |
| Official Latin | `Chorsu Restorani` | JSON-LD `alternateName` |
| ASCII | `Chorsu Restorani` | meta description, `img alt`, "Boşqa nomi" |
| Slug | `chorsu-restorani` | the URL |
| Search key | `chorsu restorani` | the search index **and** every query |

**Write in ö/ğ/ç/ş, search in anything, render in whatever wins.**

Two things make this work, and both are easy to break:

1. `toSearchKey` is applied to the index *and* the query. `çorsu`,
   `chorsu`, `cho'rsu` and `Чорсу` all collapse to one key. The shared
   config lives in [`lib/search.ts`](lib/search.ts) — if the build and the
   browser ever tokenize differently, search fails silently.
2. `ç` expands to **`ch`**, not `c`. Generic diacritic folding gives
   `ç → c`, which would lose "chorsu" — the query almost everyone types.
   This is why the ASCII spelling is published in `alternateName`, the
   meta description and a visible line on each page.

The display alphabet is one config value (`NUXT_PUBLIC_ALPHABET`). If
Search Console says standard Latin wins, flip it — no data migration.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # alphabet, coordinates, rating maths, database rules
npm run validate   # check every YAML file
npm run build      # build for Vercel (server + reviews)
npm run generate   # build the static site into .output/public
npm run check:budget  # fail if any page exceeds its weight budget
npm run check:html    # static HTML and accessibility audit
```

Nothing above needs a database or an account anywhere. Without
`DATABASE_URL` the site runs and builds normally and the review section
reports that it is unavailable, which is the truth. Copy `.env.example`
to `.env` when you want the write side too.

The database tests are skipped unless you point them at a Postgres:

```bash
TEST_DATABASE_URL=postgres://... npm test
```

## Adding a business

```bash
npm run entry      # http://localhost:4321
```

Paste a Google or Yandex Maps URL into the coordinate field and it fills
itself in. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves. It writes one YAML file
into `data/businesses/`, which you then commit like any other change.

You can also just write the file by hand — the filename is the URL slug:

```yaml
name: Çorsu Restorani          # new alphabet: ö ğ ç ş
category: ovqatlanish/restoran
district: shayxontohur
address: Çorsu bozori yonida, Toşkent
location: { lat: 41.3264, lng: 69.2347 }
phones: ["+998 71 123 45 67"]
hours:
  mon: ["09:00", "22:00"]
  fri: [["09:00", "15:00"], ["18:00", "23:00"]]   # tanaffus bilan
  sun: closed
status: published
```

A day is `closed`, one range, or several. The third form is not an edge
case: a great many restaurants and clinics close between lunch and
dinner, and a schema that cannot say so forces whoever enters the data to
lie. Closing at or after midnight is written as `"24:00"` on the day it
starts, which keeps every range comparable as plain minutes and avoids a
wrap-around special case everywhere downstream.

`npm run validate` checks the category and district exist, the
coordinates fall inside Tashkent, the phone format is right, and every
referenced photo file is present. CI runs it on every pull request, so
broken data cannot reach the site.

> The two `namuna-*.yaml` files are **placeholders, not real businesses**.
> Delete them once real listings are in.

## Contributing data

Three routes in, easiest first:

1. **[Issue form](.github/ISSUE_TEMPLATE/joy-qoshish.yml)** — no YAML, no
   git. Paste a maps link, pick a district, done. Linked from `/qoshish`.
2. **Edit on GitHub** — every business page links to its own YAML file.
3. **`npm run entry`** — the local form, for entering many at once.

All three land as a pull request or an issue, and CI validates before
anything merges. That is the whole moderation model: no accounts, no
admin panel, and the review history is public.

## Photos

```bash
# put originals in photos-src/<slug>/, then:
npm run photos
```

Originals are never committed. Each image is squeezed toward ~60KB of AVIF
(quality steps down until it fits, so a busy photo costs about the same as
a flat one) and written to `public/photos/`, then recorded in the
business's YAML with the comments and field order preserved.

Businesses **without** photos get a generated card instead — `npm run og`
draws their name, category and district onto a 1200x630 PNG. Early on
almost nothing has photos, and without this every share in Telegram shows
the same generic logo, indistinguishable from every other link. A missing
font would render those cards blank rather than erroring, so the script
checks that glyphs actually rasterise before generating any.

The first photo of a business that has one gets a `<slug>-og.jpg` at 1200x630. That one exists
purely for link previews: Telegram and most other scrapers cannot decode
AVIF, and an `og:image` they cannot read produces a preview card with no
picture — which matters, because Telegram is where most sharing happens.

## Near me

The search page can sort by distance. Geolocation is requested only on an
explicit tap, never on page load; the position stays in memory, is not
stored, is not put in the URL and never leaves the browser. A position
outside Tashkent disables the sort and says so, rather than silently
ranking the whole directory by how far away it is.

## Map

MapLibre + a self-hosted PMTiles archive. No API key, no tile server, no
per-request cost.

```bash
BUILD=20260901 npm run tiles      # extracts a Toshkent slice, ~tens of MB
npm run vendor:glyphs             # optional: serve label fonts yourself
```

The archive is gitignored — it would eat the repo budget. Build it locally
for development, or attach it to a GitHub Release and point
`NUXT_PUBLIC_PMTILES_URL` at that asset.

The map is strictly opt-in: MapLibre is 264KB gzipped, more than triple
the rest of a business page, so nothing loads until the visitor taps
"Xaritani koʻrsatiş". Every failure path falls back to a plain
OpenStreetMap link that works with no JavaScript at all.

## Identity

Everything visual comes from `lib/brand.ts`, and `lib/brand.test.ts`
asserts two things about it: that the palette meets WCAG AA in both
themes, and that `main.css` still matches the definition. Change one
without the other and a test fails — which is the only reliable way to
stop a stylesheet and a design definition drifting apart.

| | |
|---|---|
| Accent | **Mint.** `#0B6D5B` on light, `#6BDBBF` on dark |
| Neutrals | Slightly green-biased, so they read as chosen next to the mint rather than inherited |
| Type | **Manrope** — flat terminals, open counters, and it carries `ö ğ ç ş` *and* Cyrillic, which this site cannot do without |
| Mark | A map pin on a rounded mint tile |

The contrast test earned its place immediately: mint-600 measures 4.29:1
on white and fails AA for text, which is not a thing the eye reliably
catches. The light accent is mint-700.

`npm run brand` generates the favicon, the app icons, the default share
image and the web manifest from that one definition, so they cannot drift
— the usual failure being a favicon still showing last year's logo
because it was exported by hand once and never again.

The mark is a pin because the site is about places, and because it has to
survive being 16 pixels wide in a browser tab. The first version did not:
at 16px the pin thinned out and its hole closed up. The pin is now
heavier and the ring thicker, which was worth one more pass because the
tab is where a favicon is actually seen.

## Theme and colour

Components never name a colour. They use semantic tokens — `bg-canvas`,
`text-ink`, `border-line`, `bg-accent` — and the tokens swap per theme, so
there is not a single `dark:` variant in the markup. A component cannot be
right in one theme and wrong in the other, because it only ever names a
role.

The day/night switch layers an explicit choice over the system
preference: no stored value means follow the system, which is the right
default — someone whose phone is already in dark mode should not have to
tell this site as well.

Two details that are easy to get wrong and obvious when they are:

- The stored theme is applied by a small **inline, blocking** script in
  the head. Anything deferred runs after the first paint, and the visitor
  sees a white flash before their dark theme arrives.
- The toggle's icon is chosen by **CSS, not JavaScript**. The page is
  prerendered with no knowledge of the visitor's theme, so picking the
  icon in script would mean the server guesses and hydration flips it.

## Pages

```
/                              search, three category tiles, districts
/qidiruv?q=&kat=&tuman=        search — noindex, thin by nature
/qoshish                       how to contribute a listing
/kategoriya/<cat>              one category, whole city
/tuman/<district>              one district, all categories
/toshkent/<district>/<cat>     the intersection — the pages that rank
/b/<slug>                      a business — reviews, ratings, votes
/kirish                        email login — noindex
```

Browsing works on both axes. Without `/kategoriya/<cat>` the home page had
to enumerate every district under every category to reach anything, which
is what made it dense — roughly twenty chips before the first listing.
Three tiles with counts replaced all of it.

The browse surface is a real hierarchy, not a flat set of leaves:
home → district → category × district → business. Every business page
renders the trail as visible breadcrumbs *and* declares it as
`BreadcrumbList`, which gives the district and landing pages the internal
links they need — those are where search traffic lands, so they should not
depend on the sitemap alone to be found.

Pages with nothing on them are never generated and never linked. An empty
landing page is thin content that drags on the pages that do rank, and a
dead end for anyone who taps it.

## The verification queue

```bash
npm run todo    # what still needs details, grouped by category
```

`status: draft` is a queue of known names waiting on details, not a
staging area for invented data. A draft may omit district, address and
location; a **published** listing may not. So a name that is a matter of
public record can be written down immediately, while the facts someone
has to actually confirm stay empty until they do.

Drafts never reach the site: they are absent from the pages, the sitemap
and the search index. Verify one, fill in the details, set
`status: published`.

The repository ships ~32 such drafts — Tashkent universities and major
bazaars — seeded from their names alone. **No address, phone or opening
hours was guessed for any of them.** Categories like barber shops and
computer shops are deliberately empty: there is no public record to seed
them from, and inventing entries would be worse than an empty category.

## Reviews

Five stars, a written review, and up/down votes on each review. Everything
a visitor writes lives in Postgres; nothing about it touches the YAML.

**Login is an emailed link, no password.** Phone verification would be the
right answer for Tashkent and costs money per message, so that waits until
there is a reason to pay for it. Addresses are used for login only and are
never shown on the site.

Three rules do the anti-astroturfing work, and all three are database
constraints rather than checks in a handler — a constraint cannot be
forgotten by code written later:

| Rule | How |
|---|---|
| One review per person per place | `unique (business_slug, user_id)`; a second opinion rewrites the first |
| One vote per person per review | `primary key (review_id, user_id)` |
| A login link works once | `used_at is null` inside the claiming `UPDATE`, so a mail scanner that prefetches the link cannot race the visitor for it |

You cannot vote on your own review. Tokens are stored as SHA-256 hashes,
never raw, so a database dump is not a set of working credentials.

**No average is shown below three reviews.** One five-star rating is not a
measurement, and a number that looks like one is worse than no number.
Below the threshold the page shows the reviews and the count.

Sorting and display are deliberately different numbers
([`lib/rating.ts`](lib/rating.ts)):

- **Display** is the plain average — what people actually gave. Showing
  4.1 when every reviewer said 5 would be a lie about what they said.
- **Sorting** is a Bayesian average against the site-wide mean, so one
  five-star review does not outrank two hundred averaging 4.8.
- **Reviews within a page** sort by the Wilson lower bound of their votes,
  not `up − down`. Raw difference calls 41–40 and 1–0 a tie; they are not.

Business pages are rendered on demand and cached for ten minutes, so the
review text is in the HTML for crawlers, with `aggregateRating` and the
first ten reviews as JSON-LD. Client-rendered reviews would be content a
crawler may never see — on a review site, that is the content.

Moderation is `hidden_at` on a review, or `blocked_at` on an account to
hide everything it wrote at once. Both are reversible; neither deletes
anything.

## Layout

```
data/          YAML — this is the database
lib/           alphabet, schema, loader, search config (all unit-tested)
scripts/       validate, build-index, entry form, tile checks
server/        API routes + sitemap; run at build time only
app/           Nuxt pages and components
```

## Search in other languages

The alphabet layer solves *scripts* — `çoyxona`, `choyxona` and `чойхона`
fold to one key. It does nothing for different *words*: someone searching
`аптека` is not misspelling `dorixona`, they are using another language,
and Tashkent runs on both.

`lib/synonyms.ts` maps each category to its Russian, English and
colloquial Uzbek equivalents, expanded at index time — one pass at build,
nothing extra shipped to the browser. Synonyms are boosted *down*, so a
place actually named "Apteka" still outranks every pharmacy matched
through the word.

`lib/search.test.ts` builds a real index and searches it, which is also
what catches the build script and the browser drifting apart — if they
ever tokenize differently, search fails silently rather than erroring.

## Measuring

The plan for the new alphabet is to ship it, watch which spellings people
actually search, and flip `NUXT_PUBLIC_ALPHABET` if the data disagrees.
That decision cannot be made without numbers — only argued about — so two
repository variables turn measurement on:

| Variable | Effect |
|---|---|
| `ANALYTICS` | GoatCounter site code, e.g. `yalp` for `yalp.goatcounter.com` |
| `SITE_VERIFICATION` | `google-site-verification` token for Search Console |

Both are empty by default: nothing is loaded and no request leaves the
page until they are set, and analytics never load in dev, so local views
do not pollute the numbers.

GoatCounter is open source, free for non-commercial use, sets no cookies
and collects no personal data — which is why it needs no consent banner.
A tracker that required one would cost more in friction than these
numbers are worth.

Search Console is the more important half: it reports impressions *by
query*, which is the only way to see people searching `chorsu` and not
reaching a page that renders `Çorsu`.

## Indexing

Search engines are blocked by default — `robots.txt` says `Disallow: /`
and every page carries `noindex`. Turn it on with repository variable
`INDEXABLE=true` once there is real content.

The default is the safe one on purpose: a directory crawled while it
holds a handful of placeholder listings makes its first impression as a
near-empty site, and early quality signals are sticky. You want indexing
to begin at ~50 real listings, not before.

## Deployment

Two targets, one codebase. Which one you get is decided by `NITRO_PRESET`
and nothing else.

| | Vercel (default) | GitHub Pages (`NITRO_PRESET=static`) |
|---|---|---|
| Business pages | rendered on demand, cached 10 min | prerendered at build |
| Reviews, ratings, votes | yes | no — there is nowhere to write |
| Login | yes | no |
| HTTPS | automatic | needs Pages to issue a certificate |
| Cost | free tier | free |

The static build is not a crippled version — it is the honest one for a
host with no server. The review section renders as unavailable rather
than showing a form that cannot submit.

### Vercel

This is the default because reviews have to POST somewhere and GitHub
Pages has nowhere.

1. Import the repository at vercel.com. `vercel.json` pins the build
   command, so the prep steps (`brand`, `index`, `og`) are not skipped by
   framework auto-detection — without them the site ships with no search
   index.
2. Create a Postgres at neon.tech. Pick the **Frankfurt** region:
   `vercel.json` puts the functions in `fra1`, and a function in Frankfurt
   talking to a database in Virginia pays that round trip on every query.
3. Apply the schema once: `psql "$DATABASE_URL" -f db/schema.sql`, or
   `npm run db:schema`.
4. Set the environment variables from `.env.example` in the Vercel project.
   Use Neon's **pooled** connection string — the host contains `-pooler`.
   Serverless functions open a connection per cold start and the pooler is
   what absorbs that.
5. Point the domain at Vercel. It issues its own certificate.

One caveat worth knowing before you rely on it: Vercel's Hobby tier is for
non-commercial use. A free directory with no ads sits inside that. The day
yalp.uz sells listings or runs ads it needs the paid tier.

None of this is lock-in. It is Nuxt and Postgres; moving to a VPS is a
change of `DATABASE_URL` and a different `NITRO_PRESET`.

### GitHub Pages

Push to `main` → GitHub Actions builds and deploys to Pages.

Repository settings → Pages → Source: **GitHub Actions**.

This step cannot be automated. Creating a Pages site needs repository
admin rights, which `GITHUB_TOKEN` does not have and no `permissions:`
block can grant — `actions/configure-pages` with `enablement: true` fails
with "Resource not accessible by integration" unless the workflow is given
an admin-scoped personal access token. Until Pages is enabled by hand,
every build step passes and the deploy fails on the last one.

By default the site builds for its project URL,
`<owner>.github.io/<repo>/`, derived from the repository itself — a
rename needs nothing updated.

To move it to a custom domain, set it in **Settings → Pages → Custom
domain**. Nothing else needs changing: the workflow asks
`actions/configure-pages` what the Pages configuration actually is and
derives the canonical URLs, the asset prefix and the `CNAME` file from
that one answer.

Keeping a second copy of the domain in a repository variable was the
earlier design and it was wrong in a way worth remembering: with an
Actions deploy the uploaded artifact is authoritative, so a build whose
artifact had no `CNAME` file would have *cleared* a domain configured in
Settings. Reading the configuration instead means the build cannot
disagree with it.

`SITE_URL` and `BASE_URL` still override individually if a setup ever
needs them apart.

### HTTPS

After DNS resolves, tick **Enforce HTTPS** in Settings → Pages. GitHub
issues a Let's Encrypt certificate automatically, which can take up to an
hour; the checkbox stays disabled until it is ready, and that wait is
normal rather than a failure.

Do not skip it. The failure mode is a site that works perfectly and
quietly stays on http — browsers label it "Not Secure", and a directory
asking to be trusted with addresses and phone numbers cannot afford that.
`npm run check:live` fails if the site is not on https or if http does not
redirect to it, so it is a check rather than something to remember.

### Attaching the domain

Verify the domain with GitHub first (Settings → Pages → Add a verified
domain). Note that most DNS panels — aHOST's included — treat the Name
field as **relative to the zone** and append the domain themselves. Enter

```
_github-pages-challenge-<user>
```

and not `_github-pages-challenge-<user>.yalp.uz`, which lands the record
at `...yalp.uz.yalp.uz` and never verifies. The existing `_dmarc` record
in the same panel is the tell: it is entered bare. Drop the TTL to 300
while verifying so a failed lookup is not cached for hours.

Then point the domain at Pages — apex `A` records to `185.199.108.153`,
`185.199.109.153`, `185.199.110.153`, `185.199.111.153`, and a `CNAME` on
`www` to `<owner>.github.io`.

## After a deploy

```bash
npm run check:live https://yalp.uz
# EXPECT_INDEXABLE=true npm run check:live https://yalp.uz   # once indexing is on
```

Every other check in this repo inspects the build. This one inspects what
actually serves, which is where a correct build can still reach nobody: a
base URL that does not match where the site landed, a canonical naming
the wrong host, a robots.txt opening a site that was meant to stay
private.

It follows a real link from the home page rather than guessing a slug, so
it also proves internal links resolve under whatever base URL is in play,
and it fetches the assets the page references — a 404 there is the classic
base-URL mismatch. Exits non-zero on any failure, so it can gate a deploy.

## Open items

- [ ] **Verify GitHub Pages honours HTTP `Range`**: `npm run check:range <url>`.
      The map code is written and falls back gracefully, but it has not
      been run against a real archive — PMTiles fetches byte ranges out of
      one large file, so if Pages ignores `Range` the archive must move to
      a GitHub Release asset (set `NUXT_PUBLIC_PMTILES_URL`, and check
      CORS from the Pages origin).
- [ ] `.uz` DNS — confirm the registrar can set apex `A` records for Pages
      *before* paying for the domain.
- [x] **Reviews, ratings, votes** — built. Postgres behind Vercel
      functions, email magic-link login, one review per person per place.
      See *Reviews* below.
- [ ] **Connect Vercel and Neon.** The code is deployed-ready and tested,
      but no project or database exists yet — both are the account
      owner's to create.
- [ ] Turn on `ANALYTICS` and `SITE_VERIFICATION` when the site goes
      live — the alphabet decision depends on ~8 weeks of query data, and
      that clock only starts once they are set.
- [ ] Photo budget: Pages repos have a ~1GB soft limit. Keep photos AVIF
      and under ~60KB; split them into a second repo around 2,000 listings.

## Performance budget

`npm run check:budget` walks every prerendered page, sums the gzipped
weight of the scripts that page actually loads, and exits non-zero if any
page is over. It runs in CI on every pull request, so the budget is a
gate rather than an aspiration.

| | |
|---|---|
| Any page, eager JS | ≤ 100KB gzipped (currently ~80KB) |
| Any page, HTML | ≤ 40KB gzipped (currently ~2.5KB) |
| Search index | lazy — first keystroke only |
| MapLibre | lazy — 264KB gzipped, on tap only |
| Photos | ~60KB AVIF each |
| Fonts | one — Manrope, `display=swap`, from Google Fonts. `npm run vendor:font` self-hosts it instead |

Chunks reached only through a dynamic import are reported separately
rather than charged to the page; if one ever becomes eager, it lands in
the page total and the gate fails.

`npm run check:html` audits the generated HTML — missing alt text and
input labels, duplicate ids, heading order, empty links, and words fused
by a collapsed space between adjacent elements. That last one has shipped
twice ("yuboringyokixabar", "Çilonzor2"), which is why it is a check
rather than a note. It is deliberately not a browser run: axe in CI means
installing Chromium on every pull request, and these faults need no
renderer. Two lowercase words fusing is indistinguishable from a long
word, so looking at the pages is still the backstop.

## Licence

Code: MIT. Data in `data/`: CC BY-SA 4.0 — see [`data/LICENSE`](data/LICENSE).
