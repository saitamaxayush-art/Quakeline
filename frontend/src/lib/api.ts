import type { Level, Period, Quake, QuakeCollection, QuakeFeature } from './types'

const FEED_BASE = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary'

export class FeedError extends Error {
  kind: 'offline' | 'timeout' | 'http' | 'parse' | 'unknown'
  status?: number
  constructor(kind: FeedError['kind'], message: string, status?: number) {
    super(message)
    this.kind = kind
    this.status = status
  }
}

export function feedUrl(level: Level, period: Period) {
  return `${FEED_BASE}/${level}_${period}.geojson`
}

/** Splits "12 km SSW of Anza, CA" into a place and a region ("CA"). */
function splitPlace(place: string | null): { place: string; region: string } {
  if (!place) return { place: 'Unnamed location', region: 'Unknown' }
  const comma = place.lastIndexOf(',')
  if (comma === -1) return { place, region: place.replace(/^.* of /, '') }
  return { place, region: place.slice(comma + 1).trim() }
}

function toQuake(f: QuakeFeature): Quake {
  const p = f.properties
  const [lon, lat, depth] = f.geometry?.coordinates ?? [0, 0, 0]
  const { place, region } = splitPlace(p.place)
  return {
    id: f.id,
    mag: p.mag,
    magType: p.magType,
    place,
    region,
    time: p.time,
    updated: p.updated,
    lon,
    lat,
    depth: depth ?? 0,
    felt: p.felt,
    mmi: p.mmi,
    cdi: p.cdi,
    alert: p.alert,
    tsunami: p.tsunami === 1,
    sig: p.sig ?? 0,
    status: p.status,
    type: p.type,
    net: p.net,
    url: p.url,
    nst: p.nst,
    gap: p.gap,
    rms: p.rms,
  }
}

export interface FeedResult {
  quakes: Quake[]
  generated: number
  title: string
}

export async function fetchFeed(level: Level, period: Period, signal?: AbortSignal): Promise<FeedResult> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new FeedError('offline', 'You appear to be offline. Reconnect and we will try again.')
  }

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), 15000)
  signal?.addEventListener('abort', () => timeout.abort())

  let res: Response
  try {
    res = await fetch(feedUrl(level, period), { signal: timeout.signal })
  } catch (err) {
    clearTimeout(timer)
    if (signal?.aborted) throw err
    if (timeout.signal.aborted) {
      throw new FeedError('timeout', 'The USGS server took longer than 15 seconds to answer.')
    }
    throw new FeedError('unknown', 'The request to the USGS feed failed before a response came back.')
  }
  clearTimeout(timer)

  if (!res.ok) {
    throw new FeedError('http', `The USGS feed answered with status ${res.status}.`, res.status)
  }

  let body: QuakeCollection
  try {
    body = await res.json()
  } catch {
    throw new FeedError('parse', 'The feed sent back data we could not read.')
  }
  if (!body || !Array.isArray(body.features)) {
    throw new FeedError('parse', 'The feed response was missing its list of events.')
  }

  return {
    quakes: body.features.map(toQuake),
    generated: body.metadata?.generated ?? Date.now(),
    title: body.metadata?.title ?? '',
  }
}
