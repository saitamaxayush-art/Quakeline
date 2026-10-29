import { forwardRef, type ReactNode } from 'react'
import type { Quake, Period } from '../../lib/types'
import { gsap, ScrollTrigger } from '../../lib/scroll'
import { CARD, CHAPTERS, CHAPTER_VH, type ChapterId } from '../stage'

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

export function playCard(section: Element | null) {
  if (section) reveals.get(section)?.restart()
}

/**
 * Builds a chapter's scroll timeline. The title card is drawn in by an ink stroke when the
 * chapter is entered, holds while the reader scrolls the first CARD units, then leaves.
 * The returned scene timeline runs from 0 to 10 after that, as every chapter expects.
 */
export function chapterTimeline(section: HTMLElement | null, hooks: ChapterHooks = {}): Timeline {
  const scene = gsap.timeline({ defaults: { ease: 'none' } })
  if (!section) return scene
  const card = section.querySelector('.ch-card')
  const stroke = section.querySelector('.ch-card-stroke')
  const ink = section.querySelectorAll('.ch-card-ink')

  const reveal = gsap.timeline({ paused: true })
  reveal
    .fromTo(ink, { autoAlpha: 0 }, { autoAlpha: 0, duration: 0.01 })
    .fromTo(stroke, { scaleX: 0, transformOrigin: '0% 50%' }, { scaleX: 1, duration: 0.42, ease: 'power2.inOut' })
    .set(ink, { autoAlpha: 1 })
    .to(stroke, { scaleX: 0, transformOrigin: '100% 50%', duration: 0.5, ease: 'power2.inOut' })
  reveals.set(section, reveal)

  const master = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: section,
      ...SCRUB,
      onUpdate: hooks.onUpdate,
      onToggle: hooks.onToggle,
      onEnter: () => reveal.restart(),
      onEnterBack: () => reveal.progress(1),
      onLeaveBack: (self) => {
        reveal.pause(0)
        hooks.onLeaveBack?.(self)
      },
    },
  })
  master.fromTo(card, { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -48, duration: 0.5, ease: 'power2.in' }, CARD - 0.5)
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
