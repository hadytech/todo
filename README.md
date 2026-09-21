# yalp.uz

Toşkent joylari maʼlumotnomasi — ochiq kodli, ochiq maʼlumotli.
An open-source, open-data local business directory for Tashkent.

Static site, no server, no database. Everything is generated from YAML
files in this repository and served from GitHub Pages.

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
npm test           # alphabet + coordinate tests
npm run validate   # check every YAML file
npm run generate   # build the static site into .output/public
npm run check:budget  # fail if any page exceeds its weight budget
npm run check:html    # static HTML and accessibility audit
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

## Pages

```
/                              search, three category tiles, districts
/qidiruv?q=&kat=&tuman=        search — noindex, thin by nature
/qoshish                       how to contribute a listing
/kategoriya/<cat>              one category, whole city
/tuman/<district>              one district, all categories
/toshkent/<district>/<cat>     the intersection — the pages that rank
/b/<slug>                      a business
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

To move it to a custom domain, set **one** repository variable:

```
CUSTOM_DOMAIN = yalp.uz
```

That switches the canonical URLs, the asset prefix and the `CNAME` file
together. They are one setting because changing one without the others is
how this usually breaks: canonical tags and a sitemap pointing at a domain
that does not serve yet are worse than not having the domain at all.

`SITE_URL` and `BASE_URL` still override individually if a setup ever
needs them apart.

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

## Open items

- [ ] **Verify GitHub Pages honours HTTP `Range`**: `npm run check:range <url>`.
      The map code is written and falls back gracefully, but it has not
      been run against a real archive — PMTiles fetches byte ranges out of
      one large file, so if Pages ignores `Range` the archive must move to
      a GitHub Release asset (set `NUXT_PUBLIC_PMTILES_URL`, and check
      CORS from the Pages origin).
- [ ] `.uz` DNS — confirm the registrar can set apex `A` records for Pages
      *before* paying for the domain.
- [ ] **Reviews need a write endpoint**, which static hosting cannot
      provide. Deferred until the directory has traction. Options are in
      the project plan; the cheapest real one is a small API on a ~€4/mo
      VPS with the site staying on Pages.
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
| Fonts | none — system stack, which covers `ö ğ ç ş` everywhere |

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
