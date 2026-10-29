const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(ts: number, now = Date.now()) {
  const diff = (ts - now) / 1000
  const abs = Math.abs(diff)
  if (abs < 45) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

export function shortAgo(ts: number, now = Date.now()) {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

const dtf = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})
const utcf = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: 'UTC',
})

export const localTime = (ts: number) => dtf.format(ts)
export const utcTime = (ts: number) => `${utcf.format(ts)} UTC`

export function mag(m: number | null) {
  return m === null || Number.isNaN(m) ? '-' : m.toFixed(1)
}

export function km(n: number) {
  return `${n < 10 ? n.toFixed(1) : Math.round(n)} km`
}

export function coord(lat: number, lon: number) {
  const la = `${Math.abs(lat).toFixed(3)}°${lat >= 0 ? 'N' : 'S'}`
  const lo = `${Math.abs(lon).toFixed(3)}°${lon >= 0 ? 'E' : 'W'}`
  return `${la}, ${lo}`
}

export function depthLabel(d: number) {
  if (d < 70) return 'Shallow'
  if (d < 300) return 'Intermediate'
  return 'Deep'
}

/** Rough everyday description of a magnitude, based on USGS guidance. */
export function magWord(m: number | null) {
  if (m === null) return 'Unrated'
  if (m < 2.5) return 'Usually not felt'
  if (m < 4) return 'Often felt, rarely damaging'
  if (m < 5) return 'Light shaking'
  if (m < 6) return 'Moderate, can damage weak buildings'
  if (m < 7) return 'Strong, damaging near the centre'
  if (m < 8) return 'Major, serious damage over large areas'
  return 'Great, destructive across wide regions'
}

export function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Great circle distance in km. */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const r = (d: number) => (d * Math.PI) / 180
  const dLat = r(bLat - aLat)
  const dLon = r(bLon - aLon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLon / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

export const nf = new Intl.NumberFormat('en')
