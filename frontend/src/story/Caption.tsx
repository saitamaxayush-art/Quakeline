import { forwardRef, Fragment, type ReactNode } from 'react'
type Timeline = ReturnType<typeof import('gsap').gsap.timeline>

/** Plain text, or { hl } for a live value that turns seismograph red as it is read. */
export type Seg = string | { hl: string }

function words(segs: Seg[]) {
  const out: ReactNode[] = []
  let k = 0
  segs.forEach((s, si) => {
    if (si > 0) out.push(<Fragment key={k++}> </Fragment>)
    const hl = typeof s !== 'string'
    const text = hl ? s.hl : s
    text
      .split(/(\s+)/)
      .filter(Boolean)
      .forEach((w) => {
        if (/^\s+$/.test(w)) {
          out.push(<Fragment key={k++}> </Fragment>)
          return
        }
        out.push(
          <span key={k++} className={`w ${hl ? 'is-hl' : ''}`}>
            <span className="w-base">{w}</span>
            {hl && (
              <span className="w-red" aria-hidden="true">
                {w}
              </span>
            )}
          </span>,
        )
      })
  })
  return out
}

export const Caption = forwardRef<HTMLDivElement, { segs: Seg[]; label?: string; note?: ReactNode; className?: string }>(
  function Caption({ segs, label, note, className = '' }, ref) {
    return (
      <div ref={ref} className={`caption ${className}`}>
        {label && <span className="caption-label">{label}</span>}
        <p>{words(segs)}</p>
        {note && <small className="caption-note">{note}</small>}
      </div>
    )
  },
)

/**
 * Adds a caption's entrance and its highlight to a scrubbed timeline. Every word is at full
 * contrast from the moment the box is readable; the live values then turn red word by word.
 */
export function readCaption(tl: Timeline, el: Element | null, at: number, len = 1.6) {
  if (!el) return
  const red = el.querySelectorAll('.w-red')
  tl.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power3.out' }, at)
  if (red.length) tl.fromTo(red, { opacity: 0 }, { opacity: 1, duration: 0.25, stagger: Math.min(0.3, len / red.length) }, at + 0.5)
}

export function hideCaption(tl: Timeline, el: Element | null, at: number) {
  if (!el) return
  tl.to(el, { autoAlpha: 0, y: -20, duration: 0.5, ease: 'power2.in' }, at)
}
