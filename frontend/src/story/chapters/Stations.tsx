import { useMemo, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { nf } from '../../lib/format'
import { minSec, nearestStations } from '../../lib/story'
import { Caption, readCaption } from '../Caption'
import { Chapter, chapterTimeline, type StoryData } from './shared'

function miniTrace(seed: number) {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const x = i * 2
    const t = i - 18
    const y = t > 0 ? Math.exp(-t / 14) * 13 * Math.sin(t * (0.9 + (seed % 3) * 0.1)) : Math.sin(i * 1.7 + seed) * 0.6
    pts.push(`${x},${(16 - y).toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
}

export default function Stations({ hero }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const c1 = useRef<HTMLDivElement>(null)
  const list = useMemo(() => nearestStations(hero, 9), [hero])

  useGSAP(
    () => {
      const tl = chapterTimeline(ref.current)
      readCaption(tl, c1.current, 0.2, 1.4)
      tl.fromTo('.st', { autoAlpha: 0, y: 40, rotate: (i: number) => (i % 2 ? 1.5 : -1.5) }, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.5, stagger: 0.08, ease: 'power3.out' }, 1)
      // Light each station in order of distance.
      list.forEach((_, i) => {
        tl.to(`.st-${i} .st-lit`, { opacity: 1, duration: 0.25 }, 2.4 + i * 0.75)
        tl.fromTo(`.st-${i} .st-trace`, { scaleX: 0 }, { scaleX: 1, duration: 0.6, transformOrigin: '0% 50%' }, 2.4 + i * 0.75)
      })
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id] },
  )

  return (
    <Chapter ref={ref} id="stations" tone="paper">
      <div className="st-head">
        <Caption
          ref={c1}
          segs={['Seismometers pick it up', { hl: 'nearest first.' }, 'These are the nine closest stations of the Global Seismographic Network.']}
          note="Arrival times are computed from distance, not read from the stations. Approx."
        />
      </div>
      <ol className="st-grid">
        {list.map((s, i) => (
          <li key={s.code} className={`st st-${i}`}>
            <span className="st-lit" aria-hidden="true" />
            <span className="st-code">{s.code}</span>
            <span className="st-site">{s.site}</span>
            <svg className="st-svg" viewBox="0 0 120 32" aria-hidden="true">
              <path className="st-trace" d={miniTrace(i)} fill="none" stroke="var(--ink)" strokeWidth="1.4" />
            </svg>
            <span className="st-data">
              <span>{nf.format(Math.round(s.km))} km</span>
              <span>{s.pSec !== null ? `P ≈ ${minSec(s.pSec)}` : 'Beyond 100°, no direct P'}</span>
            </span>
          </li>
        ))}
      </ol>
    </Chapter>
  )
}
