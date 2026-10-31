import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ArrowDown } from 'lucide-react'
import { gsap, lockScroll } from '../lib/scroll'
import { mag } from '../lib/format'
import type { Quake } from '../lib/types'
import { Caption, type Seg } from './Caption'

/* ---------- The diagram: elastic rebound across a locked fault ---------- */

const W = 640
const H = 420
const FX = 320 // fault x
const LOCK = [150, 270] as const // locked section of the fault, y range
const HYPO = { x: FX, y: 210 }
const SHIFT = 34 // far-field offset of each block at full stress
const BOUNDS = [-90, 60, 120, 180, 240, 300, 360, 420, 530]
const FILLS = ['url(#h-light)', 'url(#h-ochre)', 'url(#h-mid)', 'url(#h-stipple)', 'url(#h-cross)', 'url(#h-flat)', 'url(#h-light)', 'url(#h-mid)']
const FRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1]
const HOLD_SECONDS = 2.5

/** Offset of a layer at x for stress c: zero at the locked fault, growing away from it. */
function offset(x: number, c: number) {
  const side = x < FX ? -1 : 1
  return side * c * SHIFT * (1 - Math.exp(-Math.abs(x - FX) / 110))
}

function bands(c: number, side: -1 | 1, straight = false) {
  return FILLS.map((fill, i) => {
    const top: string[] = []
    const bot: string[] = []
    for (let x = side < 0 ? -20 : FX; side < 0 ? x <= FX : x <= W + 20; x += 16) {
      const dy = straight ? side * SHIFT : offset(x + (side < 0 ? -0.01 : 0.01), c)
      top.push(`${x},${(BOUNDS[i] + dy).toFixed(1)}`)
      bot.push(`${x},${(BOUNDS[i + 1] + dy).toFixed(1)}`)
    }
    return { d: `M${top.join(' L')} L${bot.reverse().join(' L')}Z`, fill }
  })
}

function Half({ c, side, straight }: { c: number; side: -1 | 1; straight?: boolean }) {
  return (
    <g clipPath={`url(#rig-clip-${side < 0 ? 'l' : 'r'})`}>
      {bands(c, side, straight).map((b, i) => (
        <path key={i} d={b.d} fill={b.fill} stroke="var(--ink)" strokeWidth="1.6" />
      ))}
    </g>
  )
}

function seeded(i: number) {
  const v = Math.sin(i * 91.17 + 3.3) * 43758.5453
  return v - Math.floor(v)
}
const CRACKS = Array.from({ length: 14 }, (_, i) => {
  const y = LOCK[0] + 6 + (i / 13) * (LOCK[1] - LOCK[0] - 12)
  const dir = i % 2 ? 1 : -1
  let x = FX + dir * 5
  let cy = y
  const pts = [`${x},${cy.toFixed(1)}`]
  for (let k = 0; k < 4; k++) {
    x += dir * (16 + seeded(i * 7 + k) * 22)
    cy += (seeded(i * 3 + k) - 0.5) * 26
    pts.push(`${x.toFixed(1)},${cy.toFixed(1)}`)
  }
  return `M${pts.join(' L')}`
})

function Arrow({ x, up }: { x: number; up: boolean }) {
  const y0 = up ? 290 : 130
  const y1 = up ? 130 : 290
  const head = up ? `M${x - 16} ${y1 + 22}L${x} ${y1}L${x + 16} ${y1 + 22}` : `M${x - 16} ${y1 - 22}L${x} ${y1}L${x + 16} ${y1 - 22}`
  return (
    <g className="rig-arrow" style={{ transformOrigin: `${x}px ${y0}px` }}>
      <path d={`M${x} ${y0}L${x} ${y1}${head}`} fill="none" stroke="var(--paper)" strokeWidth="13" strokeLinecap="square" />
      <path d={`M${x} ${y0}L${x} ${y1}${head}`} fill="none" stroke="var(--ink)" strokeWidth="6" strokeLinecap="square" />
    </g>
  )
}

function Diagram() {
  return (
    <svg className="rig-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Two blocks of rock meet at a fault. Arrows push the left block up and the right block down. The middle of the fault is locked.">
      <defs>
        <clipPath id="rig-clip-l">
          <rect x="-40" y="-120" width={FX + 40} height={H + 240} />
        </clipPath>
        <clipPath id="rig-clip-r">
          <rect x={FX} y="-120" width={W - FX + 40} height={H + 240} />
        </clipPath>
      </defs>
      <rect width={W} height={H} fill="var(--paper)" />
      <g className="rig-shake">
        {FRAMES.map((c, i) => (
          <g key={c} className={`rig-frame rig-frame-${i}`} style={{ opacity: i === 0 ? 1 : 0 }}>
            <Half c={c} side={-1} />
            <Half c={c} side={1} />
          </g>
        ))}
        <g className="rig-snap" style={{ opacity: 0 }}>
          <g className="rig-snap-l">
            <Half c={1} side={-1} straight />
          </g>
          <g className="rig-snap-r">
            <Half c={1} side={1} straight />
          </g>
        </g>
        <g fill="none" stroke="var(--ink)" strokeWidth="2.4" strokeLinecap="round">
          {CRACKS.map((d, i) => (
            <path key={i} d={d} className="rig-crack" style={{ opacity: 0 }} />
          ))}
        </g>
        <path d={`M${FX} 0V${H}`} stroke="var(--paper)" strokeWidth="9" />
        <path d={`M${FX} 0V${H}`} stroke="var(--ink)" strokeWidth="4" />
        <path className="rig-lock" d={`M${FX} ${LOCK[0]}V${LOCK[1]}`} stroke="var(--red)" strokeWidth="9" />
        <g className="rig-lock-tag">
          <rect x={FX + 14} y={HYPO.y - 17} width="98" height="34" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
          <text x={FX + 26} y={HYPO.y + 6} fill="var(--red)" fontFamily="var(--mono)" fontSize="16" fontWeight="700" letterSpacing="2">
            LOCKED
          </text>
        </g>
        <Arrow x={110} up />
        <Arrow x={530} up={false} />
      </g>
      <g className="rig-rings" fill="none" stroke="var(--red)" strokeWidth="3">
        {[0, 1, 2].map((i) => (
          <circle key={i} className="rig-ring" cx={HYPO.x} cy={HYPO.y} r="40" style={{ opacity: 0 }} />
        ))}
      </g>
    </svg>
  )
}

/* ---------- The interaction ---------- */

type Phase = 'idle' | 'building' | 'about' | 'early' | 'done'

const STATUS: Record<Phase, string> = {
  idle: 'The fault is locked',
  building: 'Stress building',
  about: 'The fault is about to slip',
  early: 'Not enough stress yet. Hold longer.',
  done: 'The fault slipped',
}

/** Gauge value from hold time: slow at first, faster near the end. */
const ease = (t: number) => Math.pow(t, 1.8)

export interface RuptureRigHandle {
  reset: () => void
}

interface Props {
  hero: Quake
  reduced: boolean
  /** Locks page scroll during the hold. Off in the reduced-motion page, which has no sticky scene. */
  lockDuringHold?: boolean
  className?: string
}

export const RuptureRig = forwardRef<RuptureRigHandle, Props>(function RuptureRig({ hero, reduced, lockDuringHold = true, className = '' }, handle) {
  const root = useRef<HTMLDivElement>(null)
  const t = useRef(0)
  const holding = useRef(false)
  const phaseRef = useRef<Phase>('idle')
  const inView = useRef(false)
  const drain = useRef<ReturnType<typeof gsap.to> | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [touch] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches)

  const shouldLock = lockDuringHold && !reduced
  const lockedRef = useRef(false)
  const rupturedAt = useRef(0)
  const unlockedRef = useRef(false)
  const touchStartY = useRef<number | null>(null)
  const touchStartedAt = useRef(0)

  const applyScrollLock = useCallback(
    (lock: boolean) => {
      if (!shouldLock) return
      lockedRef.current = lock
      lockScroll(lock)
    },
    [shouldLock],
  )

  const unlock = useCallback(
    (andScroll = false) => {
      if (unlockedRef.current) return
      unlockedRef.current = true
      applyScrollLock(false)
      if (andScroll && window.__lenis) {
        window.__lenis.scrollTo(window.scrollY + window.innerHeight * 0.45, { duration: 1.2 })
      }
    },
    [applyScrollLock],
  )

  const setP = useCallback((p: Phase) => {
    if (phaseRef.current === p) return
    phaseRef.current = p
    setPhase(p)
  }, [])

  /** Draws the diagram for the current gauge value. Transform and opacity only. */
  const draw = useCallback(() => {
    const el = root.current
    if (!el) return
    const raw = ease(t.current)
    const v = reduced ? Math.floor(raw * 10) / 10 : raw
    const fill = el.querySelector<HTMLElement>('.gauge-fill')
    if (fill) fill.style.transform = el.dataset.horizontal ? `scaleX(${v})` : `scaleY(${v})`
    const pct = el.querySelector('.gauge-pct')
    if (pct) pct.textContent = `${Math.round(v * 100)}%`
    if (phaseRef.current === 'done') return
    const f = v * (FRAMES.length - 1)
    const lo = Math.floor(f)
    const frac = reduced ? 0 : f - lo
    el.querySelectorAll<SVGGElement>('.rig-frame').forEach((g, i) => {
      g.style.opacity = i === lo ? String(1 - frac) : i === lo + 1 ? String(frac) : reduced && i === Math.round(f) ? '1' : '0'
    })
    el.querySelectorAll<SVGGElement>('.rig-arrow').forEach((a) => (a.style.transform = `scaleY(${1 + v * 0.7})`))
    el.querySelectorAll<SVGPathElement>('.rig-crack').forEach((c, i) => (c.style.opacity = v > (i + 1) / 15 ? '1' : '0'))
    const shake = el.querySelector<SVGGElement>('.rig-shake')
    if (shake) {
      const a = !reduced && holding.current ? v * v * 4 : 0
      shake.style.transform = a ? `translate(${(Math.random() - 0.5) * a}px, ${(Math.random() - 0.5) * a}px)` : ''
    }
    if (holding.current) setP(v >= 0.7 ? 'about' : 'building')
    el.querySelector('.hold')?.classList.toggle('is-holding', holding.current)
  }, [reduced, setP])

  const rupture = useCallback(() => {
    if (phaseRef.current === 'done') return
    const el = root.current
    holding.current = false
    drain.current?.kill()
    t.current = 1
    // Keep scroll locked for the whole interaction and after the rupture fires
    applyScrollLock(true)
    rupturedAt.current = performance.now()
    unlockedRef.current = false

    setP('done')
    draw()
    document.documentElement.classList.add('is-ruptured')
    if (!el) return
    const q = gsap.utils.selector(el)
    gsap.set(q('.rig-frame'), { opacity: 0 })
    gsap.set(q('.rig-snap'), { opacity: 1 })
    gsap.set(q('.rig-lock-tag'), { autoAlpha: 0 })
    el.querySelectorAll<SVGGElement>('.rig-arrow').forEach((a) => (a.style.transform = ''))
    gsap.set(q('.rig-shake'), { x: 0, y: 0 })
    if (reduced) {
      // Still frames: the slipped state, red, and the rings, with no movement.
      gsap.set(q('.rig-ring'), { opacity: 0.8, scale: (i: number) => 1.6 + i * 1.4, svgOrigin: `${HYPO.x} ${HYPO.y}` })
      gsap.set(q('.rig-flood'), { opacity: 0.35 })
      gsap.delayedCall(1.2, () => gsap.set(q('.rig-flood'), { opacity: 0 }))
      gsap.set(q('.rig-after'), { autoAlpha: 1 })
      t.current = 0
      draw()
      return
    }
    const tl = gsap.timeline()
    // The blocks snap past each other and the bent layers spring back straight.
    tl.fromTo(q('.rig-snap-l'), { y: SHIFT * 0.9 }, { y: 0, duration: 0.9, ease: 'elastic.out(1, 0.32)' }, 0)
    tl.fromTo(q('.rig-snap-r'), { y: -SHIFT * 0.9 }, { y: 0, duration: 0.9, ease: 'elastic.out(1, 0.32)' }, 0)
    // One jolt.
    tl.fromTo(el, { x: -22, y: 8 }, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' }, 0)
    tl.fromTo(q('.rig-flood'), { opacity: 0 }, { opacity: 0.85, duration: 0.08 }, 0)
    tl.to(q('.rig-flood'), { opacity: 0, duration: 1.6, ease: 'power2.out' }, 0.45)
    tl.fromTo(
      q('.rig-ring'),
      { opacity: 1, scale: 0.3, svgOrigin: `${HYPO.x} ${HYPO.y}` },
      { opacity: 0, scale: 6, svgOrigin: `${HYPO.x} ${HYPO.y}`, duration: 1.8, stagger: 0.3, ease: 'power2.out', repeat: 1 },
      0.1,
    )
    tl.fromTo(q('.rig-after'), { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, 0.7)
    // The stored strain is gone: the gauge drains.
    tl.to(t, { current: 0, duration: 1.4, ease: 'power2.inOut', onUpdate: draw }, 0.5)
  }, [applyScrollLock, draw, reduced, setP])

  const start = useCallback(() => {
    if (phaseRef.current === 'done' || holding.current) return
    drain.current?.kill()
    holding.current = true
    applyScrollLock(true)
    setP('building')
  }, [applyScrollLock, setP])

  const release = useCallback(() => {
    if (!holding.current) return
    holding.current = false
    // Keep scroll locked if rupture has already occurred
    if (phaseRef.current === 'done') return
    applyScrollLock(false)
    setP('early')
    if (reduced) {
      t.current = 0
      draw()
      return
    }
    drain.current = gsap.to(t, { current: 0, duration: 0.7, ease: 'power2.out', onUpdate: draw })
  }, [applyScrollLock, draw, reduced, setP])

  const reset = useCallback(() => {
    const el = root.current
    holding.current = false
    unlockedRef.current = false
    rupturedAt.current = 0
    applyScrollLock(false)
    drain.current?.kill()
    t.current = 0
    phaseRef.current = 'idle'
    setPhase('idle')
    document.documentElement.classList.remove('is-ruptured')
    if (!el) return
    const q = gsap.utils.selector(el)
    gsap.killTweensOf([el, ...q('.rig-snap-l, .rig-snap-r, .rig-flood, .rig-ring, .rig-after')])
    gsap.set(el, { x: 0, y: 0 })
    gsap.set(q('.rig-snap'), { opacity: 0 })
    gsap.set(q('.rig-lock-tag'), { autoAlpha: 1 })
    gsap.set(q('.rig-ring'), { opacity: 0 })
    gsap.set(q('.rig-flood'), { opacity: 0 })
    gsap.set(q('.rig-after'), { autoAlpha: 0 })
    draw()
  }, [applyScrollLock, draw])

  useImperativeHandle(handle, () => ({ reset }), [reset])

  // Hold loop.
  useEffect(() => {
    const tick = (_time: number, dt: number) => {
      if (!holding.current) return
      t.current = Math.min(1, t.current + dt / 1000 / HOLD_SECONDS)
      draw()
      if (t.current >= 1) rupture()
    }
    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [draw, rupture])

  // Orientation of the gauge follows the layout (vertical beside the diagram, horizontal on phones).
  useEffect(() => {
    const el = root.current
    if (!el) return
    const m = window.matchMedia('(max-width: 760px)')
    const set = () => {
      if (m.matches) el.dataset.horizontal = '1'
      else delete el.dataset.horizontal
      draw()
    }
    set()
    m.addEventListener('change', set)
    return () => m.removeEventListener('change', set)
  }, [draw])

  // Space holds while the diagram is on screen.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => (inView.current = e.intersectionRatio >= 0.5), { threshold: [0, 0.5, 1] })
    io.observe(el)
    const down = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' && ev.key !== ' ') return
      const tag = (ev.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      // Space must never scroll when this scene is in view or post-rupture
      if (inView.current || (phaseRef.current === 'done' && !unlockedRef.current)) {
        ev.preventDefault()
        if (ev.repeat) return
        if (phaseRef.current !== 'done') start()
      }
    }
    const up = (ev: KeyboardEvent) => {
      if (ev.code !== 'Space' && ev.key !== ' ') return
      const tag = (ev.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (inView.current || (phaseRef.current === 'done' && !unlockedRef.current)) {
        ev.preventDefault()
        release()
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      io.disconnect()
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [start, release])

  // Deliberate unlock after rupture: 700ms grace period, ignores momentum, unlocks on new input.
  useEffect(() => {
    if (phase !== 'done' || !shouldLock) return
    const GRACE_MS = 700

    const onWheel = (e: WheelEvent) => {
      if (unlockedRef.current) return
      const now = performance.now()
      if (now - rupturedAt.current < GRACE_MS) return
      if (e.deltaY > 0) {
        unlock()
        if (window.__lenis) {
          window.__lenis.scrollTo(window.scrollY + Math.max(e.deltaY, 60), { immediate: false })
        }
      }
    }

    const onTouchStart = (e: TouchEvent) => {
      touchStartedAt.current = performance.now()
      touchStartY.current = e.touches[0].clientY
    }

    const onTouchMove = (e: TouchEvent) => {
      if (unlockedRef.current || touchStartY.current === null) return
      if (touchStartedAt.current - rupturedAt.current < GRACE_MS) return
      const dy = touchStartY.current - e.touches[0].clientY
      if (dy > 20) {
        unlock()
        if (window.__lenis) {
          window.__lenis.scrollTo(window.scrollY + 80, { immediate: false })
        }
      }
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (unlockedRef.current) return
      if (e.key === ' ' || e.code === 'Space' || e.repeat) {
        if (e.key === ' ' || e.code === 'Space') e.preventDefault()
        return
      }
      const now = performance.now()
      if (now - rupturedAt.current < GRACE_MS) return
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        unlock()
        if (window.__lenis) {
          const dist = e.key === 'PageDown' ? window.innerHeight * 0.8 : 120
          window.__lenis.scrollTo(window.scrollY + dist, { immediate: false })
        }
      }
    }

    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: true })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [phase, shouldLock, unlock])

  // Never leave the page locked if the scene unmounts mid-hold.
  useEffect(
    () => () => {
      if (shouldLock) lockScroll(false)
      document.documentElement.classList.remove('is-ruptured')
    },
    [shouldLock],
  )

  const done = phase === 'done'
  const place: Seg[] = ['That is what happened at', { hl: `M${mag(hero.mag)},` }, { hl: `${hero.place}.` }]

  return (
    <div ref={root} className={`rig is-${phase} ${className}`}>
      <div className="rig-flood" aria-hidden="true" />
      <figure className="rig-panel">
        <Diagram />
        <figcaption className={`rig-status is-${phase}`} aria-hidden="true">
          {STATUS[phase]}
        </figcaption>
      </figure>

      <div className="gauge" aria-hidden="true">
        <span className="gauge-label">Stress</span>
        <span className="gauge-track">
          <span className="gauge-fill" />
        </span>
        <span className="gauge-pct">0%</span>
      </div>

      <div className="rig-side">
        <div className="rig-controls" hidden={done}>
          <p className="rig-instruction" id="rig-instruction">
            {touch ? 'Touch and hold to load the fault' : 'Press and hold to load the fault'}
          </p>
          {!touch && (
            <p className="rig-hint">
              or hold <kbd>Space</kbd>
            </p>
          )}
          <button
            className="hold"
            aria-label="Hold to load the fault"
            aria-describedby="rig-instruction"
            onFocus={() => {
              if (shouldLock) window.__lenis?.stop()
            }}
            onBlur={() => {
              if (shouldLock && !lockedRef.current && !holding.current) {
                window.__lenis?.start()
              }
            }}
            onPointerDown={(ev) => {
              ev.currentTarget.setPointerCapture(ev.pointerId)
              start()
            }}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={release}
            onKeyDown={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ' || ev.code === 'Space') {
                ev.preventDefault()
                if (ev.repeat) return
                start()
              }
            }}
            onKeyUp={(ev) => {
              if (ev.key === 'Enter' || ev.key === ' ' || ev.code === 'Space') {
                ev.preventDefault()
                release()
              }
            }}
            onContextMenu={(ev) => ev.preventDefault()}
          >
            <span className="hold-label">Hold</span>
          </button>
          <button className="rig-skip" onClick={rupture}>
            Skip and show the rupture
          </button>
        </div>

        <div className="rig-after" aria-hidden={!done}>
          <Caption segs={['The fault slipped.', { hl: 'The stored strain' }, 'was released as seismic waves.']} />
          <Caption segs={place} />
          <button type="button" className="rig-cue" onClick={() => unlock(true)}>
            Scroll to follow the waves <ArrowDown size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="sr-only" role="status" aria-live="polite">
        {phase === 'idle' ? '' : STATUS[phase]}
      </p>
    </div>
  )
})
