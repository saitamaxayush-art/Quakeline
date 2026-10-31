/**
 * Cloud frame worker. Fetches satellite tiles, turns them into cloud cover, and reprojects each
 * frame to equirectangular for the globe texture. All of it runs here so the page keeps its
 * frame rate while frames load.
 */
import {
  EQ_H,
  EQ_W,
  GIBS_BASE,
  GIBS_LAYERS,
  GIBS_MATRIX,
  MERC,
  PAST_FRAMES,
  TILE_N,
  TILE_Z,
  type FrameErrorCode,
  type FrameMeta,
  type WorkerIn,
  type WorkerOut,
} from './config'
import { IR_COLORMAP } from './irColormap'

const ctx = self as unknown as {
  postMessage(message: WorkerOut, transfer?: Transferable[]): void
  onmessage: ((e: MessageEvent<WorkerIn>) => void) | null
}

const HOUR = 3600e3
const MAX_LAT = 85.0511

class FrameError extends Error {
  constructor(public code: FrameErrorCode) {
    super(code)
  }
}

/* ---------- Time domains (GIBS DescribeDomains) ---------- */

interface Span {
  start: number
  end: number
  step: number
}

function parseDuration(s: string) {
  const m = s.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/)
  if (!m) return 10 * 60e3
  return (Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60e3
}

async function domains(layer: string, from: number, to: number): Promise<Span[]> {
  const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const url = `${GIBS_BASE}/1.0.0/${layer}/default/${GIBS_MATRIX}/all/${iso(from)}--${iso(to)}.xml`
  const res = await fetch(url)
  if (!res.ok) throw new FrameError('gibs')
  const text = await res.text()
  const domain = text.match(/<Domain>([^<]*)<\/Domain>/)?.[1] ?? ''
  return domain
    .split(',')
    .map((part) => part.trim().split('/'))
    .filter((p) => p.length === 3)
    .map(([a, b, d]) => ({ start: Date.parse(a), end: Date.parse(b), step: parseDuration(d) }))
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
}

/** Closest listed time to t, within tol ms, or null. */
function nearest(spans: Span[], t: number, tol: number) {
  let best: number | null = null
  for (const s of spans) {
    const c = t <= s.start ? s.start : t >= s.end ? s.end : s.start + Math.round((t - s.start) / s.step) * s.step
    if (Math.abs(c - t) <= tol && (best === null || Math.abs(c - t) < Math.abs(best - t))) best = c
  }
  return best
}

interface GibsPlan {
  meta: FrameMeta
  /** Layer id to the exact time to request. */
  times: { layer: string; time: number }[]
}

async function planGibs(now: number): Promise<GibsPlan[]> {
  const from = now - 20 * HOUR
  const lists = await Promise.allSettled(GIBS_LAYERS.map((l) => domains(l.id, from, now)))
  const spans = lists.map((r) => (r.status === 'fulfilled' ? r.value : []))
  if (spans.every((s) => s.length === 0)) throw new FrameError('gibs')

  const plans: GibsPlan[] = []
  for (let h = Math.floor(now / HOUR) * HOUR; h > from && plans.length < PAST_FRAMES; h -= HOUR) {
    const times: { layer: string; time: number }[] = []
    const names: string[] = []
    GIBS_LAYERS.forEach((l, i) => {
      const t = nearest(spans[i], h, 10 * 60e3)
      if (t !== null) {
        times.push({ layer: l.id, time: t })
        names.push(l.name)
      }
    })
    // An hour is used only when at least two of the three satellites have an image for it.
    if (times.length >= 2) plans.push({ meta: { index: 0, kind: 'gibs', time: h, layers: names }, times })
  }
  return plans.reverse()
}

/* ---------- Tiles ---------- */

const tileCanvas = typeof OffscreenCanvas === 'undefined' ? null : new OffscreenCanvas(256, 256)
const tileCtx = tileCanvas?.getContext('2d', { willReadFrequently: true }) ?? null

async function decode(blob: Blob): Promise<Uint8ClampedArray> {
  if (!tileCtx) throw new FrameError('unsupported')
  const bmp = await createImageBitmap(blob)
  tileCtx.clearRect(0, 0, 256, 256)
  tileCtx.drawImage(bmp, 0, 0, 256, 256)
  bmp.close()
  return tileCtx.getImageData(0, 0, 256, 256).data
}

function networkCode(): FrameErrorCode {
  return navigator.onLine === false ? 'offline' : 'upstream'
}

/** A Mercator world as RGBA, assembled from TILE_N x TILE_N tiles. Missing tiles stay transparent. */
async function mosaic(urlFor: (x: number, y: number) => string, onTile?: (res: Response) => Promise<void>) {
  const out = new Uint8ClampedArray(MERC * MERC * 4)
  const jobs: Promise<void>[] = []
  for (let ty = 0; ty < TILE_N; ty++)
    for (let tx = 0; tx < TILE_N; tx++) {
      jobs.push(
        (async () => {
          let res: Response
          try {
            res = await fetch(urlFor(tx, ty))
          } catch {
            throw new FrameError(networkCode())
          }
          if (onTile) await onTile(res)
          if (!res.ok) return // GIBS answers 404 where a satellite has no image; treat as empty.
          const px = await decode(await res.blob())
          for (let row = 0; row < 256; row++) {
            const dst = ((ty * 256 + row) * MERC + tx * 256) * 4
            out.set(px.subarray(row * 1024, row * 1024 + 1024), dst)
          }
        })(),
      )
    }
  await Promise.all(jobs)
  return out
}

/* ---------- Cover ---------- */

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Infrared colour to cloud cover, for every colour quantised to 5 bits per channel. GIBS draws
 * brightness temperature with a fixed palette; the nearest palette entry gives the temperature.
 * Colder means higher, thicker cloud. The ramp, +20 °C clear to -20 °C full cover, was matched
 * against OpenWeatherMap's cover for the same tile and time.
 */
const IR_COVER = (() => {
  const lut = new Uint8Array(32768)
  const n = IR_COLORMAP.length / 4
  for (let q = 0; q < 32768; q++) {
    const r = ((q >> 10) & 31) * 8 + 4
    const g = ((q >> 5) & 31) * 8 + 4
    const b = (q & 31) * 8 + 4
    let best = Infinity
    let temp = 30
    for (let i = 0; i < n; i++) {
      const dr = IR_COLORMAP[i * 4] - r
      const dg = IR_COLORMAP[i * 4 + 1] - g
      const db = IR_COLORMAP[i * 4 + 2] - b
      const d = dr * dr + dg * dg + db * db
      if (d < best) {
        best = d
        temp = IR_COLORMAP[i * 4 + 3]
      }
    }
    lut[q] = Math.round(smoothstep(20, -20, temp) * 255)
  }
  return lut
})()

interface MercFrame {
  cover: Uint8Array
  /** 255 where some source has an image, 0 where none does. */
  data: Uint8Array
  /** Cosine of the viewing angle of the satellite that supplied each pixel. */
  view: Float32Array
}

function emptyMerc(): MercFrame {
  return { cover: new Uint8Array(MERC * MERC), data: new Uint8Array(MERC * MERC), view: new Float32Array(MERC * MERC).fill(-1) }
}

/** Beyond 72 degrees from the sub-satellite point the view is too oblique to use. */
const LIMB = Math.cos((72 * Math.PI) / 180)
const CLEAR_VIEW = Math.cos((58 * Math.PI) / 180)
const viewCache = new Map<number, Float32Array>()

/** Cosine of the great-circle distance from the sub-satellite point, for each Mercator pixel. */
function viewTable(subLon: number) {
  const hit = viewCache.get(subLon)
  if (hit) return hit
  const t = new Float32Array(MERC * MERC)
  for (let r = 0; r < MERC; r++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (r + 0.5)) / MERC)))
    const cl = Math.cos(lat)
    for (let c = 0; c < MERC; c++) {
      const lon = (((c + 0.5) / MERC) * 360 - 180 - subLon) * (Math.PI / 180)
      t[r * MERC + c] = cl * Math.cos(lon)
    }
  }
  viewCache.set(subLon, t)
  return t
}

/**
 * Adds one satellite. Each pixel comes from the satellite that sees it most directly. Near the
 * edge of a satellite's disc the infrared path runs through more cold atmosphere and reads as
 * cloud that is not there, so cover fades out between 58 and 72 degrees from the sub-point.
 */
function addInfrared(f: MercFrame, rgba: Uint8ClampedArray, subLon: number) {
  const view = viewTable(subLon)
  for (let i = 0, p = 0; i < f.cover.length; i++, p += 4) {
    const v = view[i]
    if (rgba[p + 3] < 128 || v < LIMB || v <= f.view[i]) continue
    const c = IR_COVER[((rgba[p] >> 3) << 10) | ((rgba[p + 1] >> 3) << 5) | (rgba[p + 2] >> 3)]
    f.cover[i] = Math.round(c * smoothstep(LIMB, CLEAR_VIEW, v))
    f.data[i] = 255
    f.view[i] = v
  }
}

/** OpenWeatherMap clouds_new: white with alpha, where alpha 127 is full cover. */
function addOwm(f: MercFrame, rgba: Uint8ClampedArray) {
  for (let i = 0, p = 3; i < f.cover.length; i++, p += 4) {
    f.cover[i] = Math.min(255, Math.round((rgba[p] * 255) / 127))
    f.data[i] = 255
  }
}

/* ---------- Reprojection ---------- */

/** Mercator row (float) for each equirectangular row, or -1 beyond the Mercator limit. */
const EQ_ROW = (() => {
  const rows = new Float32Array(EQ_H)
  for (let j = 0; j < EQ_H; j++) {
    const lat = 90 - ((j + 0.5) * 180) / EQ_H
    if (Math.abs(lat) > MAX_LAT) rows[j] = -1
    else {
      const phi = (lat * Math.PI) / 180
      rows[j] = ((1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2) * MERC - 0.5
    }
  }
  return rows
})()

function bilinear(src: Uint8Array, w: number, h: number, x: number, y: number) {
  const x0 = Math.floor(x)
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)))
  const y1 = Math.min(h - 1, y0 + 1)
  const fx = x - x0
  const fy = Math.max(0, Math.min(1, y - y0))
  const xa = ((x0 % w) + w) % w
  const xb = (xa + 1) % w
  const a = src[y0 * w + xa] + (src[y0 * w + xb] - src[y0 * w + xa]) * fx
  const b = src[y1 * w + xa] + (src[y1 * w + xb] - src[y1 * w + xa]) * fx
  return a + (b - a) * fy
}

/** North-up equirectangular frame (row 0 = 90°N, column 0 = 180°W). */
function toEquirect(f: MercFrame) {
  const cover = new Uint8Array(EQ_W * EQ_H)
  const data = new Uint8Array(EQ_W * EQ_H)
  let withData = 0
  let total = 0
  for (let j = 0; j < EQ_H; j++) {
    const my = EQ_ROW[j]
    if (my < 0) continue
    for (let i = 0; i < EQ_W; i++) {
      const mx = ((i + 0.5) / EQ_W) * MERC - 0.5
      const k = j * EQ_W + i
      cover[k] = bilinear(f.cover, MERC, MERC, mx, my)
      const d = bilinear(f.data, MERC, MERC, mx, my)
      data[k] = d
      total++
      if (d > 127) withData++
    }
  }
  return { cover, data, coverage: total ? withData / total : 0 }
}

/* ---------- Frame jobs ---------- */

async function owmFrame(): Promise<{ merc: MercFrame; fetchedAt: number | null }> {
  let fetchedAt: number | null = null
  let failure: FrameErrorCode | null = null
  const rgba = await mosaic(
    (x, y) => `/api/clouds/${TILE_Z}/${x}/${y}`,
    async (res) => {
      if (res.ok) {
        const h = res.headers.get('x-tile-fetched')
        const t = h ? Date.parse(h) : NaN
        if (Number.isFinite(t)) fetchedAt = fetchedAt === null ? t : Math.min(fetchedAt, t)
        return
      }
      let code: FrameErrorCode = 'upstream'
      try {
        const body = (await res.clone().json()) as { error?: string }
        if (body.error === 'missing_key' || body.error === 'invalid_key' || body.error === 'rate_limited' || body.error === 'forbidden_origin')
          code = body.error
      } catch {
        // Not JSON: the proxy is not running (for example a static server without /api).
      }
      failure = failure ?? code
    },
  )
  if (failure) throw new FrameError(failure)
  const merc = emptyMerc()
  addOwm(merc, rgba)
  return { merc, fetchedAt }
}

async function gibsFrame(plan: GibsPlan): Promise<MercFrame> {
  const iso = (t: number) => new Date(t).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const merc = emptyMerc()
  const results = await Promise.allSettled(
    plan.times.map(({ layer, time }) =>
      mosaic((x, y) => `${GIBS_BASE}/${layer}/default/${iso(time)}/${GIBS_MATRIX}/${TILE_Z}/${y}/${x}.png`),
    ),
  )
  let any = false
  results.forEach((r, i) => {
    const layer = GIBS_LAYERS.find((l) => l.id === plan.times[i].layer)
    if (r.status === 'fulfilled' && layer) {
      addInfrared(merc, r.value, layer.subLon)
      any = true
    }
  })
  if (!any) {
    const first = results[0]
    throw first.status === 'rejected' && first.reason instanceof FrameError ? first.reason : new FrameError('gibs')
  }
  return merc
}

function finish(index: number, merc: MercFrame, fetchedAt: number | null) {
  const eq = toEquirect(merc)
  ctx.postMessage({ type: 'frame', index, eq: eq.cover, coverage: eq.coverage, fetchedAt }, [eq.cover.buffer])
}

function fail(index: number, err: unknown) {
  const code = err instanceof FrameError ? err.code : navigator.onLine === false ? 'offline' : 'upstream'
  ctx.postMessage({ type: 'frameError', index, code })
}

async function start(now: number) {
  if (!tileCtx || typeof createImageBitmap === 'undefined') {
    ctx.postMessage({ type: 'plan', frames: [{ index: 0, kind: 'owm', time: null, layers: [] }], gibsOk: false })
    ctx.postMessage({ type: 'frameError', index: 0, code: 'unsupported' })
    return
  }

  // The current frame starts loading at once; the GIBS plan is worked out alongside it.
  const owmJob = owmFrame()
  owmJob.catch(() => undefined)

  let plans: GibsPlan[] = []
  let gibsOk = true
  try {
    plans = await planGibs(now)
    if (plans.length === 0) gibsOk = false
  } catch {
    gibsOk = false
  }
  const frames: FrameMeta[] = [...plans.map((p, i) => ({ ...p.meta, index: i })), { index: plans.length, kind: 'owm', time: null, layers: [] }]
  ctx.postMessage({ type: 'plan', frames, gibsOk })

  const nowIndex = plans.length
  try {
    const { merc, fetchedAt } = await owmJob
    finish(nowIndex, merc, fetchedAt)
  } catch (err) {
    fail(nowIndex, err)
  }

  // Newest first, so the frames next to "now" are ready before playback reaches them.
  for (let i = plans.length - 1; i >= 0; i -= 2) {
    const pair = [i, i - 1].filter((k) => k >= 0)
    await Promise.all(
      pair.map(async (k) => {
        try {
          finish(k, await gibsFrame(plans[k]), null)
        } catch (err) {
          fail(k, err)
        }
      }),
    )
  }
}

ctx.onmessage = (e) => {
  if (e.data.type === 'start') void start(e.data.now)
}
