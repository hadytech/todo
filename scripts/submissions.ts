/**
 * The maintainer's side of the public form.  `npm run submissions`
 *
 * Suggestions arrive in Postgres because a contributor should not need a
 * GitHub account to name the barber on their street. They do not stay
 * there: a directory's facts belong in git, where anyone can see who
 * changed what and revert it. This script is the bridge — it turns a
 * reviewed suggestion into a YAML draft, which is then committed like
 * every other change.
 *
 *   npm run submissions                  # what is waiting
 *   npm run submissions import <id>      # write a draft, mark imported
 *   npm run submissions reject <id> [why]
 *
 * Imported rows become `status: draft`, never `published` — a stranger's
 * suggestion is a lead, not a verified listing. It joins the same queue
 * as everything else in `npm run todo`.
 */
import { writeFileSync, existsSync } from 'node:fs'
import postgres from 'postgres'
import { toSlug, toDisplay } from '../lib/alphabet'
import { loadBusinesses } from '../lib/load'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL kerak. .env faylini tekşiring.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })

interface Row {
  id: string
  name: string
  category: string
  district: string | null
  address: string | null
  lat: number | null
  lng: number | null
  phone: string | null
  website: string | null
  telegram: string | null
  instagram: string | null
  hours_note: string | null
  comment: string | null
  contact: string | null
  created_at: Date
}

const [command, id, ...rest] = process.argv.slice(2)

/** Quoted always: these strings carry colons and apostrophes, and an
 *  unquoted one silently becomes a nested mapping. */
const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

function draftYaml(r: Row, slug: string): string {
  const out = [
    `name: ${q(toDisplay(r.name))}`,
    `category: ${q(r.category)}`,
  ]
  if (r.district) out.push(`district: ${r.district}`)
  if (r.address) out.push(`address: ${q(toDisplay(r.address))}`)
  if (r.lat != null && r.lng != null) {
    out.push('location:', `  lat: ${r.lat}`, `  lng: ${r.lng}`)
  }
  // Phone arrives normalised by the endpoint, but only when it parsed to
  // nine digits. Anything else is left for a human, so it is checked
  // again here rather than written out to fail validation later.
  if (r.phone && /^\+998 \d{2} \d{3} \d{2} \d{2}$/.test(r.phone)) {
    out.push(`phones: [${q(r.phone)}]`)
  }
  if (r.website && /^https?:\/\//.test(r.website)) out.push(`website: ${q(r.website)}`)
  out.push('status: draft')

  // Everything the submitter said that does not fit a field goes into
  // the note, where it is visible to whoever verifies the listing and
  // never rendered on the site.
  const notes = ['TEKŞIRILSIN: saytdagi forma orqali kelgan taklif']
  if (!r.lat) notes.push('koordinata yoʻq')
  if (!r.district) notes.push('tuman koʻrsatilmagan')
  if (r.hours_note) notes.push(`iş vaqti (taklifçi soʻzi): ${r.hours_note}`)
  if (r.phone && !/^\+998 /.test(r.phone)) notes.push(`telefon tekşirilsin: ${r.phone}`)
  if (r.website && !/^https?:\/\//.test(r.website)) notes.push(`havola: ${r.website}`)
  if (r.comment) notes.push(`izoh: ${r.comment}`)
  if (r.contact) notes.push(`taklifçi aloqasi: ${r.contact}`)
  out.push(`note: ${q(notes.join('; '))}`)

  return out.join('\n') + '\n'
}

/** A slug that does not collide with an existing listing. */
function freeSlug(name: string): string {
  const base = toSlug(name) || 'joy'
  const taken = new Set(loadBusinesses().businesses.map((b) => b.slug))
  if (!taken.has(base) && !existsSync(`data/businesses/${base}.yaml`)) return base
  for (let n = 2; n < 100; n++) {
    const s = `${base}-${n}`
    if (!taken.has(s) && !existsSync(`data/businesses/${s}.yaml`)) return s
  }
  throw new Error(`slug band: ${base}`)
}

async function list() {
  const rows = await sql<(Row & { dup: number })[]>`
    select s.*,
           (select count(*) from submissions o
             where o.status = 'pending' and lower(o.name) = lower(s.name)
               and o.id <> s.id)::int as dup
      from submissions s
     where s.status = 'pending'
  order by s.created_at
  `
  if (!rows.length) {
    console.log('Yangi taklif yoʻq.')
    return
  }

  console.log(`${rows.length} ta yangi taklif:\n`)
  for (const r of rows) {
    console.log(`  ${r.name}`)
    console.log(`    id: ${r.id}`)
    console.log(`    ${r.category}${r.district ? ` · ${r.district}` : ''}`)
    if (r.address) console.log(`    ${r.address}`)
    console.log(`    koordinata: ${r.lat != null ? `${r.lat}, ${r.lng}` : 'yoʻq'}`)
    if (r.phone) console.log(`    telefon: ${r.phone}`)
    if (r.hours_note) console.log(`    iş vaqti: ${r.hours_note}`)
    if (r.comment) console.log(`    izoh: ${r.comment}`)
    // Two people suggesting the same shop is a good sign, not a problem
    // — but importing both would put it in the directory twice.
    if (r.dup) console.log(`    ⚠ şu nom bilan yana ${r.dup} ta taklif bor`)
    console.log('')
  }
  console.log('npm run submissions import <id>   — qoralama fayl yaratadi')
  console.log('npm run submissions reject <id> [sabab]')
}

async function importOne(rowId: string) {
  const [r] = await sql<Row[]>`
    select * from submissions where id = ${rowId} and status = 'pending'
  `
  if (!r) { console.error('Taklif topilmadi yoki allaqaçon koʻrib çiqilgan.'); process.exit(1) }

  const slug = freeSlug(r.name)
  const path = `data/businesses/${slug}.yaml`
  writeFileSync(path, draftYaml(r, slug), 'utf8')

  await sql`
    update submissions
       set status = 'imported', reviewed_at = now(), review_note = ${slug}
     where id = ${rowId}
  `
  console.log(`Yaratildi: ${path}`)
  console.log('Tekşiring, toʻldiring, keyin commit qiling:')
  console.log(`  npm run validate && git add ${path} && git commit`)
}

async function reject(rowId: string, why: string) {
  const rows = await sql`
    update submissions
       set status = 'rejected', reviewed_at = now(), review_note = ${why || null}
     where id = ${rowId} and status = 'pending'
    returning name
  `
  if (!rows.length) { console.error('Taklif topilmadi.'); process.exit(1) }
  console.log(`Rad etildi: ${rows[0]!.name}`)
}

try {
  if (command === 'import') {
    if (!id) { console.error('id kerak'); process.exit(1) }
    await importOne(id)
  } else if (command === 'reject') {
    if (!id) { console.error('id kerak'); process.exit(1) }
    await reject(id, rest.join(' '))
  } else {
    await list()
  }
} finally {
  await sql.end()
}
