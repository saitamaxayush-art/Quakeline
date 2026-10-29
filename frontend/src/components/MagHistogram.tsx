import { useMemo } from 'react'
import { motion } from 'motion/react'
import type { Quake } from '../lib/types'
import { magClass } from '../lib/scales'

const BINS = [
  { from: -1, label: '<1' },
  { from: 1, label: '1' },
  { from: 2, label: '2' },
  { from: 3, label: '3' },
  { from: 4, label: '4' },
  { from: 5, label: '5' },
  { from: 6, label: '6+' },
]

export default function MagHistogram({
  quakes,
  minMag,
  onPick,
}: {
  quakes: Quake[]
  minMag: number
  onPick: (m: number) => void
}) {
  const counts = useMemo(() => {
    const c = BINS.map(() => 0)
    for (const q of quakes) {
      if (q.mag === null) continue
      const i = q.mag < 1 ? 0 : Math.min(6, Math.floor(q.mag))
      c[i]++
    }
    return c
  }, [quakes])
  const max = Math.max(1, ...counts)

  return (
    <div className="histo">
      <div className="histo-bars">
        {BINS.map((b, i) => {
          const on = b.from >= minMag || (minMag > b.from && minMag < (BINS[i + 1]?.from ?? 99))
          const h = counts[i] === 0 ? 0 : Math.max(4, Math.sqrt(counts[i] / max) * 100)
          return (
            <button
              key={b.label}
              className={`histo-col ${magClass(Math.max(b.from, 0))} ${on ? 'is-on' : ''}`}
              onClick={() => onPick(b.from === -1 ? -1 : b.from)}
              aria-label={`${counts[i]} events at magnitude ${b.label}. Show magnitude ${b.label} and up.`}
              title={`${counts[i].toLocaleString('en')} events`}
            >
              <span className="histo-n">{counts[i] > 0 ? counts[i].toLocaleString('en') : ''}</span>
              <span className="histo-track">
                <motion.span
                  className="histo-bar"
                  style={{ height: `${h}%`, originY: 1 }}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ type: 'spring', stiffness: 160, damping: 22, delay: i * 0.04 }}
                />
              </span>
              <span className="histo-label">{b.label}</span>
            </button>
          )
        })}
      </div>
      <p className="histo-note">Bar height uses a square root scale so small groups stay visible. Click a bar to set the floor.</p>
    </div>
  )
}
