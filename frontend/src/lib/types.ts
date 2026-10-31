export type AlertLevel = 'green' | 'yellow' | 'orange' | 'red'

export interface QuakeProperties {
  mag: number | null
  place: string | null
  time: number
  updated: number
  url: string
  detail: string
  felt: number | null
  cdi: number | null
  mmi: number | null
  alert: AlertLevel | null
  status: 'automatic' | 'reviewed' | 'deleted' | string
  tsunami: 0 | 1
  sig: number
  net: string
  code: string
  sources: string
  types: string
  nst: number | null
  dmin: number | null
  rms: number | null
  gap: number | null
  magType: string | null
  type: string
  title: string
}

export interface QuakeFeature {
  type: 'Feature'
  id: string
  properties: QuakeProperties
  geometry: { type: 'Point'; coordinates: [number, number, number] }
}

export interface QuakeCollection {
  type: 'FeatureCollection'
  metadata: {
    generated: number
    url: string
    title: string
    status: number
    api: string
    count: number
  }
  features: QuakeFeature[]
}

/** Flattened shape the UI works with. */
export interface Quake {
  id: string
  mag: number | null
  magType: string | null
  place: string
  region: string
  time: number
  updated: number
  lon: number
  lat: number
  depth: number
  felt: number | null
  mmi: number | null
  cdi: number | null
  alert: AlertLevel | null
  tsunami: boolean
  sig: number
  status: string
  type: string
  net: string
  url: string
  nst: number | null
  gap: number | null
  rms: number | null
}

export type Period = 'hour' | 'day' | 'week' | 'month'
export type Level = 'all' | '1.0' | '2.5' | '4.5' | 'significant'
export type SortKey = 'newest' | 'oldest' | 'strongest' | 'weakest' | 'deepest' | 'shallowest' | 'felt'
export type DepthBand = 'any' | 'shallow' | 'intermediate' | 'deep'

export interface Filters {
  period: Period
  level: Level
  q: string
  minMag: number
  depth: DepthBand
  tsunami: boolean
  reviewed: boolean
  type: string
  sort: SortKey
  /** Satellite cloud imagery layer on the map and globe. */
  clouds: boolean
}
