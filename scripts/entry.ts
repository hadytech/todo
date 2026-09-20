/**
 * Local-only data entry form.  `npm run entry`  ->  http://localhost:4321
 *
 * Manual entry speed is the real bottleneck for launch, so this is a
 * first-class tool rather than an afterthought: paste a maps URL to fill
 * coordinates, tab through the fields, Ctrl+Enter to save. It writes a
 * YAML file into data/businesses/ which you then commit like any change.
 *
 * It binds to 127.0.0.1 and writes to the working tree — it is a local
 * authoring tool and must never be deployed.
 */
import { createServer } from 'node:http'
import { writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { businessSchema } from '../lib/schema'
import { loadCategories, loadDistricts, DATA_DIR } from '../lib/load'
import { toSlug, findLegacySpellings } from '../lib/alphabet'
import { parseCoords } from '../lib/coords'

const PORT = 4321

const DAYS = [
  ['mon', 'Dush'], ['tue', 'Sesh'], ['wed', 'Çor'], ['thu', 'Pay'],
  ['fri', 'Juma'], ['sat', 'Şan'], ['sun', 'Yak'],
] as const

function page(): string {
  const categories = loadCategories()
  const districts = loadDistricts()
  const catOpts = categories
    .flatMap((c) => c.children.map((ch) => `<option value="${c.slug}/${ch.slug}">${c.name} → ${ch.name}</option>`))
    .join('')
  const distOpts = districts.map((d) => `<option value="${d.slug}">${d.name}</option>`).join('')
  const dayRows = DAYS.map(([k, label]) => `
    <tr>
      <td>${label}</td>
      <td><input name="h_${k}_open" value="09:00" size="5"></td>
      <td><input name="h_${k}_close" value="22:00" size="5"></td>
      <td><label><input type="checkbox" name="h_${k}_closed"> yopiq</label></td>
    </tr>`).join('')

  return `<!doctype html>
<html lang="uz"><head><meta charset="utf-8"><title>yalp.uz — joy qoʻşiş</title>
<style>
  :root { color-scheme: light dark; --line:#8883; }
  body { font:16px/1.5 system-ui,sans-serif; max-width:42rem; margin:2rem auto; padding:0 1rem; }
  h1 { font-size:1.25rem; } fieldset { border:1px solid var(--line); border-radius:8px; margin:1rem 0; }
  label.f { display:block; margin:.6rem 0; } label.f span { display:block; font-size:.8rem; opacity:.7; }
  input,select,textarea { width:100%; padding:.45rem; font:inherit; border:1px solid var(--line);
    border-radius:6px; background:transparent; color:inherit; }
  table input { width:auto; } td { padding:.15rem .4rem; }
  button { padding:.6rem 1.2rem; font:inherit; border-radius:6px; cursor:pointer; }
  #out { white-space:pre-wrap; font-family:ui-monospace,monospace; font-size:.85rem;
    padding:.75rem; border-radius:6px; background:#8881; margin-top:1rem; }
  .row { display:flex; gap:.75rem; } .row > * { flex:1; }
  kbd { font:inherit; background:#8882; padding:0 .3rem; border-radius:3px; }
</style></head><body>
<h1>Joy qoʻşiş</h1>
<p style="opacity:.75;font-size:.9rem">Nomlarni <b>yangi alifboda</b> yozing: ö ğ ç ş.
Saqlash — <kbd>Ctrl</kbd>+<kbd>Enter</kbd>.</p>
<form id="f">
  <fieldset><legend>Asosiy</legend>
    <label class="f">Nomi<span id="slug">slug: —</span><input name="name" required autofocus></label>
    <div class="row">
      <label class="f">Kategoriya<select name="category">${catOpts}</select></label>
      <label class="f">Tuman<select name="district">${distOpts}</select></label>
    </div>
    <label class="f">Manzil<input name="address" required></label>
    <label class="f">Koordinata
      <span>"41.3264, 69.2347" yoki Google/Yandex Maps havolasini qoʻying</span>
      <input name="coords" required placeholder="41.3264, 69.2347"></label>
    <label class="f">Tavsif<textarea name="description" rows="3"></textarea></label>
  </fieldset>
  <fieldset><legend>Aloqa</legend>
    <label class="f">Telefon<span>+998 XX XXX XX XX</span><input name="phone" placeholder="+998 71 123 45 67"></label>
    <div class="row">
      <label class="f">Telegram<input name="telegram" placeholder="@nomi"></label>
      <label class="f">Instagram<input name="instagram" placeholder="nomi"></label>
    </div>
    <div class="row">
      <label class="f">Sayt<input name="website" placeholder="https://"></label>
      <label class="f">Narx (1–4)<input name="price" type="number" min="1" max="4"></label>
    </div>
  </fieldset>
  <fieldset><legend>Iş vaqti</legend><table>${dayRows}</table></fieldset>
  <button type="submit">Saqlash</button>
</form>
<div id="out" hidden></div>
<script>
const f = document.getElementById('f'), out = document.getElementById('out');
const slugOf = s => s.normalize('NFC').toLowerCase()
  .replace(/o[ʻʼ'‘’\`]|ö|ў|о|ө/g,'o')
  .replace(/g[ʻʼ'‘’\`]|ğ|ғ|г/g,'g')
  .replace(/ç|ч/g,'ch').replace(/ş|ш|щ/g,'sh')
  .replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
f.name.addEventListener('input', e => {
  document.getElementById('slug').textContent = 'slug: ' + (slugOf(e.target.value) || '—');
});
f.addEventListener('keydown', e => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit();
});
f.addEventListener('submit', async e => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(f));
  const res = await fetch('/api/save', {
    method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
  const json = await res.json();
  out.hidden = false;
  out.textContent = json.ok ? '✓ ' + json.file + ' saqlandi' : '✗ ' + json.errors.join('\\n');
  if (json.ok) {
    f.reset(); f.name.focus();
    document.getElementById('slug').textContent = 'slug: —';
  }
});
</script></body></html>`
}

function buildRecord(body: Record<string, string>) {
  const coords = parseCoords(body.coords ?? '')
  if (!coords) return { errors: ['Koordinatani oʻqib boʻlmadi. "41.3264, 69.2347" koʻrinişida yozing.'] }

  // Only emit a day we actually have data for. Emitting [undefined,
  // undefined] for a blank field buries the real error under seven
  // spurious ones.
  const hours: Record<string, unknown> = {}
  for (const [k] of DAYS) {
    if (body[`h_${k}_closed`]) { hours[k] = 'closed'; continue }
    const open = body[`h_${k}_open`]?.trim()
    const close = body[`h_${k}_close`]?.trim()
    if (open && close) hours[k] = [open, close]
  }

  const record = {
    name: (body.name ?? '').trim(),
    category: body.category,
    district: body.district,
    address: (body.address ?? '').trim(),
    location: coords,
    ...(body.description?.trim() ? { description: body.description.trim() } : {}),
    phones: body.phone?.trim() ? [body.phone.trim()] : [],
    ...(body.telegram?.trim() ? { telegram: body.telegram.trim() } : {}),
    ...(body.instagram?.trim() ? { instagram: body.instagram.trim() } : {}),
    ...(body.website?.trim() ? { website: body.website.trim() } : {}),
    ...(body.price ? { price: Number(body.price) } : {}),
    ...(Object.keys(hours).length ? { hours } : {}),
    photos: [],
    status: 'published' as const,
  }

  const parsed = businessSchema.safeParse(record)
  if (!parsed.success) {
    return { errors: parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`) }
  }
  return { record: parsed.data }
}

const server = createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    return res.end(page())
  }

  if (req.method === 'POST' && req.url === '/api/save') {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      const reply = (code: number, body: unknown) => {
        res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' })
        res.end(JSON.stringify(body))
      }
      try {
        const built = buildRecord(JSON.parse(raw))
        if (built.errors) return reply(400, { ok: false, errors: built.errors })

        const slug = toSlug(built.record!.name)
        const file = join(DATA_DIR, 'businesses', `${slug}.yaml`)
        // Never clobber an existing entry — a duplicate name is far more
        // likely than an intentional overwrite.
        if (existsSync(file)) {
          return reply(409, { ok: false, errors: [`data/businesses/${slug}.yaml allaqachon mavjud.`] })
        }

        const legacy = findLegacySpellings(built.record!.name)
        const header = legacy.length
          ? `# Diqqat: nom eski alifboda koʻrinadi (${legacy.join(', ')}). Yangi alifboda yozing: ö ğ ç ş.\n`
          : ''
        writeFileSync(file, header + stringify(built.record), 'utf8')
        reply(200, { ok: true, file: `data/businesses/${slug}.yaml` })
      } catch (e) {
        reply(500, { ok: false, errors: [(e as Error).message] })
      }
    })
    return
  }

  res.writeHead(404).end('not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Joy qoʻşiş formasi: http://localhost:${PORT}`)
  console.log('Toʻxtatiş uchun Ctrl+C.')
})
