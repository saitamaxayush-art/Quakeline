// Explorer check: globe with clouds, playback, Dim clouds, local map, and the cloud layer's states.
// Usage: node scripts/verify-globe.mjs <base-url> <out-dir> --nokey <base-url-without-key> [--widths 390,1440]
// Fails on sideways scroll, unexpected console errors, or a missing state.
import { chromium } from '@playwright/test'
import { mkdirSync } from 'fs'
import path from 'path'
import sharp from 'sharp'

const args = process.argv.slice(2)
const base = args[0] ?? 'http://localhost:5173'
const out = args[1] ?? 'shots'
const opt = (k) => (args.includes(k) ? args[args.indexOf(k) + 1] : null)
const nokey = opt('--nokey')
const widths = (opt('--widths') ?? '390,1440').split(',').map(Number)
mkdirSync(out, { recursive: true })

const problems = []
const notes = []
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })

async function page(w, { expectErrors = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 600 ? 844 : 900 } })
  const p = await ctx.newPage()
  p.on('console', (m) => m.type() === 'error' && !expectErrors && problems.push(`${w}px console: ${m.text()}`))
  p.on('pageerror', (e) => problems.push(`${w}px pageerror: ${e.message}`))
  return { ctx, p }
}
async function overflow(p, label) {
  const o = await p.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth])
  if (o[0] > o[1] + 1) problems.push(`${label}: sideways scroll ${o[0]} > ${o[1]}`)
}
const frames = (p, n, timeout = 150000) =>
  p.waitForFunction((k) => document.querySelectorAll('.cloud-ticks li.is-ready').length >= k, n, { timeout })
async function globe(p) {
  // Below the header and the sticky toolbar, as the page's own "Open the globe" does. The globe
  // loads only near the viewport, so scroll first, then wait for its canvas, then settle again.
  await p.locator('#globe').waitFor({ timeout: 30000 })
  await scrollToGlobe(p)
  await p.locator('.globe-plate canvas').waitFor({ timeout: 30000 })
  await scrollToGlobe(p)
}
async function scrollToGlobe(p) {
  await p.evaluate(() => {
    const el = document.getElementById('globe')
    const bar = document.querySelector('.toolbar')
    const sticky = bar && getComputedStyle(bar).position === 'sticky' ? bar.offsetHeight + 12 : 0
    const y = el.getBoundingClientRect().top + window.scrollY - 76 - sticky
    // The page grows as the list loads; let Lenis re-measure before jumping.
    window.__lenis?.resize()
    if (window.__lenis) window.__lenis.scrollTo(y, { immediate: true, force: true })
    else window.scrollTo(0, y)
  })
  await p.waitForTimeout(600)
}
const plate = (p) => p.locator('.globe-plate')

async function diff(a, b) {
  const [x, y] = await Promise.all([a, b].map((f) => sharp(f).removeAlpha().raw().toBuffer({ resolveWithObject: true })))
  let changed = 0
  for (let i = 0; i < x.data.length; i += 3) {
    const d = Math.abs(x.data[i] - y.data[i]) + Math.abs(x.data[i + 1] - y.data[i + 1]) + Math.abs(x.data[i + 2] - y.data[i + 2])
    if (d > 60) changed++
  }
  return changed / (x.data.length / 3)
}

for (const w of widths) {
  const { ctx, p } = await page(w)
  // 1. Clouds on at the default zoom
  await p.goto(`${base}/explore?clouds=1`, { waitUntil: 'domcontentloaded' })
  await globe(p)
  await frames(p, 3)
  await p.locator('.globe-label').waitFor()
  await p.waitForTimeout(1500)
  await plate(p).screenshot({ path: path.join(out, `${w}-1-clouds-default.png`) })
  await p.locator('#globe').screenshot({ path: path.join(out, `${w}-1b-globe-card.png`) })
  await overflow(p, `${w} clouds default`)

  // 2. Playing, two moments
  await frames(p, 7)
  await p.locator('.cloud-range').fill('0')
  await p.waitForTimeout(300)
  await p.locator('.cloud-play').click()
  await globe(p)
  await p.waitForTimeout(200)
  const t1 = await p.locator('.globe-label').innerText()
  const a = path.join(out, `${w}-2a-playing.png`)
  await plate(p).screenshot({ path: a })
  await p.waitForTimeout(3700)
  const t2 = await p.locator('.globe-label').innerText()
  const b = path.join(out, `${w}-2b-playing-later.png`)
  await plate(p).screenshot({ path: b })
  const share = await diff(a, b)
  notes.push(`${w}px playback: "${t1.replace(/\n/g, ' / ')}" then "${t2.replace(/\n/g, ' / ')}", ${(share * 100).toFixed(1)}% of plate pixels changed`)
  if (t1 === t2) problems.push(`${w}px: label did not change during playback`)
  if (share < 0.01) problems.push(`${w}px: cloud pattern barely changed (${(share * 100).toFixed(2)}%)`)
  await p.locator('.cloud-play').click()

  // 3. Dim clouds
  await p.locator('.cloud-settings .check').click()
  await globe(p)
  await p.waitForTimeout(900)
  await plate(p).screenshot({ path: path.join(out, `${w}-3-dim.png`) })

  // 4. Clouds off and on again
  await p.locator('.cloud-head .check').click()
  await p.locator('.globe-show').waitFor()
  await globe(p)
  await p.waitForTimeout(700)
  await plate(p).screenshot({ path: path.join(out, `${w}-4a-clouds-off.png`) })
  if (new URL(p.url()).searchParams.has('clouds')) problems.push(`${w}px: clouds param still in URL after turning off`)
  await p.locator('.globe-show button').click()
  await p.locator('.globe-label').waitFor({ timeout: 15000 })
  notes.push(`${w}px clouds off then on: label back as "${(await p.locator('.globe-label').innerText()).replace(/\n/g, ' / ')}"`)

  // 5. Local map from the list
  await p.locator('.rows button, .row').first().click()
  await p.locator('.emap-land').waitFor({ state: 'attached' })
  await p.waitForFunction(() => (document.querySelector('.emap-land')?.getAttribute('d') ?? '').length > 100, null, { timeout: 30000 })
  await p.locator('.emap').scrollIntoViewIfNeeded()
  await p.waitForTimeout(700)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-5-event-map.png`) })
  await p.screenshot({ path: path.join(out, `${w}-5b-panel.png`) })
  // zoom the local map and go back
  await p.getByRole('button', { name: 'Zoom in' }).last().click()
  await p.waitForTimeout(300)
  await p.locator('.emap').screenshot({ path: path.join(out, `${w}-5c-event-map-zoomed.png`) })
  await p.getByRole('button', { name: 'Back to globe' }).click()
  await p.waitForTimeout(1200)
  if (await p.locator('.drawer').count()) problems.push(`${w}px: drawer still open after Back to globe`)
  await overflow(p, `${w} after local map`)
  await ctx.close()

  // 6. Old links
  for (const q of ['view=map', 'view=globe&color=depth', 'view=list&event=nope']) {
    const o = await page(w)
    await o.p.goto(`${base}/explore?${q}`, { waitUntil: 'networkidle' })
    await globe(o.p)
    notes.push(`${w}px old link ?${q}: globe shown`)
    await o.ctx.close()
  }

  // 7. Loading state, offline state, error state
  {
    const o = await page(w, { expectErrors: true })
    await o.p.goto(`${base}/explore`, { waitUntil: 'networkidle' })
    await globe(o.p)
    await o.p.locator('.globe-show button').click()
    await o.p.locator('.cloud-msg[role="status"]').first().waitFor()
    await o.p.locator('.cloud-bar').screenshot({ path: path.join(out, `${w}-7a-loading.png`) })
    await o.ctx.close()
  }
  {
    const o = await page(w, { expectErrors: true })
    await o.p.goto(`${base}/explore`, { waitUntil: 'networkidle' })
    await globe(o.p)
    await o.ctx.setOffline(true)
    await o.p.locator('.globe-show button').click()
    await o.p.getByText('You are offline').waitFor()
    await o.p.locator('.cloud-bar').screenshot({ path: path.join(out, `${w}-7b-offline.png`) })
    await o.ctx.close()
  }
  {
    const o = await page(w, { expectErrors: true })
    await o.p.route(/gibs\.earthdata\.nasa\.gov|\/api\/clouds\//, (r) => r.abort())
    await o.p.goto(`${base}/explore?clouds=1`, { waitUntil: 'domcontentloaded' })
    await globe(o.p)
    await o.p.locator('.cloud-msg.is-error').waitFor({ timeout: 30000 })
    await o.p.locator('.cloud-bar').screenshot({ path: path.join(out, `${w}-7c-error.png`) })
    notes.push(`${w}px error state: "${(await o.p.locator('.cloud-msg.is-error').innerText()).replace(/\n/g, ' ')}"`)
    await o.ctx.close()
  }

  // 8. Key missing
  if (nokey) {
    const o = await page(w, { expectErrors: true })
    await o.p.goto(`${nokey}/explore?clouds=1`, { waitUntil: 'domcontentloaded' })
    await globe(o.p)
    await o.p.getByText('Cloud layer needs an API key, see README.').waitFor({ timeout: 60000 })
    await frames(o.p, 2).catch(() => undefined)
    await o.p.waitForTimeout(800)
    await o.p.locator('#globe').screenshot({ path: path.join(out, `${w}-8-key-missing.png`) })
    // the globe still works: drag it and open an event
    const box = await o.p.locator('.globe-plate').boundingBox()
    await o.p.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await o.p.mouse.down()
    await o.p.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2, { steps: 6 })
    await o.p.mouse.up()
    await o.p.locator('.rows button, .row').first().click()
    await o.p.locator('.emap').waitFor()
    notes.push(`${w}px key missing: message shown, globe drags, events open`)
    await o.ctx.close()
  }
}

await browser.close()
console.log(notes.join('\n'))
console.log(problems.length ? `\nPROBLEMS:\n${problems.join('\n')}` : '\nNo overflow, no unexpected console errors.')
process.exit(problems.length ? 1 : 0)
