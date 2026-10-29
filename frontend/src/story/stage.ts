import { createGlobeFrame } from '../components/globe/frame'
import { lerp, range, smooth } from '../components/globe/frame'

export type ChapterId = 'orbit' | 'dive' | 'stress' | 'rupture' | 'waves' | 'stations' | 'published'

/** The story's chapters in order. Ch. 0 is the gate, which is not a scroll section. */
export const CHAPTERS: { id: ChapterId | 'gate'; n: number; name: string }[] = [
  { id: 'gate', n: 0, name: 'Gate' },
  { id: 'orbit', n: 1, name: 'Orbit' },
  { id: 'dive', n: 2, name: 'The dive' },
  { id: 'stress', n: 3, name: 'Stress' },
  { id: 'rupture', n: 4, name: 'Rupture' },
  { id: 'waves', n: 5, name: 'Waves' },
  { id: 'stations', n: 6, name: 'Stations' },
  { id: 'published', n: 7, name: 'Published' },
]

/** Scroll length of each chapter, in viewport heights, including its title card. */
export const CHAPTER_VH: Record<ChapterId, number> = {
  orbit: 270,
  dive: 340,
  stress: 380,
  rupture: 240,
  waves: 290,
  stations: 270,
  published: 340,
}

/** Timeline units the title card holds before the scene's own 10 units begin. */
export const CARD = 2.4
const SCENE = 10
const CARD_FRAC = CARD / (CARD + SCENE)
/** Converts a chapter's scroll progress into its scene progress (0 while the title card is up). */
export const sceneP = (p: number) => range(p, CARD_FRAC, 1)

/**
 * Shared, mutable state for the 3D stage. The scroll driver writes it once per tick, the
 * scene components read it inside useFrame.
 * Kept outside React so scrolling never re-renders anything.
 */
export const stage = {
  globe: createGlobeFrame(),
  scene: 'globe' as 'globe' | 'crust',
  camDist: 3.6,
  invert: 1,
  opacity: 1,
  wide: true,
  crust: { pan: 0, debris: 0, slip: 0, charge: 0 },
  flood: 0,
}

interface Section {
  id: ChapterId
  top: number
  height: number
}
let sections: Section[] = []

export function measureSections(root: HTMLElement) {
  const y = window.scrollY
  sections = [...root.querySelectorAll<HTMLElement>('[data-ch]')].map((el) => {
    const r = el.getBoundingClientRect()
    return { id: el.dataset.ch as ChapterId, top: r.top + y, height: r.height }
  })
}

/** Which chapter the viewport is in, and how far through it (0 to 1, over its sticky span). */
export function readScroll(): { id: ChapterId; p: number } {
  const y = window.scrollY
  const vh = window.innerHeight
  let cur: { id: ChapterId; p: number } = { id: 'orbit', p: 0 }
  for (const s of sections) {
    if (y >= s.top - 1) cur = { id: s.id, p: Math.min(1, Math.max(0, (y - s.top) / Math.max(1, s.height - vh))) }
  }
  return cur
}

/** P front arc during the waves chapter, in radians, up to 100 degrees (where direct P ends). */
export const wavesP = (p: number) => smooth(range(p, 0.05, 0.92)) * ((100 * Math.PI) / 180)
/** S waves travel at roughly 0.55 of the P front's angular distance at the same moment. */
export const wavesS = (p: number) => wavesP(p) * 0.55

export function updateStage(time: number) {
  const { id, p: raw } = readScroll()
  const p = sceneP(raw)
  const g = stage.globe
  const wide = stage.wide
  g.spin = time * 0.05
  g.ringP = 0
  g.ringS = 0

  switch (id) {
    case 'orbit': {
      stage.scene = 'globe'
      stage.invert = 1
      stage.opacity = 1
      g.focusMix = smooth(range(p, 0.1, 0.8))
      g.pulse = range(p, 0.45, 0.7)
      g.reveal = 0
      g.clouds = 1
      g.x = wide ? lerp(0.62, 0.48, p) : 0
      stage.camDist = wide ? lerp(4.1, 3.5, smooth(p)) : lerp(4.8, 4.1, smooth(p))
      break
    }
    case 'dive': {
      const a = range(p, 0, 0.44)
      const inCrust = p >= 0.46
      stage.scene = inCrust ? 'crust' : 'globe'
      stage.invert = inCrust ? 0 : 1
      stage.opacity = 1
      g.focusMix = 1
      g.pulse = 1
      g.reveal = 0
      g.clouds = 1 - range(p, 0.15, 0.35)
      g.x = wide ? lerp(0.48, 0, smooth(range(p, 0, 0.2))) : 0
      stage.camDist = lerp(wide ? 3.5 : 4.1, 1.04, a * a * a)
      stage.crust.pan = smooth(range(p, 0.46, 0.95))
      stage.crust.debris = range(p, 0.46, 0.82)
      break
    }
    case 'stress': {
      stage.scene = 'crust'
      stage.invert = 0
      stage.opacity = 0
      stage.crust.pan = 1
      stage.crust.debris = 1
      break
    }
    case 'rupture': {
      // The rupture is told with the engraved diagram on paper; the 3D stage rests.
      stage.scene = 'crust'
      stage.invert = 0
      stage.opacity = 0
      break
    }
    case 'waves': {
      stage.scene = 'globe'
      stage.invert = 1
      stage.opacity = 1
      g.focusMix = 1
      g.pulse = 1
      g.reveal = 0
      g.clouds = 0.55
      g.x = wide ? -0.5 : 0
      g.ringP = wavesP(p)
      g.ringS = wavesS(p)
      stage.camDist = wide ? 3.2 : 4.2
      break
    }
    case 'stations': {
      stage.scene = 'globe'
      stage.opacity = 0
      break
    }
    case 'published': {
      stage.scene = 'globe'
      stage.invert = 1
      stage.opacity = 1 - range(p, 0.82, 0.98)
      g.focusMix = lerp(1, 0.35, smooth(range(p, 0.2, 0.8)))
      g.pulse = 1
      g.clouds = 0.35
      g.reveal = smooth(range(p, 0.2, 0.7))
      g.x = 0
      stage.camDist = lerp(1.9, wide ? 3.5 : 4.4, smooth(range(p, 0.05, 0.6)))
      break
    }
  }
}
