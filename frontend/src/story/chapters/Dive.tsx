import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { depthLabel } from '../../lib/format'
import { Caption, hideCaption, readCaption } from '../Caption'
import { crustMaxKm, tickStep } from '../crust'
import { Chapter, chapterTimeline, type StoryData } from './shared'

const BAND: Record<string, string> = {
  Shallow: 'under 70 km',
  Intermediate: '70 to 300 km',
  Deep: 'over 300 km',
}

function fmtKm(d: number) {
  return d < 10 ? d.toFixed(1) : String(Math.round(d))
}

export default function Dive({ hero }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const c1 = useRef<HTMLDivElement>(null)
  const c2 = useRef<HTMLDivElement>(null)
  const num = useRef<HTMLSpanElement>(null)
  const depth = hero.depth
  const maxKm = crustMaxKm(depth)
  const step = tickStep(maxKm)
  const ticks: number[] = []
  for (let k = 0; k <= maxKm; k += step) ticks.push(k)
  const band = depthLabel(depth)

  useGSAP(
    () => {
      const tl = chapterTimeline(ref.current)
      readCaption(tl, c1.current, 0.3)
      hideCaption(tl, c1.current, 3.2)
      // The portal: an ink disc opens from the epicentre and the camera falls through it.
      tl.fromTo('.portal', { scale: 0, autoAlpha: 1 }, { scale: 1, duration: 1.2, ease: 'power2.in' }, 3.4)
      tl.to('.portal', { autoAlpha: 0, duration: 0.6 }, 4.65)
      // Title card framed by falling rock.
      tl.fromTo('.title-card', { autoAlpha: 0, yPercent: -50, y: 80, rotate: -2 }, { autoAlpha: 1, yPercent: -50, y: 0, rotate: -1, duration: 0.9, ease: 'power3.out' }, 4.8)
      tl.to('.title-card', { autoAlpha: 0, y: -80, rotate: 1, duration: 0.8, ease: 'power2.in' }, 7)
      // The ruler counts down to the hypocentre.
      tl.fromTo('.ruler', { autoAlpha: 0, x: 30 }, { autoAlpha: 1, x: 0, duration: 0.6 }, 5)
      tl.fromTo('.ruler-mark', { y: 0 }, { y: () => (depth / maxKm) * (document.querySelector('.ruler-track')?.clientHeight ?? 0), duration: 3.4, ease: 'power1.inOut' }, 5.4)
      const counter = { v: 0 }
      tl.to(
        counter,
        {
          v: depth,
          duration: 3.4,
          ease: 'power1.inOut',
          onUpdate: () => {
            if (num.current) num.current.textContent = fmtKm(counter.v)
          },
        },
        5.4,
      )
      readCaption(tl, c2.current, 7.8)
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id] },
  )

  return (
    <Chapter ref={ref} id="dive">
      <div className="cap-col">
        <Caption ref={c1} segs={['Its hypocentre, where the rock first broke, is', { hl: `${fmtKm(depth)} km` }, 'down. Follow it.']} />
      </div>

      <div className="portal" aria-hidden="true" />

      <div className="title-card" aria-hidden="true">
        <img className="tc-art" src="/plates/dutton-point-sublime.png" alt="" width="1100" height="576" loading="lazy" decoding="async" />
        <span className="tc-corner">Ch. 02</span>
        <span className="tc-corner tc-r">{band}</span>
        <p className="tc-big">
          <span>{fmtKm(depth)} km</span>
          <span>down</span>
        </p>
      </div>

      <div className="ruler" aria-label={`Depth ${fmtKm(depth)} km`}>
        <p className="ruler-read">
          <span ref={num}>0</span> km
        </p>
        <div className="ruler-track">
          {ticks.map((t) => (
            <span key={t} className="ruler-tick" style={{ top: `${(t / maxKm) * 100}%` }}>
              {t}
            </span>
          ))}
          <i className="ruler-mark" />
        </div>
      </div>

      <div className="cap-col cap-low">
        <Caption
          ref={c2}
          segs={['The USGS counts events', { hl: BAND[band] }, 'deep as', { hl: band.toLowerCase() + '.' }]}
        />
      </div>
    </Chapter>
  )
}
