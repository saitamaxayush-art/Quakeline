import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { geoArea, geoAzimuthalEquidistant, geoBounds, geoCircle, geoContains, geoGraticule, geoPath, type GeoProjection } from 'd3-geo'
import { feature, mesh } from 'topojson-client'
import type { GeometryCollection, Topology } from 'topojson-specification'
import type { Feature, FeatureCollection, MultiLineString, Position } from 'geojson'
import { Globe as GlobeIcon, Minus, Plus, RotateCcw } from 'lucide-react'
import type { Quake } from '../lib/types'
import { depthLabel, distanceKm, km, mag } from '../lib/format'
import { magClass } from '../lib/scales'
import { prefersReducedMotion } from '../lib/motion'
import { Button, Segmented } from './ui'
import ScaleLegend from './ScaleLegend'
// Plain JSON files served from the build (not JS chunks): fetched only when the panel needs them.
import outlines50Url from 'world-atlas/countries-50m.json?url'
import outlines10Url from 'world-atlas/countries-10m.json?url'

/**
 * Where the event happened: a flat map centred on the epicentre, drawn with d3-geo from the
 * Natural Earth 1:50m country outlines in the world-atlas package that ships with the site. The
 * outline file is a separate chunk, loaded the first time an event panel opens. No tile service
 * or other third party is contacted.
 *
 * The projection is azimuthal equidistant around the epicentre, so every distance measured from
 * the epicentre (the rings, the scale bar, "within 250 km") reads true.
 */

const EARTH_KM = 6371
const RINGS = [50, 100, 250]
const PRESETS = [50, 100, 250, 500] as const
const DEFAULT_KM = 250
/** Default radius widens through these steps until land is in view. */
const AUTO_STEPS = [250, 500, 750, 1000]
const MIN_K = 1
const MAX_K = 8
/** Frame bands that carry the graticule labels. */
const BAND_L = 52
const BAND_B = 20

type Preset = (typeof PRESETS)[number]
type RadiusChoice = 'auto' | `${Preset}`

interface Country {
  name: string
  feature: Feature
  bounds: [[number, number], [number, number]]
}

interface Outlines {
  land: FeatureCollection
  borders: MultiLineString
  coast: MultiLineString
  countries: Country[]
}

/**
 * d3 reads polygons on the sphere by winding order: a ring wound the wrong way means "everything
 * except this shape" and floods the map. A few small islands in the source files are wound that
 * way, so any polygon part larger than a hemisphere is reversed.
 */
function rewind(f: Feature): Feature {
  const g = f.geometry
  const fix = (poly: Position[][]) =>
    geoArea({ type: 'Polygon', coordinates: poly }) > 2 * Math.PI ? poly.map((r) => [...r].reverse()) : poly
  if (g.type === 'Polygon') return { ...f, geometry: { ...g, coordinates: fix(g.coordinates) } }
  if (g.type === 'MultiPolygon') return { ...f, geometry: { ...g, coordinates: g.coordinates.map(fix) } }
  return f
}

type Detail = '50m' | '10m'
const outlines: Partial<Record<Detail, Promise<Outlines>>> = {}

/** Natural Earth 1:50m by default; 1:10m (about 960 kB compressed) only for close views. */
function loadOutlines(detail: Detail) {
  outlines[detail] ??= fetch(detail === '10m' ? outlines10Url : outlines50Url)
    .then((r) => {
      if (!r.ok) throw new Error(`outline file ${r.status}`)
      return r.json() as Promise<Topology<{ countries: GeometryCollection<{ name: string }> }>>
    })
    .then((topo) => {
      const obj = topo.objects.countries
      const raw = feature(topo, obj) as FeatureCollection
      const land: FeatureCollection = { type: 'FeatureCollection', features: raw.features.map(rewind) }
      return {
        land,
        borders: mesh(topo, obj, (a, b) => a !== b),
        coast: mesh(topo, obj, (a, b) => a === b),
        countries: land.features.map((f) => ({
          name: String((f.properties as { name?: string } | null)?.name ?? ''),
          feature: f,
          bounds: geoBounds(f),
        })),
      }
    })
    .catch((err: unknown) => {
      // Let the next panel try again instead of keeping a failed download.
      delete outlines[detail]
      throw err
    })
  return outlines[detail]
}

/** Only the outlines near the event, so even the 1:10m file projects quickly. */
function nearby(data: Outlines, lat: number, lon: number, km: number) {
  const dLat = Math.min(90, km / 111)
  const dLon = Math.min(180, dLat / Math.max(0.05, Math.cos((lat * Math.PI) / 180)))
  const lonIn = (x: number) => dLon >= 180 || Math.abs(((x - lon + 540) % 360) - 180) <= dLon
  const latIn = (y: number) => Math.abs(y - lat) <= dLat
  const boxHit = ([[w, s], [e, n]]: [[number, number], [number, number]]) => {
    if (n < lat - dLat || s > lat + dLat) return false
    if (dLon >= 180) return true
    const span = w <= e ? e - w : e + 360 - w
    return lonIn(w) || lonIn(e) || span >= 360 - 1e-6 || lonIn((w + span / 2 + 540) % 360 - 180) || span > dLon * 2
  }
  const lines = (m: MultiLineString): MultiLineString => ({
    type: 'MultiLineString',
    coordinates: m.coordinates.filter((line) => line.some((p) => latIn(p[1]) && lonIn(p[0]))),
  })
  return {
    land: { type: 'FeatureCollection', features: data.countries.filter((c) => boxHit(c.bounds)).map((c) => c.feature) } as FeatureCollection,
    borders: lines(data.borders),
    coast: lines(data.coast),
    countries: data.countries.filter((c) => boxHit(c.bounds)),
  }
}

interface NearestLand {
  /** The country the epicentre lies in, if any. */
  inside: string | null
  /** Closest country outline and the distance to it, when the epicentre is at sea. */
  name: string
  km: number
}

/** Which country contains the point, or which coastline is nearest and how far. */
function nearestLand(data: Outlines, lat: number, lon: number): NearestLand {
  const pt: [number, number] = [lon, lat]
  for (const c of data.countries) {
    const [[w, s], [e, n]] = c.bounds
    const inLon = w <= e ? lon >= w && lon <= e : lon >= w || lon <= e
    if (lat >= s && lat <= n && inLon && geoContains(c.feature, pt)) return { inside: c.name, name: c.name, km: 0 }
  }
  let best = { name: '', km: Infinity }
  const visit = (ring: Position[], name: string) => {
    for (const p of ring) {
      // Cheap reject before the great-circle formula.
      if (Math.abs(p[1] - lat) * 111 > best.km) continue
      const d = distanceKm(lat, lon, p[1], p[0])
      if (d < best.km) best = { name, km: d }
    }
  }
  for (const c of data.countries) {
    const g = c.feature.geometry
    if (g.type === 'Polygon') g.coordinates.forEach((r) => visit(r, c.name))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((poly) => poly.forEach((r) => visit(r, c.name)))
  }
  return { inside: null, ...best }
}

interface View {
  k: number
  x: number
  y: number
}
const HOME: View = { k: 1, x: 0, y: 0 }

const degLabel = (v: number, pos: string, neg: string) => {
  const a = Math.abs(v)
  // Up to two decimals, so a 0.25 degree line is labelled 14.25, never rounded to 14.3.
  const t = String(Math.round(a * 100) / 100)
  return `${t}°${v === 0 ? '' : v > 0 ? pos : neg}`
}

function gratStep(radiusKm: number) {
  if (radiusKm <= 60) return 0.25
  if (radiusKm <= 120) return 0.5
  if (radiusKm <= 300) return 1
  if (radiusKm <= 600) return 2
  return 5
}

export default function EventMap({
  quake,
  all,
  onSelect,
  onBack,
}: {
  quake: Quake
  all: Quake[]
  onSelect: (q: Quake) => void
  onBack: () => void
}) {
  const [data, setData] = useState<Outlines | null>(null)
  const [fine, setFine] = useState<Outlines | null>(null)
  const [failed, setFailed] = useState(false)
  const [choice, setChoice] = useState<RadiusChoice>('auto')
  const [view, setView] = useState<View>(HOME)
  const [hover, setHover] = useState<string | null>(null)
  const [size, setSize] = useState({ w: 520, h: 380 })
  const frameRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const flyRef = useRef<SVGGElement>(null)

  useEffect(() => {
    let live = true
    loadOutlines('50m')
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [])

  // Draw in real pixels, so text and strokes keep their size on a phone.
  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return
    const measure = () => {
      const w = Math.max(280, Math.round(el.clientWidth))
      setSize({ w, h: Math.round(Math.min(460, Math.max(280, w * (w < 480 ? 0.95 : 0.72)))) })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { w: W, h: H } = size

  const land = useMemo(() => (data ? nearestLand(data, quake.lat, quake.lon) : null), [data, quake.lat, quake.lon])

  // Default radius: 250 km, widened over open ocean until the nearest land is in view.
  const autoKm = useMemo(() => {
    if (!land || land.inside) return DEFAULT_KM
    return AUTO_STEPS.find((r) => land.km * 1.12 <= r) ?? AUTO_STEPS[AUTO_STEPS.length - 1]
  }, [land])
  const radiusKm = choice === 'auto' ? autoKm : Number(choice)
  const widened = choice === 'auto' && autoKm > DEFAULT_KM

  const mapW = W - BAND_L
  const mapH = H - BAND_B
  const cx = BAND_L + mapW / 2
  const cy = mapH / 2
  const baseScale = (Math.min(mapW, mapH) * 0.44) / (radiusKm / EARTH_KM)

  // Close views switch to the 1:10m outlines once they have loaded; 1:50m shows meanwhile.
  const wantFine = radiusKm <= 100 || view.k >= 2.5
  useEffect(() => {
    if (!wantFine || fine) return
    let live = true
    loadOutlines('10m')
      .then((d) => live && setFine(d))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [wantFine, fine])
  const shown = (wantFine && fine) || data

  const proj: GeoProjection = useMemo(() => {
    const cornerKm = (Math.hypot(mapW, mapH) / 2 / baseScale) * EARTH_KM
    return geoAzimuthalEquidistant()
      .rotate([-quake.lon, -quake.lat])
      .translate([cx, cy])
      .scale(baseScale)
      // Project only what can be seen, with room to pan.
      .clipAngle(Math.min(170, ((cornerKm * 2.2) / EARTH_KM) * (180 / Math.PI)))
  }, [quake.lat, quake.lon, cx, cy, baseScale, mapW, mapH])

  const local = useMemo(() => {
    if (!shown) return null
    const cornerKm = (Math.hypot(mapW, mapH) / 2 / baseScale) * EARTH_KM
    return nearby(shown, quake.lat, quake.lon, cornerKm * 2.2)
  }, [shown, quake.lat, quake.lon, mapW, mapH, baseScale])

  const paths = useMemo(() => {
    const path = geoPath(proj)
    const step = gratStep(radiusKm)
    const labels = local
      ? local.countries
          .map((c) => ({ name: c.name, area: path.area(c.feature), at: path.centroid(c.feature) }))
          .filter((c) => c.area > 2500 && Number.isFinite(c.at[0]))
          .sort((a, b) => b.area - a.area)
          .slice(0, 6)
      : []
    return {
      step,
      grat: path(geoGraticule().step([step, step]).extent([[-180, -85], [180, 85]])()) ?? '',
      rings: RINGS.map((r) => ({
        r,
        d: path(geoCircle().center([quake.lon, quake.lat]).radius((r / EARTH_KM) * (180 / Math.PI))()) ?? '',
        top: proj([quake.lon, quake.lat + (r / EARTH_KM) * (180 / Math.PI)]),
      })),
      land: local ? (path(local.land) ?? '') : '',
      borders: local ? (path(local.borders) ?? '') : '',
      coast: local ? (path(local.coast) ?? '') : '',
      labels,
    }
  }, [proj, local, quake.lat, quake.lon, radiusKm])

  const near = useMemo(
    () =>
      all
        .filter((q) => q.id !== quake.id)
        .map((q) => ({ q, d: distanceKm(quake.lat, quake.lon, q.lat, q.lon) }))
        .filter((x) => x.d <= radiusKm)
        // Weak first, so strong events draw on top.
        .sort((a, b) => (a.q.mag ?? -9) - (b.q.mag ?? -9))
        .map((x) => ({ ...x, p: proj([x.q.lon, x.q.lat]) }))
        .filter((x): x is typeof x & { p: [number, number] } => !!x.p),
    [all, quake, proj, radiusKm],
  )

  // Screen position of a projected point under the current zoom and pan.
  const at = (p: [number, number]): [number, number] => [p[0] * view.k + view.x, p[1] * view.k + view.y]
  const epi = at([cx, cy])

  // Graticule labels where each line meets the left and bottom bands.
  const ticks = useMemo(() => {
    const out: { kind: 'lat' | 'lon'; v: number; pos: number }[] = []
    const step = paths.step
    const screen = (lon: number, lat: number) => {
      const p = proj([lon, lat])
      return p ? ([p[0] * view.k + view.x, p[1] * view.k + view.y] as const) : null
    }
    const spanDeg = ((radiusKm * 2.6) / EARTH_KM) * (180 / Math.PI) / view.k + step * 2
    const latSpan = Math.min(80, spanDeg)
    const lonSpan = Math.min(179, spanDeg / Math.max(0.15, Math.cos((quake.lat * Math.PI) / 180)))
    const seen = new Set<string>()
    const add = (kind: 'lat' | 'lon', v: number, pos: number, min: number, max: number) => {
      if (pos < min || pos > max) return
      const key = `${kind}${v}`
      if (seen.has(key)) return
      if (out.some((t) => t.kind === kind && Math.abs(t.pos - pos) < (kind === 'lon' ? 46 : 20))) return
      seen.add(key)
      out.push({ kind, v, pos })
    }
    // Meridians: crossing of the bottom edge of the map area.
    for (let lon = Math.ceil((quake.lon - lonSpan) / step) * step; lon <= quake.lon + lonSpan; lon += step) {
      const L = Math.round(((lon + 540) % 360) * 1000) / 1000 - 180
      let prev: readonly [number, number] | null = null
      for (let i = 0; i <= 80; i++) {
        const lat = Math.max(-85, Math.min(85, quake.lat - latSpan + (i / 80) * latSpan * 2))
        const s = screen(L, lat)
        if (s && prev && (prev[1] - mapH) * (s[1] - mapH) <= 0 && prev[1] !== s[1]) {
          const t = (mapH - prev[1]) / (s[1] - prev[1])
          add('lon', L, prev[0] + (s[0] - prev[0]) * t, BAND_L + 18, W - 18)
          break
        }
        prev = s
      }
    }
    // Parallels: crossing of the left edge of the map area.
    for (let lat = Math.ceil((quake.lat - latSpan) / step) * step; lat <= quake.lat + latSpan; lat += step) {
      if (Math.abs(lat) > 85) continue
      let prev: readonly [number, number] | null = null
      for (let i = 0; i <= 80; i++) {
        const lon = quake.lon - lonSpan + (i / 80) * lonSpan * 2
        const s = screen(lon, lat)
        if (s && prev && (prev[0] - BAND_L) * (s[0] - BAND_L) <= 0 && prev[0] !== s[0]) {
          const t = (BAND_L - prev[0]) / (s[0] - prev[0])
          add('lat', Math.round(lat * 1000) / 1000, prev[1] + (s[1] - prev[1]) * t, 10, mapH - 8)
          break
        }
        prev = s
      }
    }
    return out
  }, [proj, view, paths.step, radiusKm, quake.lat, quake.lon, mapH, W])

  // Scale bar: a round distance close to a quarter of the map width.
  const pxPerKm = (baseScale / EARTH_KM) * view.k
  const scaleKm = [5, 10, 20, 25, 50, 100, 200, 250, 500].reduce((b, v) => (Math.abs(v * pxPerKm - mapW * 0.22) < Math.abs(b * pxPerKm - mapW * 0.22) ? v : b), 50)

  // Fly in from the previous view: start where the last epicentre or radius was, glide to the new
  // one. Only transform and opacity animate.
  const prev = useRef<{ lat: number; lon: number; radius: number; id: string } | null>(null)
  useLayoutEffect(() => {
    const g = flyRef.current
    const last = prev.current
    prev.current = { lat: quake.lat, lon: quake.lon, radius: radiusKm, id: quake.id }
    setView(HOME)
    if (!g || !last || prefersReducedMotion() || typeof g.animate !== 'function') return
    let from: Keyframe
    if (last.id !== quake.id) {
      const p = proj([last.lon, last.lat])
      let dx = p ? cx - p[0] : 0
      let dy = p ? cy - p[1] : 0
      const len = Math.hypot(dx, dy)
      const max = Math.max(W, H) * 0.9
      if (len > max) {
        dx = (dx / len) * max
        dy = (dy / len) * max
      }
      from = { transform: `translate(${dx}px, ${dy}px)`, opacity: 0.35 }
    } else if (last.radius !== radiusKm) {
      from = { transform: `scale(${radiusKm / last.radius})`, opacity: 0.6 }
    } else return
    g.animate([from, { transform: 'translate(0px, 0px) scale(1)', opacity: 1 }], { duration: 650, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quake.id, radiusKm])

  const clampView = (v: View): View => {
    const slack = 0.5
    return {
      k: v.k,
      x: Math.min(W * slack, Math.max(W - W * v.k - W * slack, v.x)),
      y: Math.min(H * slack, Math.max(H - H * v.k - H * slack, v.y)),
    }
  }
  const clampRef = useRef(clampView)
  clampRef.current = clampView

  const zoomAt = (factor: number, px = cx, py = cy) =>
    setView((v) => {
      const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor))
      const f = k / v.k
      return clampRef.current({ k, x: px - (px - v.x) * f, y: py - (py - v.y) * f })
    })
  const zoomRef = useRef(zoomAt)
  zoomRef.current = zoomAt

  // Drag to pan, two fingers to pinch, wheel to zoom about the pointer.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const pts = new Map<number, { x: number; y: number }>()
    let pinch = 0
    const toView = (e: { clientX: number; clientY: number }) => {
      const r = svg.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      if ((e.target as Element).closest('[data-marker]')) return
      svg.setPointerCapture(e.pointerId)
      pts.set(e.pointerId, toView(e))
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        pinch = Math.hypot(a.x - b.x, a.y - b.y)
      }
    }
    const move = (e: PointerEvent) => {
      const last = pts.get(e.pointerId)
      if (!last) return
      const p = toView(e)
      pts.set(e.pointerId, p)
      if (pts.size === 2) {
        const [a, b] = [...pts.values()]
        const d = Math.hypot(a.x - b.x, a.y - b.y)
        if (pinch > 0) zoomRef.current(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2)
        pinch = d
        return
      }
      setView((v) => clampRef.current({ ...v, x: v.x + p.x - last.x, y: v.y + p.y - last.y }))
    }
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId)
      if (pts.size < 2) pinch = 0
    }
    const wheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toView(e)
      zoomRef.current(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.002)), p.x, p.y)
    }
    svg.addEventListener('pointerdown', down)
    svg.addEventListener('pointermove', move)
    svg.addEventListener('pointerup', up)
    svg.addEventListener('pointercancel', up)
    svg.addEventListener('wheel', wheel, { passive: false })
    return () => {
      svg.removeEventListener('pointerdown', down)
      svg.removeEventListener('pointermove', move)
      svg.removeEventListener('pointerup', up)
      svg.removeEventListener('pointercancel', up)
      svg.removeEventListener('wheel', wheel)
    }
  }, [])

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    const step = 48
    const pan = (dx: number, dy: number) => setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }))
    const keys: Record<string, () => void> = {
      '+': () => zoomAt(1.4),
      '=': () => zoomAt(1.4),
      '-': () => zoomAt(1 / 1.4),
      '0': () => setView(HOME),
      ArrowLeft: () => pan(step, 0),
      ArrowRight: () => pan(-step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
    }
    if (keys[e.key]) {
      e.preventDefault()
      keys[e.key]()
    }
  }

  const tip = hover ? near.find((x) => x.q.id === hover) : undefined
  const lat = `${Math.abs(quake.lat).toFixed(3)} ${quake.lat >= 0 ? 'N' : 'S'}`
  const lon = `${Math.abs(quake.lon).toFixed(3)} ${quake.lon >= 0 ? 'E' : 'W'}`
  const landText = !land
    ? failed
      ? 'not known (the outline file did not load)'
      : 'working it out'
    : land.inside
      ? `on land, in ${land.inside}`
      : `${land.name}, about ${Math.round(land.km).toLocaleString('en')} km away`
  const epiLabel = `M${mag(quake.mag)}, ${km(quake.depth)} deep`
  // The event label goes right of the marker, or left, or below it: wherever it fits clear of the
  // zoom buttons (right edge) and the latitude band (left edge).
  const labelW = epiLabel.length * 7.9
  const toolsEdge = W - 54
  const epiR = 8 + Math.max(quake.mag ?? 0, 0) * 1.1
  const labelPos: { x: number; y: number; anchor: 'start' | 'end' | 'middle' } =
    epi[0] + 18 + labelW <= toolsEdge
      ? { x: 18, y: -14, anchor: 'start' }
      : epi[0] - 18 - labelW >= BAND_L + 4
        ? { x: -18, y: -14, anchor: 'end' }
        : { x: 0, y: epiR + 18, anchor: 'middle' }

  return (
    <section className="emap" aria-labelledby="emap-title">
      <div className="emap-head">
        <div>
          <h3 id="emap-title" className="emap-title">
            Where it happened
          </h3>
          <p className="emap-sub">
            {radiusKm.toLocaleString('en')} km around the epicentre.{' '}
            {near.length === 0 ? 'No other events from this feed in that range.' : `${near.length} other ${near.length === 1 ? 'event' : 'events'} from this feed in that range.`}
          </p>
        </div>
        <Button variant="solid" size="sm" icon={<GlobeIcon size={15} />} onClick={onBack}>
          Back to globe
        </Button>
      </div>

      <div className="emap-bar">
        <Segmented<RadiusChoice>
          id="emap-r"
          label="Map radius"
          value={(PRESETS as readonly number[]).includes(radiusKm) ? (`${radiusKm}` as RadiusChoice) : choice}
          onChange={setChoice}
          options={PRESETS.map((r) => ({ value: `${r}` as RadiusChoice, label: `${r} km` }))}
        />
        {widened && land && (
          <p className="emap-note" role="status">
            {land.km * 1.12 <= autoKm
              ? `Zoomed out to ${autoKm.toLocaleString('en')} km to show nearby land.`
              : `Zoomed out to ${autoKm.toLocaleString('en')} km, the widest view. The nearest land, ${land.name}, is about ${Math.round(land.km).toLocaleString('en')} km away, near the edge of the map.`}
          </p>
        )}
      </div>

      <div className="emap-frame" ref={frameRef} style={{ height: H }}>
        <svg
          ref={svgRef}
          className="emap-svg"
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          role="application"
          aria-roledescription="zoomable map"
          aria-label={`Map of the ${radiusKm} km around the epicentre of ${quake.place}. Arrow keys move it, plus and minus zoom, 0 resets. A text summary follows the map.`}
          tabIndex={0}
          onKeyDown={onKey}
        >
          <defs>
            <clipPath id="emap-clip">
              <rect x={BAND_L} y={0} width={mapW} height={mapH} />
            </clipPath>
          </defs>
          <rect className="emap-sea" x={BAND_L} y={0} width={mapW} height={mapH} />
          <g clipPath="url(#emap-clip)">
            <g ref={flyRef} className="emap-fly" style={{ transformOrigin: `${cx}px ${cy}px` }}>
              <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
                <path className="emap-grat" d={paths.grat} />
                <path className="emap-land" d={paths.land} />
                <path className="emap-border" d={paths.borders} />
                <path className="emap-coast" d={paths.coast} />
                {paths.rings.map((r) => (r.r * pxPerKm < 6 ? null : <path key={r.r} className="emap-ring" d={r.d} />))}
              </g>
              {paths.labels.map((c) => {
                const [x, y] = at(c.at)
                return (
                  <text key={c.name} className="emap-country" x={x} y={y} textAnchor="middle">
                    {c.name}
                  </text>
                )
              })}
              {paths.rings.map((r) => {
                // Labels only on rings big enough to keep them clear of the event marker.
                if (!r.top || r.r * pxPerKm < 40) return null
                const [x, y] = at(r.top)
                return (
                  <text key={r.r} className="emap-ring-label" x={x} y={y - 4} textAnchor="middle">
                    {r.r} km
                  </text>
                )
              })}
              {near.map(({ q, p, d }) => {
                const [x, y] = at(p)
                // Only markers inside the visible map are drawn, so none can be focused while hidden.
                if (x < BAND_L - 4 || x > W + 4 || y < -4 || y > mapH + 4) return null
                return (
                  <g
                    key={q.id}
                    data-marker
                    className="emap-near"
                    transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
                    role="button"
                    tabIndex={0}
                    aria-label={`M${mag(q.mag)}, ${q.place}, ${Math.round(d)} km away. Open this event.`}
                    onClick={() => onSelect(q)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelect(q)
                      }
                    }}
                    onPointerEnter={() => setHover(q.id)}
                    onPointerLeave={() => setHover((h) => (h === q.id ? null : h))}
                    onFocus={() => setHover(q.id)}
                    onBlur={() => setHover((h) => (h === q.id ? null : h))}
                  >
                    <circle className="emap-hit" r={12} />
                    <circle className={`emap-dot ${magClass(q.mag)}`} r={3.5 + Math.max(q.mag ?? 0, 0) * 1.4} />
                  </g>
                )
              })}
              <g className="emap-epi" transform={`translate(${epi[0]} ${epi[1]})`} aria-hidden="true">
                <circle className="emap-epi-pulse" r={14} />
                <circle className={`emap-epi-dot ${magClass(quake.mag)}`} r={8 + Math.max(quake.mag ?? 0, 0) * 1.1} />
                <text className="emap-epi-label" x={labelPos.x} y={labelPos.y} textAnchor={labelPos.anchor}>
                  {epiLabel}
                </text>
              </g>
            </g>
          </g>
          {/* Frame bands with the graticule labels: solid paper, so the text never sits on the map. */}
          <rect className="emap-band" x={0} y={0} width={BAND_L} height={H} />
          <rect className="emap-band" x={0} y={mapH} width={W} height={BAND_B} />
          <rect className="emap-edge" x={BAND_L} y={0} width={mapW} height={mapH} />
          {ticks.map((t) =>
            t.kind === 'lon' ? (
              <g key={`lon${t.v}`} className="emap-tick">
                <line x1={t.pos} x2={t.pos} y1={mapH} y2={mapH + 4} />
                <text x={t.pos} y={H - 5} textAnchor="middle">
                  {degLabel(t.v, 'E', 'W')}
                </text>
              </g>
            ) : (
              <g key={`lat${t.v}`} className="emap-tick">
                <line x1={BAND_L - 4} x2={BAND_L} y1={t.pos} y2={t.pos} />
                <text x={BAND_L - 6} y={t.pos + 3.5} textAnchor="end">
                  {degLabel(t.v, 'N', 'S')}
                </text>
              </g>
            ),
          )}
          <g className="emap-scale" transform={`translate(${BAND_L + 12} ${mapH - 14})`} aria-hidden="true">
            <rect x={-6} y={-20} width={pxPerKm * scaleKm + 12} height={28} />
            <line x1={0} x2={pxPerKm * scaleKm} y1={0} y2={0} />
            <line x1={0} x2={0} y1={-4} y2={4} />
            <line x1={pxPerKm * scaleKm} x2={pxPerKm * scaleKm} y1={-4} y2={4} />
            <text x={0} y={-7}>
              {scaleKm} km
            </text>
          </g>
        </svg>

        {!data && (
          <p className="emap-wait mono" role="status">
            {failed ? 'The coastline file did not load. Distances and events are still shown.' : 'Loading coastlines'}
          </p>
        )}
        {tip && (
          <div className="viz-tip emap-tip" style={{ left: at(tip.p)[0], top: at(tip.p)[1] }} role="tooltip">
            <strong>M{mag(tip.q.mag)}</strong>
            <span>{tip.q.place}</span>
            <small>
              {Math.round(tip.d)} km from the epicentre · {km(tip.q.depth)} deep
            </small>
          </div>
        )}
        <div className="emap-tools">
          <Button variant="outline" size="sm" aria-label="Zoom in" icon={<Plus size={15} />} onClick={() => zoomAt(1.4)} />
          <Button variant="outline" size="sm" aria-label="Zoom out" icon={<Minus size={15} />} onClick={() => zoomAt(1 / 1.4)} />
          <Button variant="outline" size="sm" aria-label="Reset map" icon={<RotateCcw size={14} />} onClick={() => setView(HOME)} />
        </div>
      </div>

      <p className="emap-summary">
        Epicentre at {lat}, {lon}, {km(quake.depth)} deep ({depthLabel(quake.depth).toLowerCase()}). Nearest land: {landText}.
      </p>
      <div className="emap-key">
        <ScaleLegend scale="mag" compact />
        <span>
          Large marker: this event. Faint dashed rings: 50, 100 and 250 km. Map: Natural Earth {wantFine && fine ? '1:10m' : '1:50m'}.
        </span>
      </div>
    </section>
  )
}
