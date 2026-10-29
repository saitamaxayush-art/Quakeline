import { useEffect, useRef } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from '../lib/scroll'
import type { Period } from '../lib/types'
import type { FeedError } from '../lib/api'
import { PEN_W, Wordmark } from './Wordmark'

interface Props {
  count: number
  period: Period
  loading: boolean
  error: FeedError | null
  /** Set when the visitor already chose "follow" on an earlier visit: no question, just the title. */
  auto: boolean
  onFollow: () => void
  onSkip: () => void
  onRetry: () => void
  onDone: () => void
  playing: boolean
}

export default function Gate({ count, period, loading, error, auto, onFollow, onSkip, onRetry, onDone, playing }: Props) {
  const root = useRef<HTMLDivElement>(null)
  const firstBtn = useRef<HTMLButtonElement>(null)
  const ready = !loading && !error

  useEffect(() => {
    if (!auto) firstBtn.current?.focus({ preventScroll: true })
  }, [auto, ready])

  useGSAP(
    () => {
      if (!playing) return
      const tl = gsap.timeline({ onComplete: onDone })
      tl.to('.gate-copy', { autoAlpha: 0, y: -16, duration: auto ? 0.01 : 0.35, ease: 'power2.in' })
        .fromTo('.wipe-stroke', { scaleX: 0 }, { scaleX: 1, duration: 0.75, ease: 'expo.inOut', transformOrigin: '0% 50%' })
        .set(root.current, { backgroundColor: 'transparent' })
        .fromTo('.gate-mark', { autoAlpha: 1 }, { autoAlpha: 1, duration: 0.01 })
        .fromTo('.gate-mark .pen-mask', { x: -PEN_W }, { x: 0, duration: 1.35, ease: 'power1.inOut' })
        .to({}, { duration: 0.35 })
        .to('.gate-mark', { autoAlpha: 0, duration: 0.3 }, 'out')
        .to('.wipe-stroke', { scaleX: 0, duration: 0.8, ease: 'expo.inOut', transformOrigin: '100% 50%' }, 'out')
    },
    { scope: root, dependencies: [playing] },
  )

  const span = period === 'day' ? 'in the past 24 hours' : 'in the past 7 days'

  return (
    <div ref={root} className="gate" role="dialog" aria-modal="true" aria-labelledby="gate-q">
      <div className="gate-copy">
        <p className="gate-top">
          <span>Quakeline</span>
          <span>USGS live feed</span>
        </p>
        {error ? (
          <>
            <h1 id="gate-q" className="gate-q">
              The USGS feed did not answer.
            </h1>
            <p className="gate-err">{error.message}</p>
            <div className="gate-btns">
              <button ref={firstBtn} className="gate-btn" onClick={onRetry}>
                Try again
              </button>
              <button className="gate-btn" onClick={onSkip}>
                Skip to data
              </button>
            </div>
          </>
        ) : (
          <>
            <h1 id="gate-q" className="gate-q is-count" aria-live="polite">
              The ground moved{' '}
              {ready ? (
                <span className="gate-n">{count.toLocaleString('en')}</span>
              ) : (
                <span className="gate-wait" aria-label="a number still loading from the feed" />
              )}{' '}
              times {span}.
            </h1>
            <div className="gate-btns">
              <button ref={firstBtn} className="gate-btn" onClick={onFollow} disabled={!ready || auto}>
                Follow one
              </button>
              <button className="gate-btn" onClick={onSkip}>
                Skip to data
              </button>
            </div>
          </>
        )}
        <p className="gate-foot">
          {error ? 'Source: earthquake.usgs.gov' : ready ? 'Every number in this story comes from the live USGS feed.' : 'Reading earthquake.usgs.gov'}
        </p>
      </div>

      <svg className="wipe" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <g className="wipe-stroke">
          <rect x="-160" y="-140" width="1920" height="1180" fill="var(--paper)" filter="url(#brush-edge)" />
        </g>
      </svg>
      <Wordmark id="gate" className="gate-mark" />
    </div>
  )
}
