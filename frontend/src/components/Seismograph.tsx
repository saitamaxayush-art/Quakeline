import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { Quake } from '../lib/types'
import { mag } from '../lib/format'

const W = 640
const H = 220
const MID = H / 2

/**
 * Draws a seismograph style trace where each spike is a real event from the feed,
 * placed by its time and scaled by its magnitude.
 */
export default function Seismograph({
  quakes,
  windowMs,
  now,
  loading,
}: {
  quakes: Quake[]
  windowMs: number
  now: number
  loading: boolean
}) {
  const { path, peaks } = useMemo(() => {
    const start = now - windowMs
    const events = quakes
      .filter((q) => q.mag !== null && q.time >= start)
      .map((q) => ({
        x: ((q.time - start) / windowMs) * W,
        amp: Math.min(MID - 14, 1.5 + Math.pow(Math.max(q.mag!, 0), 2.45) * 0.85),
        q,
      }))

    // Sample the trace. Each event adds a damped oscillation that starts at its x position.
    const N = 720
    const pts: string[] = []
    for (let i = 0; i <= N; i++) {
      const x = (i / N) * W
      let y = Math.sin(i * 1.7) * 0.7 + Math.sin(i * 0.31) * 0.5
      for (const e of events) {
        const dx = x - e.x
        if (dx < -2 || dx > 48) continue
        const t = Math.max(dx, 0)
        y += e.amp * Math.exp(-t / 6.5) * Math.sin(t * 1.35 + 0.4)
      }
      pts.push(`${x.toFixed(1)},${(MID - y).toFixed(1)}`)
    }

    const top = [...events].sort((a, b) => b.q.mag! - a.q.mag!).slice(0, 3)
    return { path: `M${pts.join(' L')}`, peaks: top }
  }, [quakes, windowMs, now])

  const key = `${quakes.length}-${windowMs}`

  return (
    <div className={`seismo ${loading ? 'is-loading' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Trace of recent events">
        <defs>
          <pattern id="grid" width="32" height="22" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V22" fill="none" stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#grid)" />
        <line x1="0" x2={W} y1={MID} y2={MID} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 5" />
        <mask id="seismo-mask" maskUnits="userSpaceOnUse">
          <motion.rect
            key={key}
            x="0"
            y="0"
            width={W}
            height={H}
            fill="#fff"
            initial={{ x: -W }}
            animate={{ x: 0 }}
            transition={{ duration: 2.2, ease: [0.45, 0, 0.2, 1] }}
          />
        </mask>
        {!loading && (
          <path d={path} mask="url(#seismo-mask)" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
      </svg>
      {!loading &&
        peaks.map((p, i) => (
          <motion.span
            key={`${key}-${p.q.id}`}
            className="seismo-peak"
            style={{ left: `${(p.x / W) * 100}%`, top: `${((MID - p.amp - 6) / H) * 100}%` }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 + (p.x / W) * 1.6 + i * 0.05, duration: 0.4 }}
          >
            M{mag(p.q.mag)}
          </motion.span>
        ))}
      {loading && <div className="seismo-scan" aria-hidden="true" />}
    </div>
  )
}
