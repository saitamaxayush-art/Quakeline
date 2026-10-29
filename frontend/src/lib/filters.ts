import type { ColorBy, DepthBand, Filters, Level, Period, Quake, SortKey, ViewMode } from './types'

export const DEFAULT_FILTERS: Filters = {
  period: 'day',
  level: 'all',
  q: '',
  minMag: -1,
  depth: 'any',
  tsunami: false,
  reviewed: false,
  type: 'any',
  sort: 'newest',
  view: 'list',
  color: 'mag',
}

export const PERIODS: { value: Period; label: string; short: string }[] = [
  { value: 'hour', label: 'Past hour', short: '1H' },
  { value: 'day', label: 'Past day', short: '24H' },
  { value: 'week', label: 'Past 7 days', short: '7D' },
  { value: 'month', label: 'Past 30 days', short: '30D' },
]

export const LEVELS: { value: Level; label: string }[] = [
  { value: 'all', label: 'All events' },
  { value: '1.0', label: 'M1.0 and up' },
  { value: '2.5', label: 'M2.5 and up' },
  { value: '4.5', label: 'M4.5 and up' },
  { value: 'significant', label: 'Significant only' },
]

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'strongest', label: 'Strongest first' },
  { value: 'weakest', label: 'Weakest first' },
  { value: 'deepest', label: 'Deepest first' },
  { value: 'shallowest', label: 'Shallowest first' },
  { value: 'felt', label: 'Most felt reports' },
]

export const DEPTHS: { value: DepthBand; label: string; hint: string }[] = [
  { value: 'any', label: 'Any depth', hint: '' },
  { value: 'shallow', label: 'Shallow', hint: '0 to 70 km' },
  { value: 'intermediate', label: 'Intermediate', hint: '70 to 300 km' },
  { value: 'deep', label: 'Deep', hint: 'over 300 km' },
]

/** The full "all events, past month" feed is roughly 10 MB, so we nudge it to M2.5+. */
export function safeLevel(level: Level, period: Period): Level {
  if (period === 'month' && (level === 'all' || level === '1.0')) return '2.5'
  return level
}

const oneOf = <T extends string>(v: string | null, list: readonly T[], fallback: T): T =>
  v && (list as readonly string[]).includes(v) ? (v as T) : fallback

export function parseFilters(sp: URLSearchParams): Filters {
  const d = DEFAULT_FILTERS
  const period = oneOf(sp.get('period'), ['hour', 'day', 'week', 'month'] as const, d.period)
  const level = safeLevel(oneOf(sp.get('level'), ['all', '1.0', '2.5', '4.5', 'significant'] as const, d.level), period)
  const minMag = Number(sp.get('min'))
  return {
    period,
    level,
    q: sp.get('q') ?? '',
    minMag: sp.has('min') && Number.isFinite(minMag) ? Math.min(9, Math.max(-1, minMag)) : d.minMag,
    depth: oneOf(sp.get('depth'), ['any', 'shallow', 'intermediate', 'deep'] as const, d.depth),
    tsunami: sp.get('tsunami') === '1',
    reviewed: sp.get('reviewed') === '1',
    type: sp.get('type') ?? d.type,
    sort: oneOf(sp.get('sort'), SORTS.map((s) => s.value), d.sort),
    view: oneOf<ViewMode>(sp.get('view'), ['list', 'map'], d.view),
    color: oneOf<ColorBy>(sp.get('color'), ['mag', 'depth'], d.color),
  }
}

export function serializeFilters(f: Filters): URLSearchParams {
  const sp = new URLSearchParams()
  const d = DEFAULT_FILTERS
  if (f.period !== d.period) sp.set('period', f.period)
  if (f.level !== d.level) sp.set('level', f.level)
  if (f.q.trim()) sp.set('q', f.q.trim())
  if (f.minMag !== d.minMag) sp.set('min', String(f.minMag))
  if (f.depth !== d.depth) sp.set('depth', f.depth)
  if (f.tsunami) sp.set('tsunami', '1')
  if (f.reviewed) sp.set('reviewed', '1')
  if (f.type !== d.type) sp.set('type', f.type)
  if (f.sort !== d.sort) sp.set('sort', f.sort)
  if (f.view !== d.view) sp.set('view', f.view)
  if (f.color !== d.color) sp.set('color', f.color)
  return sp
}

export function countActive(f: Filters) {
  let n = 0
  if (f.q.trim()) n++
  if (f.minMag > -1) n++
  if (f.depth !== 'any') n++
  if (f.tsunami) n++
  if (f.reviewed) n++
  if (f.type !== 'any') n++
  return n
}

function matchesDepth(d: number, band: DepthBand) {
  if (band === 'shallow') return d < 70
  if (band === 'intermediate') return d >= 70 && d < 300
  if (band === 'deep') return d >= 300
  return true
}

const sorters: Record<SortKey, (a: Quake, b: Quake) => number> = {
  newest: (a, b) => b.time - a.time,
  oldest: (a, b) => a.time - b.time,
  strongest: (a, b) => (b.mag ?? -9) - (a.mag ?? -9),
  weakest: (a, b) => (a.mag ?? 99) - (b.mag ?? 99),
  deepest: (a, b) => b.depth - a.depth,
  shallowest: (a, b) => a.depth - b.depth,
  felt: (a, b) => (b.felt ?? 0) - (a.felt ?? 0) || b.time - a.time,
}

export function applyFilters(quakes: Quake[], f: Filters): Quake[] {
  const terms = f.q.toLowerCase().split(/\s+/).filter(Boolean)
  const out = quakes.filter((q) => {
    if (f.minMag > -1 && (q.mag === null || q.mag < f.minMag)) return false
    if (!matchesDepth(q.depth, f.depth)) return false
    if (f.tsunami && !q.tsunami) return false
    if (f.reviewed && q.status !== 'reviewed') return false
    if (f.type !== 'any' && q.type !== f.type) return false
    if (terms.length) {
      const hay = `${q.place} ${q.region} ${q.net} ${q.id}`.toLowerCase()
      if (!terms.every((t) => hay.includes(t))) return false
    }
    return true
  })
  return out.sort(sorters[f.sort])
}
