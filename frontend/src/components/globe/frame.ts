// Three-free half of the globe module: safe to import from eagerly loaded code.

/**
 * Everything that moves the globe, as a plain mutable object. A parent (the story's scroll
 * driver now, the dashboard's timeline in Phase 2) writes it; the globe reads it every frame.
 */
export interface GlobeFrame {
  /** Idle spin angle in radians. */
  spin: number
  /** 0 = idle spin pose, 1 = focus event faces the camera. */
  focusMix: number
  /** Wave fronts as arcs from the focus, in radians. 0 hides them. */
  ringP: number
  ringS: number
  /** 0 to 1, size of the focus marker. */
  pulse: number
  /** 0 to 1, share of quakes drawn, in time order. */
  reveal: number
  /** 0 to 1, cloud layer opacity. */
  clouds: number
  /** Horizontal offset of the globe in world units. */
  x: number
}

export function createGlobeFrame(): GlobeFrame {
  return { spin: 0, focusMix: 0, ringP: 0, ringS: 0, pulse: 0, reveal: 1, clouds: 1, x: 0 }
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
/** Maps v from [a, b] to [0, 1], clamped. */
export const range = (v: number, a: number, b: number) => clamp01((v - a) / (b - a))
export const smooth = (t: number) => t * t * (3 - 2 * t)
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
