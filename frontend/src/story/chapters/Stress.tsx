import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { Caption, readCaption } from '../Caption'
import { Chapter, chapterTimeline, type StoryData } from './shared'

/* ---------- Panel B: strata that bend as stress builds ---------- */

const W = 600
const H = 400
const FILLS = ['url(#h-light)', 'url(#h-ochre)', 'url(#h-mid)', 'url(#h-stipple)', 'url(#h-cross)', 'url(#h-flat)', 'url(#h-mid)']
const faultAt = (y: number) => 330 - y * 0.16

function boundary(i: number, x: number, bend: number, side: -1 | 1) {
  const base = 40 + i * 58
  const d = x - faultAt(base)
  const drag = bend * 34 * Math.exp(-((d / 140) ** 2)) * side
  const flex = bend * 22 * Math.sin((Math.PI * x) / W) * -side
  return base + drag + flex
}

function strataPaths(bend: number, side: -1 | 1) {
  const out: string[] = []
  for (let i = -1; i < 7; i++) {
    const top: string[] = []
    const bot: string[] = []
    for (let x = -20; x <= W + 20; x += 20) {
      top.push(`${x},${(i < 0 ? -40 : boundary(i, x, bend, side)).toFixed(1)}`)
      bot.push(`${x},${boundary(i + 1, x, bend, side).toFixed(1)}`)
    }
    out.push(`M${top.join(' L')} L${bot.reverse().join(' L')}Z`)
  }
  return out
}

const BENDS = [0, 0.55, 1].map((b) => ({ left: strataPaths(b, -1), right: strataPaths(b, 1) }))

export function StrataArt() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="art" aria-hidden="true">
      <defs>
        <clipPath id="cl-left">
          <path d={`M-40 -40 L${faultAt(-40)} -40 L${faultAt(H + 40)} ${H + 40} L-40 ${H + 40}Z`} />
        </clipPath>
        <clipPath id="cl-right">
          <path d={`M${faultAt(-40)} -40 L${W + 40} -40 L${W + 40} ${H + 40} L${faultAt(H + 40)} ${H + 40}Z`} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill="var(--paper)" />
      {BENDS.map((b, k) => (
        <g key={k} className={`bend bend-${k}`} filter="url(#ink-rough)">
          <g clipPath="url(#cl-left)">
            {b.left.map((d, i) => (
              <path key={i} d={d} fill={FILLS[(i + 7) % 7]} stroke="var(--ink)" strokeWidth="1.6" />
            ))}
          </g>
          <g clipPath="url(#cl-right)">
            {b.right.map((d, i) => (
              <path key={i} d={d} fill={FILLS[(i + 7) % 7]} stroke="var(--ink)" strokeWidth="1.6" />
            ))}
          </g>
        </g>
      ))}
      <path d={`M${faultAt(-10)} -10 L${faultAt(H + 10)} ${H + 10}`} stroke="var(--ink)" strokeWidth="4" />
      <g className="push" stroke="var(--ink)" strokeWidth="3" fill="none">
        <path d="M40 200 h70 m-16 -12 l16 12 l-16 12" />
        <path d="M560 200 h-70 m16 -12 l-16 12 l16 12" />
      </g>
    </svg>
  )
}

/* ---------- Panel C: the locked fault, with hairline cracks ---------- */

function seeded(i: number) {
  const v = Math.sin(i * 91.17 + 3.3) * 43758.5453
  return v - Math.floor(v)
}
const JAG = Array.from({ length: 21 }, (_, i) => `${300 + (seeded(i) - 0.5) * 26 - i * 3},${i * 20}`).join(' L')
const CRACKS = Array.from({ length: 14 }, (_, i) => {
  const y = 30 + i * 25 + seeded(i + 40) * 10
  const x = 300 - (y / 20) * 3
  const dir = i % 2 ? 1 : -1
  const pts = [[x, y]]
  let cx = x
  let cy = y
  for (let k = 0; k < 4; k++) {
    cx += dir * (14 + seeded(i * 7 + k) * 26)
    cy += (seeded(i * 3 + k) - 0.5) * 30
    pts.push([cx, cy])
  }
  return 'M' + pts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(' L')
})

export function LockedArt() {
  return (
    <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" className="art" aria-hidden="true">
      <rect width="600" height="400" fill="url(#h-light)" />
      <path d={`M0 0 L${JAG} L0 400Z`} fill="url(#h-mid)" />
      <path d={`M600 0 L${JAG} L600 400Z`} fill="url(#h-cross)" opacity="0.85" />
      <path d={`M${JAG}`} fill="none" stroke="var(--ink)" strokeWidth="5" filter="url(#ink-rough)" />
      <g fill="none" stroke="var(--ink)" strokeWidth="2.2" strokeLinecap="round">
        {CRACKS.map((d, i) => (
          <path key={i} d={d} className="crack" />
        ))}
      </g>
      <g className="lock-tag" fontFamily="var(--mono)" fontSize="15" fontWeight="600">
        <rect x="318" y="182" width="96" height="30" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
        <text x="330" y="202" fill="var(--ink)" letterSpacing="2">
          LOCKED
        </text>
      </g>
    </svg>
  )
}

export default function Stress({ hero }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const ca = useRef<HTMLDivElement>(null)
  const cb = useRef<HTMLDivElement>(null)
  const cc = useRef<HTMLDivElement>(null)
  const cd = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const tl = chapterTimeline(ref.current)
      tl.fromTo('.pa', { autoAlpha: 0, yPercent: 110, rotate: -4 }, { autoAlpha: 1, yPercent: 0, rotate: -1.2, duration: 1, ease: 'power3.out' }, 0)
      tl.fromTo('.pa .art-img', { scale: 1.35, xPercent: -8 }, { scale: 1.08, xPercent: 4, duration: 4 }, 0)
      readCaption(tl, ca.current, 0.7, 1.2)

      tl.fromTo('.pb', { autoAlpha: 0, xPercent: 120, rotate: 5 }, { autoAlpha: 1, xPercent: 0, rotate: 1.4, duration: 1, ease: 'power3.out' }, 2.6)
      tl.fromTo('.pb .art', { scale: 1.25 }, { scale: 1, duration: 3.6 }, 2.6)
      tl.fromTo('.pb .bend-1', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 3.6)
      tl.fromTo('.pb .bend-2', { opacity: 0 }, { opacity: 1, duration: 0.8 }, 4.6)
      tl.to('.pb .bend-0', { opacity: 0, duration: 0.6 }, 3.9)
      tl.to('.pb .bend-1', { opacity: 0, duration: 0.6 }, 4.9)
      readCaption(tl, cb.current, 3.2, 1.2)

      tl.fromTo('.pc', { autoAlpha: 0, yPercent: 120, rotate: 3 }, { autoAlpha: 1, yPercent: 0, rotate: -0.6, duration: 1, ease: 'power3.out' }, 5.4)
      tl.fromTo('.pc .art', { scale: 1.6, xPercent: 6, yPercent: 4 }, { scale: 1.15, xPercent: 0, yPercent: 0, duration: 3.4 }, 5.4)
      tl.fromTo('.pc .crack', { opacity: 0, scale: 0.4, transformOrigin: '0% 50%' }, { opacity: 1, scale: 1, duration: 0.3, stagger: 0.16 }, 6.4)
      readCaption(tl, cc.current, 6, 1.2)
      // On phones the panels stack and overlap, so each caption gives way to the next one.
      if (window.matchMedia('(max-width: 760px)').matches) {
        tl.to(ca.current, { autoAlpha: 0, duration: 0.3 }, 2.7)
        tl.to(cb.current, { autoAlpha: 0, duration: 0.3 }, 5.5)
      }

      tl.to('.pnl-cap', { autoAlpha: 0, duration: 0.4 }, 8.3)
      readCaption(tl, cd.current, 8.6, 1)
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id] },
  )

  return (
    <Chapter ref={ref} id="stress" tone="paper">
      <div className="panels">
        <figure className="pnl pa">
          <div className="pnl-art">
            <img className="art-img" src="/plates/holmes-toroweap.png" alt="" width="1100" height="778" loading="lazy" decoding="async" />
          </div>
          <figcaption className="pnl-credit">After W. H. Holmes, 1882</figcaption>
          <Caption ref={ca} className="pnl-cap" segs={['Rock on each side of a fault is pushed in', { hl: 'opposite directions,' }, 'year after year.']} />
        </figure>
        <figure className="pnl pb">
          <div className="pnl-art">
            <StrataArt />
          </div>
          <Caption ref={cb} className="pnl-cap" segs={['Friction keeps the fault', { hl: 'locked.' }, 'So the rock bends instead of sliding.']} />
        </figure>
        <figure className="pnl pc">
          <div className="pnl-art">
            <LockedArt />
          </div>
          <Caption ref={cc} className="pnl-cap" segs={['Bent rock stores energy, like a drawn bow.', { hl: 'Hairline cracks' }, 'start to open.']} />
        </figure>
      </div>
      <div className="cap-col cap-low cap-right">
        <Caption ref={cd} segs={['When the stress beats the friction, the fault', { hl: 'slips.' }, 'That slip is the earthquake.']} />
      </div>
    </Chapter>
  )
}
