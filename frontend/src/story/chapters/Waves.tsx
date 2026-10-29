import { useMemo, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { nf } from '../../lib/format'
import { KM_PER_DEG, minSec, pTravelSeconds } from '../../lib/story'
import { Caption, readCaption } from '../Caption'
import { sceneP, wavesP, wavesS } from '../stage'
import { Chapter, chapterTimeline, type StoryData } from './shared'

const TW = 800
const TH = 160

/** A drawn trace: quiet, then the P arrival, then the larger S arrival, scaled by magnitude. Not a recording. */
function tracePath(m: number) {
  const amp = Math.min(1, 0.25 + m / 9)
  const pts: string[] = []
  for (let i = 0; i <= 400; i++) {
    const x = (i / 400) * TW
    let y = Math.sin(i * 1.9) * 0.8 + Math.sin(i * 0.37) * 0.6
    const p = x - 220
    const s = x - 470
    if (p > 0) y += amp * 26 * Math.exp(-p / 90) * Math.sin(p * 0.42)
    if (s > 0) y += amp * 62 * Math.exp(-s / 120) * Math.sin(s * 0.23 + 0.6)
    pts.push(`${x.toFixed(1)},${(TH / 2 - y).toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
}

export default function Waves({ hero }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const c1 = useRef<HTMLDivElement>(null)
  const pKm = useRef<HTMLElement>(null)
  const sKm = useRef<HTMLElement>(null)
  const tSec = useRef<HTMLElement>(null)
  const d = useMemo(() => tracePath(hero.mag ?? 3), [hero.mag])

  useGSAP(
    () => {
      const tl = chapterTimeline(ref.current, {
        onUpdate: (self) => {
          const pk = (wavesP(sceneP(self.progress)) * 180) / Math.PI
          const sk = (wavesS(sceneP(self.progress)) * 180) / Math.PI
          const t = pTravelSeconds(pk)
          if (pKm.current) pKm.current.textContent = nf.format(Math.round(pk * KM_PER_DEG))
          if (sKm.current) sKm.current.textContent = nf.format(Math.round(sk * KM_PER_DEG))
          if (tSec.current) tSec.current.textContent = t !== null && pk > 0.2 ? minSec(t) : '0 s'
        },
      })
      readCaption(tl, c1.current, 0.3, 1.4)
      tl.fromTo('.fronts', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.6 }, 0.8)
      tl.fromTo('.seis', { autoAlpha: 0, yPercent: 30, rotate: 2 }, { autoAlpha: 1, yPercent: 0, rotate: 0.6, duration: 0.8, ease: 'power3.out' }, 1.6)
      tl.fromTo('.seis .pen-mask', { x: -TW }, { x: 0, duration: 6.4 }, 2.2)
      tl.fromTo('.mallet', { autoAlpha: 0, rotate: -6, y: 40 }, { autoAlpha: 1, rotate: -2.5, y: 0, duration: 0.8, ease: 'power3.out' }, 3.2)
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id] },
  )

  return (
    <Chapter ref={ref} id="waves">
      <div className="waves-col">
        <Caption ref={c1} segs={[{ hl: 'P waves' }, 'arrive first.', { hl: 'S waves' }, 'follow, slower and stronger.']} />
        <dl className="fronts">
          <div>
            <dt>Time since rupture</dt>
            <dd>
              <b ref={tSec}>0 s</b>
            </dd>
          </div>
          <div>
            <dt>P front</dt>
            <dd>
              <b ref={pKm}>0</b> km
            </dd>
          </div>
          <div className="is-s">
            <dt>S front</dt>
            <dd>
              <b ref={sKm}>0</b> km
            </dd>
          </div>
        </dl>
        <p className="fronts-note">Approx., from the IASP91 travel-time model.</p>
      </div>

      <figure className="pnl seis">
        <span className="pnl-head">
          <span>Seismogram</span>
          <span>Drawn from the magnitude, not a recording</span>
        </span>
        <svg viewBox={`0 0 ${TW} ${TH}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <mask id="seis-mask" maskUnits="userSpaceOnUse">
              <rect className="pen-mask" x="0" y="-10" width={TW} height={TH + 20} fill="#fff" />
            </mask>
          </defs>
          <g stroke="var(--ink)" strokeOpacity="0.18">
            {Array.from({ length: 9 }, (_, i) => (
              <line key={i} x1={i * 100} x2={i * 100} y1="0" y2={TH} />
            ))}
          </g>
          <g mask="url(#seis-mask)">
            <path d={d} fill="none" stroke="var(--ink)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            <line x1="220" x2="220" y1="6" y2={TH - 6} stroke="var(--ink)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
            <line x1="470" x2="470" y1="6" y2={TH - 6} className="s-line" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>
        <span className="seis-marks" aria-hidden="true">
          <i style={{ left: '27.5%' }}>P</i>
          <i style={{ left: '58.75%' }} className="is-s">
            S
          </i>
        </span>
      </figure>

      <figure className="pnl mallet">
        <img src="/plates/mallet-wavefronts.png" alt="Engraving of wave fronts spreading in rings from a focus along a fault" width="700" height="483" loading="lazy" decoding="async" />
        <figcaption>Wave fronts from a focus. Robert Mallet, 1862.</figcaption>
      </figure>
    </Chapter>
  )
}
