// Event panel map check: an event on land, one in open ocean, one with many neighbours, zoom in/out,
// at 390 and 1440 px; plus a network check that the outline file loads only when the panel opens.
// Usage: node scripts/verify-eventmap.mjs <base-url> <out-dir> [--widths 390,1440]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'

const args = process.argv.slice(2)
const base = args[0] ?? 'http://localhost:5173'
const out = args[1] ?? 'shots'
const widths = (args.includes('--widths') ? args[args.indexOf('--widths') + 1] : '390,1440').split(',').map(Number)
mkdirSync(out, { recursive: true })
const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson'
const QS = 'period=week&level=2.5'

const problems = []
const notes = []
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

// Pick the three events from the live feed.
const feed = await (await fetch(FEED)).json()
const qs = feed.features.map((f) => ({ id: f.id, place: f.properties.place ?? '', mag: f.properties.mag, lon: f.geometry.coordinates[0], lat: f.geometry.coordinates[1] }))
const dist = (a, b) => {
  const r = Math.PI / 180
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}
const landPick =
  qs.find((q) => /Russia/.test(q.place)) ?? qs.find((q) => /Afghanistan|Iran|Turkey|China|Tajikistan|Nevada|Utah|Montana|Argentina/.test(q.place))
const oceanCandidates = qs.filter((q) => /Ridge|Rise|South Pacific Ocean|Mid-|Easter Island|Bouvet|South Sandwich|Balleny|Indian Ocean|Atlantic Ocean|Pacific-Antarctic/.test(q.place))
const cluster = qs
  .map((q) => ({ q, n: qs.filter((o) => o.id !== q.id && dist(q, o) <= 250).length }))
  .sort((a, b) => b.n - a.n)[0].q
notes.push(`land: ${landPick?.place} | cluster: ${cluster.place} | ocean candidates: ${oceanCandidates.length}`)

async function page(w) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } })
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && problems.push(`${w}px console: ${m.text()}`))
  p.on('pageerror', (e) => problems.push(`${w}px pageerror: ${e.message}`))
  return { ctx, p }
}
async function overflow(p, label) {
  const o = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
  if (o[0] > o[1] + 1) problems.push(`${label}: sideways scroll ${o[0]} > ${o[1]}`)
}
async function openMap(p, id) {
  await p.goto(`${base}/explore?${QS}&event=${id}`, { waitUntil: 'domcontentloaded' })
  await p.locator('.emap').waitFor({ timeout: 30000 })
  await p.waitForFunction(() => (document.querySelector('.emap-land')?.getAttribute('d') ?? '').length > 50, null, { timeout: 30000 })
  await p.waitForTimeout(900)
  await p.locator('.emap').scrollIntoViewIfNeeded()
  await p.waitForTimeout(300)
}
const summary = (p) => p.locator('.emap-summary').innerText()

for (const w of widths) {
  const { ctx, p } = await page(w)
  // 1. On land
  if (landPick) {
    await openMap(p, landPick.id)
    await p.locator('.emap').screenshot({ path: path.join(out, `${w}-1-land.png`) })
    notes.push(`${w}px land "${landPick.place}": ${await summary(p)}`)
    await overflow(p, `${w} land`)
  } else problems.push('no land event found in the feed')

  // 2. Open ocean: the first candidate whose map had to widen
  let oceanDone = false
  for (const c of oceanCandidates.slice(0, 6)) {
    await openMap(p, c.id)
    if (await p.locator('.emap-note').count()) {
      await p.locator('.emap').screenshot({ path: path.join(out, `${w}-2-ocean.png`) })
      notes.push(`${w}px ocean "${c.place}": ${await p.locator('.emap-note').innerText()} | ${await summary(p)}`)
      oceanDone = true
      break
    }
  }
  if (!oceanDone && oceanCandidates[0]) {
    await openMap(p, oceanCandidates[0].id)
    await p.locator('.emap').screenshot({ path: path.join(out, `${w}-2-ocean.png`) })
    notes.push(`${w}px ocean "${oceanCandidates[0].place}" (land within 250 km, no widening): ${await summary(p)}`)
  }

  // 3. Many neighbours, hover, zoom in, zoom out
  await openMap(p, cluster.id)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-3-cluster.png`) })
  const nearCount = await p.locator('.emap-near').count()
  notes.push(`${w}px cluster "${cluster.place}": ${nearCount} nearby markers | ${await summary(p)}`)
  if (nearCount < 3) problems.push(`${w}px: cluster shows only ${nearCount} nearby markers`)
  // The visible marker nearest the map centre (clear of the zoom buttons in the corner).
  const pickNear = async () => {
    const boxes = await p.locator('.emap-near').evaluateAll((els) => {
      const f = document.querySelector('.emap-frame').getBoundingClientRect()
      return els.map((e, i) => {
        const r = e.getBoundingClientRect()
        return { i, d: Math.hypot(r.x + r.width / 2 - (f.x + f.width / 2), r.y + r.height / 2 - (f.y + f.height / 2)) }
      })
    })
    boxes.sort((a, b) => a.d - b.d)
    return p.locator('.emap-near').nth(boxes[0].i)
  }
  const dot = await pickNear()
  await dot.hover({ force: true })
  await p.waitForTimeout(250)
  if (!(await p.locator('.emap-tip').count())) problems.push(`${w}px: no tooltip on hover`)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-3b-hover.png`) })
  const zin = p.locator('.emap-tools button[aria-label="Zoom in"]')
  await zin.click()
  await zin.click()
  await p.waitForTimeout(300)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-4-zoomed-in.png`) })
  await p.locator('.emap-tools button[aria-label="Reset map"]').click()
  await p.getByRole('radio', { name: '500 km', exact: true }).click()
  await p.waitForTimeout(900)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-5-zoomed-out-500km.png`) })
  await p.getByRole('radio', { name: '50 km', exact: true }).click()
  await p.waitForTimeout(900)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-6-50km.png`) })
  // click a neighbour: the panel switches to it
  await p.getByRole('radio', { name: '250 km', exact: true }).click()
  await p.waitForTimeout(700)
  const before = new URL(p.url()).searchParams.get('event')
  await (await pickNear()).click({ force: true })
  await p.waitForTimeout(1200)
  const after = new URL(p.url()).searchParams.get('event')
  if (before === after) problems.push(`${w}px: clicking a nearby marker did not switch the event`)
  else notes.push(`${w}px clicking a nearby marker switched the panel (${before} -> ${after})`)
  await overflow(p, `${w} after map`)
  await ctx.close()
}

// Network: the outline file is requested only after the panel opens; no new external domains.
{
  const { ctx, p } = await page(1440)
  const reqs = []
  p.on('request', (r) => reqs.push(r.url()))
  await p.goto(`${base}/explore`, { waitUntil: 'networkidle' })
  await p.locator('.row').first().waitFor()
  await p.evaluate(() => document.getElementById('explore')?.scrollIntoView())
  await p.waitForTimeout(1500)
  const early = reqs.filter((u) => /countries-50m/.test(u))
  if (early.length) problems.push(`outline file loaded before the panel opened: ${early.join(', ')}`)
  const n = reqs.length
  await p.locator('.row').first().click()
  await p.waitForFunction(() => (document.querySelector('.emap-land')?.getAttribute('d') ?? '').length > 50, null, { timeout: 30000 })
  const late = reqs.slice(n).filter((u) => /countries-50m/.test(u))
  if (!late.length) problems.push('outline file not requested after opening the panel')
  const hosts = [...new Set(reqs.map((u) => new URL(u).host))].filter((h) => !/^localhost|^127\./.test(h))
  notes.push(`network: before opening, outline requests = ${early.length}; after opening = ${late.map((u) => new URL(u).pathname).join(', ')}`)
  notes.push(`network: external hosts contacted in the whole session = ${hosts.join(', ') || 'none'}`)
  await ctx.close()
}

await browser.close()
console.log(notes.join('\n'))
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo overflow, no console errors.')
process.exit(problems.length ? 1 : 0)
