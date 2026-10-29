import { memo, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Waves, Users, ShieldAlert } from 'lucide-react'
import type { Quake } from '../lib/types'
import { depthLabel, km, mag, shortAgo, localTime } from '../lib/format'
import { depthClass, magClass } from '../lib/scales'
import { Button } from './ui'

const PAGE = 30

const Row = memo(function Row({
  q,
  now,
  index,
  onOpen,
}: {
  q: Quake
  now: number
  index: number
  onOpen: (q: Quake) => void
}) {
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: { delay: Math.min(index % PAGE, 14) * 0.025, duration: 0.35 } }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="row-li"
    >
      <button className="row" onClick={() => onOpen(q)} aria-label={`Open details for ${q.place}, magnitude ${mag(q.mag)}`}>
        <span className={`row-mag ${magClass(q.mag)}`}>
          <strong>{mag(q.mag)}</strong>
          <small>{q.magType ?? 'mag'}</small>
        </span>
        <span className="row-main">
          <span className="row-place">{q.place}</span>
          <span className="row-meta">
            <time dateTime={new Date(q.time).toISOString()} title={localTime(q.time)}>
              {shortAgo(q.time, now)} ago
            </time>
            <span aria-hidden="true">/</span>
            <span className={`depth-chip ${depthClass(q.depth)}`}>
              {depthLabel(q.depth)} {km(q.depth)}
            </span>
            {q.type !== 'earthquake' && (
              <>
                <span aria-hidden="true">/</span>
                <span className="cap">{q.type}</span>
              </>
            )}
          </span>
        </span>
        <span className="row-tags">
          {q.tsunami && (
            <span className="tag tag-strong" title="Tsunami flag set in the feed">
              <Waves size={13} aria-hidden="true" /> Tsunami flag
            </span>
          )}
          {q.alert && (
            <span className={`tag tag-alert alert-${q.alert}`} title="PAGER alert level">
              <ShieldAlert size={13} aria-hidden="true" /> {q.alert}
            </span>
          )}
          {q.felt ? (
            <span className="tag" title="Did You Feel It? responses">
              <Users size={13} aria-hidden="true" /> {q.felt}
            </span>
          ) : null}
        </span>
        <ArrowRight className="row-arrow" size={18} aria-hidden="true" />
      </button>
    </motion.li>
  )
})

export default function QuakeList({
  quakes,
  now,
  onOpen,
  resetKey,
}: {
  quakes: Quake[]
  now: number
  onOpen: (q: Quake) => void
  resetKey: string
}) {
  const [limit, setLimit] = useState(PAGE)
  useEffect(() => setLimit(PAGE), [resetKey])

  const shown = quakes.slice(0, limit)
  const left = quakes.length - shown.length

  return (
    <>
      <ul className="rows" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((q, i) => (
            <Row key={q.id} q={q} now={now} index={i} onOpen={onOpen} />
          ))}
        </AnimatePresence>
      </ul>
      {left > 0 && (
        <div className="more">
          <Button variant="outline" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, left)} more
          </Button>
          <span className="more-note">{left.toLocaleString('en')} not shown yet</span>
        </div>
      )}
    </>
  )
}

export function ListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul className="rows" aria-busy="true" aria-label="Loading events">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="row-li">
          <div className="row row-skel" style={{ animationDelay: `${i * 80}ms` }}>
            <span className="skel skel-mag" />
            <span className="row-main">
              <span className="skel skel-line" style={{ width: `${60 + ((i * 17) % 30)}%` }} />
              <span className="skel skel-line skel-sm" style={{ width: `${30 + ((i * 11) % 20)}%` }} />
            </span>
          </div>
        </li>
      ))}
    </ul>
  )
}
