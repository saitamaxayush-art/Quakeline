import { forwardRef, type ReactNode } from 'react'
import type { Quake, Period } from '../../lib/types'
import { gsap, ScrollTrigger } from '../../lib/scroll'
import { prefersReducedMotion } from '../../lib/motion'
import { CARD, CARD_CONFIG, CHAPTERS, CHAPTER_VH, type ChapterId } from '../stage'

export interface StoryData {
  hero: Quake
  quakes: Quake[]
  period: Period
  generated: number | null
  now: number
}

export const SCRUB = { start: 'top top', end: 'bottom bottom', scrub: true } as const

type Timeline = ReturnType<typeof gsap.timeline>
type Trigger = InstanceType<typeof ScrollTrigger>
interface ChapterHooks {
  onUpdate?: (self: Trigger) => void
  onLeaveBack?: (self: Trigger) => void
  onToggle?: (self: Trigger) => void
}

/** The ink-stroke reveal of a chapter's title card, kept per section so it can be replayed. */
const reveals = new WeakMap<Element, Timeline>()

/** Shows a chapter's title card and draws it in. Used for Ch. 1 when the gate closes: the
 *  chapter starts at scroll 0, so its ScrollTrigger never fires onEnter on its own. */
export function playCard(section: Element | null) {
  if (!section) return
  gsap.set(section.querySelector('.ch-card'), { autoAlpha: 1, y: 0 })
  reveals.get(section)?.restart()
}

/**
 * Builds a chapter's scroll timeline. The title card is drawn in by an ink stroke when the
 * chapter is entered, holds while the reader scrolls the first CARD units, then leaves.
 * The returned scene timeline runs from 0 to 10 after that, as every chapter expects.
 */
export function chapterTimeline(section: HTMLElement | null, hooks: ChapterHooks = {}): Timeline {
  const scene = gsap.timeline({ defaults: { ease: 'none' } })
  if (!section) return scene
  const card = section.querySelector<HTMLElement>('.ch-card')
  const stroke = section.querySelector<SVGElement>('.ch-card-stroke')
  const ink = section.querySelectorAll<HTMLElement>('.ch-card-ink')
  const still = prefersReducedMotion()
  const { entrance, exit } = CARD_CONFIG

  // Clean initial state without layout shift or edge flicker. The card stays hidden until its
  // chapter is entered, so an empty paper box never slides up with the incoming frame.
  if (still) {
    gsap.set(ink, { autoAlpha: 1 })
    if (stroke) gsap.set(stroke, { scaleX: 0 })
  } else {
    gsap.set(card, { autoAlpha: 0 })
    gsap.set(ink, { autoAlpha: 0 })
    if (stroke) gsap.set(stroke, { scaleX: 0, transformOrigin: '0% 50%' })
  }

  const reveal = gsap.timeline({ paused: true })
  if (still) {
    reveal.set(ink, { autoAlpha: 1 })
  } else {
    reveal
      .set(ink, { autoAlpha: 0 })
      .fromTo(stroke, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: entrance.strokeInDuration, ease: entrance.ease })
      .set(ink, { autoAlpha: 1 })
      .to(stroke, { scaleX: 0, transformOrigin: '100% 50%', duration: entrance.strokeOutDuration, ease: entrance.ease })
  }
  reveals.set(section, reveal)

  const master = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      ...SCRUB,
      onUpdate: hooks.onUpdate,
      onToggle: hooks.onToggle,
      onEnter: () => {
        gsap.set(card, { autoAlpha: 1, y: 0 })
        // Already drawn (Ch. 1 after the gate): keep it, do not draw it twice.
        if (reveal.progress() === 0) reveal.restart()
      },
      onEnterBack: () => {
        gsap.set(card, { autoAlpha: 1, y: 0 })
        reveal.progress(1)
      },
      onLeaveBack: (self) => {
        reveal.pause(0)
        gsap.set(card, { autoAlpha: 0 })
        hooks.onLeaveBack?.(self)
      },
      onLeave: () => {
        gsap.set(card, { autoAlpha: 0 })
      },
    },
  })

  master.fromTo(
    card,
    { autoAlpha: 1, y: 0 },
    { autoAlpha: 0, y: still ? 0 : exit.y, duration: exit.duration, ease: still ? 'none' : exit.ease, immediateRender: false },
    CARD - exit.duration,
  )
  master.add(scene, CARD)
  return scene
}

/** A chapter: a tall scroll section with one sticky, full-screen frame and a title card. */
export const Chapter = forwardRef<HTMLElement, { id: ChapterId; tone?: 'ink' | 'paper'; sub?: ReactNode; children: ReactNode }>(function Chapter(
  { id, tone = 'ink', sub, children },
  ref,
) {
  const info = CHAPTERS.find((c) => c.id === id)!
  return (
    <section ref={ref} data-ch={id} className={`ch ch-${id} tone-${tone}`} style={{ height: `${CHAPTER_VH[id]}vh` }} aria-labelledby={`h-${id}`}>
      <div className="ch-frame">
        <div className="ch-card">
          <h2 id={`h-${id}`} className="ch-card-ink ch-card-head">
            <span className="ch-card-num">{String(info.n).padStart(2, '0')}</span>
            <span className="ch-card-name">{info.name}</span>
          </h2>
          {sub && <p className="ch-card-ink ch-card-sub">{sub}</p>}
          <svg className="ch-card-brush" viewBox="0 0 600 300" preserveAspectRatio="none" aria-hidden="true">
            <g className="ch-card-stroke">
              <rect x="-40" y="-30" width="680" height="360" fill="var(--ink)" filter="url(#brush-edge)" />
            </g>
          </svg>
        </div>
        {children}
      </div>
    </section>
  )
})

export function spanWords(period: Period) {
  return period === 'day' ? 'in the past 24 hours' : 'in the past 7 days'
}
