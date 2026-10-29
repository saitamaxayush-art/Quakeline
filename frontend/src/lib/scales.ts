/**
 * Data colour scales for the dashboard. The colours themselves live in global.css as tokens
 * (--mag-0 to --mag-4, --depth-shallow, --depth-intermediate, --depth-deep); this file only
 * decides which step a value falls in and how each step is labelled. Colour is never the only
 * signal: every use shows the number or label next to it.
 */

export type MagStep = 0 | 1 | 2 | 3 | 4

export const MAG_SCALE: { step: MagStep; label: string; short: string }[] = [
  { step: 0, label: 'Below M2.5', short: '<2.5' },
  { step: 1, label: 'M2.5 to 4.4', short: '2.5' },
  { step: 2, label: 'M4.5 to 5.9', short: '4.5' },
  { step: 3, label: 'M6.0 to 6.9', short: '6' },
  { step: 4, label: 'M7.0 and up', short: '7' },
]

export function magStep(m: number | null): MagStep | null {
  if (m === null || Number.isNaN(m)) return null
  if (m >= 7) return 4
  if (m >= 6) return 3
  if (m >= 4.5) return 2
  if (m >= 2.5) return 1
  return 0
}

/** Class for anything coloured by magnitude: sets --c (fill) and --on (text on that fill). */
export function magClass(m: number | null) {
  const s = magStep(m)
  return s === null ? 'mag-none' : `mag-${s}`
}

export type DepthBandKey = 'shallow' | 'intermediate' | 'deep'

export const DEPTH_SCALE: { key: DepthBandKey; label: string; range: string }[] = [
  { key: 'shallow', label: 'Shallow', range: '0 to 70 km' },
  { key: 'intermediate', label: 'Intermediate', range: '70 to 300 km' },
  { key: 'deep', label: 'Deep', range: '300 km and more' },
]

export function depthKey(km: number): DepthBandKey {
  if (km < 70) return 'shallow'
  if (km < 300) return 'intermediate'
  return 'deep'
}

export function depthClass(km: number) {
  return `depth-${depthKey(km)}`
}

/**
 * Resolved colour of a token, for code that draws outside CSS (canvas or WebGL).
 * Reads :root so the tokens stay the single source of truth.
 */
export function tokenColor(name: `--mag-${MagStep}` | `--depth-${DepthBandKey}`) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}
