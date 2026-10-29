import { useEffect, useRef, useState } from 'react'
import { gsap } from '../lib/scroll'
import { CHAPTERS, readScroll, type ChapterId } from './stage'

/**
 * Where you are in the story: a thin rail on the right (a bar along the top on phones) with one
 * tick per chapter, the current chapter's number and name, and progress through it.
 * Ticks jump to their chapter; Ch. 0 reopens the gate.
 */
export default function ChapterRail({ onGate }: { onGate: () => void }) {
  const [active, setActive] = useState(1)
  const fills = useRef<(HTMLSpanElement | null)[]>([])

  useEffect(() => {
    let cur = -1
    const tick = () => {
      const { id, p } = readScroll()
      const i = CHAPTERS.findIndex((c) => c.id === id)
      if (i !== cur) {
        cur = i
        setActive(i)
      }
      fills.current.forEach((f, k) => {
        if (f) f.style.setProperty('--p', String(k < i ? 1 : k === i ? p : 0))
      })
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])

  const go = (id: ChapterId | 'gate') => {
    if (id === 'gate') return onGate()
    const el = document.querySelector<HTMLElement>(`[data-ch="${id}"]`)
    if (!el) return
    const y = el.getBoundingClientRect().top + window.scrollY
    if (window.__lenis) window.__lenis.scrollTo(y, { duration: 1.4 })
    else window.scrollTo({ top: y, behavior: 'smooth' })
  }

  const cur = CHAPTERS[active] ?? CHAPTERS[1]

  return (
    <nav className="rail" aria-label="Story chapters">
      <p className="rail-now" aria-live="polite">
        <b>{String(cur.n).padStart(2, '0')}</b>
        <span>{cur.name}</span>
      </p>
      <ol className="rail-ticks">
        {CHAPTERS.map((c, i) => (
          <li key={c.id}>
            <button
              className={`rail-tick ${i === active ? 'is-active' : ''} ${i < active ? 'is-past' : ''}`}
              onClick={() => go(c.id)}
              aria-label={`Chapter ${c.n}, ${c.name}`}
              aria-current={i === active ? 'step' : undefined}
              title={`${String(c.n).padStart(2, '0')} ${c.name}`}
            >
              <span className="rail-seg">
                <span
                  className="rail-fill"
                  ref={(el) => {
                    fills.current[i] = el
                  }}
                />
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
