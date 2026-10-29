import { memo, useMemo, useState } from 'react'
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Topology, GeometryCollection } from 'topojson-specification'
import landTopo from 'world-atlas/land-110m.json'
import type { Quake } from '../lib/types'
import { depthLabel, mag, km, timeAgo } from '../lib/format'
import { depthClass, magClass } from '../lib/scales'

const W = 960
const H = 470

const projection = geoEqualEarth().fitExtent(
  [
    [8, 8],
    [W - 8, H - 8],
  ],
  { type: 'Sphere' },
)
const pathGen = geoPath(projection)
const topo = landTopo as unknown as Topology<{ land: GeometryCollection }>
const landPath = pathGen(feature(topo, topo.objects.land)) ?? ''
const spherePath = pathGen({ type: 'Sphere' }) ?? ''
const gratPath = pathGen(geoGraticule10()) ?? ''

export function radiusFor(m: number | null) {
  const v = Math.max(m ?? 0, 0)
  return 1.3 + Math.pow(v, 1.7) * 0.45
}

const Base = memo(function Base() {
  return (
    <>
      <defs>
        <pattern id="map-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" className="map-hatch-line" />
        </pattern>
      </defs>
      <path d={spherePath} className="map-sphere" />
      <path d={gratPath} className="map-grat" />
      <path d={landPath} className="map-land" />
    </>
  )
})

function WorldMap({
  quakes,
  onSelect,
  selectedId,
  compact,
  focus,
  colorBy = 'mag',
}: {
  quakes: Quake[]
  onSelect?: (q: Quake) => void
  selectedId?: string | null
  compact?: boolean
  focus?: Quake | null
  /** Which data scale fills the dots. */
  colorBy?: 'mag' | 'depth'
}) {
  const [hover, setHover] = useState<{ q: Quake; x: number; y: number } | null>(null)

  const dots = useMemo(() => {
    // Draw weak events first so strong ones sit on top.
    const sorted = [...quakes].sort((a, b) => (a.mag ?? 0) - (b.mag ?? 0))
    const newest = quakes.reduce((m, q) => Math.max(m, q.time), 0)
    return sorted.flatMap((q, i) => {
      const p = projection([q.lon, q.lat])
      if (!p) return []
      return [{ q, x: p[0], y: p[1], r: radiusFor(q.mag), i, fresh: newest - q.time < 60 * 60 * 1000 }]
    })
  }, [quakes])

  const animate = dots.length < 1500
  const focusPt = focus ? projection([focus.lon, focus.lat]) : null

  return (
    <div className={`worldmap ${compact ? 'is-compact' : ''}`}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${quakes.length} events`}>
        <Base />
        <g>
          {dots.map((d) => {
            const strong = (d.q.mag ?? 0) >= 4.5
            const tone = colorBy === 'depth' ? depthClass(d.q.depth) : magClass(d.q.mag)
            return (
              <g key={d.q.id} transform={`translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`}>
                {d.fresh && strong && !compact && <circle r={d.r} className="map-ripple" />}
                <circle
                  r={d.r}
                  className={`map-dot ${tone} ${selectedId === d.q.id ? 'is-selected' : ''} ${animate ? 'is-anim' : ''}`}
                  style={animate ? { animationDelay: `${Math.min(d.i * 2, 900)}ms` } : undefined}
                  onMouseEnter={onSelect ? () => setHover({ q: d.q, x: d.x, y: d.y }) : undefined}
                  onMouseLeave={onSelect ? () => setHover(null) : undefined}
                  onClick={onSelect ? () => onSelect(d.q) : undefined}
                />
              </g>
            )
          })}
        </g>
        {focusPt && (
          <g transform={`translate(${focusPt[0]} ${focusPt[1]})`} className="map-focus">
            <circle r="26" className="map-focus-ring" />
            <circle r="5" className="map-focus-dot" />
          </g>
        )}
      </svg>
      {hover && (
        <div
          className="map-tip"
          style={{ left: `${(hover.x / W) * 100}%`, top: `${(hover.y / H) * 100}%` }}
          role="tooltip"
        >
          <strong>M{mag(hover.q.mag)}</strong>
          <span>{hover.q.place}</span>
          <small>
            {timeAgo(hover.q.time)} · {depthLabel(hover.q.depth)}, {km(hover.q.depth)} deep
          </small>
        </div>
      )}
    </div>
  )
}

export default memo(WorldMap)
