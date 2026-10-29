import { forwardRef } from 'react'

/**
 * QUAKELINE built from single pen strokes on a 40 x 100 grid, so it can be "written" by a
 * moving mask the way a seismograph pen writes on the drum. The mask moves with transform only.
 */
const GLYPHS: Record<string, { d: string; w: number }> = {
  Q: { d: 'M20 4C6 4 4 18 4 50s2 46 16 46 16-14 16-46S34 4 20 4ZM25 76l15 26', w: 40 },
  U: { d: 'M4 0v74c0 16 6 22 16 22s16-6 16-22V0', w: 40 },
  A: { d: 'M2 100 17 0h6l15 100M8 64h24', w: 40 },
  K: { d: 'M4 0v100M38 0 6 58M15 45l23 55', w: 40 },
  E: { d: 'M37 4H4v92h33M4 48h27', w: 40 },
  L: { d: 'M4 0v96h33', w: 38 },
  I: { d: 'M6 0v100', w: 12 },
  N: { d: 'M4 100V4l32 92V0', w: 40 },
}
const WORD = 'QUAKELINE'
const GAP = 12

let x = 0
const LAYOUT = WORD.split('').map((ch) => {
  const g = GLYPHS[ch]
  const at = x
  x += g.w + GAP
  return { ch, d: g.d, x: at }
})
const WIDTH = x - GAP + 60
/** Distance the pen mask travels, in viewBox units. */
export const PEN_W = WIDTH + 80

export const Wordmark = forwardRef<SVGSVGElement, { className?: string; id: string; trace?: boolean }>(function Wordmark(
  { className, id, trace = true },
  ref,
) {
  return (
    <svg ref={ref} className={className} viewBox={`-60 -8 ${WIDTH + 8} 118`} role="img" aria-label="Quakeline">
      <defs>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse">
          <rect className="pen-mask" x={-60} y={-20} width={WIDTH + 80} height={140} fill="#fff" />
        </mask>
      </defs>
      <g mask={`url(#${id}-mask)`} fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="square" strokeLinejoin="miter">
        {trace && <path d="M-60 50h18l4-14 5 28 4-20 3 10 4-4h12" strokeWidth="3" />}
        {LAYOUT.map((l) => (
          <path key={`${l.ch}${l.x}`} d={l.d} transform={`translate(${l.x} 0)`} />
        ))}
      </g>
    </svg>
  )
})
