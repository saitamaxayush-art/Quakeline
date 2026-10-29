import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { EASE } from '../../lib/motion'
import { depthLabel, km, mag, nf, shortAgo, titleCase } from '../../lib/format'
import { magClass } from '../../lib/scales'
import { range, smooth } from '../../components/globe/frame'
import { Caption, readCaption } from '../Caption'
import { Chapter, chapterTimeline, spanWords, type StoryData } from './shared'
import { sceneP } from '../stage'

const utcClock = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })

export default function Published({ hero, quakes, period, generated, now }: StoryData) {
  const ref = useRef<HTMLElement>(null)
  const c1 = useRef<HTMLDivElement>(null)
  const count = useRef<HTMLElement>(null)
  const [morphed, setMorphed] = useState(false)
  const morphRef = useRef(false)
  const navigate = useNavigate()
  const total = quakes.length
  const eventHref = `/explore?${period === 'week' ? 'period=week&' : ''}event=${encodeURIComponent(hero.id)}`

  useGSAP(
    () => {
      const tl = chapterTimeline(ref.current, {
        onUpdate: (self) => {
          const m = sceneP(self.progress) > 0.22
          if (m !== morphRef.current) {
            morphRef.current = m
            setMorphed(m)
          }
          if (count.current) count.current.textContent = nf.format(Math.round(smooth(range(sceneP(self.progress), 0.2, 0.7)) * total))
        },
      })
      readCaption(tl, c1.current, 0.2, 1.2)
      tl.fromTo('.fill-count', { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.5 }, 2)
      tl.to(['.record-slot', '.fill-count'], { autoAlpha: 0, y: -30, duration: 0.6 }, 6.2)
      tl.fromTo('.poster', { yPercent: 120, rotate: 2 }, { yPercent: 0, rotate: 0, duration: 1.2, ease: 'power3.out' }, 6.4)
      tl.fromTo('.poster-line', { yPercent: 110 }, { yPercent: 0, duration: 0.6, stagger: 0.18, ease: 'power3.out' }, 7)
      tl.set({}, {}, 10)
    },
    { scope: ref, dependencies: [hero.id, total] },
  )

  const go = (to: string) => navigate(to, { viewTransition: true })

  return (
    <Chapter ref={ref} id="published">
      <div className="record-slot">
        {!morphed ? (
          <motion.div layoutId="hero-record" className="record-cap" transition={{ duration: 0.7, ease: EASE.out }}>
            <Caption ref={c1} segs={['Stations send their readings to the USGS. The event is', { hl: 'located and published.' }]} />
          </motion.div>
        ) : (
          <motion.button
            layoutId="hero-record"
            className="row record-row"
            onClick={() => go(eventHref)}
            transition={{ duration: 0.7, ease: EASE.out }}
            aria-label={`Open ${hero.place} in the explorer`}
          >
            <span className={`row-mag ${magClass(hero.mag)}`}>
              <strong>{mag(hero.mag)}</strong>
              <small>{hero.magType ?? 'mag'}</small>
            </span>
            <span className="row-main">
              <span className="row-place">{hero.place}</span>
              <span className="row-meta">
                <span>{shortAgo(hero.time, now)} ago</span>
                <span aria-hidden="true">/</span>
                <span>
                  {km(hero.depth)} · {depthLabel(hero.depth)}
                </span>
                <span aria-hidden="true">/</span>
                <span>{titleCase(hero.status)}</span>
              </span>
            </span>
            <ArrowRight className="row-arrow" size={18} aria-hidden="true" />
          </motion.button>
        )}
      </div>

      <p className="fill-count">
        <b ref={count}>0</b> of {nf.format(total)} earthquakes {spanWords(period)}
      </p>

      <article className="poster" aria-labelledby="poster-title">
        <span className="pk pk-tl">
          <small>Feed generated</small>
          {generated ? `${utcClock.format(generated)} UTC` : 'Live'}
        </span>
        <span className="pk pk-tr">
          <small>Earthquakes</small>
          {nf.format(total)}, {period === 'day' ? 'past 24 h' : 'past 7 days'}
        </span>
        <h2 id="poster-title" className="poster-type">
          <span className="poster-mask">
            <span className="poster-line">The ground</span>
          </span>
          <span className="poster-mask">
            <span className="poster-line">is never</span>
          </span>
          <span className="poster-mask">
            <span className="poster-line">still.</span>
          </span>
        </h2>
        <svg className="poster-trace" viewBox="0 0 400 30" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 15H170l5-9 6 20 5-26 6 28 5-18 5 9 4-4H400" fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <button className="poster-btn" onClick={() => go('/explore')}>
          Open the explorer
          <ArrowRight size={18} aria-hidden="true" />
        </button>
        <span className="pk pk-bl">
          <small>Strongest</small>M{mag(hero.mag)}, {hero.region}
        </span>
        <span className="pk pk-br">
          <small>Source</small>USGS, earthquake.usgs.gov
        </span>
      </article>
    </Chapter>
  )
}
