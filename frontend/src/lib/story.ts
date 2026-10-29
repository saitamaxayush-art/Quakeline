import type { Quake } from './types'
import { distanceKm } from './format'
import stationList from '../data/stations.json'

export interface Station {
  code: string
  lat: number
  lon: number
  site: string
}

export const STATIONS = stationList as Station[]

/** Earthquakes only: the feed also lists quarry blasts, explosions and ice quakes. */
export function earthquakesOnly(quakes: Quake[]) {
  return quakes.filter((q) => q.type === 'earthquake')
}

export function strongest(quakes: Quake[]): Quake | null {
  let best: Quake | null = null
  for (const q of quakes) {
    if (q.mag === null) continue
    if (!best || q.mag > (best.mag ?? -9) || (q.mag === best.mag && q.sig > best.sig)) best = q
  }
  return best
}

/**
 * P wave travel time for a surface source, in seconds, by angular distance in degrees.
 * Points read off the IASP91 reference model and linearly interpolated, so results are approximate.
 * Beyond about 100 degrees the direct P wave is in the core shadow and is not returned.
 */
const P_CURVE: [number, number][] = [
  [0, 0],
  [1, 19],
  [2, 32],
  [5, 76],
  [10, 146],
  [15, 212],
  [20, 277],
  [25, 327],
  [30, 373],
  [40, 458],
  [50, 533],
  [60, 601],
  [70, 661],
  [80, 713],
  [90, 760],
  [100, 802],
]

export function pTravelSeconds(deg: number): number | null {
  if (deg > 100) return null
  for (let i = 1; i < P_CURVE.length; i++) {
    const [d1, t1] = P_CURVE[i]
    if (deg <= d1) {
      const [d0, t0] = P_CURVE[i - 1]
      return t0 + ((deg - d0) / (d1 - d0)) * (t1 - t0)
    }
  }
  return null
}

export const KM_PER_DEG = 111.195

export interface StationHit extends Station {
  km: number
  deg: number
  pSec: number | null
}

export function nearestStations(q: Quake, n = 9): StationHit[] {
  return STATIONS.map((s) => {
    const km = distanceKm(q.lat, q.lon, s.lat, s.lon)
    const deg = km / KM_PER_DEG
    return { ...s, km, deg, pSec: pTravelSeconds(deg) }
  })
    .sort((a, b) => a.km - b.km)
    .slice(0, n)
}

export function minSec(s: number) {
  const total = Math.round(s)
  const m = Math.floor(total / 60)
  const r = total % 60
  return m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`
}

/* ---------- Gate choice ---------- */

export type GateChoice = 'follow' | 'skip'
const KEY = 'quakeline.gate'

export function readGate(): GateChoice | null {
  try {
    const v = window.localStorage.getItem(KEY)
    return v === 'follow' || v === 'skip' ? v : null
  } catch {
    return null
  }
}

export function writeGate(v: GateChoice | null) {
  try {
    if (v) window.localStorage.setItem(KEY, v)
    else window.localStorage.removeItem(KEY)
  } catch {
    /* storage blocked: the choice simply is not remembered */
  }
}
