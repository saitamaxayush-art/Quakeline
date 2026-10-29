/**
 * Geometry shared by the 3D cross-section and the HTML depth ruler, so both agree on where
 * the hypocentre sits. World units: the surface is at y = TOP, the block bottom at y = BOTTOM.
 */
export const TOP = 1.2
export const BOTTOM = -2.2

/** Depth shown at the bottom of the block, in km: a round number below the hypocentre. */
export function crustMaxKm(depth: number) {
  const want = Math.max(depth * 1.6, 25)
  const steps = [25, 40, 60, 100, 150, 250, 400, 600, 800]
  return steps.find((s) => s >= want) ?? 800
}

export function depthToY(km: number, maxKm: number) {
  return TOP - (km / maxKm) * (TOP - BOTTOM)
}

/** x position of the fault at height y. It dips to the left. */
export function faultX(y: number) {
  return 0.15 + (y - TOP) * 0.32
}

export function tickStep(maxKm: number) {
  if (maxKm <= 40) return 5
  if (maxKm <= 100) return 10
  if (maxKm <= 250) return 25
  return 100
}
