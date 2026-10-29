/**
 * Motion tokens. The same values exist as CSS custom properties at the top of global.css
 * (--ease-*, --dur-*), so CSS, Motion and GSAP all move on one scale.
 */
export const EASE = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  ink: [0.76, 0, 0.24, 1] as const,
}

/** GSAP names for the same curves. */
export const GSAP_EASE = {
  out: 'power3.out',
  inOut: 'power2.inOut',
  ink: 'expo.inOut',
}

/** Seconds. */
export const DUR = {
  xs: 0.15,
  sm: 0.25,
  md: 0.45,
  lg: 0.8,
  xl: 1.4,
}

export function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
