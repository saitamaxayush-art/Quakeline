import { DEPTH_SCALE, MAG_SCALE } from '../lib/scales'

/** Key for a data colour scale. Every swatch carries its label, so colour is never the only signal. */
export default function ScaleLegend({ scale, compact }: { scale: 'mag' | 'depth'; compact?: boolean }) {
  const title = scale === 'mag' ? 'Magnitude' : 'Depth'
  return (
    <div className={`legend ${compact ? 'is-compact' : ''}`} role="group" aria-label={`${title} colour key`}>
      <span className="legend-title">{title}</span>
      <ul>
        {scale === 'mag'
          ? MAG_SCALE.map((s) => (
              <li key={s.step}>
                <i className={`swatch mag-${s.step}`} aria-hidden="true" />
                {s.label}
              </li>
            ))
          : DEPTH_SCALE.map((s) => (
              <li key={s.key}>
                <i className={`swatch depth-${s.key}`} aria-hidden="true" />
                {s.label}, {s.range}
              </li>
            ))}
      </ul>
    </div>
  )
}
